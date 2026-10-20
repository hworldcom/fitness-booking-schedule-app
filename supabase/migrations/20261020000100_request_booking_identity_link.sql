-- DEV0388: a request retains its original occurrence after its booking moves.
-- Only schema changes: existing requests, bookings and their snapshots stay intact.
set local lock_timeout = '5s';

alter table app.coach_private_bookings
  add constraint coach_private_bookings_request_identity_key
  unique (run_id, id, coach_profile_id, client_profile_id);

alter table app.coach_booking_requests
  drop constraint coach_booking_requests_booking_fkey,
  add constraint coach_booking_requests_booking_fkey
  foreign key (run_id, accepted_booking_id, coach_profile_id, client_profile_id)
  references app.coach_private_bookings (run_id, id, coach_profile_id, client_profile_id)
  on delete restrict;

alter table app.coach_private_bookings
  drop constraint coach_private_bookings_request_link_key;

create function app.guard_accepted_booking_request() returns trigger
language plpgsql set search_path = '' as $$
begin
  if tg_op = 'UPDATE' and old.accepted_booking_id is not null then
    -- The accepted attempt is historical evidence, including its original slot.
    -- The ordinary updated-at trigger may still maintain its bookkeeping field.
    if (to_jsonb(new) - 'updated_at') is distinct from
       (to_jsonb(old) - 'updated_at') then
      raise exception 'accepted booking request history is immutable'
        using errcode = '23514', constraint = 'coach_booking_requests_accepted_history';
    end if;
  elsif new.accepted_booking_id is not null then
    -- Check the original occurrence at acceptance, rather than requiring the
    -- booking's mutable current occurrence to match that origin forever.
    -- SHARE prevents a concurrent schedule update during this initial binding.
    perform 1 from app.coach_private_bookings b
      where b.id = new.accepted_booking_id and b.run_id = new.run_id
        and b.coach_profile_id = new.coach_profile_id
        and b.client_profile_id = new.client_profile_id
        and b.slot_id = new.slot_id
      for share;
    if not found then
      raise exception 'accepted booking must originate from this request occurrence'
        using errcode = '23503', constraint = 'coach_booking_requests_booking_origin';
    end if;
  end if;
  return new;
end $$;

alter function app.guard_accepted_booking_request() owner to app_owner;
revoke all on function app.guard_accepted_booking_request()
  from public, anon, authenticated, service_role, app_runtime;

-- Invoker execution preserves the existing owner-command RLS boundary; exact
-- administrative fixture operations retain their normal administrator context.
create trigger accepted_booking_request_origin
  before insert or update on app.coach_booking_requests
  for each row execute function app.guard_accepted_booking_request();

comment on constraint coach_booking_requests_booking_fkey on app.coach_booking_requests
  is 'Accepted request links to stable booking and participant identity; its original slot is retained independently of later booking schedule changes.';
