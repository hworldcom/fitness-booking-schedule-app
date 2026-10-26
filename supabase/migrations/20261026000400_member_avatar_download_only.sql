-- MOV-117: viewing member photos grants downloads, not bucket enumeration or signing.
drop policy if exists account_avatars_member_select on storage.objects;
create policy account_avatars_member_select on storage.objects for select to authenticated
  using (
    bucket_id='account-avatars'
    and storage.allow_only_operation('object.get_authenticated')
    and app.current_storage_actor_can_read_member_avatar(name)
  );
