import { execFileSync } from "node:child_process";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { demoHostedTarget } from "./lib/demo-coach-target";
import {
  demoRetirementArgument,
  demoRetirementProofStatements,
} from "./lib/demo-coach-retirement";

let work: string | undefined;
try {
  const apply = demoRetirementArgument(process.argv.slice(2));
  const target = demoHostedTarget(process.env);
  work = await mkdtemp(path.join(tmpdir(), "movx-dev0349-retirement-"));
  await mkdir(path.join(work, "supabase"));
  await writeFile(
    path.join(work, "supabase/config.toml"),
    'project_id="dev0349_retirement"\n',
    { mode: 0o600 },
  );
  const sqlFile = path.join(work, "retire.sql");
  await writeFile(
    sqlFile,
    `begin isolation level repeatable read; ${demoRetirementProofStatements(apply)} commit; select result from pg_temp.demo_retirement_evidence;`,
    { mode: 0o600 },
  );
  let response: { rows?: { result: unknown }[] };
  try {
    response = JSON.parse(
      execFileSync(
        path.join(process.cwd(), "node_modules/.bin/supabase"),
        [
          "db",
          "query",
          "--linked",
          "--project-ref",
          target.projectRef,
          "--workdir",
          work,
          "--file",
          sqlFile,
          "--output",
          "json",
        ],
        {
          encoding: "utf8",
          stdio: ["ignore", "pipe", "pipe"],
          timeout: 60_000,
          maxBuffer: 1024 * 1024,
        },
      ),
    );
  } catch {
    throw new Error(
      "Hosted demo retirement refused or failed. Check exact fixture ownership/schema and CLI access. No fallback or broad reset was attempted.",
    );
  }
  if (response.rows?.length !== 1)
    throw new Error("Unexpected bounded retirement evidence response.");
  console.log(
    JSON.stringify(
      { environment: "dev", ...(response.rows[0].result as object) },
      null,
      2,
    ),
  );
} catch (error) {
  console.error(
    error instanceof Error ? error.message : "Hosted demo retirement failed.",
  );
  process.exitCode = 1;
} finally {
  if (work) await rm(work, { recursive: true, force: true });
}
