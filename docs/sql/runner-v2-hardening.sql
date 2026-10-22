-- SIGNAL RUNNER V2: consolidated atomic economy + device linking.
-- Supersedes docs/sql/runner-buy-atomic-proposed.sql and
-- docs/sql/runner-device-link-atomic-proposed.sql.
-- Staging-tested inside ROLLBACK transactions on 2026-10-22;
-- deploying to production requires running this entire file first,
-- followed by supabase/functions/runner-store/index.ts.
-- Uses SECURITY INVOKER. Both RPCs must be callable only by service_role.

CREATE OR REPLACE FUNCTION public.buy_runner_item(p_player_id uuid, p_item_id text)
RETURNS jsonb
LANGUAGE plpgsql
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_price integer;
  v_credits integer;
BEGIN
  SELECT price INTO v_price
  FROM public.runner_shop_items
  WHERE item_id = p_item_id AND active = true;

  IF v_price IS NULL THEN RAISE EXCEPTION 'item_not_found'; END IF;

  -- Serialize all paid purchases for a player BEFORE checking inventory.
  SELECT credits INTO v_credits
  FROM public.runner_players
  WHERE id = p_player_id
  FOR UPDATE;
  IF v_credits IS NULL THEN RAISE EXCEPTION 'player_not_found'; END IF;

  IF v_price = 0 OR EXISTS (
    SELECT 1 FROM public.runner_inventory
    WHERE player_id = p_player_id AND item_id = p_item_id
  ) THEN
    RETURN jsonb_build_object(
      'ok', true, 'already_owned', true, 'credits', v_credits
    );
  END IF;

  IF v_credits < v_price THEN RAISE EXCEPTION 'not_enough_credits'; END IF;

  UPDATE public.runner_players
  SET credits = credits - v_price, updated_at = now()
  WHERE id = p_player_id
  RETURNING credits INTO v_credits;

  INSERT INTO public.runner_inventory(player_id, item_id)
  VALUES (p_player_id, p_item_id);

  RETURN jsonb_build_object(
    'ok', true, 'already_owned', false,
    'credits', v_credits, 'item_id', p_item_id
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.buy_runner_item(uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.buy_runner_item(uuid,text) TO service_role;

CREATE OR REPLACE FUNCTION public.redeem_runner_link_atomic(
  p_code_hash text,
  p_device_hash text
)
RETURNS jsonb
LANGUAGE plpgsql
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_target uuid;
  v_current uuid;
  v_runs integer;
  v_credits integer;
  v_name text;
  v_total_signals integer;
  v_total_distance bigint;
  v_best_distance integer;
  v_owner boolean;
  v_avatar text;
  v_background text;
  v_obstacle text;
  v_profile_bg text;
BEGIN
  IF p_code_hash !~ '^[a-f0-9]{64}$'
     OR p_device_hash !~ '^[a-f0-9]{64}$' THEN
    RAISE EXCEPTION 'invalid_link_code';
  END IF;

  -- Serialize requests for the same device even when its mapping row
  -- does not exist yet. This prevents competing valid codes from
  -- overwriting each other's newly created device mapping.
  PERFORM pg_advisory_xact_lock(hashtextextended(p_device_hash, 0));

  -- Lock the code. The second redeemer waits, then sees used_at.
  SELECT player_id INTO v_target
  FROM public.runner_device_link_codes
  WHERE code_hash = p_code_hash
    AND used_at IS NULL
    AND expires_at > clock_timestamp()
  FOR UPDATE;
  IF v_target IS NULL THEN RAISE EXCEPTION 'link_code_expired'; END IF;

  -- Lock the existing device row, if any, and inspect its current player.
  SELECT player_id INTO v_current
  FROM public.runner_player_devices
  WHERE device_hash = p_device_hash
  FOR UPDATE;

  -- Support legacy device identities that predate runner_player_devices.
  IF v_current IS NULL THEN
    SELECT id INTO v_current
    FROM public.runner_players WHERE token_hash = p_device_hash FOR UPDATE;
  END IF;

  IF v_current IS NOT NULL AND v_current <> v_target THEN
    SELECT runs_count, credits, display_name, total_signals, total_distance,
           best_distance, is_project_owner, selected_avatar,
           selected_background, selected_obstacle, selected_profile_background
    INTO v_runs, v_credits, v_name, v_total_signals, v_total_distance,
         v_best_distance, v_owner, v_avatar, v_background, v_obstacle,
         v_profile_bg
    FROM public.runner_players WHERE id = v_current FOR UPDATE;

    IF COALESCE(v_runs,0) > 0
       OR COALESCE(v_credits,0) > 0
       OR COALESCE(v_name,'') <> ''
       OR COALESCE(v_total_signals,0) > 0
       OR COALESCE(v_total_distance,0) > 0
       OR COALESCE(v_best_distance,0) > 0
       OR COALESCE(v_owner,false)
       OR COALESCE(v_avatar,'orbit_o') <> 'orbit_o'
       OR COALESCE(v_background,'deep_space') <> 'deep_space'
       OR COALESCE(v_obstacle,'signal_spires') <> 'signal_spires'
       OR COALESCE(v_profile_bg,'deep_space') <> 'deep_space'
       OR EXISTS (SELECT 1 FROM public.runner_name_registry WHERE player_id=v_current)
       OR EXISTS (SELECT 1 FROM public.runner_inventory WHERE player_id = v_current)
       OR EXISTS (SELECT 1 FROM public.runner_achievements WHERE player_id = v_current)
       OR EXISTS (SELECT 1 FROM public.runner_scores WHERE player_id = v_current)
       OR EXISTS (SELECT 1 FROM public.runner_runs WHERE player_id = v_current) THEN
      RAISE EXCEPTION 'device_has_progress';
    END IF;
  END IF;

  -- Ensure target exists; FK constraints provide additional protection.
  PERFORM 1 FROM public.runner_players WHERE id = v_target;
  IF NOT FOUND THEN RAISE EXCEPTION 'linked_player_missing'; END IF;

  INSERT INTO public.runner_player_devices(device_hash,player_id,last_seen_at)
  VALUES (p_device_hash,v_target,clock_timestamp())
  ON CONFLICT (device_hash) DO UPDATE
  SET player_id=excluded.player_id,last_seen_at=excluded.last_seen_at;

  UPDATE public.runner_device_link_codes
  SET used_at=clock_timestamp()
  WHERE code_hash=p_code_hash AND used_at IS NULL;

  IF NOT FOUND THEN RAISE EXCEPTION 'link_code_expired'; END IF;

  RETURN jsonb_build_object('ok',true,'linked',true,'player_id',v_target);
END;
$function$;

REVOKE ALL ON FUNCTION public.redeem_runner_link_atomic(text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.redeem_runner_link_atomic(text,text) TO service_role;
