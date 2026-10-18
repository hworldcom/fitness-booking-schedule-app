import {
  DEMO_COACH_FIXTURES,
  FOUNDATION_RUN_ID,
  sqlLiteral,
} from "./demo-coach-fixtures";

export function demoRetirementArgument(args: readonly string[]) {
  if (
    args.length !== 3 ||
    args[0] !== "--environment" ||
    args[1] !== "dev" ||
    !["--check", "--apply"].includes(args[2])
  )
    throw new Error(
      "Usage: retire-hosted-demo-coaches.ts --environment dev --check|--apply. No local/production target or implicit write is allowed.",
    );
  return args[2] === "--apply";
}

export const demoRetirementAllowlistSql = DEMO_COACH_FIXTURES.map(
  (c) =>
    `(${sqlLiteral(c.profileId)}::uuid,${sqlLiteral(c.authUserId)}::uuid,${sqlLiteral(c.slug)},${sqlLiteral(c.email)},${sqlLiteral(c.seedParticipantRole)})`,
).join(",");

// Must execute in one transaction. Never retire the shared dataset itself:
// real testers enroll in that same active/public dataset.
export function demoCoachRetirementStatements(apply = true) {
  return `set local lock_timeout='5s'; set local statement_timeout='30s';
    select set_config('app.coach_profile_management','on',true);
    select set_config('app.identity_enrollment','on',true);
    select p.id from app.profiles p where p.id in (select id from (values ${demoRetirementAllowlistSql}) expected(id,auth_id,slug,email,seed_role)) order by p.id for update;
    select c.profile_id from app.coach_profiles c where c.profile_id in (select id from (values ${demoRetirementAllowlistSql}) expected(id,auth_id,slug,email,seed_role)) order by c.profile_id for update;
    select d.profile_id from app.demo_run_participants d where d.profile_id in (select id from (values ${demoRetirementAllowlistSql}) expected(id,auth_id,slug,email,seed_role)) order by d.profile_id for update;
    do $retire_demo$ declare expected record; begin
      for expected in select * from (values ${demoRetirementAllowlistSql}) v(id,auth_id,slug,email,seed_role) loop
        if exists(select 1 from app.profiles where auth_user_id=expected.auth_id and id<>expected.id)
          then raise exception 'Reserved demo Auth binding conflicts'; end if;
        if not exists(select 1 from app.profiles where id=expected.id) then
          if exists(select 1 from app.coach_profiles where public_slug=expected.slug)
            then raise exception 'Reserved demo slug ownership conflicts'; end if;
          continue;
        end if;
        if not exists(select 1 from app.profiles p
          join app.coach_profiles c on c.profile_id=p.id
          join app.demo_run_participants d on d.profile_id=p.id and d.run_id=c.run_id
          join app.demo_runs r on r.id=c.run_id
          left join auth.users u on u.id=p.auth_user_id
          where p.id=expected.id and c.run_id=${sqlLiteral(FOUNDATION_RUN_ID)}::uuid
            and r.slug='local-foundation-2030' and r.status='active' and r.catalogue_visibility='public'
            and c.public_slug=expected.slug and c.is_demo and d.status in ('active','revoked')
            and not exists(select 1 from app.coach_profiles other where other.profile_id=p.id and other.run_id<>c.run_id)
            and not exists(select 1 from app.demo_run_participants other where other.profile_id=p.id and other.run_id<>c.run_id)
            and ((p.auth_user_id is null and p.record_source='fixture' and p.claimed_at is null and c.record_source='fixture' and d.role=expected.seed_role)
              or (p.auth_user_id=expected.auth_id and p.record_source='user' and p.claimed_at is not null and c.record_source='user' and d.role='member'
                and u.email=expected.email and u.raw_app_meta_data->>'movx_coach_profile_id'=p.id::text
                and u.raw_app_meta_data->>'movx_coach_slug'=expected.slug and u.raw_app_meta_data->>'movx_demo_environment'='dev')))
          then raise exception 'Hosted demo fixture identity conflicts for %',expected.slug; end if;
      end loop;
      ${
        apply
          ? `update app.coach_profiles set visibility='hidden',updated_at=statement_timestamp()
        where run_id=${sqlLiteral(FOUNDATION_RUN_ID)}::uuid and profile_id in (select id from (values ${demoRetirementAllowlistSql}) v(id,auth_id,slug,email,seed_role)) and visibility<>'hidden';
      update app.demo_run_participants set status='revoked',revoked_at=statement_timestamp(),updated_at=statement_timestamp()
        where run_id=${sqlLiteral(FOUNDATION_RUN_ID)}::uuid and profile_id in (select id from (values ${demoRetirementAllowlistSql}) v(id,auth_id,slug,email,seed_role)) and status<>'revoked';`
          : ""
      }
    end $retire_demo$;`;
}

