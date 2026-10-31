-- MOV-140: Instagram usernames may begin with underscores.
-- Replace only the validator body; preserve existing rows, owner and grants.
create or replace function app.valid_application_social_url(value text, host text) returns boolean
language sql immutable set search_path='' as $$
  select value is null or (
    length(value) between 1 and 500
    and value ~ ('^https://(www\.)?' || replace(host,'.','\.') || '/'
      || case when host='instagram.com' then '[A-Za-z0-9_]' else '[A-Za-z0-9]' end
      || '[A-Za-z0-9._~!$&''()*+,;=:@/%?-]*$')
    and value !~* '%(00|0a|0d)'
  )
$$;
