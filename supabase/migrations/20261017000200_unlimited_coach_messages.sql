-- DEV0278: Unlimited eligible messages and first contacts, with no send quota.
-- Keep the private signature for existing callers; their authentication, pair,
-- context, block, body-size and exact-retry checks remain authoritative.
-- CREATE OR REPLACE preserves existing function ownership and privileges.
create or replace function app.mail_rate(
  c app.message_conversations, actor uuid, first_contact boolean
) returns void language plpgsql set search_path = '' as $$
begin
  return;
end
$$;
