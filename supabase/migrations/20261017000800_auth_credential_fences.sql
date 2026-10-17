-- DEV0286: a late pre-change login cannot reacquire application authority.
create table app.auth_credential_fences (
  auth_user_id uuid primary key references auth.users(id) on delete cascade,
  changed_at timestamptz not null
);
alter table app.auth_credential_fences owner to app_owner;
alter table app.auth_credential_fences enable row level security;
alter table app.auth_credential_fences force row level security;
revoke all on app.auth_credential_fences from public, anon, authenticated, app_runtime;
create policy auth_credential_fence_management on app.auth_credential_fences to app_owner using (true) with check (true);

create or replace function app.managed_auth_session_exists(requested_user uuid, requested_session uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists(select 1 from auth.sessions s join auth.users u on u.id=s.user_id
    left join app.auth_credential_fences fence on fence.auth_user_id=u.id
    where s.id=requested_session and s.user_id=requested_user and u.email_confirmed_at is not null
      and (s.not_after is null or s.not_after > statement_timestamp())
      and (fence.changed_at is null or s.created_at >= fence.changed_at));
$$;

create function app.revoke_auth_credentials(requested_user uuid, requested_changed_at timestamptz)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if requested_changed_at is null or requested_changed_at > statement_timestamp() + interval '30 seconds' then
    raise exception 'invalid credential update timestamp' using errcode='22023';
  end if;
  insert into app.auth_credential_fences(auth_user_id,changed_at) values(requested_user,requested_changed_at)
    on conflict(auth_user_id) do update set changed_at=greatest(app.auth_credential_fences.changed_at,excluded.changed_at);
  delete from app.application_auth_sessions where auth_user_id=requested_user;
end;
$$;
alter function app.revoke_auth_credentials(uuid,timestamptz) owner to app_owner;
revoke all on function app.revoke_auth_credentials(uuid,timestamptz) from public, anon, authenticated;
grant execute on function app.revoke_auth_credentials(uuid,timestamptz) to app_runtime;
