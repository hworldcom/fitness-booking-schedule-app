import { readFileSync } from "node:fs";

const targets = JSON.parse(
  readFileSync(
    new URL("../../config/supabase-environments.json", import.meta.url),
    "utf8",
  ),
);

export function hostedTarget(environment) {
  if (environment !== "dev" && environment !== "prod")
    throw new Error("Select the hosted environment explicitly: dev or prod.");
  return Object.freeze({ environment, ...targets[environment] });
}

export function hostedRuntimeConfiguration(values, environment) {
  const target = hostedTarget(environment);
  const connectionString = values.DATABASE_URL?.trim();
  const authUrl = values.NEXT_PUBLIC_SUPABASE_URL?.trim();
  if (!connectionString || !authUrl)
    throw new Error(
      "Hosted verification requires DATABASE_URL and NEXT_PUBLIC_SUPABASE_URL.",
    );
  let database;
  let auth;
  try {
    database = new URL(connectionString);
    auth = new URL(authUrl);
  } catch {
    throw new Error(
      "Hosted database/Auth configuration must contain valid URLs.",
    );
  }
  if (
    !["postgres:", "postgresql:"].includes(database.protocol) ||
    !database.hostname.endsWith(".pooler.supabase.com") ||
    database.port !== "6543" ||
    database.pathname !== "/postgres" ||
    !database.password ||
    database.search ||
    database.hash
  )
    throw new Error(
      "Hosted DATABASE_URL must use a credentialed Supabase transaction pooler on port 6543 for postgres, without URL options.",
    );
  if (
    auth.origin !== `https://${target.projectRef}.supabase.co` ||
    auth.pathname !== "/" ||
    auth.username ||
    auth.password ||
    auth.search ||
    auth.hash
  )
    throw new Error(
      "The public Auth URL does not match the selected hosted environment.",
    );
  let username;
  try {
    username = decodeURIComponent(database.username);
  } catch {
    throw new Error("The hosted runtime username is invalid.");
  }
  if (username !== `${target.runtimeUser}.${target.projectRef}`)
    throw new Error(
      "DATABASE_URL must use the selected environment's dedicated runtime role and project suffix.",
    );
  return Object.freeze({ ...target, connectionString });
}

export function hostedDevelopmentConfiguration(values) {
  const configuration = hostedRuntimeConfiguration(values, "dev");
  const key = values.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim();
  if (!key || !/^sb_publishable_[A-Za-z0-9_-]+$/.test(key))
    throw new Error(
      "Hosted development requires the dev project's public sb_publishable_ key.",
    );
  let site;
  try {
    site = new URL(values.NEXT_PUBLIC_SITE_URL);
  } catch {
    throw new Error("Hosted development requires NEXT_PUBLIC_SITE_URL.");
  }
  if (
    site.protocol !== "http:" ||
    site.hostname !== "localhost" ||
    site.pathname !== "/" ||
    site.search ||
    site.hash ||
    site.username ||
    site.password ||
    !site.port ||
    Number(site.port) < 1024
  )
    throw new Error(
      "Hosted development requires an exact http://localhost:<port> origin on an unprivileged port.",
    );
  return Object.freeze({
    ...configuration,
    siteUrl: site.origin,
    port: site.port,
  });
}

export function redactHostedError(error, connectionString) {
  let message =
    error instanceof Error ? error.message : "Unknown database error";
  if (!connectionString) return message;
  const parsed = new URL(connectionString);
  let decodedPassword = parsed.password;
  try {
    decodedPassword = decodeURIComponent(parsed.password);
  } catch {
    /* Keep encoded redaction for malformed percent escapes. */
  }
  for (const value of [connectionString, parsed.password, decodedPassword])
    if (value) message = message.replaceAll(value, "[redacted]");
  return message;
}

export function hostedEnvironmentArgument(args) {
  if (args.length !== 2 || args[0] !== "--environment")
    throw new Error(
      "Usage: verify-hosted-runtime-database.mjs --environment dev|prod",
    );
  return hostedTarget(args[1]).environment;
}
