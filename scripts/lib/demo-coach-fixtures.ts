import { SEEDED_COACH_ACCOUNTS } from "./local-coach-accounts";

// Descriptions are fictional examples, never credentials, endorsements or reviews.
const samples = [
  {
    previousBio:
      "A patient boxing coach focused on balanced footwork, clean fundamentals and private sessions that meet each client at the right pace.",
    introduction:
      "Build boxing confidence with clear feedback, balanced footwork and focused pad rounds.",
    approach:
      "We start with your goals and a comfortable warm-up, then work on stance, movement and combinations. Each session finishes with a short recap and something practical to work on next time. Beginners and returning athletes are welcome.",
    focusLabels: ["Boxing fundamentals", "Footwork", "Beginner confidence"],
    bring:
      "Comfortable training clothes, water and your own hand wraps. Ask about gloves before your first session.",
  },
  {
    previousBio:
      "A technical Muay Thai coach who builds confident combinations through calm pad work, clear feedback and carefully paced private training.",
    introduction:
      "Find your rhythm in Muay Thai with relaxed pad work, purposeful combinations and steady progress.",
    approach:
      "We build from stance and balance to punches, kicks and controlled knees. Short technical rounds leave room for questions and feedback. Training intensity follows your experience and goals; contact drills are always discussed first.",
    focusLabels: ["Muay Thai", "Pad work", "Balance and timing"],
    bring:
      "Training clothes, water, hand wraps and gloves if you have them. We discuss suitable equipment before training.",
  },
  {
    previousBio:
      "An MMA fundamentals coach who connects striking and wrestling with practical movement, structured drills and supportive one-to-one sessions.",
    introduction:
      "Make sense of MMA through approachable striking, wrestling entries and movement drills.",
    approach:
      "Each session has one clear theme, from distance management to moving safely between standing and ground positions. We practise progressively, agree contact levels together and leave time to review what felt useful. You do not need competition experience.",
    focusLabels: ["MMA fundamentals", "Movement", "Controlled partner drills"],
    bring:
      "Clean training clothes, water and a towel. Ask which gloves or protective equipment suit your planned session.",
  },
  {
    previousBio:
      "A detail-oriented Brazilian Jiu-Jitsu coach helping clients understand position, pressure and escapes through focused private practice.",
    introduction:
      "Understand no-gi grappling through patient explanations, positional practice and useful escapes.",
    approach:
      "We explore one position at a time, connecting frames, balance and movement before adding resistance. Repetition and clear stopping signals keep practice collaborative. Sessions can focus on first steps or a specific problem from your regular training.",
    focusLabels: ["No-gi grappling", "Escapes", "Positional understanding"],
    bring:
      "Clean close-fitting sportswear without zips, water and a towel. Remove jewellery before stepping onto the mats.",
  },
  {
    previousBio:
      "A kickboxing coach combining precise technique with energetic conditioning, especially for clients building confidence in their first private sessions.",
    introduction:
      "Enjoy kickboxing with crisp combinations, encouraging feedback and conditioning at your pace.",
    approach:
      "A typical session combines an easy warm-up, technique on pads and short conditioning rounds. We develop guard, footwork and balanced kicks before adding speed. New starters can learn without sparring; every session is adapted together.",
    focusLabels: ["Kickboxing", "Pad combinations", "Fitness and confidence"],
    bring:
      "Comfortable sportswear, water, hand wraps and gloves if available. Ask about equipment before your first visit.",
  },
  {
    previousBio:
      "A friendly fitness coach focused on practical strength, conditioning and building a consistent training routine.",
    introduction:
      "Get stronger and feel fitter with approachable strength training, useful conditioning and a plan that fits your week.",
    approach:
      "We start with your goals and current routine, then practise comfortable squat, hinge, push and pull patterns. Sessions mix technique, manageable resistance and short conditioning rounds. Clear feedback and steady progression help beginners and returning athletes build consistency.",
    focusLabels: ["Fitness", "Strength fundamentals", "Conditioning"],
    bring:
      "Comfortable sportswear, clean training shoes, water and a towel. We agree the session intensity together before starting.",
  },
] as const;

export const DEMO_COACH_FIXTURES = SEEDED_COACH_ACCOUNTS.map((coach, index) => {
  const sample = samples[index];
  return Object.freeze({
    ...coach,
    previousBio: sample.previousBio,
    bio: `${sample.introduction}\n\n${sample.approach}`,
    portraitPath: `/images/coaches/${coach.slug}.webp`,
    website: {
      brandLabel: `${coach.displayName} Coaching`,
      introduction: sample.introduction,
      approach: sample.approach,
      experience:
        "Fictional development profile for testing MovX. This sample does not represent a real coach or verified professional qualifications.",
      focusLabels: [...sample.focusLabels],
      faqs: [
        {
          question: "Can I start as a beginner?",
          answer:
            "Yes. Tell me about your experience and goals so we can agree a comfortable starting point.",
        },
        { question: "What should I bring?", answer: sample.bring },
        {
          question: "Where will we train?",
          answer:
            "Choose one of the active Berlin training locations on this profile. These are fictional development examples, not real venue offers.",
        },
      ],
      links: [],
    },
  });
});

export const DEMO_FIXTURE_VERSION = 1;
export const FOUNDATION_RUN_ID = "20000000-0000-4000-8000-000000000001";

export { fitnessDemoCoachSeedSql } from "./demo-coach-seed.mjs";

