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
  created_at,
  updated_at
)
values
  ('10000000-0000-4000-8000-000000000002', null, 'daniel-park', 'Daniel Park', 'DP', 'Runs on good coffee', 'peach', 'fixture', null, '2026-09-20T00:00:00Z', '2026-09-20T00:00:00Z'),
  ('10000000-0000-4000-8000-000000000003', null, 'lea-weber', 'Lea Weber', 'LW', 'Yoga & everyday movement', 'lavender', 'fixture', null, '2026-09-20T00:00:00Z', '2026-09-20T00:00:00Z'),
  ('10000000-0000-4000-8000-000000000004', null, 'max-mueller', 'Max Müller', 'MM', 'Always up for one more rep', 'blue', 'fixture', null, '2026-09-20T00:00:00Z', '2026-09-20T00:00:00Z'),
  ('10000000-0000-4000-8000-000000000005', null, 'sam-lee', 'Sam Lee', 'SL', 'Muay Thai coach at Northside Combat', 'orange', 'fixture', null, '2026-09-20T00:00:00Z', '2026-09-20T00:00:00Z'),
  ('10000000-0000-4000-8000-000000000006', null, 'maya-fischer', 'Maya Fischer', 'MF', 'Strength coach at Fabrik Training', 'blue', 'fixture', null, '2026-09-20T00:00:00Z', '2026-09-20T00:00:00Z'),
  ('10000000-0000-4000-8000-000000000007', null, 'nora-klein', 'Nora Klein', 'NK', 'MMA fundamentals coach at Groundline MMA', 'green', 'fixture', null, '2026-09-28T00:00:00Z', '2026-09-28T00:00:00Z'),
  ('10000000-0000-4000-8000-000000000008', null, 'idris-malik', 'Idris Malik', 'IM', 'No-gi grappling coach at Groundline MMA', 'navy', 'fixture', null, '2026-09-28T00:00:00Z', '2026-09-28T00:00:00Z'),
  ('10000000-0000-4000-8000-000000000009', null, 'elif-demir', 'Elif Demir', 'ED', 'Kickboxing coach at Kiezstrike Club', 'orange', 'fixture', null, '2026-09-28T00:00:00Z', '2026-09-28T00:00:00Z'),
  ('10000000-0000-4000-8000-000000000010', null, 'anika-roth', 'Anika Roth', 'AR', 'Recovery practitioner at Quiet Current Recovery', 'lavender', 'fixture', null, '2026-09-28T00:00:00Z', '2026-09-28T00:00:00Z'),
  ('10000000-0000-4000-8000-000000000011', null, 'jules-hartmann', 'Jules Hartmann', 'JH', 'Strength coach at Nightshift Athletic Club', 'blue', 'fixture', null, '2026-09-28T00:00:00Z', '2026-09-28T00:00:00Z'),
  ('10000000-0000-4000-8000-000000000012', null, 'mina-okafor', 'Mina Okafor', 'MO', 'Yoga teacher at Nightshift Athletic Club', 'peach', 'fixture', null, '2026-09-28T00:00:00Z', '2026-09-28T00:00:00Z')
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

insert into app.organizations (
  id,
  run_id,
  slug,
  name,
  description,
  kind,
  status,
  record_source,
  created_at,
  updated_at
)
values
  ('30000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001', 'northside-combat', 'Northside Combat', 'Technique-led Muay Thai in Kreuzberg.', 'gym', 'active', 'fixture', '2026-09-20T00:00:00Z', '2026-09-20T00:00:00Z'),
  ('30000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000001', 'fabrik-training', 'Fabrik Training', 'Small-group strength training in Neukölln.', 'gym', 'active', 'fixture', '2026-09-20T00:00:00Z', '2026-09-20T00:00:00Z'),
  ('30000000-0000-4000-8000-000000000003', '20000000-0000-4000-8000-000000000001', 'studio-vela', 'Studio Vela', 'Mindful movement and yoga in Prenzlauer Berg.', 'studio', 'active', 'fixture', '2026-09-20T00:00:00Z', '2026-09-20T00:00:00Z'),
  ('30000000-0000-4000-8000-000000000004', '20000000-0000-4000-8000-000000000001', 'sunday-coffee', 'Sunday Coffee', 'A neighbourhood café and community meeting point.', 'cafe', 'active', 'fixture', '2026-09-20T00:00:00Z', '2026-09-20T00:00:00Z'),
  ('30000000-0000-4000-8000-000000000005', '20000000-0000-4000-8000-000000000001', 'groundline-mma', 'Groundline MMA', 'Structured MMA and no-gi grappling in Kreuzberg.', 'gym', 'active', 'fixture', '2026-09-26T00:00:00Z', '2026-09-26T00:00:00Z'),
  ('30000000-0000-4000-8000-000000000006', '20000000-0000-4000-8000-000000000001', 'kiezstrike', 'Kiezstrike Club', 'Beginner-friendly kickboxing in Kreuzberg.', 'gym', 'active', 'fixture', '2026-09-26T00:00:00Z', '2026-09-26T00:00:00Z'),
  ('30000000-0000-4000-8000-000000000007', '20000000-0000-4000-8000-000000000001', 'quiet-current', 'Quiet Current Recovery', 'Sports massage and restorative wellness in Charlottenburg.', 'studio', 'active', 'fixture', '2026-09-26T00:00:00Z', '2026-09-26T00:00:00Z'),
  ('30000000-0000-4000-8000-000000000008', '20000000-0000-4000-8000-000000000001', 'nightshift-athletic', 'Nightshift Athletic Club', 'Music-led strength, mobility and yoga in Mitte.', 'gym', 'active', 'fixture', '2026-09-26T00:00:00Z', '2026-09-26T00:00:00Z')
