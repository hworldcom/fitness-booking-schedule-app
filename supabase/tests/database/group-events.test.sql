begin;

create extension if not exists pgtap with schema extensions;
set local search_path = extensions, public, pg_catalog;

select plan(21);

select has_table('app', 'group_events', 'group events table exists');
select has_table(
  'app',
  'group_event_pool_projections',
  'group event pool projections table exists'
);
select has_table(
  'app',
  'group_event_contribution_projections',
  'group event contribution projections table exists'
);

select is(
  (select count(*)::integer from app.group_events where record_source = 'fixture'),
  1,
  'one deterministic group-event draft is seeded'
);
select is(
  (
    select count(*)::integer
    from app.group_events
    where record_source = 'fixture'
      and publication_status = 'draft'
      and projection_availability = 'unbound'
      and event_pool_address is null
  ),
  1,
  'the fixture remains an honest unbound draft'
);
select is(
  (
    select count(*)::integer
    from app.group_events
    where record_source = 'fixture' and publication_status = 'published'
  ),
  0,
  'seed data does not fabricate a fundable public event'
);

select ok(
  (
    select bool_and(table_record.relrowsecurity)
    from pg_catalog.pg_class as table_record
    join pg_catalog.pg_namespace as namespace_record
      on namespace_record.oid = table_record.relnamespace
    where namespace_record.nspname = 'app'
      and table_record.relname in (
        'group_events',
        'group_event_pool_projections',
        'group_event_contribution_projections'
      )
  ),
  'all group-event tables enable row-level security'
);
select ok(
  (
    select bool_and(table_record.relforcerowsecurity)
    from pg_catalog.pg_class as table_record
    join pg_catalog.pg_namespace as namespace_record
      on namespace_record.oid = table_record.relnamespace
    where namespace_record.nspname = 'app'
      and table_record.relname in (
        'group_events',
        'group_event_pool_projections',
        'group_event_contribution_projections'
      )
  ),
  'all group-event tables force row-level security'
);
select is(
  (
    select count(*)::integer
    from pg_catalog.pg_policies
    where schemaname = 'app'
      and policyname in (
        'group_events_management_all',
        'group_events_owner_select',
        'group_events_public_select',
        'group_event_pool_projections_management_all',
        'group_event_pool_projections_owner_select',
        'group_event_pool_projections_public_select',
        'group_event_contribution_projections_management_all',
        'group_event_contribution_projections_actor_select'
      )
  ),
  8,
  'management, public and actor-scoped policies exist'
);

select ok(
  has_table_privilege('app_runtime', 'app.group_events', 'select')
    and has_table_privilege(
      'app_runtime',
      'app.group_event_pool_projections',
      'select'
    )
    and has_table_privilege(
      'app_runtime',
      'app.group_event_contribution_projections',
      'select'
    ),
  'runtime may read policy-filtered group-event tables'
);
select ok(
  not has_table_privilege('app_runtime', 'app.group_events', 'insert')
    and not has_table_privilege('app_runtime', 'app.group_events', 'update')
    and not has_table_privilege(
      'app_runtime',
      'app.group_event_pool_projections',
      'insert'
    )
    and not has_table_privilege(
      'app_runtime',
      'app.group_event_contribution_projections',
      'update'
    ),
  'runtime cannot mutate group-event tables directly'
);

select ok(
  has_function_privilege(
    'app_runtime',
    'app.create_owned_group_event_draft(uuid,text,text,text,timestamptz,timestamptz,text,uuid)',
    'execute'
  ),
  'runtime may call the bounded owner draft function'
);
select ok(
  has_function_privilege(
    'app_runtime',
    'app.record_verified_group_event_pool_projection(uuid,text,text,text,text,text,text,text,bigint,smallint,smallint,smallint,timestamptz,timestamptz,timestamptz,text,text,bigint,timestamptz)',
    'execute'
  ),
  'runtime may persist trusted finalized pool evidence'
);
select ok(
  has_function_privilege(
    'app_runtime',
    'app.record_verified_group_event_contribution_projection(uuid,text,text,text,text,bigint,text,text,bigint,timestamptz)',
    'execute'
  ),
  'runtime may persist trusted finalized contribution evidence'
);
select ok(
  not has_function_privilege(
    'anon',
    'app.create_owned_group_event_draft(uuid,text,text,text,timestamptz,timestamptz,text,uuid)',
    'execute'
  ),
  'Supabase anonymous role cannot call owner mutations'
);
select function_owner_is(
  'app',
  'record_verified_group_event_pool_projection',
  array[
    'uuid', 'text', 'text', 'text', 'text', 'text', 'text', 'text', 'bigint',
    'smallint', 'smallint', 'smallint', 'timestamp with time zone',
    'timestamp with time zone', 'timestamp with time zone', 'text', 'text',
    'bigint', 'timestamp with time zone'
  ],
  'app_owner',
  'trusted pool projection function is owned by the non-login owner'
);

