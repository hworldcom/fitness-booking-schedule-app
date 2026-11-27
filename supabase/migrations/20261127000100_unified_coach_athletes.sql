-- MOV-288: one private roster row per registered person or unlinked contact.
-- Additive read only: no contact, booking, invitation or consent is rewritten.
CREATE OR REPLACE FUNCTION app.current_coach_athletes(
  requested_filter text, requested_limit integer,
  before_at timestamptz DEFAULT NULL, before_key text DEFAULT NULL
) RETURNS TABLE(projection jsonb)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE actor uuid; dataset uuid; reference_time timestamptz := statement_timestamp();
BEGIN
  IF NOT app.authorized_actor_context_valid(NULL, NULL, NULL) THEN
    RAISE EXCEPTION 'athlete roster forbidden' USING errcode = '42501';
  END IF;
  IF requested_filter IS NULL OR requested_filter NOT IN ('all','connected','unconnected','external')
    OR requested_limit IS NULL OR requested_limit NOT BETWEEN 1 AND 51
    OR (before_at IS NULL) <> (before_key IS NULL)
    OR (before_key IS NOT NULL AND before_key !~ '^[pe]:[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$') THEN
    RAISE EXCEPTION 'athlete roster page invalid' USING errcode = '22023';
  END IF;
  actor := current_setting('app.current_profile_id')::uuid;
  dataset := current_setting('app.current_run_id')::uuid;
  PERFORM app.connection_access_flags(true);
  IF NOT EXISTS (
    SELECT 1 FROM app.coach_profiles c
    LEFT JOIN app.coach_applications a ON a.profile_id = c.profile_id
    WHERE c.run_id = dataset AND c.profile_id = actor
      AND (c.is_demo OR a.status IN ('approved','suspended'))
  ) THEN RAISE EXCEPTION 'athlete roster forbidden' USING errcode = '42501'; END IF;

  RETURN QUERY
  WITH contacts AS MATERIALIZED (
    SELECT e.* FROM app.coach_external_clients e
    WHERE e.run_id = dataset AND e.coach_profile_id = actor
  ), bookings AS MATERIALIZED (
    SELECT b.id, b.client_profile_id, b.external_client_id, b.scheduled_start_at, b.created_at
    FROM app.coach_private_bookings b
    WHERE b.run_id = dataset AND b.coach_profile_id = actor
      AND b.credit_projection_id IS NULL AND b.status IN ('confirmed','completed')
      AND b.client_profile_id IS DISTINCT FROM actor
  ), pairs AS MATERIALIZED (
    SELECT p.* FROM app.coach_athlete_connection_pairs p
    WHERE p.run_id = dataset AND p.coach_profile_id = actor
  ), people AS (
    SELECT b.client_profile_id AS id FROM bookings b WHERE b.client_profile_id IS NOT NULL
    UNION SELECT p.athlete_profile_id FROM pairs p
    UNION SELECT e.linked_profile_id FROM contacts e WHERE e.linked_profile_id IS NOT NULL
  ), registered AS (
    SELECT 'p:' || person.id::text AS key, person.id AS profile_id,
      e.id AS external_client_id, person.display_name AS name,
      dates.last_at, dates.next_at,
      coalesce(dates.last_at, greatest(person.created_at, dates.created_at, a.created_at, e.created_at)) AS sort_at,
      b.id AS booking_id, app.connection_attempt_projection(a.id) AS connection,
      coalesce(a.status NOT IN ('pending','accepted'), true)
        AND b.id IS NOT NULL
        AND app.connection_pair_eligible(jsonb_populate_record(NULL::app.coach_athlete_connection_pairs,
          jsonb_build_object('run_id',dataset,'coach_profile_id',actor,'athlete_profile_id',person.id))) AS can_send,
      CASE WHEN a.status = 'accepted' THEN 'connected'
        WHEN a.status = 'pending' THEN 'pending' ELSE 'unconnected' END AS status
    FROM people entry JOIN app.profiles person ON person.id = entry.id
    LEFT JOIN pairs pair ON pair.athlete_profile_id = person.id
    LEFT JOIN LATERAL (
      SELECT attempt.* FROM app.coach_athlete_connection_attempts attempt
      WHERE attempt.pair_id = pair.id ORDER BY attempt.attempt_number DESC LIMIT 1
    ) a ON true
    LEFT JOIN LATERAL (
      SELECT max(x.scheduled_start_at) FILTER (WHERE x.scheduled_start_at <= reference_time) AS last_at,
        min(x.scheduled_start_at) FILTER (WHERE x.scheduled_start_at > reference_time) AS next_at,
        max(x.created_at) AS created_at
      FROM bookings x WHERE x.client_profile_id = person.id
    ) dates ON true
    LEFT JOIN LATERAL (
      SELECT x.id FROM bookings x WHERE x.client_profile_id = person.id
      ORDER BY x.scheduled_start_at DESC, x.id DESC LIMIT 1
    ) b ON true
    LEFT JOIN LATERAL (
      SELECT x.id, x.created_at FROM contacts x WHERE x.linked_profile_id = person.id
      ORDER BY x.created_at DESC, x.id DESC LIMIT 1
    ) e ON true
  ), unlinked AS (
    SELECT 'e:' || e.id::text AS key, NULL::uuid AS profile_id,
      e.id AS external_client_id, e.name, dates.last_at, dates.next_at,
      coalesce(dates.last_at,e.created_at) AS sort_at,
      NULL::uuid AS booking_id, NULL::jsonb AS connection, false AS can_send, 'external'::text AS status
    FROM contacts e
    LEFT JOIN LATERAL (
      SELECT max(b.scheduled_start_at) FILTER (WHERE b.scheduled_start_at <= reference_time) AS last_at,
        min(b.scheduled_start_at) FILTER (WHERE b.scheduled_start_at > reference_time) AS next_at
      FROM bookings b WHERE b.external_client_id = e.id
    ) dates ON true
    WHERE e.linked_profile_id IS NULL
  ), rows AS (SELECT * FROM registered UNION ALL SELECT * FROM unlinked)
  SELECT jsonb_build_object('key',r.key,'profileId',r.profile_id,'externalClientId',r.external_client_id,
    'name',r.name,'lastSessionAt',r.last_at,'nextSessionAt',r.next_at,'sortAt',r.sort_at,
    'bookingId',r.booking_id,'connection',r.connection,'canSend',r.can_send,'status',r.status)
  FROM rows r
  WHERE (requested_filter = 'all' OR r.status = requested_filter
      OR (requested_filter = 'unconnected' AND r.status = 'pending'))
    AND (before_at IS NULL OR (r.sort_at,r.key) < (before_at,before_key))
  ORDER BY r.sort_at DESC, r.key DESC LIMIT requested_limit;
  PERFORM app.connection_access_flags(false);
