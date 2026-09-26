import { address } from "@solana/kit";
import postgres from "postgres";

const databaseUrl =
  process.env.DATABASE_TEST_URL ??
  "postgresql://postgres:postgres@127.0.0.1:55322/postgres";
const email = process.env.CLUB_ADMIN_EMAIL?.trim().toLowerCase();
const walletInput = process.env.CLUB_WALLET_ADDRESS?.trim();
const organizationSlug = process.env.CLUB_SLUG?.trim() || "northside-combat";

if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
  throw new Error("CLUB_ADMIN_EMAIL must name an existing local account.");
}
if (!walletInput) {
  throw new Error("CLUB_WALLET_ADDRESS is required.");
}

let walletAddress;
try {
  walletAddress = address(walletInput);
} catch {
  throw new Error("CLUB_WALLET_ADDRESS must be a canonical Solana address.");
}

const sql = postgres(databaseUrl, { max: 1, prepare: false, ssl: false });
try {
  const result = await sql.begin(async (transaction) => {
    const people = await transaction`
      select
        auth_user.id as auth_user_id,
        profile.id as profile_id,
        participant.run_id
      from auth.users as auth_user
      join app.profiles as profile on profile.auth_user_id = auth_user.id
      join app.demo_run_participants as participant
        on participant.profile_id = profile.id
        and participant.status = 'active'
      where lower(auth_user.email) = ${email}
        and profile.record_source = 'user'
        and profile.claimed_at is not null
    `;
    if (people.length !== 1) {
      throw new Error(
        "The email must have exactly one enrolled local MovX Club profile.",
      );
    }
    const clubs = await transaction`
      select id, run_id, name
      from app.organizations
      where slug = ${organizationSlug}
        and status = 'active'
        and run_id = ${people[0].run_id}::uuid
    `;
    if (clubs.length !== 1) {
      throw new Error("CLUB_SLUG must identify one active local club.");
    }
    const person = people[0];
    const club = clubs[0];

    await transaction`
      update app.organization_wallet_authorities
      set
        revoked_at = statement_timestamp(),
        revocation_reason = 'context-changed'
      where run_id = ${club.run_id}::uuid
        and organization_id = ${club.id}::uuid
        and revoked_at is null
    `;
    await transaction`
      update app.organization_memberships
      set
        status = 'revoked',
        revoked_at = statement_timestamp()
      where run_id = ${club.run_id}::uuid
        and organization_id = ${club.id}::uuid
        and role = 'primary_admin'
        and status = 'active'
        and profile_id <> ${person.profile_id}::uuid
    `;
    await transaction`
      insert into app.organization_memberships (
        run_id,
        organization_id,
        profile_id,
        role,
        status,
        revoked_at
      )
      values (
        ${club.run_id}::uuid,
        ${club.id}::uuid,
        ${person.profile_id}::uuid,
        'primary_admin',
        'active',
        null
      )
      on conflict (run_id, organization_id, profile_id)
      do update set
        role = 'primary_admin',
        status = 'active',
        revoked_at = null
    `;
    await transaction`
      update app.wallet_bindings
      set
        status = 'revoked',
        revoked_at = statement_timestamp(),
        revocation_reason = 'legacy'
      where run_id = ${club.run_id}::uuid
        and organization_id = ${club.id}::uuid
        and owner_type = 'organization'
        and status = 'active'
    `;
    await transaction`
      insert into app.wallet_bindings (
        run_id,
        cluster,
        wallet_address,
        owner_type,
        profile_id,
        organization_id,
        bound_by_auth_user_id,
        provenance,
        status,
        verified_at
      )
      values (
        ${club.run_id}::uuid,
        'solana:devnet',
        ${walletAddress},
        'organization',
        null,
        ${club.id}::uuid,
        ${person.auth_user_id}::uuid,
        'prepared',
        'active',
        statement_timestamp()
      )
    `;
    return { clubName: club.name, walletAddress };
  });
  console.log(
    `Prepared ${result.clubName} for ${email} with club wallet ${result.walletAddress}.`,
  );
} finally {
  await sql.end();
}