on conflict do nothing;

insert into app.organization_memberships (
  run_id,
  organization_id,
  profile_id,
  role,
  status,
  created_at,
  updated_at,
  revoked_at
)
values
  ('20000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000005', 'primary_admin', 'active', '2026-09-20T00:00:00Z', '2026-09-20T00:00:00Z', null),
  ('20000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000006', 'primary_admin', 'active', '2026-09-20T00:00:00Z', '2026-09-20T00:00:00Z', null),
  ('20000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000003', 'primary_admin', 'active', '2026-09-20T00:00:00Z', '2026-09-20T00:00:00Z', null)
on conflict do nothing;

insert into app.venues (
  id,
  run_id,
  organization_id,
  slug,
  name,
  area,
  city,
  country_code,
  timezone,
  description,
  kind,
  status,
  record_source,
  activity_tags,
  created_at,
  updated_at
)
values
  ('40000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000001', 'northside-combat', 'Northside Combat', 'Kreuzberg', 'Berlin', 'DE', 'Europe/Berlin', 'Technique-led Muay Thai, welcoming pad rounds and a steady path from first class to confident combinations.', 'gym', 'active', 'fixture', array['Muay Thai'], '2026-09-20T00:00:00Z', '2026-09-20T00:00:00Z'),
  ('40000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000002', 'fabrik', 'Fabrik Training', 'Neukölln', 'Berlin', 'DE', 'Europe/Berlin', 'Small-group strength sessions, thoughtful coaching and flexible open-floor training for every experience level.', 'gym', 'active', 'fixture', array['Strength'], '2026-09-20T00:00:00Z', '2026-09-20T00:00:00Z'),
  ('40000000-0000-4000-8000-000000000003', '20000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000003', 'vela', 'Studio Vela', 'Prenzlauer Berg', 'Berlin', 'DE', 'Europe/Berlin', 'A calm room for vinyasa, slower mobility sessions and mindful movement that fits around a busy week.', 'studio', 'active', 'fixture', array['Yoga'], '2026-09-20T00:00:00Z', '2026-09-20T00:00:00Z'),
  ('40000000-0000-4000-8000-000000000004', '20000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000004', 'sunday-coffee', 'Sunday Coffee', 'Kreuzberg', 'Berlin', 'DE', 'Europe/Berlin', 'A café meeting point for neighbourhood runs and conversation.', 'cafe', 'active', 'fixture', array['Running'], '2026-09-20T00:00:00Z', '2026-09-20T00:00:00Z'),
  ('40000000-0000-4000-8000-000000000005', '20000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000005', 'groundline-mma', 'Groundline MMA', 'Kreuzberg', 'Berlin', 'DE', 'Europe/Berlin', 'Structured MMA and no-gi grappling with fundamentals, controlled sparring and technical sessions for mixed levels.', 'gym', 'active', 'fixture', array['MMA', 'Grappling'], '2026-09-26T00:00:00Z', '2026-09-26T00:00:00Z'),
  ('40000000-0000-4000-8000-000000000006', '20000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000006', 'kiezstrike', 'Kiezstrike Club', 'Kreuzberg', 'Berlin', 'DE', 'Europe/Berlin', 'Beginner-friendly kickboxing, focused K1 technique and energetic conditioning in a respectful team setting.', 'gym', 'active', 'fixture', array['Kickboxing'], '2026-09-26T00:00:00Z', '2026-09-26T00:00:00Z'),
  ('40000000-0000-4000-8000-000000000007', '20000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000007', 'quiet-current', 'Quiet Current Recovery', 'Charlottenburg', 'Berlin', 'DE', 'Europe/Berlin', 'Sports massage, guided recovery and restorative wellness sessions designed to complement regular training.', 'studio', 'active', 'fixture', array['Massage', 'Wellness'], '2026-09-26T00:00:00Z', '2026-09-26T00:00:00Z'),
  ('40000000-0000-4000-8000-000000000008', '20000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000008', 'nightshift-athletic', 'Nightshift Athletic Club', 'Mitte', 'Berlin', 'DE', 'Europe/Berlin', 'A music-and-light-led club with strength circuits, mobility and yoga across early mornings and late evenings.', 'gym', 'active', 'fixture', array['Strength', 'Yoga'], '2026-09-26T00:00:00Z', '2026-09-26T00:00:00Z')
on conflict do nothing;

