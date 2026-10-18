-- DEV0337: bootstrap a new foundation only. Existing tester data is authoritative.
-- Replaying the complete seed must not restore deleted content or old defaults.
do $demo_bootstrap$
begin
  if exists(select 1 from app.demo_runs where id='20000000-0000-4000-8000-000000000001') then
    return;
  end if;
  if exists(select 1 from app.profiles where id in (
    '10000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000005',
    '10000000-0000-4000-8000-000000000007','10000000-0000-4000-8000-000000000008',
    '10000000-0000-4000-8000-000000000009','10000000-0000-4000-8000-000000000013')) then
    raise exception 'Partial demo foundation requires explicit repair; existing data was preserved';
  end if;

insert into app.profiles (
  id,
  auth_user_id,
  slug,
  display_name,
  initials,
  bio,
  avatar_color,
  record_source,
  claimed_at,
  coaching_activated_at,
  created_at,
  updated_at
)
values
  ('10000000-0000-4000-8000-000000000002', null, 'daniel-park', 'Daniel Park', 'DP', 'Runs on good coffee', 'peach', 'fixture', null, '2026-10-03T00:00:00Z', '2026-09-20T00:00:00Z', '2026-09-20T00:00:00Z'),
  ('10000000-0000-4000-8000-000000000003', null, 'lea-weber', 'Lea Weber', 'LW', 'Yoga & everyday movement', 'lavender', 'fixture', null, null, '2026-09-20T00:00:00Z', '2026-09-20T00:00:00Z'),
  ('10000000-0000-4000-8000-000000000004', null, 'max-mueller', 'Max Müller', 'MM', 'Always up for one more rep', 'blue', 'fixture', null, null, '2026-09-20T00:00:00Z', '2026-09-20T00:00:00Z'),
  ('10000000-0000-4000-8000-000000000005', null, 'sam-lee', 'Sam Lee', 'SL', 'Muay Thai coach at Northside Combat', 'orange', 'fixture', null, '2026-10-03T00:00:00Z', '2026-09-20T00:00:00Z', '2026-09-20T00:00:00Z'),
  ('10000000-0000-4000-8000-000000000006', null, 'maya-fischer', 'Maya Fischer', 'MF', 'Strength coach at Fabrik Training', 'blue', 'fixture', null, null, '2026-09-20T00:00:00Z', '2026-09-20T00:00:00Z'),
  ('10000000-0000-4000-8000-000000000007', null, 'nora-klein', 'Nora Klein', 'NK', 'MMA fundamentals coach at Groundline MMA', 'green', 'fixture', null, '2026-10-03T00:00:00Z', '2026-09-28T00:00:00Z', '2026-09-28T00:00:00Z'),
  ('10000000-0000-4000-8000-000000000008', null, 'idris-malik', 'Idris Malik', 'IM', 'No-gi grappling coach at Groundline MMA', 'navy', 'fixture', null, '2026-10-03T00:00:00Z', '2026-09-28T00:00:00Z', '2026-09-28T00:00:00Z'),
  ('10000000-0000-4000-8000-000000000009', null, 'elif-demir', 'Elif Demir', 'ED', 'Kickboxing coach at Kiezstrike Club', 'orange', 'fixture', null, '2026-10-03T00:00:00Z', '2026-09-28T00:00:00Z', '2026-09-28T00:00:00Z'),
  ('10000000-0000-4000-8000-000000000010', null, 'anika-roth', 'Anika Roth', 'AR', 'Recovery practitioner at Quiet Current Recovery', 'lavender', 'fixture', null, null, '2026-09-28T00:00:00Z', '2026-09-28T00:00:00Z'),
  ('10000000-0000-4000-8000-000000000011', null, 'jules-hartmann', 'Jules Hartmann', 'JH', 'Strength coach at Nightshift Athletic Club', 'blue', 'fixture', null, null, '2026-09-28T00:00:00Z', '2026-09-28T00:00:00Z'),
  ('10000000-0000-4000-8000-000000000012', null, 'mina-okafor', 'Mina Okafor', 'MO', 'Yoga teacher at Nightshift Athletic Club', 'peach', 'fixture', null, null, '2026-09-28T00:00:00Z', '2026-09-28T00:00:00Z')
on conflict do nothing;