export const demoRetirementSummarySql = `select c.public_slug,c.visibility,d.status participant_status,
  (select count(*)::int from app.current_application_identity(p.auth_user_id)) application_identities,
  app.group_coach_enabled(c.run_id,c.profile_id,true) group_public
  from app.profiles p join app.coach_profiles c on c.profile_id=p.id
    join app.demo_run_participants d on d.profile_id=p.id and d.run_id=c.run_id
  where p.id in (select id from (values ${demoRetirementAllowlistSql}) v(id,auth_id,slug,email,seed_role)) order by c.public_slug;`;

// All protected rows are hashed inside the same repeatable-read snapshot, so
// unrelated concurrent tester activity neither causes false failures nor gets
// included in this operation. Only the exact authorized field changes differ.
const snapshotSql = `do $snapshot$ declare t record; fingerprint text; expression text; begin
  for t in select schemaname,tablename from pg_tables where schemaname in ('app','auth','storage') order by schemaname,tablename loop
    expression:='to_jsonb(v)';
    if t.schemaname='app' and t.tablename in ('coach_profiles','demo_run_participants') then
      expression:=format($mask$case when v.run_id=%L::uuid and v.profile_id in (select id from (values ${demoRetirementAllowlistSql}) expected(id,auth_id,slug,email,seed_role)) then to_jsonb(v)-%L::text[] else to_jsonb(v) end$mask$,
        ${sqlLiteral(FOUNDATION_RUN_ID)},case when t.tablename='coach_profiles' then '{visibility,updated_at}' else '{status,revoked_at,updated_at}' end);
    end if;
    execute format('select md5(coalesce(jsonb_agg(value order by value::text)::text,''[]'')) from (select %s value from %I.%I v) s',expression,t.schemaname,t.tablename) into fingerprint;
    insert into pg_temp.demo_retirement_fingerprints values(current_setting('dev0349.snapshot_phase'),t.schemaname||'.'||t.tablename,fingerprint);
  end loop;
end $snapshot$;`;

export function demoRetirementProofStatements(apply: boolean) {
  return `create temporary table demo_retirement_fingerprints(phase text,relation text,fingerprint text);
    create temporary table demo_retirement_evidence(result jsonb);
    select set_config('dev0349.snapshot_phase','before',true); ${snapshotSql}
    ${demoCoachRetirementStatements(apply)}
    select set_config('dev0349.snapshot_phase','after',true); ${snapshotSql}
    do $preservation$ begin
      if exists(select relation,fingerprint from pg_temp.demo_retirement_fingerprints where phase='before'
        except select relation,fingerprint from pg_temp.demo_retirement_fingerprints where phase='after')
        or exists(select relation,fingerprint from pg_temp.demo_retirement_fingerprints where phase='after'
        except select relation,fingerprint from pg_temp.demo_retirement_fingerprints where phase='before')
        then raise exception 'Unapproved data change detected; complete retirement rolled back'; end if;
    end $preservation$;
    insert into pg_temp.demo_retirement_evidence select jsonb_build_object('applied',${apply},'protectedDataPreserved',true,'fixtures',coalesce(jsonb_agg(to_jsonb(t) order by t.public_slug),'[]'::jsonb)) from (${demoRetirementSummarySql.replace(/;$/, "")}) t;
    ${
      apply
        ? `do $authority$ declare u record; begin
      if exists(select 1 from pg_temp.demo_retirement_evidence e cross join lateral jsonb_array_elements(e.result->'fixtures') f
        where f->>'visibility'<>'hidden' or f->>'participant_status'<>'revoked' or (f->>'application_identities')::int<>0 or (f->>'group_public')::boolean)
        then raise exception 'Retired demo remains public or authorized'; end if;
      for u in select p.auth_user_id from app.profiles p where p.id in (select id from (values ${demoRetirementAllowlistSql}) v(id,auth_id,slug,email,seed_role)) and p.auth_user_id is not null loop
        begin
          perform app.enroll_application_identity(u.auth_user_id,'Retired fictional coach');
          raise exception 'Revoked demo enrollment unexpectedly succeeded' using errcode='P0002';
        exception when sqlstate 'P0001' then
          if sqlerrm<>'application identity conflicts with existing state' then raise; end if;
        end;
      end loop;
    end $authority$;`
        : ""
    }`;
}