insert into app.participating_gyms (
  run_id,
  venue_id,
  artwork_key,
  coach_names,
  map_label,
  map_address,
  map_latitude,
  map_longitude,
  supports_non_core_visit,
  status,
  created_at,
  updated_at
)
values
  ('20000000-0000-4000-8000-000000000001', '40000000-0000-4000-8000-000000000001', 'fight', array['Sam Lee'], 'Near Amerika-Gedenkbibliothek', 'Blücherplatz 1, 10961 Berlin', 52.4965680, 13.3923650, true, 'active', '2026-09-26T00:00:00Z', '2026-09-26T00:00:00Z'),
  ('20000000-0000-4000-8000-000000000001', '40000000-0000-4000-8000-000000000002', 'strength', array['Maya Fischer'], 'Near Museum Neukölln', 'Alt-Britz 81, 12359 Berlin', 52.4460190, 13.4376420, true, 'active', '2026-09-26T00:00:00Z', '2026-09-26T00:00:00Z'),
  ('20000000-0000-4000-8000-000000000001', '40000000-0000-4000-8000-000000000003', 'flow', array['Lea Weber'], 'Near Museum Pankow', 'Prenzlauer Allee 227/228, 10405 Berlin', 52.5331600, 13.4195100, true, 'active', '2026-09-26T00:00:00Z', '2026-09-26T00:00:00Z'),
  ('20000000-0000-4000-8000-000000000001', '40000000-0000-4000-8000-000000000005', 'ground', array['Nora Klein', 'Idris Malik'], 'Near the Jewish Museum Berlin', 'Lindenstraße 9–14, 10969 Berlin', 52.5023119, 13.3954469, true, 'active', '2026-09-26T00:00:00Z', '2026-09-26T00:00:00Z'),
  ('20000000-0000-4000-8000-000000000001', '40000000-0000-4000-8000-000000000006', 'fight', array['Elif Demir'], 'Near Berlinische Galerie', 'Alte Jakobstraße 124–128, 10969 Berlin', 52.5033889, 13.3984444, true, 'active', '2026-09-26T00:00:00Z', '2026-09-26T00:00:00Z'),
  ('20000000-0000-4000-8000-000000000001', '40000000-0000-4000-8000-000000000007', 'recovery', array['Anika Roth'], 'Near Museum Berggruen', 'Schloßstraße 1, 14059 Berlin', 52.5191944, 13.2953056, true, 'active', '2026-09-26T00:00:00Z', '2026-09-26T00:00:00Z'),
  ('20000000-0000-4000-8000-000000000001', '40000000-0000-4000-8000-000000000008', 'night', array['Jules Hartmann', 'Mina Okafor'], 'Near Futurium', 'Alexanderufer 2, 10117 Berlin', 52.5240876, 13.3743507, false, 'active', '2026-09-26T00:00:00Z', '2026-09-26T00:00:00Z')
on conflict do nothing;

insert into app.venue_staff (
  run_id,
  venue_id,
  profile_id,
  role,
  status,
  created_at,
  updated_at,
  revoked_at
)
values (
  '20000000-0000-4000-8000-000000000001',
  '40000000-0000-4000-8000-000000000001',
  '10000000-0000-4000-8000-000000000005',
  'check_in_staff',
  'active',
  '2026-09-20T00:00:00Z',
  '2026-09-20T00:00:00Z',
  null
)
on conflict do nothing;

insert into app.trainer_affiliations (
  run_id,
  venue_id,
  profile_id,
  title,
  activity_tags,
  status,
  created_at,
  updated_at
)
values
  ('20000000-0000-4000-8000-000000000001', '40000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000005', 'Muay Thai coach', array['Muay Thai'], 'active', '2026-09-20T00:00:00Z', '2026-09-20T00:00:00Z'),
  ('20000000-0000-4000-8000-000000000001', '40000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000006', 'Strength coach', array['Strength'], 'active', '2026-09-20T00:00:00Z', '2026-09-20T00:00:00Z'),
  ('20000000-0000-4000-8000-000000000001', '40000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000003', 'Yoga teacher', array['Yoga'], 'active', '2026-09-20T00:00:00Z', '2026-09-20T00:00:00Z'),
  ('20000000-0000-4000-8000-000000000001', '40000000-0000-4000-8000-000000000005', '10000000-0000-4000-8000-000000000007', 'MMA coach', array['MMA'], 'active', '2026-09-28T00:00:00Z', '2026-09-28T00:00:00Z'),
  ('20000000-0000-4000-8000-000000000001', '40000000-0000-4000-8000-000000000005', '10000000-0000-4000-8000-000000000008', 'No-gi grappling coach', array['Grappling'], 'active', '2026-09-28T00:00:00Z', '2026-09-28T00:00:00Z'),
  ('20000000-0000-4000-8000-000000000001', '40000000-0000-4000-8000-000000000006', '10000000-0000-4000-8000-000000000009', 'Kickboxing coach', array['Kickboxing'], 'active', '2026-09-28T00:00:00Z', '2026-09-28T00:00:00Z'),
  ('20000000-0000-4000-8000-000000000001', '40000000-0000-4000-8000-000000000007', '10000000-0000-4000-8000-000000000010', 'Recovery practitioner', array['Massage', 'Wellness'], 'active', '2026-09-28T00:00:00Z', '2026-09-28T00:00:00Z'),
  ('20000000-0000-4000-8000-000000000001', '40000000-0000-4000-8000-000000000008', '10000000-0000-4000-8000-000000000011', 'Strength coach', array['Strength'], 'active', '2026-09-28T00:00:00Z', '2026-09-28T00:00:00Z'),
  ('20000000-0000-4000-8000-000000000001', '40000000-0000-4000-8000-000000000008', '10000000-0000-4000-8000-000000000012', 'Yoga teacher', array['Yoga'], 'active', '2026-09-28T00:00:00Z', '2026-09-28T00:00:00Z')
