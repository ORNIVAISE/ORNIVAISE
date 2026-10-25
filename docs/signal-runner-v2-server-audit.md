# SIGNAL RUNNER V2 — server transaction audit (2026-10-22)

Status: **review required before merging V2**. This document is a non-deployed audit; it does not change the live Supabase database.

## Verified

- Edge Function `runner-store` version 7 uses server-side RPCs for buy/equip/finish.
- `buy_runner_item` debits credits and inserts inventory within a single PostgreSQL transaction.
- `finish_runner_run` updates `runner_runs` with `finished_at is null` and raises `run_not_active` if no row changed, preventing the same run from being rewarded twice.
- `profile_background` checks that the item is an active background and owned (unless free).
- Edge Function uses a device token and server-side service key. Its `verify_jwt` setting is false, so the device token is the principal credential.
- Security Advisor reported no findings; RLS is enabled for all nine public runner tables.

## Finding SRV-01 — concurrent duplicate purchases

**Severity: medium/high depending on transaction concurrency.**

Current `buy_runner_item` checks `runner_inventory` **before** acquiring `FOR UPDATE` on `runner_players`. Two concurrent purchases from different devices can both pass the initial ownership check. The second waits for the player lock, then can debit credits even though the first inserted the item; its `INSERT ... ON CONFLICT DO NOTHING` would not restore the extra debit.

### Recommended fix (requires separate controlled deployment)

Inside the `buy_runner_item` database function:
1. Validate the item and price.
2. Lock the player's row using `SELECT credits ... FOR UPDATE`.
3. **After acquiring that lock**, check inventory ownership again (or move the existing inventory check below the lock).
4. Only if still unowned, validate credits, debit once, and insert the inventory row.
5. Keep the debit and insert in one transaction.

Do not rely on frontend button disabling for server-side idempotency.

### Verification plan

- On an isolated test player with sufficient credits, send two concurrent `buy` calls for the same paid item using two linked device tokens.
- Assert exactly one inventory record, exactly one price debit, and subsequent requests return `already_owned`.
- Test insufficient credits, free items, invalid IDs, and concurrent purchases of *different* items.
- Repeat on transient HTTP failures and retries; compare credits against server state.

## Finding SRV-02 — device-link atomicity

The `redeem_link` Edge Function currently performs separate REST calls to remap the device and mark the link code as used. These are not one database transaction. Concurrent redemptions and partial network failures need a dedicated atomic RPC or equivalent transaction.

### Verification plan

- Redeem the same code simultaneously on two clean devices; expect at most one success.
- Test expired codes, codes from another player, and a device with existing progress.
- Simulate a failure after device mapping but before code consumption and verify recovery behavior.

## Release gate

Do not deploy database changes or merge `feature/signal-runner-v2` until these cases have been tested. Avoid testing purchases on real player balances.


## Edge Function v8 integration plan (not deployed)

Current `runner-store` v7 redeems a link with multiple independent REST requests. After the atomic RPC is tested on staging, replace only its `redeem_link` action so that it:

1. Preserves the existing eight-character link-code validation.
2. Hashes the code and device token using the existing SHA-256 helper.
3. Sends both hashes to `/rest/v1/rpc/redeem_runner_link_atomic` in **one** POST.
4. Uses the returned player ID to load the linked player and existing `getState` response.
5. Preserves the other actions and their response shapes.

**Deployment dependency:** the Edge Function update must not precede the SQL RPC deployment. Test with two independent devices, simultaneous redemptions, expired codes, an already-used code, and a device with existing progress.

**Additional release blocker:** the proposed RPC currently mirrors the old progress check (runs, credits, display name). Before deployment, extend the check to inventory and other meaningful player records to avoid losing access to existing purchases.


## 2026-10-25 follow-up — proposed server hardening

This section records source changes prepared on `feature/signal-runner-v2`. The SQL and Edge Function are **not deployed**. The 2026-10-22 findings above describe the earlier deployed/source snapshot and remain historical.

### Changes prepared

- Start a run through a single database transaction. A player-row lock serializes linked-device starts, and a partial unique index permits only one active run per player.
- Apply durable request quotas using keyed hashes for device tokens and forwarded IPs. The database stores hashes, not raw values; the per-isolate limiter remains as a cheap first check.
- Limit JSON request bodies to 8 KiB while streaming, return `Cache-Control: no-store`, and map unexpected database/runtime errors to a generic client response.
- Check submitted run distance and collected signals against server-clock elapsed time and the current runner movement/collectible cadence before the existing atomic finish-and-award RPC.

### Required staging sequence

1. Apply `docs/sql/runner-v2-server-hardening-proposed.sql` to an isolated Supabase project with a disposable player. Do not apply it to production as part of this change.
2. Verify concurrent starts leave exactly one active run, then verify a finish can award only once.
3. Exercise request quotas across separate Edge instances, many tokens from one IP, and one token across multiple actions. Confirm the forwarded IP header is present and trusted before relying on its quota.
4. Compare run validation against real short, long, low-speed, capped-speed, and mobile-frame-rate play sessions. Tune limits if legitimate runs fail.
5. Deploy the matching Edge Function only after the SQL passes these checks. The public test page still uses its test/simulated flow and does not prove this backend integration.

### Remaining security limitation

Distance and signal ceilings reject implausible reports but do not prove a run was played. A client can still fabricate a physically plausible score. A deterministic server simulation or signed event/replay protocol is needed before treating leaderboard scores as cheat-proof. Public leaderboard field minimization is also outside this patch because it requires a coordinated API/client change.
