-- SIGNAL RUNNER V2 server hardening proposal.
-- NOT DEPLOYED. Apply and test on an isolated Supabase database before updating
-- the Edge Function. The Edge Function depends on both RPCs in this file.

-- Retire any duplicate active runs without awarding score or credits. Keep the
-- newest run for each player, then prevent duplicates at the database level.
WITH ranked_active_runs AS (
  SELECT id,
         row_number() OVER (PARTITION BY player_id ORDER BY started_at DESC, id DESC) AS run_rank
  FROM public.runner_runs
  WHERE finished_at IS NULL
)
UPDATE public.runner_runs AS run
SET finished_at = clock_timestamp(),
    distance = 0,
    signals = 0,
    credits_awarded = 0
FROM ranked_active_runs AS ranked
WHERE run.id = ranked.id
  AND ranked.run_rank > 1;

CREATE UNIQUE INDEX IF NOT EXISTS runner_runs_one_active_per_player_idx
  ON public.runner_runs(player_id)
  WHERE finished_at IS NULL;

CREATE OR REPLACE FUNCTION public.start_runner_run_atomic(p_player_id uuid)
RETURNS TABLE(id uuid, started_at timestamptz)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  PERFORM 1
  FROM public.runner_players
  WHERE runner_players.id = p_player_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'player_not_found';
  END IF;

  -- The player-row lock serializes starts from linked devices. The partial
  -- unique index is a second guard if another code path inserts a run.
  UPDATE public.runner_runs
  SET finished_at = clock_timestamp(),
      distance = 0,
      signals = 0,
      credits_awarded = 0
  WHERE player_id = p_player_id
    AND finished_at IS NULL;

  RETURN QUERY
  INSERT INTO public.runner_runs(player_id)
  VALUES (p_player_id)
  RETURNING runner_runs.id, runner_runs.started_at;
END;
$function$;