on conflict do nothing;

with fixture_sessions (
  id,
  venue_id,
  trainer_profile_id,
  slug,
  title,
  description,
  discipline,
  day_offset,
  local_start_time,
  duration_minutes,
  capacity
) as (
  values
    ('50000000-0000-4000-8000-000000000001'::uuid, '40000000-0000-4000-8000-000000000001'::uuid, '10000000-0000-4000-8000-000000000005'::uuid, 'northside-foundations-w1', 'Muay Thai foundations', 'Stance, footwork and controlled partner drills for newer members.', 'Muay Thai', 1, '18:00'::time, 60, 18),
    ('50000000-0000-4000-8000-000000000002'::uuid, '40000000-0000-4000-8000-000000000001'::uuid, '10000000-0000-4000-8000-000000000005'::uuid, 'northside-pads-movement-w1', 'Pads and movement', 'Technique rounds that connect clean combinations with purposeful movement.', 'Muay Thai', 3, '19:30'::time, 75, 16),
    ('50000000-0000-4000-8000-000000000003'::uuid, '40000000-0000-4000-8000-000000000001'::uuid, '10000000-0000-4000-8000-000000000005'::uuid, 'northside-all-levels-w1', 'Muay Thai all levels', 'A longer weekend session mixing technical rounds, pads and conditioning.', 'Muay Thai', 5, '11:00'::time, 90, 20),
    ('50000000-0000-4000-8000-000000000004'::uuid, '40000000-0000-4000-8000-000000000002'::uuid, '10000000-0000-4000-8000-000000000006'::uuid, 'fabrik-strength-foundations-w1', 'Strength foundations', 'A coached full-body session focused on stable, repeatable technique.', 'Strength', 0, '07:00'::time, 50, 12),
    ('50000000-0000-4000-8000-000000000005'::uuid, '40000000-0000-4000-8000-000000000002'::uuid, '10000000-0000-4000-8000-000000000006'::uuid, 'fabrik-lunch-circuit-w1', 'Lunch strength circuit', 'An efficient midday circuit with clear movement options for every level.', 'Strength', 2, '12:15'::time, 50, 12),
    ('50000000-0000-4000-8000-000000000006'::uuid, '40000000-0000-4000-8000-000000000002'::uuid, '10000000-0000-4000-8000-000000000006'::uuid, 'fabrik-full-body-w1', 'Full-body strength', 'Progressive compound lifts and accessories in a supportive small group.', 'Strength', 4, '18:00'::time, 60, 12),
    ('50000000-0000-4000-8000-000000000007'::uuid, '40000000-0000-4000-8000-000000000003'::uuid, '10000000-0000-4000-8000-000000000003'::uuid, 'vela-evening-vinyasa-w1', 'Evening vinyasa', 'A steady flow that builds heat before a quiet finish.', 'Yoga', 0, '18:30'::time, 60, 16),
    ('50000000-0000-4000-8000-000000000008'::uuid, '40000000-0000-4000-8000-000000000003'::uuid, '10000000-0000-4000-8000-000000000003'::uuid, 'vela-morning-mobility-w1', 'Morning mobility flow', 'Gentle mobility and balance work for an unhurried start.', 'Yoga', 3, '07:30'::time, 60, 16),
    ('50000000-0000-4000-8000-000000000009'::uuid, '40000000-0000-4000-8000-000000000003'::uuid, '10000000-0000-4000-8000-000000000003'::uuid, 'vela-sunday-slow-flow-w1', 'Sunday slow flow', 'Longer holds, spacious breathing and an extended reset.', 'Yoga', 6, '10:00'::time, 75, 16),
    ('50000000-0000-4000-8000-000000000010'::uuid, '40000000-0000-4000-8000-000000000005'::uuid, '10000000-0000-4000-8000-000000000007'::uuid, 'groundline-mma-fundamentals-w1', 'MMA fundamentals', 'Core striking-to-grappling transitions taught at a controlled pace.', 'MMA', 1, '19:00'::time, 75, 18),
    ('50000000-0000-4000-8000-000000000011'::uuid, '40000000-0000-4000-8000-000000000005'::uuid, '10000000-0000-4000-8000-000000000008'::uuid, 'groundline-no-gi-w1', 'No-gi grappling', 'Position, escape and submission sequences followed by guided rounds.', 'Grappling', 2, '18:30'::time, 90, 18),
    ('50000000-0000-4000-8000-000000000012'::uuid, '40000000-0000-4000-8000-000000000005'::uuid, '10000000-0000-4000-8000-000000000007'::uuid, 'groundline-controlled-sparring-w1', 'Controlled MMA sparring', 'Technical rounds for experienced members with coached intensity.', 'MMA', 5, '13:00'::time, 90, 16),
    ('50000000-0000-4000-8000-000000000013'::uuid, '40000000-0000-4000-8000-000000000006'::uuid, '10000000-0000-4000-8000-000000000009'::uuid, 'kiezstrike-all-levels-w1', 'Kickboxing all levels', 'Punch-and-kick combinations with options for first-timers and regulars.', 'Kickboxing', 0, '17:30'::time, 60, 20),
    ('50000000-0000-4000-8000-000000000014'::uuid, '40000000-0000-4000-8000-000000000006'::uuid, '10000000-0000-4000-8000-000000000009'::uuid, 'kiezstrike-k1-technique-w1', 'K1 technique', 'Focused combination, timing and defence work with partner drills.', 'Kickboxing', 2, '19:00'::time, 90, 20),
    ('50000000-0000-4000-8000-000000000015'::uuid, '40000000-0000-4000-8000-000000000006'::uuid, '10000000-0000-4000-8000-000000000009'::uuid, 'kiezstrike-weekend-w1', 'Weekend kickboxing', 'A mixed-level weekend class with technique, bags and conditioning.', 'Kickboxing', 6, '15:00'::time, 90, 20),
    ('50000000-0000-4000-8000-000000000016'::uuid, '40000000-0000-4000-8000-000000000007'::uuid, '10000000-0000-4000-8000-000000000010'::uuid, 'quiet-current-guided-mobility-w1', 'Guided mobility', 'A small-group mobility session for hips, shoulders and spine.', 'Wellness', 1, '12:30'::time, 45, 10),
    ('50000000-0000-4000-8000-000000000017'::uuid, '40000000-0000-4000-8000-000000000007'::uuid, '10000000-0000-4000-8000-000000000010'::uuid, 'quiet-current-restorative-w1', 'Restorative recovery', 'Breathing, gentle movement and guided down-regulation after training.', 'Wellness', 3, '18:30'::time, 60, 10),
    ('50000000-0000-4000-8000-000000000018'::uuid, '40000000-0000-4000-8000-000000000007'::uuid, '10000000-0000-4000-8000-000000000010'::uuid, 'quiet-current-massage-w1', 'Sports massage', 'A focused one-to-one recovery appointment tailored to recent training.', 'Massage', 5, '10:00'::time, 50, 1),
    ('50000000-0000-4000-8000-000000000019'::uuid, '40000000-0000-4000-8000-000000000008'::uuid, '10000000-0000-4000-8000-000000000011'::uuid, 'nightshift-sunrise-strength-w1', 'Sunrise strength', 'An early full-body session combining free weights and short intervals.', 'Strength', 0, '06:45'::time, 50, 24),
    ('50000000-0000-4000-8000-000000000020'::uuid, '40000000-0000-4000-8000-000000000008'::uuid, '10000000-0000-4000-8000-000000000011'::uuid, 'nightshift-express-circuit-w1', 'Express circuit', 'A compact lunchtime strength circuit with clear station changes.', 'Strength', 3, '12:15'::time, 50, 24),
    ('50000000-0000-4000-8000-000000000021'::uuid, '40000000-0000-4000-8000-000000000008'::uuid, '10000000-0000-4000-8000-000000000012'::uuid, 'nightshift-night-flow-w1', 'Night flow', 'Music-led yoga that moves from active sequences into a calm finish.', 'Yoga', 4, '20:00'::time, 60, 24),
    ('50000000-0000-4000-8000-000000000022'::uuid, '40000000-0000-4000-8000-000000000001'::uuid, '10000000-0000-4000-8000-000000000005'::uuid, 'northside-foundations-w2', 'Muay Thai foundations', 'Stance, footwork and controlled partner drills for newer members.', 'Muay Thai', 8, '18:00'::time, 60, 18),
    ('50000000-0000-4000-8000-000000000023'::uuid, '40000000-0000-4000-8000-000000000001'::uuid, '10000000-0000-4000-8000-000000000005'::uuid, 'northside-pads-movement-w2', 'Pads and movement', 'Technique rounds that connect clean combinations with purposeful movement.', 'Muay Thai', 10, '19:30'::time, 75, 16),
    ('50000000-0000-4000-8000-000000000024'::uuid, '40000000-0000-4000-8000-000000000001'::uuid, '10000000-0000-4000-8000-000000000005'::uuid, 'northside-all-levels-w2', 'Muay Thai all levels', 'A longer weekend session mixing technical rounds, pads and conditioning.', 'Muay Thai', 12, '11:00'::time, 90, 20),
    ('50000000-0000-4000-8000-000000000025'::uuid, '40000000-0000-4000-8000-000000000002'::uuid, '10000000-0000-4000-8000-000000000006'::uuid, 'fabrik-strength-foundations-w2', 'Strength foundations', 'A coached full-body session focused on stable, repeatable technique.', 'Strength', 7, '07:00'::time, 50, 12),
    ('50000000-0000-4000-8000-000000000026'::uuid, '40000000-0000-4000-8000-000000000002'::uuid, '10000000-0000-4000-8000-000000000006'::uuid, 'fabrik-lunch-circuit-w2', 'Lunch strength circuit', 'An efficient midday circuit with clear movement options for every level.', 'Strength', 9, '12:15'::time, 50, 12),
    ('50000000-0000-4000-8000-000000000027'::uuid, '40000000-0000-4000-8000-000000000002'::uuid, '10000000-0000-4000-8000-000000000006'::uuid, 'fabrik-full-body-w2', 'Full-body strength', 'Progressive compound lifts and accessories in a supportive small group.', 'Strength', 11, '18:00'::time, 60, 12),
    ('50000000-0000-4000-8000-000000000028'::uuid, '40000000-0000-4000-8000-000000000003'::uuid, '10000000-0000-4000-8000-000000000003'::uuid, 'vela-evening-vinyasa-w2', 'Evening vinyasa', 'A steady flow that builds heat before a quiet finish.', 'Yoga', 7, '18:30'::time, 60, 16),
    ('50000000-0000-4000-8000-000000000029'::uuid, '40000000-0000-4000-8000-000000000003'::uuid, '10000000-0000-4000-8000-000000000003'::uuid, 'vela-morning-mobility-w2', 'Morning mobility flow', 'Gentle mobility and balance work for an unhurried start.', 'Yoga', 10, '07:30'::time, 60, 16),
    ('50000000-0000-4000-8000-000000000030'::uuid, '40000000-0000-4000-8000-000000000003'::uuid, '10000000-0000-4000-8000-000000000003'::uuid, 'vela-sunday-slow-flow-w2', 'Sunday slow flow', 'Longer holds, spacious breathing and an extended reset.', 'Yoga', 13, '10:00'::time, 75, 16),
    ('50000000-0000-4000-8000-000000000031'::uuid, '40000000-0000-4000-8000-000000000005'::uuid, '10000000-0000-4000-8000-000000000007'::uuid, 'groundline-mma-fundamentals-w2', 'MMA fundamentals', 'Core striking-to-grappling transitions taught at a controlled pace.', 'MMA', 8, '19:00'::time, 75, 18),
    ('50000000-0000-4000-8000-000000000032'::uuid, '40000000-0000-4000-8000-000000000005'::uuid, '10000000-0000-4000-8000-000000000008'::uuid, 'groundline-no-gi-w2', 'No-gi grappling', 'Position, escape and submission sequences followed by guided rounds.', 'Grappling', 9, '18:30'::time, 90, 18),
    ('50000000-0000-4000-8000-000000000033'::uuid, '40000000-0000-4000-8000-000000000005'::uuid, '10000000-0000-4000-8000-000000000007'::uuid, 'groundline-controlled-sparring-w2', 'Controlled MMA sparring', 'Technical rounds for experienced members with coached intensity.', 'MMA', 12, '13:00'::time, 90, 16),
    ('50000000-0000-4000-8000-000000000034'::uuid, '40000000-0000-4000-8000-000000000006'::uuid, '10000000-0000-4000-8000-000000000009'::uuid, 'kiezstrike-all-levels-w2', 'Kickboxing all levels', 'Punch-and-kick combinations with options for first-timers and regulars.', 'Kickboxing', 7, '17:30'::time, 60, 20),
    ('50000000-0000-4000-8000-000000000035'::uuid, '40000000-0000-4000-8000-000000000006'::uuid, '10000000-0000-4000-8000-000000000009'::uuid, 'kiezstrike-k1-technique-w2', 'K1 technique', 'Focused combination, timing and defence work with partner drills.', 'Kickboxing', 9, '19:00'::time, 90, 20),
    ('50000000-0000-4000-8000-000000000036'::uuid, '40000000-0000-4000-8000-000000000006'::uuid, '10000000-0000-4000-8000-000000000009'::uuid, 'kiezstrike-weekend-w2', 'Weekend kickboxing', 'A mixed-level weekend class with technique, bags and conditioning.', 'Kickboxing', 13, '15:00'::time, 90, 20),
    ('50000000-0000-4000-8000-000000000037'::uuid, '40000000-0000-4000-8000-000000000007'::uuid, '10000000-0000-4000-8000-000000000010'::uuid, 'quiet-current-guided-mobility-w2', 'Guided mobility', 'A small-group mobility session for hips, shoulders and spine.', 'Wellness', 8, '12:30'::time, 45, 10),
    ('50000000-0000-4000-8000-000000000038'::uuid, '40000000-0000-4000-8000-000000000007'::uuid, '10000000-0000-4000-8000-000000000010'::uuid, 'quiet-current-restorative-w2', 'Restorative recovery', 'Breathing, gentle movement and guided down-regulation after training.', 'Wellness', 10, '18:30'::time, 60, 10),
    ('50000000-0000-4000-8000-000000000039'::uuid, '40000000-0000-4000-8000-000000000007'::uuid, '10000000-0000-4000-8000-000000000010'::uuid, 'quiet-current-massage-w2', 'Sports massage', 'A focused one-to-one recovery appointment tailored to recent training.', 'Massage', 12, '10:00'::time, 50, 1),
    ('50000000-0000-4000-8000-000000000040'::uuid, '40000000-0000-4000-8000-000000000008'::uuid, '10000000-0000-4000-8000-000000000011'::uuid, 'nightshift-sunrise-strength-w2', 'Sunrise strength', 'An early full-body session combining free weights and short intervals.', 'Strength', 7, '06:45'::time, 50, 24),
    ('50000000-0000-4000-8000-000000000041'::uuid, '40000000-0000-4000-8000-000000000008'::uuid, '10000000-0000-4000-8000-000000000011'::uuid, 'nightshift-express-circuit-w2', 'Express circuit', 'A compact lunchtime strength circuit with clear station changes.', 'Strength', 10, '12:15'::time, 50, 24),
    ('50000000-0000-4000-8000-000000000042'::uuid, '40000000-0000-4000-8000-000000000008'::uuid, '10000000-0000-4000-8000-000000000012'::uuid, 'nightshift-night-flow-w2', 'Night flow', 'Music-led yoga that moves from active sequences into a calm finish.', 'Yoga', 11, '20:00'::time, 60, 24)
),
anchored_sessions as (
  select
    fixture.id,
    run.id as run_id,
    fixture.venue_id,
    fixture.trainer_profile_id,
    fixture.slug,
    fixture.title,
    fixture.description,
    fixture.discipline,
    'Europe/Berlin'::text as timezone,
    'EURC'::text as currency_code,
    (
      run.schedule_anchor_date
      + fixture.day_offset
      + fixture.local_start_time
    ) at time zone 'Europe/Berlin' as starts_at,
    (
      run.schedule_anchor_date
      + fixture.day_offset
      + fixture.local_start_time
      + fixture.duration_minutes * interval '1 minute'
    ) at time zone 'Europe/Berlin' as ends_at,
    fixture.capacity,
    0::numeric(20, 0) as price_base_units,
    'scheduled'::text as status,
    'fixture'::text as record_source,
    '2026-09-28T00:00:00Z'::timestamptz as created_at,
    '2026-09-28T00:00:00Z'::timestamptz as updated_at
  from fixture_sessions as fixture
  join app.demo_runs as run
    on run.id = '20000000-0000-4000-8000-000000000001'
)
insert into app.class_sessions (
  id,
  run_id,
  venue_id,
  trainer_profile_id,
  slug,
  title,
  description,
  discipline,
  timezone,
  currency_code,
  starts_at,
  ends_at,
  capacity,
  price_base_units,
  status,
  record_source,
  created_at,
  updated_at
)
select
  id,
  run_id,
  venue_id,
  trainer_profile_id,
  slug,
  title,
  description,
  discipline,
  timezone,
  currency_code,
  starts_at,
  ends_at,
  capacity,
  price_base_units,
  status,
  record_source,
  created_at,
  updated_at
