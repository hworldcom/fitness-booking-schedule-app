-- MOV-255: one current card per pair; preserve all attempts and function grants.
CREATE OR REPLACE FUNCTION app.current_coach_athlete_connections(requested_role text, requested_section text, requested_limit integer, before_created_at timestamp with time zone, before_id uuid) RETURNS TABLE(projection jsonb)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
begin
  if not app.authorized_actor_context_valid(null, null, null)
    or requested_role is null or requested_role not in ('coach', 'athlete')
    or requested_section is null or requested_section not in ('incoming', 'outgoing', 'accepted', 'history')
    or requested_limit is null or requested_limit not between 1 and 51
    or (before_created_at is null) <> (before_id is null) then
    raise exception 'connection page is invalid' using errcode = 'P0001';
  end if;
  perform app.connection_access_flags(true);
  return query select app.connection_attempt_projection(a.id)
    from app.coach_athlete_connection_attempts a join app.coach_athlete_connection_pairs p on p.id = a.pair_id
    where p.run_id::text = current_setting('app.current_run_id', true)
      and (case requested_role when 'coach' then p.coach_profile_id else p.athlete_profile_id end)::text = current_setting('app.current_profile_id', true)
      -- Select the latest attempt before section/cursor/limit, so reconnection
      -- supersedes old cards without deleting any retained request history.
      and not exists (select 1 from app.coach_athlete_connection_attempts newer
        where newer.pair_id = a.pair_id and newer.attempt_number > a.attempt_number)
      and case requested_section
        when 'incoming' then a.status = 'pending' and a.recipient_profile_id::text = current_setting('app.current_profile_id', true)
        when 'outgoing' then a.status = 'pending' and a.sender_profile_id::text = current_setting('app.current_profile_id', true)
        when 'accepted' then a.status = 'accepted' else a.status in ('declined', 'withdrawn', 'removed') end
      and (before_created_at is null or (a.created_at, a.id) < (before_created_at, before_id))
    order by a.created_at desc, a.id desc limit requested_limit;
  perform app.connection_access_flags(false);
exception when others then perform app.connection_access_flags(false); raise;
end;
$$;