insert into app.demo_runs (
  id,
  slug,
  name,
  status,
  catalogue_visibility,
  schedule_anchor_date,
  starts_at,
  ends_at,
  retired_at,
  created_at,
  updated_at
)
values (
  '20000000-0000-4000-8000-000000000001',
  'local-foundation-2030',
  'Local foundation run',
  'active',
  'public',
  '2026-09-28',
  '2026-09-27T22:00:00Z',
  '2026-10-26T23:00:00Z',
  null,
  '2026-09-20T00:00:00Z',
  '2026-09-20T00:00:00Z'
)
on conflict (id) do update
set schedule_anchor_date = excluded.schedule_anchor_date,
    starts_at = excluded.starts_at,
    ends_at = excluded.ends_at,
    updated_at = excluded.updated_at
where (
  demo_runs.schedule_anchor_date,
  demo_runs.starts_at,
  demo_runs.ends_at
) is distinct from (
  excluded.schedule_anchor_date,
  excluded.starts_at,
  excluded.ends_at
);

insert into app.demo_run_participants (
  run_id,
  profile_id,
  role,
  status,
  joined_at,
  revoked_at,
  created_at,
  updated_at
)
values
  ('20000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000002', 'member', 'active', '2026-09-20T00:00:00Z', null, '2026-09-20T00:00:00Z', '2026-09-20T00:00:00Z'),
  ('20000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000003', 'member', 'active', '2026-09-20T00:00:00Z', null, '2026-09-20T00:00:00Z', '2026-09-20T00:00:00Z'),
  ('20000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000004', 'member', 'active', '2026-09-20T00:00:00Z', null, '2026-09-20T00:00:00Z', '2026-09-20T00:00:00Z'),
  ('20000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000005', 'operator', 'active', '2026-09-20T00:00:00Z', null, '2026-09-20T00:00:00Z', '2026-09-20T00:00:00Z'),
  ('20000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000006', 'operator', 'active', '2026-09-20T00:00:00Z', null, '2026-09-20T00:00:00Z', '2026-09-20T00:00:00Z'),
  ('20000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000007', 'operator', 'active', '2026-09-28T00:00:00Z', null, '2026-09-28T00:00:00Z', '2026-09-28T00:00:00Z'),
  ('20000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000008', 'operator', 'active', '2026-09-28T00:00:00Z', null, '2026-09-28T00:00:00Z', '2026-09-28T00:00:00Z'),
  ('20000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000009', 'operator', 'active', '2026-09-28T00:00:00Z', null, '2026-09-28T00:00:00Z', '2026-09-28T00:00:00Z'),
  ('20000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000010', 'operator', 'active', '2026-09-28T00:00:00Z', null, '2026-09-28T00:00:00Z', '2026-09-28T00:00:00Z'),
  ('20000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000011', 'operator', 'active', '2026-09-28T00:00:00Z', null, '2026-09-28T00:00:00Z', '2026-09-28T00:00:00Z'),
  ('20000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000012', 'operator', 'active', '2026-09-28T00:00:00Z', null, '2026-09-28T00:00:00Z', '2026-09-28T00:00:00Z')
on conflict do nothing;