from anchored_sessions
on conflict (id) do update
set venue_id = excluded.venue_id,
    trainer_profile_id = excluded.trainer_profile_id,
    slug = excluded.slug,
    title = excluded.title,
    description = excluded.description,
    discipline = excluded.discipline,
    timezone = excluded.timezone,
    currency_code = excluded.currency_code,
    starts_at = excluded.starts_at,
    ends_at = excluded.ends_at,
    capacity = excluded.capacity,
    price_base_units = excluded.price_base_units,
    status = excluded.status,
    record_source = excluded.record_source,
    updated_at = excluded.updated_at
where (
  class_sessions.venue_id,
  class_sessions.trainer_profile_id,
  class_sessions.slug,
  class_sessions.title,
  class_sessions.description,
  class_sessions.discipline,
  class_sessions.timezone,
  class_sessions.currency_code,
  class_sessions.starts_at,
  class_sessions.ends_at,
  class_sessions.capacity,
  class_sessions.price_base_units,
  class_sessions.status,
  class_sessions.record_source
) is distinct from (
  excluded.venue_id,
  excluded.trainer_profile_id,
  excluded.slug,
  excluded.title,
  excluded.description,
  excluded.discipline,
  excluded.timezone,
  excluded.currency_code,
  excluded.starts_at,
  excluded.ends_at,
  excluded.capacity,
  excluded.price_base_units,
  excluded.status,
  excluded.record_source
);

