-- Local demo coaches become claimed user records when their passwordless test
-- accounts are provisioned. The generated portrait remains a fixture asset,
-- so fixture authority follows is_demo rather than the mutable record source.

alter table app.coach_profiles
  drop constraint coach_profiles_portrait_reference_check;

alter table app.coach_profiles
  add constraint coach_profiles_portrait_reference_check check (
    (
      portrait_source is null
      and portrait_path is null
      and portrait_updated_at is null
    )
    or (
      portrait_source in ('fixture', 'storage')
      and portrait_path is not null
      and portrait_updated_at is not null
      and (
        (
          portrait_source = 'fixture'
          and is_demo
          and portrait_path = pg_catalog.concat(
            '/images/coaches/',
            public_slug,
            '.webp'
          )
        )
        or (
          portrait_source = 'storage'
          and portrait_path ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}[.]webp$'
          and pg_catalog.split_part(portrait_path, '/', 1) = profile_id::text
        )
      )
    )
  );
