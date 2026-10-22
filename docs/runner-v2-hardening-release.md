# SIGNAL RUNNER V2: consolidated hardening release
Date: 2026-10-22

## Files in this atomic Git commit
- `docs/sql/runner-v2-hardening.sql`: fixes serialized buys; atomic, one-use device-link redemption; checks all profile progress.
- `supabase/functions/runner-store/index.ts`: updated Edge Function to invoke device-link RPC, return accurate conflict/expiry statuses.
- `index.html`: RU/EN error handling, guarded profile-background changes, idempotent shop notification, no leaderboard failure masquerading as link failure.

## Deployment order (required)
1. Apply `docs/sql/runner-v2-hardening.sql` to Supabase.
2. Confirm both RPCs are executable only by `service_role`, not `anon`, `authenticated`, or `PUBLIC`.
3. Deploy `supabase/functions/runner-store/index.ts` with `verify_jwt=false` (retains existing secret token authentication).
4. Smoke-test `state`, purchase, equip, link, profile background, and run end in both RU and EN.
5. Browser-test desktop, iPhone, Android, and tablet before merging V2 into `main`.

## Completed smoke tests
- Four inline JavaScript blocks compile and no duplicate element IDs are present.
- Two database ROLLBACK dry-runs: idempotent purchase and atomic link cases (success, reused code, expired code, paid inventory preservation).
- The staging source keeps all existing Edge actions and secrets server-side (environment variables only).

## Remaining release gates
- Parallel purchases and link redemption from independent HTTP requests, not merely sequential SQL dry-runs.
- End-to-end browser and touch testing (portrait and landscape) plus visual screenshots.
- Verify no old client was cached, RLS and security advisors still clean, and production Edge deployed successfully.
- Confirm game credits, leaderboard, achievements, owned backgrounds, and records persist across devices.
- Do not merge `main` until these are green.