insert into app.membership_products (
  id,
  run_id,
  organization_id,
  scope,
  slug,
  status,
  record_source,
  created_by_profile_id,
  created_at,
  updated_at
)
values
  (
    '60000000-0000-4000-8000-000000000101',
    '20000000-0000-4000-8000-000000000001',
    null,
    'platform',
    'basic',
    'active',
    'fixture',
    null,
    '2026-09-26T00:00:00Z',
    '2026-09-26T00:00:00Z'
  ),
  (
    '60000000-0000-4000-8000-000000000102',
    '20000000-0000-4000-8000-000000000001',
    null,
    'platform',
    'classic',
    'active',
    'fixture',
    null,
    '2026-09-26T00:00:00Z',
    '2026-09-26T00:00:00Z'
  )
on conflict do nothing;

insert into app.membership_product_versions (
  id,
  run_id,
  product_id,
  version_number,
  plan_code,
  name,
  description,
  currency_code,
  price_base_units,
  period_policy,
  duration_seconds,
  access_model,
  included_checkins,
  max_included_checkins_per_day,
  required_core_gym_count,
  non_core_visit_price_base_units,
  transferable,
  transfer_fee_base_units,
  minimum_hold_seconds,
  minimum_remaining_transfer_seconds,
  status,
  published_at,
  retired_at,
  created_by_profile_id,
  created_at,
  updated_at
)
values
  (
    '61000000-0000-4000-8000-000000000101',
    '20000000-0000-4000-8000-000000000001',
    '60000000-0000-4000-8000-000000000101',
    1,
    'basic',
    'Basic',
    'Ten included check-ins across four selected core gyms.',
    'EURC',
    80000000,
    'calendar_month',
    null,
    'limited',
    10,
    1,
    4,
    15000000,
    false,
    0,
    0,
    0,
    'draft',
    null,
    null,
    null,
    '2026-09-26T00:00:00Z',
    '2026-09-26T00:00:00Z'
  ),
  (
    '61000000-0000-4000-8000-000000000102',
    '20000000-0000-4000-8000-000000000001',
    '60000000-0000-4000-8000-000000000102',
    1,
    'classic',
    'Classic',
    'Unlimited included check-ins across four selected core gyms, limited to one included check-in per venue-local day.',
    'EURC',
    150000000,
    'calendar_month',
    null,
    'daily_uncapped',
    null,
    1,
    4,
    15000000,
    false,
    0,
    0,
    0,
    'draft',
    null,
    null,
    null,
    '2026-09-26T00:00:00Z',
    '2026-09-26T00:00:00Z'
  )