REVOKE ALL ON FUNCTION public.start_runner_run_atomic(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.start_runner_run_atomic(uuid) TO service_role;

-- Store only keyed hashes for player tokens and forwarded IPs. No raw token or
-- IP address is written to this table. Service access is only through the
-- server-side Edge Function; RLS is enabled as defense in depth.
CREATE TABLE IF NOT EXISTS public.runner_request_limits (
  key_hash text NOT NULL CHECK (key_hash ~ '^[a-f0-9]{64}$'),
  bucket text NOT NULL CHECK (bucket ~ '^(ip|token)_(state|start_run|finish_run|buy|equip|profile_background|create_link|redeem_link|new_player)$'),
  window_started_at timestamptz NOT NULL,
  request_count integer NOT NULL DEFAULT 0 CHECK (request_count >= 0),
  last_request_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY (key_hash, bucket)
);

ALTER TABLE public.runner_request_limits ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.runner_request_limits FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.runner_request_limits TO service_role;
CREATE INDEX IF NOT EXISTS runner_request_limits_updated_at_idx
  ON public.runner_request_limits(updated_at);

CREATE OR REPLACE FUNCTION public.runner_rate_check_one(
  p_key_hash text,
  p_bucket text,
  p_limit integer,
  p_window_seconds integer,
  p_min_interval_ms integer DEFAULT 0
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_now timestamptz := clock_timestamp();
  v_started timestamptz;
  v_count integer;
  v_last_request timestamptz;
BEGIN
  IF p_key_hash !~ '^[a-f0-9]{64}$'
     OR p_bucket !~ '^(ip|token)_(state|start_run|finish_run|buy|equip|profile_background|create_link|redeem_link|new_player)$'
     OR p_limit < 1
     OR p_window_seconds < 1
     OR p_min_interval_ms < 0 THEN
    RAISE EXCEPTION 'invalid_rate_limit_parameters';
  END IF;

  INSERT INTO public.runner_request_limits(
    key_hash, bucket, window_started_at, request_count, last_request_at, updated_at
  )
  VALUES (p_key_hash, p_bucket, v_now, 0, NULL, v_now)
  ON CONFLICT (key_hash, bucket) DO NOTHING;

  SELECT window_started_at, request_count, last_request_at
  INTO v_started, v_count, v_last_request
  FROM public.runner_request_limits
  WHERE key_hash = p_key_hash AND bucket = p_bucket
  FOR UPDATE;

  IF v_started <= v_now - make_interval(secs => p_window_seconds) THEN
    v_started := v_now;
    v_count := 0;
    v_last_request := NULL;
  END IF;

  IF v_count >= p_limit THEN
    RETURN false;
  END IF;

  IF p_min_interval_ms > 0
     AND v_last_request IS NOT NULL
     AND v_last_request > v_now - make_interval(secs => p_min_interval_ms / 1000.0) THEN
    RETURN false;
  END IF;

  UPDATE public.runner_request_limits
  SET window_started_at = v_started,
      request_count = v_count + 1,
      last_request_at = v_now,
      updated_at = v_now
  WHERE key_hash = p_key_hash AND bucket = p_bucket;

  -- Opportunistic retention cleanup avoids keeping inactive hashed identifiers.
  IF random() < 0.02 THEN
    DELETE FROM public.runner_request_limits
    WHERE updated_at < v_now - interval '24 hours';
  END IF;

  RETURN true;
END;
$function$;

REVOKE ALL ON FUNCTION public.runner_rate_check_one(text,text,integer,integer,integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.runner_rate_check_one(text,text,integer,integer,integer) TO service_role;

CREATE OR REPLACE FUNCTION public.runner_allow_request_atomic(
  p_token_hash text,
  p_ip_hash text,
  p_action text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_token_limit integer;
  v_token_window integer;
  v_token_gap integer := 0;
  v_ip_limit integer;
  v_ip_window integer;
BEGIN
  IF p_token_hash !~ '^[a-f0-9]{64}$'
     OR (p_ip_hash IS NOT NULL AND p_ip_hash !~ '^[a-f0-9]{64}$')
     OR p_action NOT IN ('state','start_run','finish_run','buy','equip','profile_background','create_link','redeem_link','new_player') THEN
    RAISE EXCEPTION 'invalid_rate_limit_parameters';
  END IF;

  IF p_action = 'new_player' THEN
    v_token_limit := 1; v_token_window := 3600;
    v_ip_limit := 20; v_ip_window := 3600;
  ELSIF p_action = 'state' THEN
    v_token_limit := 35; v_token_window := 10;
    v_ip_limit := 120; v_ip_window := 60;
  ELSIF p_action = 'start_run' THEN
    v_token_limit := 10; v_token_window := 60; v_token_gap := 1800;
    v_ip_limit := 30; v_ip_window := 60;
  ELSIF p_action = 'redeem_link' THEN
    v_token_limit := 8; v_token_window := 10;
    v_ip_limit := 20; v_ip_window := 60;
  ELSE
    v_token_limit := 18; v_token_window := 10;
    v_ip_limit := 60; v_ip_window := 60;
  END IF;

  -- Check the IP bucket first so rotating tokens cannot bypass its shared cap.
  IF p_ip_hash IS NOT NULL
     AND NOT public.runner_rate_check_one(
       p_ip_hash, 'ip_' || p_action, v_ip_limit, v_ip_window, 0
     ) THEN
    RETURN false;
  END IF;

  RETURN public.runner_rate_check_one(
    p_token_hash, 'token_' || p_action,
    v_token_limit, v_token_window, v_token_gap
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.runner_allow_request_atomic(text,text,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.runner_allow_request_atomic(text,text,text) TO service_role;

-- Staging acceptance checklist:
-- 1. Two simultaneous starts for one player return distinct IDs but leave
--    exactly one unfinished run; only the returned active run can be finished.
-- 2. Concurrent finishes of one run award credits and score once.
-- 3. Repeated calls from one token and from many tokens at one IP hit limits.
-- 4. New-player limit is shared across Edge instances for the forwarded IP.
-- 5. Confirm Supabase supplies a trusted x-forwarded-for header to this Edge
--    Function before relying on the IP bucket in production.
-- 6. Verify clients receive only allowlisted errors and Cache-Control: no-store.
-- 7. Compare distance/signal ceilings against real runs at low and capped speed.
--    The ceilings are stricter plausibility checks, not complete replay-based
--    anti-cheat; a client can still fabricate a physically plausible run.
