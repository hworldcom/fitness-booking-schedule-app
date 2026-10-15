-- DEV0244/DEV0245: owner-trigger reads must not depend on a preceding enrolment
-- call leaving its transaction-local identity flag enabled. No runtime raw grant.
create policy message_membership_select on app.demo_run_participants for select to app_owner using (current_setting('app.message_management',true)='on');
create function app.mail_valid_body(body text) returns boolean language sql immutable set search_path='' as $$
 select body is not null and char_length(body) between 1 and 4000 and octet_length(body)<=16000
 and regexp_replace(body,'[[:space:]'||U&'\00A0\1680\2000\2001\2002\2003\2004\2005\2006\2007\2008\2009\200A\2028\2029\202F\205F\3000\FEFF'||']','','g')<>''
$$;
alter function app.mail_valid_body(text) owner to app_owner;
revoke all on function app.mail_valid_body(text) from public,anon,authenticated,service_role,app_runtime;
alter table app.message_entries add constraint message_nonblank_unicode_body check(body is null or app.mail_valid_body(body));
alter table app.message_consents add constraint message_nonblank_unicode_opening check(app.mail_valid_body(first_body));
