import { randomBytes } from "node:crypto";
import { constants } from "node:fs";
import {
  chmod,
  lstat,
  mkdir,
  open,
  readFile,
  rename,
  rm,
} from "node:fs/promises";
import path from "node:path";
import { DEMO_COACH_FIXTURES } from "./demo-coach-fixtures";

export type DemoEnvironment = "local" | "dev";
export type DemoCredential = {
  email: string;
  authUserId: string;
  password: string;
  initializedAt: string | null;
};
export type DemoCredentials = {
  environment: DemoEnvironment;
  target: string;
  note: string;
  coaches: Record<string, DemoCredential>;
};

export async function privateDemoCredentialStore(
  root: string,
  environment: DemoEnvironment,
  target: string,
) {
  const directory = path.join(root, "work", "demo-coaches");
  await mkdir(directory, { recursive: true, mode: 0o700 });
  if (
    !(await lstat(directory)).isDirectory() ||
    (await lstat(directory)).isSymbolicLink()
  )
    throw new Error("Private demo credential directory must not be a symlink.");
  await chmod(directory, 0o700);
  const file = path.join(directory, `${environment}.json`);
  const lock = path.join(directory, `${environment}.lock`);
  try {
    await mkdir(lock, { mode: 0o700 });
  } catch {
    throw new Error(
      `Demo setup is already running, or an interrupted setup left ${lock}. Check before removing this exact lock directory.`,
    );
  }
  try {
    let credentials: DemoCredentials = {
      environment,
      target,
      note: "Private initial tester passwords. Do not commit or publish. Existing accounts are never overwritten by setup; these saved initial values can become stale after an owner password change. Use the account recovery flow for deliberate individual password changes.",
      coaches: {},
    };
    try {
      const stat = await lstat(file);
      if (!stat.isFile() || stat.isSymbolicLink() || stat.size > 32000)
        throw new Error("Invalid private demo credential file.");
      await chmod(file, 0o600);
      const saved = JSON.parse(await readFile(file, "utf8")) as DemoCredentials;
      if (
        saved.environment !== environment ||
        saved.target !== target ||
        !saved.coaches ||
        typeof saved.coaches !== "object"
      )
        throw new Error("Demo credentials belong to another target.");
      for (const [slug, value] of Object.entries(saved.coaches)) {
        const coach = DEMO_COACH_FIXTURES.find(
          (candidate) => candidate.slug === slug,
        );
        if (
          !coach ||
          value.email !== coach.email ||
          value.authUserId !== coach.authUserId ||
          typeof value.password !== "string" ||
          value.password.length < 20 ||
          value.password.length > 72
        )
          throw new Error("Invalid demo credential entry.");
      }
      credentials = { ...saved, note: credentials.note };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
    return {
      file,
      credentials,
      async save() {
        const temporary = `${file}.${randomBytes(8).toString("hex")}.tmp`;
        const handle = await open(
          temporary,
          constants.O_WRONLY |
            constants.O_CREAT |
            constants.O_EXCL |
            constants.O_NOFOLLOW,
          0o600,
        );
        try {
          await handle.writeFile(JSON.stringify(credentials, null, 2) + "\n");
          await handle.sync();
        } finally {
          await handle.close();
        }
        try {
          await rename(temporary, file);
        } finally {
          await rm(temporary, { force: true });
        }
      },
      close: () => rm(lock, { recursive: true }),
    };
  } catch (error) {
    await rm(lock, { recursive: true });
    throw error;
  }
}

export function generateDemoPassword() {
  return `MovX!9a-${randomBytes(20).toString("base64url")}`;
}