insert into app.gyms (
  id,
  run_id,
  slug,
  name,
  description,
  public_location_label,
  area,
  city,
  country_code,
  timezone,
  latitude,
  longitude,
  location_source,
  location_provider,
  location_confirmed_at,
  status,
  record_source,
  created_at,
  updated_at
)
values
  ('40000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001', 'northside-combat', 'Northside Combat', 'Technique-led Muay Thai, welcoming pad rounds and a steady path from first class to confident combinations.', 'Near Amerika-Gedenkbibliothek — Blücherplatz 1, 10961 Berlin', 'Kreuzberg', 'Berlin', 'DE', 'Europe/Berlin', 52.496568, 13.392365, 'fixture', null, '2026-09-26T00:00:00Z', 'active', 'fixture', '2026-09-20T00:00:00Z', '2026-09-26T00:00:00Z'),
  ('40000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000001', 'fabrik', 'Fabrik Training', 'Small-group strength sessions, thoughtful coaching and flexible open-floor training for every experience level.', 'Near Museum Neukölln — Alt-Britz 81, 12359 Berlin', 'Neukölln', 'Berlin', 'DE', 'Europe/Berlin', 52.446019, 13.437642, 'fixture', null, '2026-09-26T00:00:00Z', 'active', 'fixture', '2026-09-20T00:00:00Z', '2026-09-26T00:00:00Z'),
  ('40000000-0000-4000-8000-000000000003', '20000000-0000-4000-8000-000000000001', 'vela', 'Studio Vela', 'A calm room for vinyasa, slower mobility sessions and mindful movement that fits around a busy week.', 'Near Museum Pankow — Prenzlauer Allee 227/228, 10405 Berlin', 'Prenzlauer Berg', 'Berlin', 'DE', 'Europe/Berlin', 52.533160, 13.419510, 'fixture', null, '2026-09-26T00:00:00Z', 'active', 'fixture', '2026-09-20T00:00:00Z', '2026-09-26T00:00:00Z'),
  ('40000000-0000-4000-8000-000000000005', '20000000-0000-4000-8000-000000000001', 'groundline-mma', 'Groundline MMA', 'Structured MMA and no-gi grappling with fundamentals, controlled sparring and technical sessions for mixed levels.', 'Near the Jewish Museum Berlin — Lindenstraße 9–14, 10969 Berlin', 'Kreuzberg', 'Berlin', 'DE', 'Europe/Berlin', 52.502312, 13.395447, 'fixture', null, '2026-09-26T00:00:00Z', 'active', 'fixture', '2026-09-26T00:00:00Z', '2026-09-26T00:00:00Z'),
  ('40000000-0000-4000-8000-000000000006', '20000000-0000-4000-8000-000000000001', 'kiezstrike', 'Kiezstrike Club', 'Beginner-friendly kickboxing, focused K1 technique and energetic conditioning in a respectful team setting.', 'Near Berlinische Galerie — Alte Jakobstraße 124–128, 10969 Berlin', 'Kreuzberg', 'Berlin', 'DE', 'Europe/Berlin', 52.503389, 13.398444, 'fixture', null, '2026-09-26T00:00:00Z', 'active', 'fixture', '2026-09-26T00:00:00Z', '2026-09-26T00:00:00Z'),
  ('40000000-0000-4000-8000-000000000007', '20000000-0000-4000-8000-000000000001', 'quiet-current', 'Quiet Current Recovery', 'Sports massage, guided recovery and restorative wellness sessions designed to complement regular training.', 'Near Museum Berggruen — Schloßstraße 1, 14059 Berlin', 'Charlottenburg', 'Berlin', 'DE', 'Europe/Berlin', 52.519194, 13.295306, 'fixture', null, '2026-09-26T00:00:00Z', 'active', 'fixture', '2026-09-26T00:00:00Z', '2026-09-26T00:00:00Z'),
  ('40000000-0000-4000-8000-000000000008', '20000000-0000-4000-8000-000000000001', 'nightshift-athletic', 'Nightshift Athletic Club', 'A music-and-light-led club with strength circuits, mobility and yoga across early mornings and late evenings.', 'Near Futurium — Alexanderufer 2, 10117 Berlin', 'Mitte', 'Berlin', 'DE', 'Europe/Berlin', 52.524088, 13.374351, 'fixture', null, '2026-09-26T00:00:00Z', 'active', 'fixture', '2026-09-26T00:00:00Z', '2026-09-26T00:00:00Z')
on conflict (id) do update
set slug = excluded.slug,
    name = excluded.name,
    description = excluded.description,
    public_location_label = excluded.public_location_label,
    area = excluded.area,
    city = excluded.city,
    country_code = excluded.country_code,
    timezone = excluded.timezone,
    latitude = excluded.latitude,
    longitude = excluded.longitude,
    location_source = excluded.location_source,
    location_provider = excluded.location_provider,
    location_confirmed_at = excluded.location_confirmed_at,
    status = excluded.status,
    record_source = excluded.record_source,
    updated_at = excluded.updated_at
where gyms.record_source = 'fixture'
  and (
    gyms.slug,
    gyms.name,
    gyms.description,
    gyms.public_location_label,
    gyms.area,
    gyms.city,
    gyms.country_code,
    gyms.timezone,
    gyms.latitude,
    gyms.longitude,
    gyms.location_source,
    gyms.location_provider,
    gyms.location_confirmed_at,
    gyms.status
  ) is distinct from (
    excluded.slug,
    excluded.name,
    excluded.description,
    excluded.public_location_label,
    excluded.area,
    excluded.city,
    excluded.country_code,
    excluded.timezone,
    excluded.latitude,
    excluded.longitude,
    excluded.location_source,
    excluded.location_provider,
    excluded.location_confirmed_at,
    excluded.status
  );