select throws_ok(
  $$
    insert into app.group_events (
      id, run_id, coach_profile_id, public_slug, title, discipline,
      description, coach_slug_snapshot, coach_display_name_snapshot,
      location_kind_snapshot, location_label_snapshot,
      location_timezone_snapshot, latitude_snapshot, longitude_snapshot,
      starts_at, ends_at, publication_status, projection_availability,
      record_source
    ) values (
      '83000000-0000-4000-8000-000000000010',
      '20000000-0000-4000-8000-000000000001',
      '10000000-0000-4000-8000-000000000005',
      'invalid-short-title',
      'x',
      'Muay Thai',
      'A sufficiently long group-event description.',
      'sam-lee',
      'Sam Lee',
      'gym',
      'A valid location label',
      'Europe/Berlin',
      52.5,
      13.4,
      statement_timestamp() + interval '10 days',
      statement_timestamp() + interval '10 days 1 hour',
      'draft',
      'unbound',
      'user'
    )
  $$,
  '23514',
  null,
  'short event titles fail the database constraint'
);

select throws_ok(
  $$
    insert into app.group_events (
      id, run_id, coach_profile_id, public_slug, title, discipline,
      description, coach_slug_snapshot, coach_display_name_snapshot,
      location_kind_snapshot, location_label_snapshot,
      location_timezone_snapshot, latitude_snapshot, longitude_snapshot,
      starts_at, ends_at, publication_status, published_at,
      projection_availability, record_source
    ) values (
      '83000000-0000-4000-8000-000000000011',
      '20000000-0000-4000-8000-000000000001',
      '10000000-0000-4000-8000-000000000005',
      'invalid-published-event',
      'Invalid published event',
      'Muay Thai',
      'A published event cannot exist without one bound pool address.',
      'sam-lee',
      'Sam Lee',
      'gym',
      'A valid location label',
      'Europe/Berlin',
      52.5,
      13.4,
      statement_timestamp() + interval '10 days',
      statement_timestamp() + interval '10 days 1 hour',
      'published',
      statement_timestamp(),
      'unbound',
      'user'
    )
  $$,
  '23514',
  null,
  'published metadata without a pool binding fails closed'
);

select throws_ok(
  $$
    insert into app.group_event_pool_projections (
      event_id, run_id, program_address, event_pool_address, vault_address,
      coach_authority_address, payout_recipient_address, mint_address,
      token_program_address,
      seat_price_base_units, minimum_participants, maximum_participants,
      participant_count, funding_deadline, event_starts_at, event_ends_at,
      lifecycle_status, transaction_signature, observed_slot, finalized_at
    ) values (
      '83000000-0000-4000-8000-000000000001',
      '20000000-0000-4000-8000-000000000001',
      'GEUMk7SoYEsAvTgbFxohHTPbDfdX1citFT6Xxr6E4ULr',
      'GU3Ty9KXYFJ1m5g8t7EJC5H7h4n6Zx8JqQz7b9WmVQDA',
      'AjrQdXjR9y7B4oniU5TT7PTuiqubySQuvEDJaabkJP8C',
      '7EcXv8cRWYEbaYjvcXn37Bq6STqS2QwRkX8EBXjKn5Ge',
      '7EcXv8cRWYEbaYjvcXn37Bq6STqS2QwRkX8EBXjKn5Ge',
      '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU',
      'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA',
      25000000,
      1,
      12,
      0,
      '2026-10-17T10:00:00Z',
      '2026-10-18T09:00:00Z',
      '2026-10-18T11:00:00Z',
      'funding',
      repeat('2', 88),
      1,
      statement_timestamp()
    )
  $$,
  '23514',
  null,
  'pool capacity below the adopted minimum fails the constraint'
);

select throws_ok(
  $$
    insert into app.group_event_contribution_projections (
      run_id, event_id, participant_profile_id, program_address,
      event_pool_address, contribution_address, participant_wallet_address,
      amount_base_units, lifecycle_status, transaction_signature,
      observed_slot, finalized_at
    ) values (
      '20000000-0000-4000-8000-000000000001',
      '83000000-0000-4000-8000-000000000001',
      '10000000-0000-4000-8000-000000000003',
      'GEUMk7SoYEsAvTgbFxohHTPbDfdX1citFT6Xxr6E4ULr',
      'GU3Ty9KXYFJ1m5g8t7EJC5H7h4n6Zx8JqQz7b9WmVQDA',
      '9xQeWvG816bUx9EPf3fD2U7X1cmZ5Qw8YJ4nN6hKTpLs',
      '3idZ8hddpfAZ1JWW3gmH7YD6yokUuFDb1Txem2H6kPFe',
      25000000,
      'invented',
      repeat('3', 88),
      1,
      statement_timestamp()
    )
  $$,
  '23514',
  null,
  'unknown contribution lifecycle values fail the constraint'
);

select ok(
  obj_description('app.group_events'::regclass) is not null
    and obj_description('app.group_event_pool_projections'::regclass) is not null
    and obj_description('app.group_event_contribution_projections'::regclass) is not null,
  'group-event authority boundaries are documented in the schema'
);

select * from finish();
rollback;
