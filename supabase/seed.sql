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
  ('10000000-0000-4000-8000-000000000006', null, 'maya-fischer', 'Maya Fischer', 'MF', 'Strength coach at Fabrik Training', 'blue', 'fixture', null, '2026-09-20T00:00:00Z', '2026-09-20T00:00:00Z')
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
  '2030-09-23',
  '2030-09-22T22:00:00Z',
  '2030-10-22T22:00:00Z',
  null,
  '2026-09-20T00:00:00Z',
  '2026-09-20T00:00:00Z'
)
on conflict do nothing;

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
  ('20000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000006', 'operator', 'active', '2026-09-20T00:00:00Z', null, '2026-09-20T00:00:00Z', '2026-09-20T00:00:00Z')
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
  ('20000000-0000-4000-8000-000000000001', '40000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000003', 'Yoga teacher', array['Yoga'], 'active', '2026-09-20T00:00:00Z', '2026-09-20T00:00:00Z')
on conflict do nothing;

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
values
  ('50000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001', '40000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000005', 'muay-thai', 'Muay Thai fundamentals', 'A welcoming session covering stance, movement and pad work.', 'Muay Thai', 'Europe/Berlin', 'EURC', '2030-09-24T16:00:00Z', '2030-09-24T17:00:00Z', 4, 12000000, 'scheduled', 'fixture', '2026-09-20T00:00:00Z', '2026-09-20T00:00:00Z'),
  ('50000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000001', '40000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000006', 'strength', 'Strength, together', 'A small-group strength session built around good technique.', 'Strength', 'Europe/Berlin', 'EURC', '2030-09-25T15:30:00Z', '2030-09-25T16:20:00Z', 6, 18000000, 'scheduled', 'fixture', '2026-09-20T00:00:00Z', '2026-09-20T00:00:00Z'),
  ('50000000-0000-4000-8000-000000000003', '20000000-0000-4000-8000-000000000001', '40000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000003', 'sunday-flow', 'Sunday reset flow', 'Gentle movement, spacious breathing and a long stretch.', 'Yoga', 'Europe/Berlin', 'EURC', '2030-09-29T08:00:00Z', '2030-09-29T09:15:00Z', 8, 15000000, 'scheduled', 'fixture', '2026-09-20T00:00:00Z', '2026-09-20T00:00:00Z')
on conflict do nothing;

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
