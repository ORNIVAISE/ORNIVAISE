import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const ALLOWED_ORIGINS = new Set([
  "https://ornivaise.ru",
  "https://www.ornivaise.ru",
  "https://ornivaise.github.io"
]);

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const secretKeysRaw = Deno.env.get("SUPABASE_SECRET_KEYS");
let ADMIN_KEY = "";
if (secretKeysRaw) {
  try { ADMIN_KEY = JSON.parse(secretKeysRaw).default || ""; } catch (_) {}
}
if (!ADMIN_KEY) ADMIN_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

function cors(origin: string | null) {
  const allowed = origin && ALLOWED_ORIGINS.has(origin) ? origin : "https://ornivaise.ru";
  return {
    "Access-Control-Allow-Origin": allowed,
    "Access-Control-Allow-Headers": "content-type, apikey",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin"
  };
}

function json(body: unknown, status = 200, origin: string | null = null) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors(origin), "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" }
  });
}

function adminHeaders(extra: Record<string,string> = {}) {
  const h: Record<string,string> = { apikey: ADMIN_KEY, "Content-Type": "application/json", ...extra };
  if (ADMIN_KEY.startsWith("eyJ")) h.Authorization = "Bearer " + ADMIN_KEY;
  return h;
}

async function db(path: string, init: RequestInit = {}) {
  const res = await fetch(SUPABASE_URL + path, {
    ...init,
    headers: { ...adminHeaders(), ...(init.headers || {}) }
  });
  const text = await res.text();
  let data: any = null;
  try { data = text ? JSON.parse(text) : null; } catch (_) { data = text; }
  if (!res.ok) throw new Error(typeof data === "object" ? (data?.message || data?.error || "db_error") : String(data));
  return data;
}

async function sha256(value: string) {
  const bytes = new TextEncoder().encode(value);
  const hash = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2,"0")).join("");
}

async function keyedHash(value: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(ADMIN_KEY),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value));
  return Array.from(new Uint8Array(signature)).map(b => b.toString(16).padStart(2,"0")).join("");
}

function getForwardedClientIp(req: Request) {
  const first = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "";
  return /^[0-9a-f:.]{2,80}$/i.test(first) ? first : "";
}

async function allowPersistentRequest(tokenRateHash: string, ipRateHash: string | null, action: string) {
  const allowed = await db("/rest/v1/rpc/runner_allow_request_atomic", {
    method: "POST",
    body: JSON.stringify({
      p_token_hash: tokenRateHash,
      p_ip_hash: ipRateHash,
      p_action: action
    })
  });
  return allowed === true;
}

function maxRunnerDistance(elapsedSeconds: number) {
  // Mirrors distance growth in updateRunner: speed=300+0.072*distance,
  // distance advances by speed*dt*0.18, capped at 680 speed.
  const t = Math.max(0, elapsedSeconds);
  const growth = 0.072 * 0.18;
  const capDistance = (680 - 300) / 0.072;
  const capTime = Math.log(680 / 300) / growth;
  const physical = t <= capTime
    ? (300 / growth) * (Math.exp(growth * t) - 1)
    : capDistance + 680 * 0.18 * (t - capTime);
  // Small allowance covers animation-frame and request timing differences.
  return Math.floor(physical * 1.08 + 12);
}

function maxRunnerSignals(elapsedSeconds: number, distance: number) {
  // Coins appear in pairs at least 1.18s apart. Each pair tops out at 8
  // signals (a 7-value gold orb plus the normal orb); require enough time
  // and run distance for the pair to reach the player.
  if (elapsedSeconds < 4.1 || distance < 140) return 0;
  const wavesByTime = Math.floor((elapsedSeconds - 4.1) / 1.18) + 1;
  const wavesByDistance = Math.floor((distance - 140) / 65) + 1;
  return Math.min(wavesByTime, wavesByDistance) * 8;
}

function validToken(token: unknown): token is string {
  return typeof token === "string" && /^[a-f0-9]{64}$/i.test(token);
}

async function getPlayerById(playerId: string) {
  const rows = await db("/rest/v1/runner_players?id=eq." + encodeURIComponent(playerId) + "&select=*");
  return Array.isArray(rows) && rows.length ? rows[0] : null;
}