EXCEPTION WHEN OTHERS THEN PERFORM app.connection_access_flags(false); RAISE;
END;
$$;
ALTER FUNCTION app.current_coach_athletes(text,integer,timestamptz,text) OWNER TO app_owner;
REVOKE ALL ON FUNCTION app.current_coach_athletes(text,integer,timestamptz,text)
  FROM PUBLIC, anon, authenticated, service_role, app_notification_worker, app_media_worker;
GRANT EXECUTE ON FUNCTION app.current_coach_athletes(text,integer,timestamptz,text) TO app_runtime;

-- Keep the existing private-booking summary signature unchanged. Only its owning
-- coach may resolve a contact; athletes never receive this private record ID.
CREATE OR REPLACE FUNCTION app.current_owned_booking_external_client(requested_booking_id uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE flags jsonb; result uuid;
BEGIN
  IF NOT app.authorized_actor_context_valid(NULL,NULL,NULL) OR requested_booking_id IS NULL THEN
    RAISE EXCEPTION 'owned booking reference forbidden' USING errcode='42501';
  END IF;
  flags := app.availability_enter();
  SELECT b.external_client_id INTO result FROM app.coach_private_bookings b
  WHERE b.id=requested_booking_id AND b.run_id::text=current_setting('app.current_run_id',true)
    AND b.coach_profile_id::text=current_setting('app.current_profile_id',true)
    AND b.credit_projection_id IS NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'owned booking reference forbidden' USING errcode='42501'; END IF;
  PERFORM app.availability_leave(flags);
  RETURN result;
EXCEPTION WHEN OTHERS THEN PERFORM app.availability_leave(flags); RAISE;
END;
$$;
ALTER FUNCTION app.current_owned_booking_external_client(uuid) OWNER TO app_owner;
REVOKE ALL ON FUNCTION app.current_owned_booking_external_client(uuid)
  FROM PUBLIC, anon, authenticated, service_role, app_notification_worker, app_media_worker;
GRANT EXECUTE ON FUNCTION app.current_owned_booking_external_client(uuid) TO app_runtime;
