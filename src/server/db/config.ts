export type DatabaseRuntimeConfig = Readonly<{
  connectionString: string;
  ssl: false | "require";
}>;

export class DatabaseConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DatabaseConfigurationError";
  }
}

function isLocalHostname(hostname: string) {
  return (
    hostname === "127.0.0.1" ||
    hostname === "localhost" ||
    hostname === "::1" ||
    hostname === "host.docker.internal" ||
    hostname.startsWith("supabase_db_")
  );
}

export function parseDatabaseUrl(
  value: string | undefined,
): DatabaseRuntimeConfig {
  if (!value?.trim()) {
    throw new DatabaseConfigurationError(
      "DATABASE_URL is required when a server database module is initialized.",
    );
  }

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new DatabaseConfigurationError(
      "DATABASE_URL must be a valid PostgreSQL connection URL.",
    );
  }

  if (url.protocol !== "postgres:" && url.protocol !== "postgresql:") {
    throw new DatabaseConfigurationError(
      "DATABASE_URL must use the postgres or postgresql protocol.",
    );
  }
  if (!url.hostname || !url.username || url.pathname === "/") {
    throw new DatabaseConfigurationError(
      "DATABASE_URL must include a host, user and database name.",
    );
  }

  return Object.freeze({
    connectionString: url.toString(),
    ssl: isLocalHostname(url.hostname) ? false : "require",
  });
}