insert into app.coach_profiles (
  run_id,
  profile_id,
  public_slug,
  display_name,
  bio,
  service_mode,
  timezone,
  selected_gym_id,
  location_kind,
  public_location_label,
  latitude,
  longitude,
  location_source,
  location_provider,
  location_confirmed_at,
  visibility,
  record_source,
  is_demo,
  created_at,
  updated_at
)
values
  (
    '20000000-0000-4000-8000-000000000001',
    '10000000-0000-4000-8000-000000000002',
    'daniel-park',
    'Daniel Park',
    'A patient boxing coach focused on balanced footwork, clean fundamentals and private sessions that meet each client at the right pace.',
    'private-training',
    'Europe/Berlin',
    null,
    'independent',
    'Tempelhofer Feld — Columbiadamm, 12101 Berlin',
    52.473086,
    13.403665,
    'fixture',
    null,
    '2026-10-03T00:00:00Z',
    'visible',
    'fixture',
    true,
    '2026-10-03T00:00:00Z',
    '2026-10-03T00:00:00Z'
  ),
  (
    '20000000-0000-4000-8000-000000000001',
    '10000000-0000-4000-8000-000000000005',
    'sam-lee',
    'Sam Lee',
    'A technical Muay Thai coach who builds confident combinations through calm pad work, clear feedback and carefully paced private training.',
    'private-training',
    'Europe/Berlin',
    '40000000-0000-4000-8000-000000000001',
    'gym',
    'Near Amerika-Gedenkbibliothek — Blücherplatz 1, 10961 Berlin',
    52.496568,
    13.392365,
    'fixture',
    null,
    '2026-10-03T00:00:00Z',
    'visible',
    'fixture',
    true,
    '2026-10-03T00:00:00Z',
    '2026-10-03T00:00:00Z'
  ),
  (
    '20000000-0000-4000-8000-000000000001',
    '10000000-0000-4000-8000-000000000007',
    'nora-klein',
    'Nora Klein',
    'An MMA fundamentals coach who connects striking and wrestling with practical movement, structured drills and supportive one-to-one sessions.',
    'private-training',
    'Europe/Berlin',
    '40000000-0000-4000-8000-000000000005',
    'gym',
    'Near the Jewish Museum Berlin — Lindenstraße 9–14, 10969 Berlin',
    52.502312,
    13.395447,
    'fixture',
    null,
    '2026-10-03T00:00:00Z',
    'visible',
    'fixture',
    true,
    '2026-10-03T00:00:00Z',
    '2026-10-03T00:00:00Z'
  ),
  (
    '20000000-0000-4000-8000-000000000001',
    '10000000-0000-4000-8000-000000000008',
    'idris-malik',
    'Idris Malik',
    'A detail-oriented Brazilian Jiu-Jitsu coach helping clients understand position, pressure and escapes through focused private practice.',
    'private-training',
    'Europe/Berlin',
    '40000000-0000-4000-8000-000000000005',
    'gym',
    'Near the Jewish Museum Berlin — Lindenstraße 9–14, 10969 Berlin',
    52.502312,
    13.395447,
    'fixture',
    null,
    '2026-10-03T00:00:00Z',
    'visible',
    'fixture',
    true,
    '2026-10-03T00:00:00Z',
    '2026-10-03T00:00:00Z'
  ),
  (
    '20000000-0000-4000-8000-000000000001',
    '10000000-0000-4000-8000-000000000009',
    'elif-demir',
    'Elif Demir',
    'A kickboxing coach combining precise technique with energetic conditioning, especially for clients building confidence in their first private sessions.',
    'private-training',
    'Europe/Berlin',
    '40000000-0000-4000-8000-000000000006',
    'gym',
    'Near Berlinische Galerie — Alte Jakobstraße 124–128, 10969 Berlin',
    52.503389,
    13.398444,
    'fixture',
    null,
    '2026-10-03T00:00:00Z',
    'visible',
    'fixture',
    true,
    '2026-10-03T00:00:00Z',
    '2026-10-03T00:00:00Z'
  )
