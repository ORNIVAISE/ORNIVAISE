-- SIGNAL RUNNER V2: proposed fix, NOT deployed.
-- Apply only after testing on a separate Supabase project.
-- Preserve invoker privileges and existing EXECUTE grants (service_role only).
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

-- Privilege hardening for fresh installations (existing project already
-- grants EXECUTE to postgres and service_role only).
REVOKE ALL ON FUNCTION public.buy_runner_item(uuid,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.buy_runner_item(uuid,text) TO service_role;
