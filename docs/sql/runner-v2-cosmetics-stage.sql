-- SIGNAL RUNNER V2 cosmetic catalog: staged INACTIVE until release.
-- Deployed under migration runner_v2_cosmetic_items_inactive_20261022.
-- Idempotent: preserves any existing item and all player data.
INSERT INTO public.runner_shop_items(item_id,category,price,sort_order,active)
VALUES
  ('glacier_revenant','avatar',220,90,false),
  ('storm_seraph','avatar',520,100,false),
  ('magma_sovereign','avatar',1150,110,false),
  ('astral_leviathan','avatar',1350,120,false),
  ('abyssal_ocean','background',240,70,false),
  ('aurora_sanctum','background',620,80,false),
  ('volcanic_cataclysm','background',1250,90,false),
  ('celestial_temple','background',1450,100,false),
  ('frost_spines','obstacle',190,80,false),
  ('inferno_obelisks','obstacle',480,90,false),
  ('thunder_sentinels','obstacle',590,100,false),
  ('rift_serpents','obstacle',1180,110,false)
ON CONFLICT (item_id) DO NOTHING;
