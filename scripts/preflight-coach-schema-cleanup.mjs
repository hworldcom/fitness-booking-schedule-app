import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import postgres from "postgres";

const localDatabaseUrl =
  "postgresql://postgres:postgres@127.0.0.1:55322/postgres";
const useLocalDatabase = process.argv.includes("--local");
const useLinkedProject = process.argv.includes("--linked");

if (useLocalDatabase === useLinkedProject) {
  throw new Error("Choose exactly one preflight target: --local or --linked.");
}

const legacyTables = Object.freeze([
  "organization_wallet_authorities",
  "membership_checkins",
  "membership_arrival_requests",
  "class_reservations",
  "membership_daily_access_claims",
  "membership_period_core_gyms",
  "membership_periods",
  "membership_activation_operation_gyms",
  "membership_activation_operations",
  "membership_product_gym_eligibility",
  "membership_product_versions",
  "membership_products",
  "participating_gyms",
  "class_sessions",
  "trainer_affiliations",
  "venue_staff",
  "venues",
  "organization_memberships",
  "organizations",
]);

const expectedDependentTables = new Set([
  ...legacyTables,
  "auth_challenges",
  "wallet_bindings",
]);

function quoteIdentifier(identifier) {
  if (!/^[a-z_]+$/.test(identifier)) {
    throw new Error(`Unsafe SQL identifier: ${identifier}`);
  }
  return `"${identifier}"`;
}

function sqlTextArray(values) {
  return `array[${values.map((value) => `'${value}'`).join(", ")}]::text[]`;
}

function readLinkedProjectRef() {
  let projectRef;
  if (process.env.SUPABASE_PROJECT_REF) {
    projectRef = process.env.SUPABASE_PROJECT_REF;
  } else {
    try {
      projectRef = readFileSync(
        resolve("supabase/.temp/project-ref"),
        "utf8",
      ).trim();
    } catch {
      throw new Error(
        "SUPABASE_PROJECT_REF is required when supabase/.temp/project-ref is unavailable.",
      );
    }
  }

  if (!/^[a-z]{20}$/.test(projectRef)) {
    throw new Error("The linked Supabase project reference is malformed.");
  }
  return projectRef;
}

function readSupabaseAccessToken() {
  if (process.env.SUPABASE_ACCESS_TOKEN) {
    return process.env.SUPABASE_ACCESS_TOKEN;
  }

  if (process.platform === "darwin") {
    try {
      return execFileSync(
        "security",
        ["find-generic-password", "-s", "Supabase CLI", "-w"],
        {
          encoding: "utf8",
          stdio: ["ignore", "pipe", "ignore"],
        },
      ).trim();
    } catch {
      // Fall through to the secret-safe setup error below.
    }
  }

  throw new Error(
    "A Supabase CLI login or SUPABASE_ACCESS_TOKEN is required for --linked.",
  );
}

function linkedQuery(projectRef, accessToken) {
  const endpoint = `https://api.supabase.com/v1/projects/${projectRef}/database/query/read-only`;

  return async (query) => {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query }),
    });
    const responseBody = await response.text();
    if (!response.ok) {
      throw new Error(
        `Supabase read-only query returned ${response.status}: ${responseBody.slice(0, 1_000)}`,
      );
    }
    return JSON.parse(responseBody);
  };
}

const blockerDefinitions = Object.freeze([
  {
    name: "non_fixture_organizations",
    tables: ["organizations"],
    from: "app.organizations",
    where: "record_source <> 'fixture'",
  },
  {
    name: "non_fixture_venues",
    tables: ["venues"],
    from: "app.venues",
    where: "record_source <> 'fixture'",
  },
  {
    name: "non_fixture_organization_memberships",
    tables: ["organization_memberships", "profiles"],
    from: `app.organization_memberships as membership
      join app.profiles as profile on profile.id = membership.profile_id`,
    where: "profile.record_source <> 'fixture'",
  },
  {
    name: "organization_wallet_authorities",
    tables: ["organization_wallet_authorities"],
    from: "app.organization_wallet_authorities",
  },
  {
    name: "organization_wallet_bindings",
    tables: ["wallet_bindings"],
    from: "app.wallet_bindings",
    where: "owner_type = 'organization'",
  },
  {
    name: "organization_wallet_challenges",
    tables: ["auth_challenges"],
    from: "app.auth_challenges",
    where: "owner_type = 'organization'",
  },
  ...[
    "membership_activation_operations",
    "membership_periods",
    "membership_daily_access_claims",
    "class_reservations",
    "membership_arrival_requests",
    "membership_checkins",
  ].map((tableName) => ({
    name: tableName,
    tables: [tableName],
    from: `app.${quoteIdentifier(tableName)}`,
  })),
]);

