-- PROPOSED ONLY: do not execute against production without staging tests.
-- Called by runner-store Edge Function after hashing the device token and link code.
-- This single transaction serializes concurrent redemptions of the same code.
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
BEGIN
  IF p_code_hash !~ '^[a-f0-9]{64}$'
     OR p_device_hash !~ '^[a-f0-9]{64}$' THEN
    RAISE EXCEPTION 'invalid_link_code';
  END IF;

  -- Lock the code first. The second redeemer waits, then sees used_at.
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

  IF v_current IS NOT NULL AND v_current <> v_target THEN
    SELECT runs_count, credits, display_name
    INTO v_runs, v_credits, v_name
    FROM public.runner_players WHERE id = v_current FOR UPDATE;

    IF COALESCE(v_runs,0) > 0
       OR COALESCE(v_credits,0) > 0
       OR COALESCE(v_name,'') <> '' THEN
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

-- Edge Function migration:
-- Replace its multi-step redeem_link REST updates with ONE POST
-- /rest/v1/rpc/redeem_runner_link_atomic
-- {p_code_hash: sha256(code), p_device_hash: sha256(token.toLowerCase())}
-- After successful RPC, read the linked player by returned player_id and getState.
-- Do NOT deploy the Edge Function before the RPC exists.
--
-- Staging acceptance:
-- (1) Two concurrent requests for the same code -> exactly one succeeds.
-- (2) Invalid/expired code -> no mapping changes.
-- (3) Device with progress -> 409 and code remains usable.
-- (4) Failure during RPC -> transaction rollback.
-- (5) Existing device mapping and a new device mapping both work.
--
-- Important: device progress check mirrors the existing Edge Function.
-- A stronger progress definition should additionally consider inventory and
-- other player records before production rollout.
