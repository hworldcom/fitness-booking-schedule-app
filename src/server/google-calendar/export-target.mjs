/** Configuration-only check shared by server startup and build validation.
 * @param {Readonly<Record<string, string | undefined>>} env
 */
export function calendarExportTargetMatches(env) {
  try {
    const runtime = new URL(env.DATABASE_URL ?? "");
    const worker = new URL(env.GOOGLE_CALENDAR_WORKER_DATABASE_URL ?? "");
    const runtimeUser = decodeURIComponent(runtime.username);
    const workerUser = decodeURIComponent(worker.username);
    if (
      !/^postgres(?:ql)?:$/.test(runtime.protocol) ||
      !/^postgres(?:ql)?:$/.test(worker.protocol) ||
      !runtime.hostname ||
      runtime.hostname !== worker.hostname ||
      (runtime.port || "5432") !== (worker.port || "5432") ||
      runtime.pathname === "/" ||
      runtime.pathname !== worker.pathname ||
      !runtimeUser ||
      !workerUser ||
      !worker.password ||
      worker.hash ||
      workerUser === runtimeUser ||
      [
        "postgres",
        "supabase_admin",
        "app_owner",
        "app_runtime",
        "service_role",
      ].includes(workerUser.split(".")[0])
    )
      return false;
    if (runtime.hostname.endsWith(".pooler.supabase.com")) {
      const ordinary = runtimeUser.split("."),
        delivery = workerUser.split(".");
      if (
        ordinary.length !== 2 ||
        delivery.length !== 2 ||
        ordinary[1] !== delivery[1]
      )
        return false;
      if (
        new URL(env.NEXT_PUBLIC_SUPABASE_URL ?? "").hostname !==
        ordinary[1] + ".supabase.co"
      )
        return false;
    }
    return true;
  } catch {
    return false;
  }
}
