export const LOCAL_SUPABASE_PROJECT_ID = "movx-club-local";
export const LOCAL_SUPABASE_DATABASE_CONTAINER = `supabase_db_${LOCAL_SUPABASE_PROJECT_ID}`;

// This deliberately accepts only the literal identity/ports owned by this repo.
// Other TOML configuration remains the CLI's responsibility.
export function assertLocalSupabaseConfiguration(source) {
  const expected = new Map([
    [".project_id", '"' + LOCAL_SUPABASE_PROJECT_ID + '"'],
    ["api.port", "55321"],
    ["db.port", "55322"],
    ["local_smtp.port", "55324"],
  ]);
  const found = new Map();
  let section = "";
  for (const line of source.split(/\r?\n/)) {
    const heading = /^\s*\[([^\]]+)\]\s*(?:#.*)?$/.exec(line);
    if (heading) section = heading[1];
    const assignment = /^\s*([a-z_]+)\s*=\s*(.*?)\s*(?:#.*)?$/.exec(line);
    if (!assignment) continue;
    const key = section + "." + assignment[1];
    if (!expected.has(key)) continue;
    if (found.has(key) || assignment[2] !== expected.get(key)) {
      throw new Error(
        "Local Supabase must use movx-club-local and repository ports 55321/55322/55324; retained projects cannot be used by this launcher.",
      );
    }
    found.set(key, assignment[2]);
  }
  if (found.size !== expected.size) {
    throw new Error(
      "The local Supabase identity/port configuration is incomplete.",
    );
  }
}