on conflict (run_id, profile_id) do update
set public_slug = excluded.public_slug,
    display_name = excluded.display_name,
    bio = excluded.bio,
    service_mode = excluded.service_mode,
    timezone = excluded.timezone,
    selected_gym_id = excluded.selected_gym_id,
    location_kind = excluded.location_kind,
    public_location_label = excluded.public_location_label,
    latitude = excluded.latitude,
    longitude = excluded.longitude,
    location_source = excluded.location_source,
    location_provider = excluded.location_provider,
    location_confirmed_at = excluded.location_confirmed_at,
    visibility = excluded.visibility,
    is_demo = excluded.is_demo,
    updated_at = excluded.updated_at
where coach_profiles.record_source = 'fixture'
  and (
    coach_profiles.public_slug,
    coach_profiles.display_name,
    coach_profiles.bio,
    coach_profiles.service_mode,
    coach_profiles.timezone,
    coach_profiles.selected_gym_id,
    coach_profiles.location_kind,
    coach_profiles.public_location_label,
    coach_profiles.latitude,
    coach_profiles.longitude,
    coach_profiles.location_source,
    coach_profiles.location_provider,
    coach_profiles.location_confirmed_at,
    coach_profiles.visibility
  ) is distinct from (
    excluded.public_slug,
    excluded.display_name,
    excluded.bio,
    excluded.service_mode,
    excluded.timezone,
    excluded.selected_gym_id,
    excluded.location_kind,
    excluded.public_location_label,
    excluded.latitude,
    excluded.longitude,
    excluded.location_source,
    excluded.location_provider,
    excluded.location_confirmed_at,
    excluded.visibility
  );

update app.coach_profiles
set portrait_source = 'fixture',
    portrait_path = '/images/coaches/daniel-park.webp',
    portrait_updated_at = '2026-10-08T00:00:00Z'
where run_id = '20000000-0000-4000-8000-000000000001'
  and profile_id = '10000000-0000-4000-8000-000000000002'
  and public_slug = 'daniel-park'
  and is_demo
  and record_source = 'fixture'
  and exists (select 1 from app.profiles profile where profile.id = coach_profiles.profile_id and profile.record_source = 'fixture' and profile.auth_user_id is null and profile.claimed_at is null)
  and portrait_source is null
  and portrait_path is null
  and portrait_updated_at is null;

-- Historical funding-event fixtures are not current scheduling inventory.

insert into app.coach_profile_disciplines (
  run_id, profile_id, discipline, sort_order, created_at
)
select seed.run_id::uuid, seed.profile_id::uuid, seed.discipline,
  seed.sort_order, seed.created_at::timestamptz
from (values
  ('20000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000002', 'Boxing', 1, '2026-10-03T00:00:00Z'),
  ('20000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000005', 'Muay Thai', 1, '2026-10-03T00:00:00Z'),
  ('20000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000005', 'Boxing', 2, '2026-10-03T00:00:00Z'),
  ('20000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000007', 'MMA', 1, '2026-10-03T00:00:00Z'),
  ('20000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000007', 'Wrestling', 2, '2026-10-03T00:00:00Z'),
  ('20000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000008', 'Brazilian Jiu-Jitsu', 1, '2026-10-03T00:00:00Z'),
  ('20000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000009', 'Kickboxing', 1, '2026-10-03T00:00:00Z')
) as seed(run_id,profile_id,discipline,sort_order,created_at)
join app.coach_profiles coach
  on coach.run_id = seed.run_id::uuid
  and coach.profile_id = seed.profile_id::uuid
  and coach.record_source = 'fixture'
join app.profiles profile
  on profile.id = coach.profile_id
  and profile.record_source = 'fixture'
  and profile.auth_user_id is null
  and profile.claimed_at is null
on conflict (run_id, profile_id, discipline) do update
set sort_order = excluded.sort_order
where coach_profile_disciplines.sort_order is distinct from excluded.sort_order;