async function runPreflight(query) {
  let preflightFailed = false;
  const relationRows = await query(`
    select table_name
    from information_schema.tables
    where table_schema = 'app'
      and table_type = 'BASE TABLE'
    order by table_name
  `);
  const existingRelations = new Set(relationRows.map((row) => row.table_name));
  const beforeCleanup = existingRelations.has("organizations");
  const afterCleanup = existingRelations.has("gyms");

  console.log(
    `Schema state: ${beforeCleanup ? "pre-cleanup" : afterCleanup ? "post-cleanup" : "unknown"}.`,
  );

  const existingLegacyTables = legacyTables.filter((tableName) =>
    existingRelations.has(tableName),
  );
  if (existingLegacyTables.length > 0) {
    const countRows = await query(
      existingLegacyTables
        .map(
          (tableName) =>
            `select '${tableName}' as table_name, count(*)::integer as count from app.${quoteIdentifier(tableName)}`,
        )
        .join("\nunion all\n"),
    );
    const countsByTable = new Map(
      countRows.map((row) => [row.table_name, row.count]),
    );
    for (const tableName of legacyTables) {
      if (countsByTable.has(tableName)) {
        console.log(`${tableName}: ${countsByTable.get(tableName)} rows`);
      } else {
        console.log(`${tableName}: absent`);
      }
    }
  }

  const retainedCountDefinitions = [
    {
      label: "profiles",
      table: "profiles",
      from: "app.profiles",
    },
    {
      label: "demo_run_participants",
      table: "demo_run_participants",
      from: "app.demo_run_participants",
    },
    {
      label: "personal_auth_challenges",
      table: "auth_challenges",
      from: "app.auth_challenges",
      where: beforeCleanup ? "owner_type = 'personal'" : undefined,
    },
    {
      label: "personal_wallet_bindings",
      table: "wallet_bindings",
      from: "app.wallet_bindings",
      where: beforeCleanup ? "owner_type = 'personal'" : undefined,
    },
  ].filter(({ table }) => existingRelations.has(table));
  if (retainedCountDefinitions.length > 0) {
    const retainedCountRows = await query(
      retainedCountDefinitions
        .map(
          ({ label, from, where }) =>
            `select '${label}' as retained_table, count(*)::integer as count from ${from}${where ? ` where ${where}` : ""}`,
        )
        .join("\nunion all\n"),
    );
    for (const { retained_table: retainedTable, count } of retainedCountRows) {
      console.log(`${retainedTable}: ${count} retained rows`);
    }
  }

  if (afterCleanup) {
    const gymRows = await query(`
      select
        count(*)::integer as total,
        count(*) filter (where record_source <> 'fixture')::integer
          as non_fixture
      from app.gyms
    `);
    console.log(`gyms: ${gymRows[0]?.total ?? 0} rows`);
    if ((gymRows[0]?.non_fixture ?? 0) > 0) {
      console.error(
        "BLOCKER: gyms contains non-fixture rows requiring review.",
      );
      preflightFailed = true;
    }
  }

  if (!beforeCleanup) {
    if (!afterCleanup) {
      console.error(
        "BLOCKER: neither the legacy organization schema nor app.gyms exists.",
      );
      preflightFailed = true;
    }
    return preflightFailed;
  }

  const availableBlockers = blockerDefinitions.filter((definition) =>
    definition.tables.every((tableName) => existingRelations.has(tableName)),
  );
  const blockerRows = await query(
    availableBlockers
      .map(
        ({ name, from, where }) =>
          `select '${name}' as blocker, count(*)::integer as count from ${from}${where ? ` where ${where}` : ""}`,
      )
      .join("\nunion all\n"),
  );
  for (const { blocker, count } of blockerRows) {
    if (count > 0) {
      console.error(`BLOCKER: ${blocker} has ${count} rows requiring review.`);
      preflightFailed = true;
    }
  }

  const locationTables = ["participating_gyms", "venues", "organizations"];
  if (locationTables.every((tableName) => existingRelations.has(tableName))) {
    const malformedLocations = await query(`
      select count(*)::integer as count
      from app.participating_gyms as participating_gym
      left join app.venues as venue
        on venue.run_id = participating_gym.run_id
        and venue.id = participating_gym.venue_id
      left join app.organizations as organization
        on organization.run_id = venue.run_id
        and organization.id = venue.organization_id
      left join pg_catalog.pg_timezone_names as timezone_record
        on timezone_record.name = venue.timezone
      where venue.id is null
        or organization.id is null
        or venue.record_source <> 'fixture'
        or organization.record_source <> 'fixture'
        or pg_catalog.char_length(venue.slug) not between 1 and 80
        or pg_catalog.char_length(venue.name) not between 2 and 160
        or pg_catalog.char_length(venue.description) not between 1 and 2000
        or pg_catalog.char_length(
          pg_catalog.concat_ws(
            ' — ',
            participating_gym.map_label,
            participating_gym.map_address
          )
        ) not between 2 and 240
        or pg_catalog.char_length(venue.area) not between 1 and 120
        or pg_catalog.char_length(venue.city) not between 1 and 120
        or venue.country_code !~ '^[A-Z]{2}$'
        or timezone_record.name is null
        or participating_gym.map_latitude not between -90 and 90
        or participating_gym.map_longitude not between -180 and 180
    `);
    if ((malformedLocations[0]?.count ?? 0) > 0) {
      console.error(
        `BLOCKER: ${malformedLocations[0].count} fictional gym locations are malformed.`,
      );
      preflightFailed = true;
    }
  }

  const dependencyRows = await query(`
    select
      source_table.relname as source_table,
      constraint_record.conname as constraint_name,
      target_table.relname as target_table
    from pg_catalog.pg_constraint as constraint_record
    join pg_catalog.pg_class as source_table
      on source_table.oid = constraint_record.conrelid
    join pg_catalog.pg_namespace as source_namespace
      on source_namespace.oid = source_table.relnamespace
    join pg_catalog.pg_class as target_table
      on target_table.oid = constraint_record.confrelid
    join pg_catalog.pg_namespace as target_namespace
      on target_namespace.oid = target_table.relnamespace
    where constraint_record.contype = 'f'
      and source_namespace.nspname = 'app'
      and target_namespace.nspname = 'app'
      and target_table.relname = any (${sqlTextArray(legacyTables)})
    order by source_table.relname, constraint_record.conname
  `);
  console.log(
    `Foreign-key dependencies targeting retired tables: ${dependencyRows.length}.`,
  );
  for (const dependency of dependencyRows) {
    console.log(
      `${dependency.source_table}.${dependency.constraint_name} -> ${dependency.target_table}`,
    );
    if (!expectedDependentTables.has(dependency.source_table)) {
      console.error(
        `BLOCKER: unexpected dependent table ${dependency.source_table}.`,
      );
      preflightFailed = true;
    }
  }

  return preflightFailed;
}

let preflightFailed = false;
let connection;

try {
  if (useLocalDatabase) {
    connection = postgres(localDatabaseUrl, {
      max: 1,
      prepare: false,
      ssl: false,
    });
    await connection.begin(async (transaction) => {
      await transaction.unsafe("set transaction read only");
      preflightFailed = await runPreflight((query) =>
        transaction.unsafe(query),
      );
    });
  } else {
    const projectRef = readLinkedProjectRef();
    const accessToken = readSupabaseAccessToken();
    preflightFailed = await runPreflight(linkedQuery(projectRef, accessToken));
  }
} catch (error) {
  const message =
    error instanceof Error ? error.message : "Unknown database error";
  console.error(`Coach schema cleanup preflight failed: ${message}`);
  preflightFailed = true;
} finally {
  if (connection) {
    await connection.end({ timeout: 5 });
  }
}

if (preflightFailed) {
  process.exitCode = 1;
} else {
  console.log("Coach schema cleanup preflight passed.");
}