on conflict do nothing;

update app.membership_product_versions
set status = 'published',
    published_at = '2026-09-26T00:00:00Z'
where id in (
  '61000000-0000-4000-8000-000000000101',
  '61000000-0000-4000-8000-000000000102'
)
  and status = 'draft';

insert into app.membership_product_gym_eligibility (
  run_id,
  product_id,
  product_scope,
  venue_id,
  status,
  created_at,
  updated_at
)
values
  ('20000000-0000-4000-8000-000000000001', '60000000-0000-4000-8000-000000000101', 'platform', '40000000-0000-4000-8000-000000000001', 'active', '2026-09-26T00:00:00Z', '2026-09-26T00:00:00Z'),
  ('20000000-0000-4000-8000-000000000001', '60000000-0000-4000-8000-000000000101', 'platform', '40000000-0000-4000-8000-000000000002', 'active', '2026-09-26T00:00:00Z', '2026-09-26T00:00:00Z'),
  ('20000000-0000-4000-8000-000000000001', '60000000-0000-4000-8000-000000000101', 'platform', '40000000-0000-4000-8000-000000000003', 'active', '2026-09-26T00:00:00Z', '2026-09-26T00:00:00Z'),
  ('20000000-0000-4000-8000-000000000001', '60000000-0000-4000-8000-000000000101', 'platform', '40000000-0000-4000-8000-000000000005', 'active', '2026-09-26T00:00:00Z', '2026-09-26T00:00:00Z'),
  ('20000000-0000-4000-8000-000000000001', '60000000-0000-4000-8000-000000000101', 'platform', '40000000-0000-4000-8000-000000000006', 'active', '2026-09-26T00:00:00Z', '2026-09-26T00:00:00Z'),
  ('20000000-0000-4000-8000-000000000001', '60000000-0000-4000-8000-000000000102', 'platform', '40000000-0000-4000-8000-000000000001', 'active', '2026-09-26T00:00:00Z', '2026-09-26T00:00:00Z'),
  ('20000000-0000-4000-8000-000000000001', '60000000-0000-4000-8000-000000000102', 'platform', '40000000-0000-4000-8000-000000000002', 'active', '2026-09-26T00:00:00Z', '2026-09-26T00:00:00Z'),
  ('20000000-0000-4000-8000-000000000001', '60000000-0000-4000-8000-000000000102', 'platform', '40000000-0000-4000-8000-000000000003', 'active', '2026-09-26T00:00:00Z', '2026-09-26T00:00:00Z'),
  ('20000000-0000-4000-8000-000000000001', '60000000-0000-4000-8000-000000000102', 'platform', '40000000-0000-4000-8000-000000000005', 'active', '2026-09-26T00:00:00Z', '2026-09-26T00:00:00Z'),
  ('20000000-0000-4000-8000-000000000001', '60000000-0000-4000-8000-000000000102', 'platform', '40000000-0000-4000-8000-000000000006', 'active', '2026-09-26T00:00:00Z', '2026-09-26T00:00:00Z'),
  ('20000000-0000-4000-8000-000000000001', '60000000-0000-4000-8000-000000000102', 'platform', '40000000-0000-4000-8000-000000000007', 'active', '2026-09-26T00:00:00Z', '2026-09-26T00:00:00Z'),
  ('20000000-0000-4000-8000-000000000001', '60000000-0000-4000-8000-000000000102', 'platform', '40000000-0000-4000-8000-000000000008', 'active', '2026-09-26T00:00:00Z', '2026-09-26T00:00:00Z')
on conflict do nothing;
