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
