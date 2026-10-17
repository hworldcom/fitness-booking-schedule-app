-- DEV0321: serialize reference attachment and ordinary Storage cleanup. Keep
-- the first locally applied migration intact; this is an additive correction.
create function app.lock_coach_website_banner_mutation() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  perform pg_advisory_xact_lock(hashtextextended('coach-banner:'||new.profile_id::text,321));
  return new;
end;
$$;
alter function app.lock_coach_website_banner_mutation() owner to app_owner;
revoke all on function app.lock_coach_website_banner_mutation() from public,anon,authenticated,app_runtime;
-- BEFORE INSERT runs even when ON CONFLICT ultimately skips the insert. The
-- existing command always inserts/checks the optional row before inspecting files.
create trigger coach_website_banner_mutation_lock
before insert or update on app.coach_website_content
for each row execute function app.lock_coach_website_banner_mutation();

create function app.can_delete_owned_coach_banner(requested_path text) returns boolean
language plpgsql volatile security definer set search_path='' as $$
declare owner_profile uuid;
begin
  owner_profile:=app.current_storage_website_owner();
  if owner_profile is null or split_part(requested_path,'/',1)<>owner_profile::text then return false; end if;
  perform pg_advisory_xact_lock(hashtextextended('coach-banner:'||owner_profile::text,321));
  -- A VOLATILE function gets a fresh command snapshot after waiting for a
  -- concurrent attachment commit; a STABLE predicate could use the older snapshot.
  return not app.storage_website_banner_is_current(requested_path,false);
end;
$$;
alter function app.can_delete_owned_coach_banner(text) owner to postgres;
revoke all on function app.can_delete_owned_coach_banner(text) from public,anon;
grant execute on function app.can_delete_owned_coach_banner(text) to authenticated;
drop policy coach_banners_owner_delete on storage.objects;
create policy coach_banners_owner_delete on storage.objects for delete to authenticated using(
  bucket_id='coach-banners' and app.can_delete_owned_coach_banner(name));

-- Public policy callers may ask only about currently public bytes, never whether
-- a known old object is still referenced by a hidden draft.
create function app.can_read_public_coach_banner(requested_path text) returns boolean
language sql stable security definer set search_path='' as $$
  select app.storage_website_banner_is_current(requested_path,true)
$$;
alter function app.can_read_public_coach_banner(text) owner to postgres;
revoke all on function app.can_read_public_coach_banner(text) from public;
grant execute on function app.can_read_public_coach_banner(text) to anon,authenticated;
drop policy coach_banners_public_current_select on storage.objects;
create policy coach_banners_public_current_select on storage.objects for select to anon,authenticated using(
  bucket_id='coach-banners' and app.can_read_public_coach_banner(name));
revoke all on function app.storage_website_banner_is_current(text,boolean) from anon,authenticated;