insert into app.coach_posts (
  run_id,
  id,
  coach_profile_id,
  body,
  visibility,
  published_at,
  record_source,
  created_at,
  updated_at
)
values
  (
    '20000000-0000-4000-8000-000000000001',
    '81000000-0000-4000-8000-000000000001',
    '10000000-0000-4000-8000-000000000005',
    'A useful pad round starts with balance: return to stance before adding speed.',
    'visible',
    '2026-10-03T09:30:00Z',
    'fixture',
    '2026-10-03T09:30:00Z',
    '2026-10-03T09:30:00Z'
  ),
  (
    '20000000-0000-4000-8000-000000000001',
    '81000000-0000-4000-8000-000000000002',
    '10000000-0000-4000-8000-000000000007',
    'When striking meets wrestling, posture is the bridge. Practise the transition slowly before adding resistance.',
    'visible',
    '2026-10-03T08:15:00Z',
    'fixture',
    '2026-10-03T08:15:00Z',
    '2026-10-03T08:15:00Z'
  ),
  (
    '20000000-0000-4000-8000-000000000001',
    '81000000-0000-4000-8000-000000000003',
    '10000000-0000-4000-8000-000000000002',
    'Footwork practice is most useful when every step leaves you balanced enough to defend or move again.',
    'visible',
    '2026-10-02T17:00:00Z',
    'fixture',
    '2026-10-02T17:00:00Z',
    '2026-10-02T17:00:00Z'
  )
on conflict (run_id, id) do update
set coach_profile_id = excluded.coach_profile_id,
    body = excluded.body,
    visibility = excluded.visibility,
    published_at = excluded.published_at,
    updated_at = excluded.updated_at
where coach_posts.record_source = 'fixture'
  and (
    coach_posts.coach_profile_id,
    coach_posts.body,
    coach_posts.visibility,
    coach_posts.published_at
  ) is distinct from (
    excluded.coach_profile_id,
    excluded.body,
    excluded.visibility,
    excluded.published_at
  );

-- DEV0335: richer fictional coach defaults for new/unclaimed nonproduction fixtures.
-- Claimed profiles, uploaded/removed portraits and later tester edits are preserved.
update app.coach_profiles c set bio=v.bio,
 portrait_source=case when c.portrait_path is null then 'fixture' else c.portrait_source end,
 portrait_path=coalesce(c.portrait_path,v.portrait_path),
 portrait_updated_at=coalesce(c.portrait_updated_at,'2026-10-18T00:00:00Z'::timestamptz)
