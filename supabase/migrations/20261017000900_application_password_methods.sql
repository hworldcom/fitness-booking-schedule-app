-- DEV0286: passwordless accounts can have a provider-generated random hash.
-- Record evidence of a deliberately configured/used application password.
create table app.auth_password_methods (
  auth_user_id uuid primary key references auth.users(id) on delete cascade,
  configured_at timestamptz not null default statement_timestamp()
);
alter table app.auth_password_methods owner to app_owner;
alter table app.auth_password_methods enable row level security;
alter table app.auth_password_methods force row level security;
revoke all on app.auth_password_methods from public, anon, authenticated, app_runtime;
create policy auth_password_method_management on app.auth_password_methods to app_owner using (true) with check (true);

create function app.record_password_method(requested_user uuid)
returns void language sql security definer set search_path = '' as $$
  insert into app.auth_password_methods(auth_user_id) values(requested_user)
    on conflict(auth_user_id) do nothing;
$$;
alter function app.record_password_method(uuid) owner to app_owner;
revoke all on function app.record_password_method(uuid) from public, anon, authenticated;
grant execute on function app.record_password_method(uuid) to app_runtime;

create or replace function app.account_has_password(requested_user uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce(u.encrypted_password,'') <> '' and exists(
    select 1 from app.auth_password_methods p where p.auth_user_id=u.id
  ) from auth.users u where u.id=requested_user;
$$;
