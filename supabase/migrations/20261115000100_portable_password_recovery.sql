-- MOV-238: recovery links prove mailbox ownership on the receiving device.
-- Keep original bound helpers and every existing flow unchanged for signup/rollback.
create function app.read_recovery_email_auth_flow(requested_id_hash text)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('emailHash',email_hash,'purpose',purpose,'intent',intent,'returnTo',return_to)
  from app.email_auth_flows
  where requested_id_hash ~ '^[0-9a-f]{64}$' and id_hash=requested_id_hash
    and purpose='recovery' and consumed_at is null and expires_at > statement_timestamp();
$$;

create function app.consume_recovery_email_auth_flow(requested_id_hash text, verified_email_hash text)
returns boolean language plpgsql security definer set search_path = '' as $$
begin
  update app.email_auth_flows set consumed_at=statement_timestamp()
  where requested_id_hash ~ '^[0-9a-f]{64}$' and verified_email_hash ~ '^[0-9a-f]{64}$'
    and id_hash=requested_id_hash and email_hash=verified_email_hash
    and purpose='recovery' and consumed_at is null and expires_at > statement_timestamp();
  return found;
end;
$$;

alter function app.read_recovery_email_auth_flow(text) owner to app_owner;
alter function app.consume_recovery_email_auth_flow(text,text) owner to app_owner;
revoke all on function app.read_recovery_email_auth_flow(text),
  app.consume_recovery_email_auth_flow(text,text) from public,anon,authenticated,service_role;
grant execute on function app.read_recovery_email_auth_flow(text),
  app.consume_recovery_email_auth_flow(text,text) to app_runtime;
