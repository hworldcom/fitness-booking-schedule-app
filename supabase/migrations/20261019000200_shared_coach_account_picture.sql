-- Explicit per-owner sharing. Existing portrait/account references are unchanged.
alter table app.coach_profiles drop constraint coach_profiles_portrait_reference_check;
alter table app.coach_profiles add constraint coach_profiles_portrait_reference_check check ((
  (portrait_source is null and portrait_path is null and portrait_updated_at is null)
  or (portrait_source='fixture' and is_demo and portrait_path=concat('/images/coaches/',public_slug,'.webp') and portrait_updated_at is not null)
  or (portrait_source='storage' and portrait_updated_at is not null
    and portrait_path ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}[.]webp$'
    and split_part(portrait_path,'/',1)=profile_id::text)
  or (portrait_source='account' and portrait_path=profile_id::text and portrait_updated_at is not null)
) is true);
comment on column app.coach_profiles.portrait_source is 'Fixture, separate public Storage portrait, or explicitly shared account picture. Account source stores only the owner UUID marker, never a private object path.';

create function app.set_current_coach_account_picture(requested_enabled boolean,expected_source text,expected_path text)
returns table(previous_source text,previous_path text,media_updated_at timestamptz)
language plpgsql security definer set search_path='' as $$
declare actor_profile uuid; actor_run uuid; selected_coach app.coach_profiles%rowtype;
  prior_management text:=coalesce(current_setting('app.coach_profile_management',true),'off');
  prior_application text:=coalesce(current_setting('app.coach_application_management',true),'off');
begin
  if requested_enabled is null or not app.authorized_actor_context_valid(null,null,null) then
    raise exception 'coach portrait actor context is invalid' using errcode='P0001';
  end if;
  actor_profile:=current_setting('app.current_profile_id')::uuid;
  actor_run:=current_setting('app.current_run_id')::uuid;
  perform set_config('app.coach_profile_management','on',true);
  perform set_config('app.coach_application_management','on',true);
  select c.* into selected_coach from app.coach_profiles c
    where c.run_id=actor_run and c.profile_id=actor_profile
      and (c.is_demo or exists(select 1 from app.coach_applications a where a.profile_id=actor_profile and a.status in ('pending','approved','rejected')))
    for update of c;
  if not found or selected_coach.portrait_source is distinct from expected_source
    or selected_coach.portrait_path is distinct from expected_path then
    raise exception 'coach portrait reference conflicts with current state' using errcode='P0001';
  end if;
  previous_source:=selected_coach.portrait_source;previous_path:=selected_coach.portrait_path;
  -- Disabling is allowed only for the sharing choice, never to erase a newer separate portrait.
  if not requested_enabled and selected_coach.portrait_source is distinct from 'account' then
    raise exception 'coach portrait reference conflicts with current state' using errcode='P0001';
  end if;
  update app.coach_profiles c set
    portrait_source=case when requested_enabled then 'account' end,
    portrait_path=case when requested_enabled then actor_profile::text end,
    portrait_updated_at=case when requested_enabled then greatest(date_trunc('milliseconds',statement_timestamp()),date_trunc('milliseconds',selected_coach.portrait_updated_at)+interval '1 millisecond') end
    where c.run_id=actor_run and c.profile_id=actor_profile
    returning c.portrait_updated_at into media_updated_at;
  perform set_config('app.coach_profile_management',prior_management,true);
  perform set_config('app.coach_application_management',prior_application,true);
  return next;
exception when others then
  perform set_config('app.coach_profile_management',prior_management,true);
  perform set_config('app.coach_application_management',prior_application,true);raise;
end $$;
alter function app.set_current_coach_account_picture(boolean,text,text) owner to app_owner;
revoke all on function app.set_current_coach_account_picture(boolean,text,text) from public,anon,authenticated;
grant execute on function app.set_current_coach_account_picture(boolean,text,text) to app_runtime;

-- Keep the opt-in while replacing/removing its underlying account picture.
create function app.refresh_shared_coach_picture_version() returns trigger
language plpgsql security definer set search_path='' as $$
declare prior_management text:=coalesce(current_setting('app.coach_profile_management',true),'off');
begin
  if new.avatar_storage_path is not distinct from old.avatar_storage_path and new.avatar_updated_at is not distinct from old.avatar_updated_at then return new; end if;
  perform set_config('app.coach_profile_management','on',true);
  update app.coach_profiles c set portrait_updated_at=greatest(date_trunc('milliseconds',statement_timestamp()),c.portrait_updated_at+interval '1 millisecond')
    where c.profile_id=new.id and c.portrait_source='account' and c.portrait_path=new.id::text;
  perform set_config('app.coach_profile_management',prior_management,true);return new;
exception when others then perform set_config('app.coach_profile_management',prior_management,true);raise;
end $$;
alter function app.refresh_shared_coach_picture_version() owner to postgres;
revoke all on function app.refresh_shared_coach_picture_version() from public,anon,authenticated,app_runtime;
create trigger refresh_shared_coach_picture_version after update of avatar_storage_path,avatar_updated_at on app.profiles
  for each row execute function app.refresh_shared_coach_picture_version();

create function app.public_shared_coach_picture_reference(requested_profile uuid,requested_version timestamptz)
returns table(profile_id uuid,avatar_storage_path text,avatar_updated_at timestamptz,portrait_updated_at timestamptz)
language sql stable security definer set search_path='' as $$
  select c.profile_id,p.avatar_storage_path,p.avatar_updated_at,c.portrait_updated_at
  from app.coach_profiles c join app.profiles p on p.id=c.profile_id
  where c.profile_id=requested_profile and c.portrait_source='account' and c.portrait_path=c.profile_id::text
    and c.portrait_updated_at=requested_version and p.avatar_storage_path is not null
    and app.coach_website_is_public(c.run_id,c.profile_id)
$$;
alter function app.public_shared_coach_picture_reference(uuid,timestamptz) owner to postgres;
revoke all on function app.public_shared_coach_picture_reference(uuid,timestamptz) from public,anon,authenticated;
grant execute on function app.public_shared_coach_picture_reference(uuid,timestamptz) to app_runtime;

-- Storage credentials remain ordinary request credentials. Only the CURRENT
-- opted-in picture is readable publicly, under the same publication gate.
create function app.can_read_public_shared_coach_picture(requested_path text) returns boolean
language sql stable security definer set search_path='' as $$
  select exists(select 1 from app.profiles p join app.coach_profiles c on c.profile_id=p.id
    where p.avatar_storage_path=requested_path and c.portrait_source='account' and c.portrait_path=c.profile_id::text
      and app.coach_website_is_public(c.run_id,c.profile_id))
$$;
alter function app.can_read_public_shared_coach_picture(text) owner to postgres;
revoke all on function app.can_read_public_shared_coach_picture(text) from public;
grant execute on function app.can_read_public_shared_coach_picture(text) to anon,authenticated;
create policy account_avatars_public_shared_coach_select on storage.objects for select to anon,authenticated
  using(bucket_id='account-avatars' and app.can_read_public_shared_coach_picture(name));
