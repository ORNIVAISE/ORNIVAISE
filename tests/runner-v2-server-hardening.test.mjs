import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const edge = readFileSync(new URL("../supabase/functions/runner-store/index.ts", import.meta.url), "utf8");
const sql = readFileSync(new URL("../docs/sql/runner-v2-server-hardening-proposed.sql", import.meta.url), "utf8");

assert.match(edge, /Cache-Control": "no-store"/);
assert.match(edge, /readJsonLimited\(req, 8192\)/);
assert.match(edge, /rpc\/runner_allow_request_atomic/);
assert.match(edge, /runner-ip-v1:/);
assert.match(edge, /rpc\/start_runner_run_atomic/);
assert.match(edge, /maxRunnerDistance\(elapsed\)/);
assert.match(edge, /\(300 \* 0\.18 \/ growth\)/);
assert.match(edge, /maxRunnerSignals\(elapsed, distance\)/);
assert.match(edge, /json\(\{ error: "server_error" \}, 500, origin\)/);
assert.match(edge, /const status = known\.get\(msg\)/);

assert.match(sql, /CREATE UNIQUE INDEX IF NOT EXISTS runner_runs_one_active_per_player_idx[\s\S]*?WHERE finished_at IS NULL/);
assert.match(sql, /CREATE OR REPLACE FUNCTION public\.start_runner_run_atomic/);
assert.match(sql, /FOR UPDATE/);
assert.match(sql, /CREATE TABLE IF NOT EXISTS public\.runner_request_limits/);
assert.match(sql, /ENABLE ROW LEVEL SECURITY/);
assert.match(sql, /CREATE OR REPLACE FUNCTION public\.runner_allow_request_atomic/);
assert.match(sql, /REVOKE ALL ON FUNCTION public\.runner_allow_request_atomic/);
assert.match(sql, /not complete replay-based[\s\S]*anti-cheat/i);

console.log("Runner V2 server hardening contracts passed.");