from (values
('10000000-0000-4000-8000-000000000002'::uuid,'Build boxing confidence with clear feedback, balanced footwork and focused pad rounds.

We start with your goals and a comfortable warm-up, then work on stance, movement and combinations. Each session finishes with a short recap and something practical to work on next time. Beginners and returning athletes are welcome.','/images/coaches/daniel-park.webp'),
('10000000-0000-4000-8000-000000000005'::uuid,'Find your rhythm in Muay Thai with relaxed pad work, purposeful combinations and steady progress.

We build from stance and balance to punches, kicks and controlled knees. Short technical rounds leave room for questions and feedback. Training intensity follows your experience and goals; contact drills are always discussed first.','/images/coaches/sam-lee.webp'),
('10000000-0000-4000-8000-000000000007'::uuid,'Make sense of MMA through approachable striking, wrestling entries and movement drills.

Each session has one clear theme, from distance management to moving safely between standing and ground positions. We practise progressively, agree contact levels together and leave time to review what felt useful. You do not need competition experience.','/images/coaches/nora-klein.webp'),
('10000000-0000-4000-8000-000000000008'::uuid,'Understand no-gi grappling through patient explanations, positional practice and useful escapes.

We explore one position at a time, connecting frames, balance and movement before adding resistance. Repetition and clear stopping signals keep practice collaborative. Sessions can focus on first steps or a specific problem from your regular training.','/images/coaches/idris-malik.webp'),
('10000000-0000-4000-8000-000000000009'::uuid,'Enjoy kickboxing with crisp combinations, encouraging feedback and conditioning at your pace.

A typical session combines an easy warm-up, technique on pads and short conditioning rounds. We develop guard, footwork and balanced kicks before adding speed. New starters can learn without sparring; every session is adapted together.','/images/coaches/elif-demir.webp')
) v(profile_id,bio,portrait_path)
where c.profile_id=v.profile_id and c.run_id='20000000-0000-4000-8000-000000000001'
 and c.is_demo and c.record_source='fixture'
 and exists(select 1 from app.profiles p where p.id=c.profile_id and p.record_source='fixture' and p.auth_user_id is null and p.claimed_at is null)
 and (c.bio,c.portrait_path) is distinct from (v.bio,coalesce(c.portrait_path,v.portrait_path));

-- BEGIN DEV0336 FITNESS COACH
-- Reused verbatim by the guarded nonproduction provisioner; never run from migrations.
do $fitness_fixture$
begin
  if not exists(select 1 from app.demo_runs where id='20000000-0000-4000-8000-000000000001' and slug='local-foundation-2030' and status='active') then
    raise exception 'Fitness demo coach requires the existing active foundation dataset';
  end if;
  if exists(select 1 from app.profiles where
      (slug='jake-miller' and id<>'10000000-0000-4000-8000-000000000013') or
      (auth_user_id='90000000-0000-4000-8000-000000000013' and id<>'10000000-0000-4000-8000-000000000013') or
      (id='10000000-0000-4000-8000-000000000013' and not
        (slug='jake-miller' and ((record_source='fixture' and auth_user_id is null and claimed_at is null)
        or (record_source='user' and auth_user_id='90000000-0000-4000-8000-000000000013' and claimed_at is not null)))))
    or exists(select 1 from app.coach_profiles where
      (public_slug='jake-miller' and profile_id<>'10000000-0000-4000-8000-000000000013') or
      (profile_id='10000000-0000-4000-8000-000000000013' and (not is_demo or public_slug<>'jake-miller' or run_id<>'20000000-0000-4000-8000-000000000001')))
    or exists(select 1 from app.profiles p where p.id='10000000-0000-4000-8000-000000000013' and p.auth_user_id is not null
      and not exists(select 1 from app.coach_profiles c where c.profile_id=p.id)) then
    raise exception 'Reserved Fitness demo identity conflicts with existing data';
  end if;
  if not exists(select 1 from app.gyms where id='40000000-0000-4000-8000-000000000002'
    and run_id='20000000-0000-4000-8000-000000000001' and status='active' and record_source='fixture' and location_confirmed_at is not null) then
    raise exception 'Fitness demo coach requires the existing confirmed fictional Fabrik venue';
  end if;
end;
$fitness_fixture$;
insert into app.profiles(id,slug,display_name,initials,bio,avatar_color,record_source,coaching_activated_at)
values('10000000-0000-4000-8000-000000000013','jake-miller','Jake Miller','JM','Small steps, steady progress and a good training playlist.','blue','fixture',statement_timestamp())
on conflict do nothing;
insert into app.demo_run_participants(run_id,profile_id,role,status,joined_at)
values('20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000013','member','active',statement_timestamp())
on conflict do nothing;
insert into app.coach_profiles(run_id,profile_id,public_slug,display_name,bio,service_mode,timezone,
 selected_gym_id,location_kind,public_location_label,latitude,longitude,location_source,location_provider,location_confirmed_at,
 visibility,record_source,is_demo,portrait_source,portrait_path,portrait_updated_at)
select g.run_id,'10000000-0000-4000-8000-000000000013','jake-miller','Jake Miller',
 'Get stronger and feel fitter with approachable strength training, useful conditioning and a plan that fits your week.

We start with your goals and current routine, then practise comfortable squat, hinge, push and pull patterns. Sessions mix technique, manageable resistance and short conditioning rounds. Clear feedback and steady progression help beginners and returning athletes build consistency.',
 'private-training','Europe/Berlin',g.id,'gym',g.public_location_label,g.latitude,g.longitude,g.location_source,g.location_provider,g.location_confirmed_at,
 'visible','fixture',true,'fixture','/images/coaches/jake-miller.webp',statement_timestamp()
from app.gyms g where g.id='40000000-0000-4000-8000-000000000002' and g.run_id='20000000-0000-4000-8000-000000000001'
on conflict do nothing;
-- The existing profile trigger creates exactly one confirmed active primary venue.
insert into app.coach_profile_disciplines(run_id,profile_id,discipline,sort_order)
select c.run_id,c.profile_id,'Fitness',1 from app.coach_profiles c join app.profiles p on p.id=c.profile_id
where c.run_id='20000000-0000-4000-8000-000000000001' and c.profile_id='10000000-0000-4000-8000-000000000013'
 and c.record_source='fixture' and p.record_source='fixture' and p.auth_user_id is null and p.claimed_at is null
on conflict do nothing;
-- END DEV0336 FITNESS COACH

end;
$demo_bootstrap$;
