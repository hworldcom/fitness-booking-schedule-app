alter table app.trainer_affiliations
  drop constraint trainer_affiliations_activity_tags_check;

alter table app.trainer_affiliations
  add constraint trainer_affiliations_activity_tags_check
    check (
      cardinality(activity_tags) > 0
      and activity_tags <@ array[
        'Grappling',
        'Kickboxing',
        'Massage',
        'MMA',
        'Muay Thai',
        'Running',
        'Strength',
        'Wellness',
        'Yoga'
      ]::text[]
    );

alter table app.class_sessions
  drop constraint class_sessions_discipline_check;

alter table app.class_sessions
  add constraint class_sessions_discipline_check
    check (
      discipline in (
        'Grappling',
        'Kickboxing',
        'Massage',
        'MMA',
        'Muay Thai',
        'Running',
        'Strength',
        'Wellness',
        'Yoga'
      )
    );
