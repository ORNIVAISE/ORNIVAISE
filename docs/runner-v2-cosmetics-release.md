# SIGNAL RUNNER V2 — comprehensive cosmetic pass (2026-10-22)

## Implemented in feature/signal-runner-v2
- 12 new cosmetic SKUs: 4 planets, 4 backgrounds, 4 obstacle families.
- Rare, epic, legendary and void shop filters; bilingual RU/EN labels.
- Animated previews for original and new legendary collections, with eruption, aurora, celestial, acid, space and storm visual signatures.
- New *Canvas* world scenes (not just store artwork): volcanic eruption with magma and ash, aurora pillars, floating celestial ruins, underwater creatures. Existing crimson rift enhanced.
- New planet Canvas art (magma sovereign, astral leviathan, storm seraph and glacier revenant), planet-specific trails and ambient particles.
- New obstacle Canvas art (ice spines, lava obelisks, storm sentinels, astral serpents), preserving existing collision shapes/timing.
- Background cards expose separate **equip for run** and **apply to profile** actions after ownership is confirmed server-side.
- Profile has its own scene preview, owned-background swatches and a shortcut to shop backgrounds.
- In URL query `?v2preview=1`, all unreleased new items have DISABLED purchase buttons marked “СКОРО / COMING SOON”; there is no client-side fake payment.
- Respects CSS `prefers-reduced-motion` for decorative animations.

## Economy and release order
- The 12 SKUs have been inserted into Supabase with **active=false**. Existing 23 items remain active.
- **DO NOT run** `docs/sql/runner-v2-cosmetics-activate.sql` until the new site is published and verified.
- After activating: 14 avatars, 10 backgrounds, 11 obstacles, 35 items total.
- Backgrounds use the same validated `profile_background` server action as existing owned backgrounds; no separate charge.
- The server determines prices, inventory and ownership, not the frontend.

## Tests completed
- JavaScript parses in all four inline blocks; no duplicated HTML IDs.
- New IDs all have rarity, Russian and English metadata, matching staged SQL.
- Canvas spectacle runtime smoke: six worlds at four distances; nine avatar variants at three distances (0 failures).
- Product stage was tested under SQL ROLLBACK, then applied: 12 inactive, zero new active.

## Required before public rollout
- Rendered browser checks on iPhone, Android, tablet, desktop for landscape/portrait, small store cards and the full profile.
- Test actual checkout and profile-background persistence using isolated test players when the catalog is activated.
- Test mobile frame rate on a lower-end device and the reduced-motion setting.
- Verify all game physics, boss events, portals, 2-device connection, leaderboard and reward/achievement flows.
- Re-run security and performance advisors; publish `main` only when all checks pass.
