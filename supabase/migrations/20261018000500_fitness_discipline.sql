-- DEV0336: extend the shared discipline contract; no demo data or Auth writes.
alter table app.coach_profile_disciplines drop constraint coach_profile_disciplines_value_check;
alter table app.coach_profile_disciplines add constraint coach_profile_disciplines_value_check
  check (discipline in ('Boxing','Muay Thai','Kickboxing','Brazilian Jiu-Jitsu','MMA','Wrestling','Fitness'));
alter table app.coach_group_sessions drop constraint coach_group_sessions_discipline_check;
alter table app.coach_group_sessions add constraint coach_group_sessions_discipline_check
  check (discipline in ('Boxing','Muay Thai','Kickboxing','Brazilian Jiu-Jitsu','MMA','Wrestling','Fitness'));
alter table app.group_events drop constraint group_events_discipline_check;
alter table app.group_events add constraint group_events_discipline_check
  check (discipline in ('Boxing','Muay Thai','Kickboxing','Brazilian Jiu-Jitsu','MMA','Wrestling','Fitness'));

-- Recreate exactly the three existing validators from their installed definitions.
-- Preserve body changes from intervening migrations, security settings, owner/ACL,
-- signature and all other validation rather than copying the frozen baseline.
do $fitness$
declare target record; definition text; matched integer := 0;
begin
  for target in select p.oid from pg_catalog.pg_proc p
    join pg_catalog.pg_namespace n on n.oid=p.pronamespace
    where n.nspname='app' and p.proname in
      ('upsert_owned_coach_profile','create_owned_group_event_draft','update_owned_group_event_draft')
  loop
    definition := pg_catalog.pg_get_functiondef(target.oid);
    if (length(definition)-length(replace(definition,'''Wrestling''',''))) <> length('''Wrestling''') then
      raise exception 'Fitness migration found an unexpected discipline validator';
    end if;
    if position('''Fitness''' in definition)=0 then
      execute replace(definition,'''Wrestling''','''Wrestling'', ''Fitness''');
    end if;
    matched := matched+1;
  end loop;
  if matched<>3 then raise exception 'Fitness migration requires exactly three known discipline validators'; end if;
end;
$fitness$;
