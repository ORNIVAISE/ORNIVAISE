-- RELEASE GATE: run only AFTER the V2 index.html is live and verified.
-- New item visuals depend on V2 CSS and Canvas branches.
-- Existing credit balances, inventory and selections are unchanged.
BEGIN;
UPDATE public.runner_shop_items SET active=true
WHERE active=false AND item_id IN (
  'glacier_revenant',
  'storm_seraph',
  'magma_sovereign',
  'astral_leviathan',
  'abyssal_ocean',
  'aurora_sanctum',
  'volcanic_cataclysm',
  'celestial_temple',
  'frost_spines',
  'inferno_obelisks',
  'thunder_sentinels',
  'rift_serpents'
);
COMMIT;
-- To hide the new items if rollout fails, UPDATE active=false for this list.
-- Previously purchased items remain in runner_inventory even when inactive.
