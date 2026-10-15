-- DEV0244: reserve an opening message's submission identity until acceptance.
-- An ordinary service send must not consume that identity and make a later
-- recipient decision conflict with an unrelated message body/context.
create function app.mail_guard_consent_submission() returns trigger language plpgsql set search_path='' as $$
begin
 if new.kind='text' and exists(
  select 1 from app.message_consents a where a.conversation_id=new.conversation_id and a.sender_profile_id=new.sender_profile_id and a.id=new.submission_id
  and (a.status<>'accepted' or new.context_id is not null or a.first_body is distinct from new.body or a.created_at is distinct from new.created_at)
 ) then raise exception 'message submission conflicts' using errcode='P0001'; end if;
 return new;
end $$;
alter function app.mail_guard_consent_submission() owner to app_owner;
revoke all on function app.mail_guard_consent_submission() from public,anon,authenticated,service_role,app_runtime;
create trigger mail_guard_consent_submission before insert on app.message_entries for each row execute function app.mail_guard_consent_submission();

-- DEV0245: explicit JSON cast keeps SQL lint free of implicit-type warnings.
create or replace function app.mail_trigger_enter() returns jsonb language plpgsql set search_path='' as $$
declare flags jsonb:='{}'::jsonb; flag text; begin
 foreach flag in array array['app.coach_connection_management','app.coach_profile_management','app.coach_application_management','app.coach_booking_management','app.coach_availability_management','app.coach_booking_request_management','app.profile_media_management','app.message_management'] loop
  flags:=flags||jsonb_build_object(flag,coalesce(current_setting(flag,true),''));
 end loop;
 perform app.mail_flags(true); return flags;
end $$;