async function getPlayerByHash(tokenHash: string) {
  const devices = await db("/rest/v1/runner_player_devices?device_hash=eq." + encodeURIComponent(tokenHash) + "&select=player_id&limit=1");
  if (Array.isArray(devices) && devices[0]?.player_id) {
    return await getPlayerById(devices[0].player_id);
  }
  const legacy = await db("/rest/v1/runner_players?token_hash=eq." + encodeURIComponent(tokenHash) + "&select=*");
  const player = Array.isArray(legacy) && legacy.length ? legacy[0] : null;
  if (player) {
    try {
      await db("/rest/v1/runner_player_devices", {
        method: "POST",
        headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
        body: JSON.stringify({ device_hash: tokenHash, player_id: player.id, last_seen_at: new Date().toISOString() })
      });
    } catch (_) {}
  }
  return player;
}

async function ensurePlayer(token: string, tokenRateHash: string, ipRateHash: string | null) {
  const tokenHash = await sha256(token.toLowerCase());
  let player = await getPlayerByHash(tokenHash);
  if (player) {
    try {
      await db("/rest/v1/runner_player_devices?device_hash=eq." + encodeURIComponent(tokenHash), {
        method: "PATCH",
        headers: { Prefer: "return=minimal" },
        body: JSON.stringify({ last_seen_at: new Date().toISOString() })
      });
    } catch (_) {}
    return player;
  }
  if (!await allowPersistentRequest(tokenRateHash, ipRateHash, "new_player")) {
    throw new Error("rate_limited");
  }
  try {
    const rows = await db("/rest/v1/runner_players", {
      method: "POST",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify({ token_hash: tokenHash })
    });
    player = rows?.[0] || null;
    if (player) {
      await db("/rest/v1/runner_player_devices", {
        method: "POST",
        headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
        body: JSON.stringify({ device_hash: tokenHash, player_id: player.id })
      });
    }
  } catch (_) {
    player = await getPlayerByHash(tokenHash);
  }
  if (!player) throw new Error("player_init_failed");
  return player;
}

function randomLinkCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  return Array.from(bytes, b => alphabet[b % alphabet.length]).join("");
}

async function readJsonLimited(req: Request, maxBytes: number) {
  const reader = req.body?.getReader();
  if (!reader) return { ok: false as const, error: "invalid_json" };
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > maxBytes) {
      await reader.cancel();
      return { ok: false as const, error: "payload_too_large" };
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  try {
    return { ok: true as const, value: JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)) };
  } catch (_) {
    return { ok: false as const, error: "invalid_json" };
  }
}

async function getState(player: any) {
  const [inventory, items, achievements, devices] = await Promise.all([
    db("/rest/v1/runner_inventory?player_id=eq." + encodeURIComponent(player.id) + "&select=item_id"),
    db("/rest/v1/runner_shop_items?active=eq.true&select=item_id,category,price,sort_order&order=category.asc,sort_order.asc"),
    db("/rest/v1/runner_achievements?player_id=eq." + encodeURIComponent(player.id) + "&select=achievement_id,reward,unlocked_at&order=unlocked_at.asc"),
    db("/rest/v1/runner_player_devices?player_id=eq." + encodeURIComponent(player.id) + "&select=device_hash")
  ]);
  return {
    player: {
      credits: player.credits,
      selected_avatar: player.selected_avatar,
      selected_background: player.selected_background,
      selected_obstacle: player.selected_obstacle,
      selected_profile_background: player.selected_profile_background || "deep_space",
      display_name: player.display_name || "",
      runs_count: player.runs_count || 0,
      total_signals: player.total_signals || 0,
      total_distance: player.total_distance || 0,
      best_distance: player.best_distance || 0
    },
    achievements: achievements || [],
    linked_devices: Array.isArray(devices) ? devices.length : 1,
    inventory: (inventory || []).map((x:any) => x.item_id),
    items: items || []
  };
}


const ACTIONS = new Set(["state","start_run","finish_run","buy","equip","profile_background","create_link","redeem_link"]);
const tokenRate = new Map<string,{started:number,count:number,lastStart:number}>();
let globalStarted = Date.now();
let globalCount = 0;

function allowRequest(token:string, action:string){
  const now=Date.now();
  if(now-globalStarted>10000){globalStarted=now;globalCount=0}
  globalCount++;
  if(globalCount>300)return false;

  if(tokenRate.size>2000)tokenRate.clear();
  let row=tokenRate.get(token);
  if(!row||now-row.started>10000){row={started:now,count:0,lastStart:0}}
  row.count++;
  const limit=action==="state"?35:action==="redeem_link"?8:18;
  if(row.count>limit){tokenRate.set(token,row);return false}
  if(action==="start_run"){
    if(now-row.lastStart<1800){tokenRate.set(token,row);return false}
    row.lastStart=now;
  }
  tokenRate.set(token,row);
  return true;
}

