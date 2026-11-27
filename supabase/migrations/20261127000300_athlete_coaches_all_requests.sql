-- MOV-293: all owned private request statuses contribute a coach contact.
-- Requested times are not sessions; existing connection consent stays unchanged.
CREATE OR REPLACE FUNCTION app.current_athlete_coaches(
  requested_filter text, requested_limit integer,
  before_at timestamptz DEFAULT NULL, before_key text DEFAULT NULL
) RETURNS TABLE(projection jsonb)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE actor uuid; dataset uuid; reference_time timestamptz := statement_timestamp();
  previous_group text := coalesce(current_setting('app.group_session_management',true),'');
BEGIN
  IF NOT app.authorized_actor_context_valid(NULL,NULL,NULL) THEN
    RAISE EXCEPTION 'coach roster forbidden' USING errcode='42501';
  END IF;
  IF requested_filter IS NULL OR requested_filter NOT IN ('all','connected','unconnected')
    OR requested_limit IS NULL OR requested_limit NOT BETWEEN 1 AND 51
    OR (before_at IS NULL) <> (before_key IS NULL)
    OR (before_key IS NOT NULL AND before_key !~ '^p:[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$') THEN
    RAISE EXCEPTION 'coach roster page invalid' USING errcode='22023';
  END IF;
  actor := current_setting('app.current_profile_id')::uuid;
  dataset := current_setting('app.current_run_id')::uuid;
  PERFORM app.connection_access_flags(true);
  PERFORM set_config('app.group_session_management','on',true);
  RETURN QUERY
  WITH bookings AS MATERIALIZED (
    SELECT b.id,b.coach_profile_id,b.scheduled_start_at AS starts_at,b.created_at
    FROM app.coach_private_bookings b
    WHERE b.run_id=dataset AND b.client_profile_id=actor
      AND b.coach_profile_id<>actor AND b.credit_projection_id IS NULL
      AND b.status IN ('confirmed','completed')
  ), requests AS MATERIALIZED (
    SELECT r.coach_profile_id,r.created_at FROM app.coach_booking_requests r
    WHERE r.run_id=dataset AND r.client_profile_id=actor AND r.coach_profile_id<>actor
  ), groups AS MATERIALIZED (
    SELECT s.coach_profile_id,s.starts_at,r.created_at
    FROM app.coach_group_registrations r
    JOIN app.coach_group_sessions s ON s.run_id=r.run_id AND s.id=r.session_id
    WHERE r.run_id=dataset AND r.athlete_profile_id=actor
      AND r.status='active' AND r.decision='approved' AND s.coach_profile_id<>actor
      AND (s.status='confirmed' OR (s.status='open' AND s.decision_deadline_at>reference_time))
  ), sessions AS (
    SELECT b.coach_profile_id,b.starts_at,b.created_at FROM bookings b
    UNION ALL SELECT g.coach_profile_id,g.starts_at,g.created_at FROM groups g
  ), pairs AS MATERIALIZED (
    SELECT p.* FROM app.coach_athlete_connection_pairs p
    WHERE p.run_id=dataset AND p.athlete_profile_id=actor
  ), people AS (
    SELECT s.coach_profile_id AS id FROM sessions s
    UNION SELECT p.coach_profile_id FROM pairs p
    UNION SELECT r.coach_profile_id FROM requests r
  ), rows AS (
    SELECT 'p:'||person.id::text AS key,person.id AS profile_id,c.display_name AS name,
      dates.last_at,dates.next_at,
      coalesce(dates.last_at,greatest(person.created_at,dates.created_at,a.created_at,pair.created_at,request_dates.created_at)) AS sort_at,
      b.id AS booking_id,app.connection_attempt_projection(a.id) AS connection,
      coalesce(a.status NOT IN ('pending','accepted'),true) AND b.id IS NOT NULL
        AND app.connection_pair_eligible(jsonb_populate_record(NULL::app.coach_athlete_connection_pairs,
          jsonb_build_object('run_id',dataset,'coach_profile_id',person.id,'athlete_profile_id',actor))) AS can_send,
      CASE WHEN a.status='accepted' THEN 'connected'
        WHEN a.status='pending' THEN 'pending' ELSE 'unconnected' END AS status,
      c.public_slug,
      c.visibility='visible' AND (c.is_demo OR application.status='approved')
        AND app.coach_has_publishable_primary_location(c.run_id,c.profile_id) AS coach_public,
      c.portrait_source,c.portrait_path,c.portrait_updated_at
    FROM people entry JOIN app.profiles person ON person.id=entry.id
    JOIN app.coach_profiles c ON c.run_id=dataset AND c.profile_id=person.id
    LEFT JOIN app.coach_applications application ON application.profile_id=person.id
    LEFT JOIN pairs pair ON pair.coach_profile_id=person.id
    LEFT JOIN LATERAL (
      SELECT attempt.* FROM app.coach_athlete_connection_attempts attempt
      WHERE attempt.pair_id=pair.id ORDER BY attempt.attempt_number DESC LIMIT 1
    ) a ON true
    LEFT JOIN LATERAL (
      SELECT max(s.starts_at) FILTER (WHERE s.starts_at<=reference_time) AS last_at,
        min(s.starts_at) FILTER (WHERE s.starts_at>reference_time) AS next_at,max(s.created_at) AS created_at
      FROM sessions s WHERE s.coach_profile_id=person.id
    ) dates ON true
    LEFT JOIN LATERAL (
      SELECT max(r.created_at) AS created_at FROM requests r WHERE r.coach_profile_id=person.id
    ) request_dates ON true
    LEFT JOIN LATERAL (
      SELECT x.id FROM bookings x WHERE x.coach_profile_id=person.id
      ORDER BY x.starts_at DESC,x.id DESC LIMIT 1
    ) b ON true
  )
  SELECT jsonb_build_object('key',r.key,'profileId',r.profile_id,'name',r.name,'status',r.status,
    'lastSessionAt',r.last_at,'nextSessionAt',r.next_at,'sortAt',r.sort_at,
    'bookingId',r.booking_id,'connection',r.connection,'canSend',r.can_send,
    'coachPublic',coalesce(r.coach_public,false),'coachSlug',CASE WHEN r.coach_public THEN r.public_slug END,
    'coachPortrait',CASE WHEN r.coach_public THEN jsonb_build_object('source',r.portrait_source,
      'path',r.portrait_path,'updatedAt',r.portrait_updated_at) END)
  FROM rows r
  WHERE (requested_filter='all' OR r.status=requested_filter
      OR (requested_filter='unconnected' AND r.status='pending'))
    AND (before_at IS NULL OR (r.sort_at,r.key)<(before_at,before_key))
  ORDER BY r.sort_at DESC,r.key DESC LIMIT requested_limit;
  PERFORM set_config('app.group_session_management',previous_group,true);
  PERFORM app.connection_access_flags(false);
EXCEPTION WHEN OTHERS THEN
  PERFORM set_config('app.group_session_management',previous_group,true);
  PERFORM app.connection_access_flags(false); RAISE;
END;
$$;
ALTER FUNCTION app.current_athlete_coaches(text,integer,timestamptz,text) OWNER TO app_owner;
REVOKE ALL ON FUNCTION app.current_athlete_coaches(text,integer,timestamptz,text)
  FROM PUBLIC,anon,authenticated,service_role,app_notification_worker,app_media_worker;
GRANT EXECUTE ON FUNCTION app.current_athlete_coaches(text,integer,timestamptz,text) TO app_runtime;
