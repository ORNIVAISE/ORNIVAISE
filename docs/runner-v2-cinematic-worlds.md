# SIGNAL RUNNER V2 — cinematic backgrounds and real-time reflections

## Changed
- Four original world panoramas are loaded as same-origin SVG: lava, frost, signal storm and void rift.
- The selected purchased game background determines the asset, lighting and floor color; other worlds keep the existing procedural backgrounds.
- The running lane now includes glossy themed floor cracks, reflective rim lights and motion-responsive world glints.
- All onscreen objects are mirrored using a single reused offscreen canvas: **the actual planet and obstacles move in their reflections**. The mirror is clipped to the floor below the collision surface, faded toward the viewer and updated every other frame on narrow mobile screens.
- Four obstacle families now have distinct shapes: `orbital_debris` (molten sphere / shattered shard / burning ring / fragments), `frost_spines` (ice cluster / ridge / needle / fractured crystal), `thunder_sentinels` (electric tower / orbit ring / gate / sweeping blade), and `rift_serpents` (serpent / fractured cluster / void loop / tendrils).
- Meshes use each existing obstacle's `o.x/o.y/o.w/o.h` and existing variant/type. **Spawn distances, hitboxes, gravity, credits, leaderboard and persistence are unchanged.**
- Reduced-motion preferences keep the existing restrictions. On mobile the mirror-buffer refresh is throttled to every two frames; backdrop images load once and are reused.

## Limitations
These are in-game rendered approximations of the supplied cinematic mockups, not the original full mockup PNGs pasted into the game (those contain HUD and baked obstacles). Dynamic reflection makes the effects respond to the actual run; it is not a static screenshot.

## Release checks
- `node tests/runner-v2-cosmetics.test.mjs`
- `node tests/runner-v2-reflections.test.mjs`
- Browser screenshots at desktop and 375px, 390px, 768px widths with the four themes
- Performance on a lower-end Android device and on reduced-motion settings
- Confirm profile background/store overlays and the jump hitboxes have not shifted
- Keep `main` untouched until all are checked and 12 staged cosmetic items can be activated safely.