Deno.serve(async (req) => {
  const origin = req.headers.get("origin");
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors(origin) });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405, origin);
  if (origin && !ALLOWED_ORIGINS.has(origin)) return json({ error: "origin_not_allowed" }, 403, origin);
  if (!ADMIN_KEY) return json({ error: "server_not_configured" }, 500, origin);
  const size = Number(req.headers.get("content-length") || "0");
  if (Number.isFinite(size) && size > 8192) return json({ error: "payload_too_large" }, 413, origin);
  const type = req.headers.get("content-type") || "";
  if (!type.toLowerCase().includes("application/json")) return json({ error: "unsupported_media_type" }, 415, origin);

  const parsedBody = await readJsonLimited(req, 8192);
  if (!parsedBody.ok) {
    const status = parsedBody.error === "payload_too_large" ? 413 : 400;
    return json({ error: parsedBody.error }, status, origin);
  }
  const body: any = parsedBody.value;

  const token = body?.token;
  if (!validToken(token)) return json({ error: "invalid_player_token" }, 400, origin);
  const action = String(body?.action || "state");
  if (!ACTIONS.has(action)) return json({ error: "unknown_action" }, 400, origin);
  if (!allowRequest(token,action)) return json({ error: "rate_limited" }, 429, origin);

  try {
    const tokenRateHash = await keyedHash("runner-token-v1:" + token.toLowerCase());
    const forwardedIp = getForwardedClientIp(req);
    const ipRateHash = forwardedIp ? await keyedHash("runner-ip-v1:" + forwardedIp) : null;
    if (!await allowPersistentRequest(tokenRateHash, ipRateHash, action)) {
      return json({ error: "rate_limited" }, 429, origin);
    }

    const player = await ensurePlayer(token, tokenRateHash, ipRateHash);

    if (action === "state") {
      return json({ ok: true, ...(await getState(player)) }, 200, origin);
    }

    if (action === "create_link") {
      await db("/rest/v1/runner_device_link_codes?player_id=eq." + encodeURIComponent(player.id) + "&used_at=is.null", {
        method: "DELETE",
        headers: { Prefer: "return=minimal" }
      });
      let linkCode = "";
      let saved = false;
      for (let attempt = 0; attempt < 3 && !saved; attempt++) {
        linkCode = randomLinkCode();
        const codeHash = await sha256(linkCode);
        try {
          await db("/rest/v1/runner_device_link_codes", {
            method: "POST",
            headers: { Prefer: "return=minimal" },
            body: JSON.stringify({
              code_hash: codeHash,
              player_id: player.id,
              expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString()
            })
          });
          saved = true;
        } catch (_) {}
      }
      if (!saved) throw new Error("link_code_failed");
      return json({ ok: true, link_code: linkCode, expires_in: 600 }, 200, origin);
    }

    if (action === "redeem_link") {
      const rawCode = String(body?.link_code || "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8);
      if (!/^[A-Z2-9]{8}$/.test(rawCode) || /[IO01]/.test(rawCode)) {
        return json({ error: "invalid_link_code" }, 400, origin);
      }
      const linked = await db("/rest/v1/rpc/redeem_runner_link_atomic", {
        method: "POST",
        body: JSON.stringify({
          p_code_hash: await sha256(rawCode),
          p_device_hash: await sha256(token.toLowerCase())
        })
      });
      const linkedPlayer = await getPlayerById(linked?.player_id);
      if (!linkedPlayer) throw new Error("linked_player_missing");
      return json({ ok: true, linked: true, ...(await getState(linkedPlayer)) }, 200, origin);
    }

    if (action === "start_run") {
      const rows = await db("/rest/v1/rpc/start_runner_run_atomic", {
        method: "POST",
        body: JSON.stringify({ p_player_id: player.id })
      });
      const run = rows?.[0];
      if (!run) throw new Error("run_start_failed");
      return json({ ok: true, run_id: run.id, started_at: run.started_at }, 200, origin);
    }

    if (action === "finish_run") {
      const runId = String(body?.run_id || "");
      const name = String(body?.player_name || "").trim().slice(0,20);
      const distance = Math.floor(Number(body?.distance) || 0);
      const signals = Math.floor(Number(body?.signals) || 0);
      if (!/^[0-9a-f-]{36}$/i.test(runId)) return json({ error: "invalid_run" }, 400, origin);

      const runs = await db("/rest/v1/runner_runs?id=eq." + encodeURIComponent(runId) +
        "&player_id=eq." + encodeURIComponent(player.id) + "&select=id,started_at,finished_at");
      const run = runs?.[0];
      if (!run || run.finished_at) return json({ error: "run_not_active" }, 409, origin);

      const startedAt = Date.parse(run.started_at);
      if (!Number.isFinite(startedAt) || startedAt > Date.now() + 30000) {
        return json({ error: "invalid_run_clock" }, 422, origin);
      }
      const elapsed = Math.max(0, (Date.now() - startedAt) / 1000);
      const maxDistance = maxRunnerDistance(elapsed);
      const maxSignals = maxRunnerSignals(elapsed, distance);
      if (distance < 0 || distance > maxDistance || signals < 0 || signals > maxSignals) {
        return json({ error: "run_validation_failed" }, 422, origin);
      }

      const result = await db("/rest/v1/rpc/finish_runner_run", {
        method: "POST",
        body: JSON.stringify({
          p_run_id: runId,
          p_player_id: player.id,
          p_name: name,
          p_distance: distance,
          p_signals: signals,
          p_max_distance: maxDistance,
          p_max_signals: maxSignals
        })
      });
      const refreshed = await getPlayerByHash(await sha256(token.toLowerCase()));
      return json({ ...(result || {}), ...(await getState(refreshed)) }, 200, origin);
    }

    if (action === "buy") {
      const itemId = String(body?.item_id || "");
      const result = await db("/rest/v1/rpc/buy_runner_item", {
        method: "POST",
        body: JSON.stringify({ p_player_id: player.id, p_item_id: itemId })
      });
      const refreshed = await getPlayerByHash(await sha256(token.toLowerCase()));
      return json({ ...result, ...(await getState(refreshed)) }, 200, origin);
    }

    if (action === "equip") {
      const itemId = String(body?.item_id || "");
      const result = await db("/rest/v1/rpc/equip_runner_item", {
        method: "POST",
        body: JSON.stringify({ p_player_id: player.id, p_item_id: itemId })
      });
      const refreshed = await getPlayerByHash(await sha256(token.toLowerCase()));
      return json({ ...result, ...(await getState(refreshed)) }, 200, origin);
    }

    if (action === "profile_background") {
      const itemId = String(body?.item_id || "");
      const shop = await db("/rest/v1/runner_shop_items?item_id=eq." + encodeURIComponent(itemId) +
        "&category=eq.background&active=eq.true&select=item_id,price&limit=1");
      const item = shop?.[0];
      if (!item) return json({ error: "invalid_profile_background" }, 400, origin);

      if (Number(item.price || 0) > 0) {
        const owned = await db("/rest/v1/runner_inventory?player_id=eq." + encodeURIComponent(player.id) +
          "&item_id=eq." + encodeURIComponent(itemId) + "&select=item_id&limit=1");
        if (!owned?.length) return json({ error: "item_not_owned" }, 409, origin);
      }

      await db("/rest/v1/runner_players?id=eq." + encodeURIComponent(player.id), {
        method: "PATCH",
        headers: { Prefer: "return=minimal" },
        body: JSON.stringify({ selected_profile_background: itemId, updated_at: new Date().toISOString() })
      });
      const refreshed = await getPlayerByHash(await sha256(token.toLowerCase()));
      return json({ ok: true, ...(await getState(refreshed)) }, 200, origin);
    }

    return json({ error: "unknown_action" }, 400, origin);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "";
    const known = new Map<string, number>([
      ["rate_limited", 429],
      ["not_enough_credits", 409],
      ["device_has_progress", 409],
      ["item_not_owned", 409],
      ["run_not_active", 409],
      ["name_taken", 409],
      ["reserved_name", 409],
      ["link_code_expired", 404],
      ["item_not_found", 400],
      ["invalid_name", 400],
      ["invalid_distance", 422],
      ["invalid_signals", 422]
    ]);
    const status = known.get(msg);
    return status
      ? json({ error: msg }, status, origin)
      : json({ error: "server_error" }, 500, origin);
  }
});
