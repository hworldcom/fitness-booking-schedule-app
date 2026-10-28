-- MOV-135: additive optional public social links/languages; no row rewrite, private contact read, or privilege change.
create or replace function app.valid_coach_website_content(value jsonb) returns boolean
language plpgsql immutable set search_path='' as $$
declare item jsonb; key text; platform text; host text;
begin
  if value is null or jsonb_typeof(value)<>'object' then return false; end if;
  if not value ?& array['brandLabel','introduction','approach','experience','focusLabels','faqs','links'] then return false; end if;
  for key in select jsonb_object_keys(value) loop
    if key not in ('brandLabel','introduction','approach','experience','focusLabels','faqs','links','socialLinks','languages') then return false; end if;
  end loop;
  for key in select unnest(array['brandLabel','introduction','approach','experience']) loop
    if jsonb_typeof(value->key)<>'string' or not app.valid_coach_website_text(value->>key,
      case key when 'brandLabel' then 80 when 'introduction' then 220 else 2000 end,
      key in ('approach','experience')) then return false; end if;
  end loop;
  if jsonb_typeof(value->'focusLabels')<>'array' or jsonb_typeof(value->'faqs')<>'array' or jsonb_typeof(value->'links')<>'array' then return false; end if;
  if jsonb_array_length(value->'focusLabels')>8 or jsonb_array_length(value->'faqs')>6 or jsonb_array_length(value->'links')>4 then return false; end if;
  for item in select * from jsonb_array_elements(value->'focusLabels') loop
    if jsonb_typeof(item)<>'string' or not app.valid_coach_website_text(item#>>'{}',60) or btrim(item#>>'{}')='' then return false; end if;
  end loop;
  if (select count(*) from jsonb_array_elements(value->'focusLabels')) <>
     (select count(distinct x) from jsonb_array_elements(value->'focusLabels') x) then return false; end if;
  for item in select * from jsonb_array_elements(value->'faqs') loop
    if jsonb_typeof(item)<>'object' then return false; end if;
    if (select count(*) from jsonb_object_keys(item))<>2 or not item ?& array['question','answer']
      or jsonb_typeof(item->'question')<>'string' or jsonb_typeof(item->'answer')<>'string'
      or not app.valid_coach_website_text(item->>'question',160) or btrim(item->>'question')=''
      or not app.valid_coach_website_text(item->>'answer',1000,true) or btrim(item->>'answer')='' then return false; end if;
  end loop;
  for item in select * from jsonb_array_elements(value->'links') loop
    if jsonb_typeof(item)<>'object' then return false; end if;
    if (select count(*) from jsonb_object_keys(item))<>2 or not item ?& array['label','url']
      or jsonb_typeof(item->'label')<>'string' or jsonb_typeof(item->'url')<>'string'
      or not app.valid_coach_website_text(item->>'label',60) or btrim(item->>'label')=''
      or char_length(item->>'url')>2048 or (item->>'url') !~ '^https://[^/?#@[:space:]\\]+[.][^/?#@[:space:]\\]+([/?#][^[:space:]\\]*)?$'
      then return false; end if;
  end loop;

  if value ? 'languages' then
    if jsonb_typeof(value->'languages')<>'array' or jsonb_array_length(value->'languages')>8 then return false; end if;
    for item in select * from jsonb_array_elements(value->'languages') loop
      if jsonb_typeof(item)<>'string' or not app.valid_coach_website_text(item#>>'{}',60)
        or btrim(item#>>'{}')='' then return false; end if;
    end loop;
    if (select count(*) from jsonb_array_elements(value->'languages')) <>
      (select count(distinct lower(btrim(x))) from jsonb_array_elements_text(value->'languages') x) then return false; end if;
  end if;
  if value ? 'socialLinks' then
    if jsonb_typeof(value->'socialLinks')<>'object' then return false; end if;
    for platform in select jsonb_object_keys(value->'socialLinks') loop
      if platform not in ('instagram','facebook','linkedin') then return false; end if;
      if jsonb_typeof(value->'socialLinks'->platform)<>'string' then return false; end if;
      host:=platform||'[.]com';
      if value->'socialLinks'->>platform<>'' and (
        char_length(value->'socialLinks'->>platform)>2048 or
        (value->'socialLinks'->>platform) !~* ('^https://([a-z0-9]([a-z0-9-]*[a-z0-9])?[.])*'||host||'(:443)?([/?#][^[:space:]\\]*)?$')
      ) then return false; end if;
    end loop;
  end if;
  return true;
exception when others then return false;
end;
$$;
alter function app.valid_coach_website_content(jsonb) owner to app_owner;