export type DemoCoachState = {
  profile_id: string;
  auth_user_id: string | null;
  record_source: string;
  claimed_at: string | null;
  run_id: string;
  run_slug: string;
  run_status: string;
  participant_status: string;
  participant_role: string;
  public_slug: string;
  coach_record_source: string;
  is_demo: boolean;
};

export function assertDemoCoachStates(rows: readonly DemoCoachState[]) {
  if (rows.length !== DEMO_COACH_FIXTURES.length)
    throw new Error(
      "Expected the complete foundation demo coach allowlist; no database reset or broad seed was attempted.",
    );
  for (const coach of DEMO_COACH_FIXTURES) {
    const row = rows.find(
      (candidate) => candidate.profile_id === coach.profileId,
    );
    if (
      !row ||
      row.run_id !== FOUNDATION_RUN_ID ||
      row.run_slug !== "local-foundation-2030" ||
      row.run_status !== "active" ||
      row.participant_status !== "active" ||
      !row.is_demo ||
      row.public_slug !== coach.slug
    )
      throw new Error(`Demo fixture identity conflicts for ${coach.slug}.`);
    const untouched =
      row.auth_user_id === null &&
      row.record_source === "fixture" &&
      row.claimed_at === null &&
      row.coach_record_source === "fixture" &&
      row.participant_role === coach.seedParticipantRole;
    const claimed =
      row.auth_user_id === coach.authUserId &&
      row.record_source === "user" &&
      row.claimed_at !== null &&
      row.coach_record_source === "user" &&
      row.participant_role === "member";
    if (!untouched && !claimed)
      throw new Error(`Demo fixture ownership conflicts for ${coach.slug}.`);
  }
}

export function sqlLiteral(value: string) {
  if (value.includes("\0")) throw new Error("NUL is not valid fixture text.");
  return "'" + value.replaceAll("'", "''") + "'";
}

// One batch; PostgreSQL checks and applies all allowlisted ownership bindings atomically.
export function demoCoachDefaultsStatements(
  profileIds: readonly string[],
  websiteIds: readonly string[],
  passwordIds: readonly string[],
) {
  const wanted = new Set([...profileIds, ...websiteIds, ...passwordIds]);
  if (
    [...wanted].some(
      (id) => !DEMO_COACH_FIXTURES.some((coach) => coach.profileId === id),
    )
  )
    throw new Error("Unknown demo profile in fixture plan.");
  const selected = DEMO_COACH_FIXTURES.filter((coach) =>
    wanted.has(coach.profileId),
  );
  if (!selected.length) return "select true as preserved;";
  const statements = selected.map((coach) => {
    const profile = sqlLiteral(coach.profileId) + "::uuid";
    const auth = sqlLiteral(coach.authUserId) + "::uuid";
    const run = sqlLiteral(FOUNDATION_RUN_ID) + "::uuid";
    return `
      if not exists(select 1 from app.profiles p join app.coach_profiles c on c.profile_id=p.id and c.run_id=${run}
        join app.demo_run_participants d on d.profile_id=p.id and d.run_id=c.run_id
        where p.id=${profile} and c.is_demo and c.public_slug=${sqlLiteral(coach.slug)}
          and (p.auth_user_id is null and p.record_source='fixture' and p.claimed_at is null and c.record_source='fixture' and d.role=${sqlLiteral(coach.seedParticipantRole)}
            or p.auth_user_id=${auth} and p.record_source='user' and p.claimed_at is not null and c.record_source='user' and d.role='member')
          and d.status='active') then raise exception 'Demo fixture ownership changed'; end if;
      update app.profiles set auth_user_id=${auth},record_source='user',claimed_at=coalesce(claimed_at,statement_timestamp()),updated_at=statement_timestamp()
        where id=${profile} and auth_user_id is null;
      update app.demo_run_participants set role='member',updated_at=statement_timestamp() where profile_id=${profile} and run_id=${run} and role<>'member';
      update app.coach_profiles set record_source='user',updated_at=statement_timestamp() where profile_id=${profile} and run_id=${run} and record_source='fixture';
      ${
        passwordIds.includes(coach.profileId)
          ? `
      if to_regprocedure('app.record_password_method(uuid)') is not null then perform app.record_password_method(${auth}); end if;
      if to_regprocedure('app.revoke_auth_credentials(uuid,timestamp with time zone)') is not null then perform app.revoke_auth_credentials(${auth},statement_timestamp()); end if;
      delete from auth.sessions where user_id=${auth};
      `
          : ""
      }
    `;
  });
  return `set local lock_timeout='5s';set local statement_timeout='30s';
    select set_config('app.coach_profile_management','on',true);
    select p.id from app.profiles p join app.coach_profiles c on c.profile_id=p.id
      join app.demo_run_participants d on d.profile_id=p.id and d.run_id=c.run_id
      where c.run_id='${FOUNDATION_RUN_ID}'::uuid and p.id in (${selected.map((coach) => sqlLiteral(coach.profileId) + "::uuid").join(",")})
      order by p.id for update of p,c,d;
    do $demo_defaults$ begin ${statements.join("\n")} end $demo_defaults$;`;
}

export function demoCoachDefaultsSql(
  profileIds: readonly string[],
  websiteIds: readonly string[],
  passwordIds: readonly string[],
) {
  return `begin; ${demoCoachDefaultsStatements(profileIds, websiteIds, passwordIds)} commit; select true as prepared;`;
}
