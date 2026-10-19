/** Isolated local HTTP/Storage rehearsal. Never provisions retained/demo accounts. */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { execFileSync, spawn } from "node:child_process";
import { openSync } from "node:fs";
import {
  cp,
  mkdir,
  mkdtemp,
  symlink,
  writeFile,
  readdir,
  readFile,
} from "node:fs/promises";
import sharp from "sharp";
import { createClient } from "@supabase/supabase-js";
import {
  localConnectionRehearsal,
  type LocalPerson,
} from "./lib/local-connection-rehearsal";
import {
  assertLoopbackSupabaseTargets,
  parseLocalSupabaseStatus,
} from "./lib/local-coach-accounts";
import { localDevelopmentProcessEnvironment } from "./lib/local-development";
import { normalizeCanonicalProfileImage } from "../src/server/profile-images/image-normalization";

const status = parseLocalSupabaseStatus(
  execFileSync("node_modules/.bin/supabase", ["status", "-o", "env"], {
    stdio: ["ignore", "pipe", "pipe"],
  }).toString(),
);
assertLoopbackSupabaseTargets(status);
const base = "http://localhost:3182";
const reuse = process.env.SHARED_PICTURE_PREVIEW_PATH;
const preview = reuse ?? (await mkdtemp("/private/tmp/movx-dev0382-"));
assert.match(preview, /^\/private\/tmp\/movx-dev0382-[A-Za-z0-9]{6}$/);
if (reuse) {
  const files = (await readdir("src", { recursive: true }))
    .filter((p) => /\.(tsx?|css)$/.test(p))
    .sort();
  const savedFiles = (await readdir(`${preview}/src`, { recursive: true }))
    .filter((p) => /\.(tsx?|css)$/.test(p))
    .sort();
  assert.deepEqual(
    savedFiles,
    files,
    "Owned preview source inventory changed.",
  );
  for (const path of files)
    assert.ok(
      (await readFile(`src/${path}`)).equals(
        await readFile(`${preview}/src/${path}`),
      ),
      `Owned preview source differs: ${path}`,
    );
  for (const path of ["next.config.ts", "postcss.config.mjs"])
    assert.ok(
      (await readFile(path)).equals(await readFile(`${preview}/${path}`)),
      `Owned preview config differs: ${path}`,
    );
  const currentPackage = JSON.parse(await readFile("package.json", "utf8"));
  const previewPackage = JSON.parse(
    await readFile(`${preview}/package.json`, "utf8"),
  );
  delete currentPackage.scripts;
  delete previewPackage.scripts;
  assert.deepEqual(
    previewPackage,
    currentPackage,
    "Owned preview runtime package/dependencies changed.",
  );
  await readFile(`${preview}/.next/BUILD_ID`);
} else {
  for (const path of [
    "src",
    "public",
    "scripts",
    "package.json",
    "tsconfig.json",
    "next-env.d.ts",
    "next.config.ts",
    "postcss.config.mjs",
  ])
    await cp(path, `${preview}/${path}`, { recursive: true });
  await symlink(`${process.cwd()}/node_modules`, `${preview}/node_modules`);
}
const log = openSync(`${preview}/server.log`, "a", 0o600);
const next = `${process.cwd()}/node_modules/next/dist/bin/next`;
const environment = {
  ...localDevelopmentProcessEnvironment(status),
  NEXT_PUBLIC_SITE_URL: base,
};
console.log(
  JSON.stringify({
    preview,
    base,
    build: reuse ? "matching production source reused" : "started",
  }),
);
if (!reuse) {
  const build = spawn(process.execPath, [next, "build", "--webpack"], {
    cwd: preview,
    env: environment,
    stdio: ["ignore", log, log],
  });
  assert.equal(
    await new Promise((resolve) => build.on("exit", resolve)),
    0,
    "Owned local preview build failed; see server.log.",
  );
}
const child = spawn(
  process.execPath,
  [next, "start", "--hostname", "localhost", "--port", "3182"],
  { cwd: preview, env: environment, stdio: ["ignore", log, log] },
);
process.env.CONNECTION_TEST_SITE_URL = base;
const fixture = await localConnectionRehearsal("DEV0382");
const {
  database: db,
  person,
  approveCoach,
  work,
  cookieHeader,
  cleanup,
} = fixture;
const evidence = `test-results/dev0382-shared-picture/${randomUUID()}`;
await mkdir(evidence, { recursive: true, mode: 0o700 });
const people: LocalPerson[] = [];
const checked: string[] = [];
const originals = async () =>
  (
    await db<{ key: string; hash: string }[]>`
  select 'profile:'||id::text key,md5(to_jsonb(t)::text) hash from app.profiles t
  union all select 'coach:'||profile_id::text,md5(to_jsonb(t)::text) from app.coach_profiles t
  union all select 'application:'||profile_id::text,md5(to_jsonb(t)::text) from app.coach_applications t
  union all select 'object:'||id::text,md5(to_jsonb(t)::text) from storage.objects t
`
  )
    .map((row) => [row.key, row.hash])
    .sort((a, b) => a[0].localeCompare(b[0]));
const baseline = await originals();
await writeFile(`${evidence}/baseline.json`, JSON.stringify(baseline), {
  mode: 0o600,
});
async function request(
  path: string,
  actor?: LocalPerson,
  init: RequestInit = {},
) {
  return fetch(base + path, {
    ...init,
    redirect: "manual",
    signal: AbortSignal.timeout(90000),
    headers: {
      origin: base,
      ...(actor ? { cookie: cookieHeader(actor) } : {}),
      ...init.headers,
    },
  });
}
async function mutation(
  path: string,
  actor: LocalPerson | undefined,
  method = "POST",
  body?: Uint8Array<ArrayBuffer>,
) {
  const response = await request(path, actor, {
    method,
    ...(path.endsWith("/portrait/account") && actor
      ? {
          body: JSON.stringify({ profileId: actor.actor.profileId }),
          headers: { "content-type": "application/json" },
        }
      : {}),
    ...(body ? { body, headers: { "content-type": "image/webp" } } : {}),
  });
  assert.equal(
    response.status,
    200,
    `${path}: ${await response.clone().text()}`,
  );
  return response.json() as Promise<{
    status: string;
    imageUrl: string | null;
  }>;
}
async function denied(path: string, actor?: LocalPerson) {
  const response = await request(path, actor);
  assert.equal(response.status, 404);
  assert.equal((await response.arrayBuffer()).byteLength, 0);
  assert.match(response.headers.get("cache-control") ?? "", /no-store/);
}
async function image(path: string, expected: Uint8Array, actor?: LocalPerson) {
  const response = await request(path, actor);
  assert.equal(response.status, 200, path);
  assert.equal(response.headers.get("content-type"), "image/webp");
  assert.match(response.headers.get("cache-control") ?? "", /no-store/);
  assert.ok(response.headers.get("vary")?.includes("Cookie"));
  assert.deepEqual(new Uint8Array(await response.arrayBuffer()), expected);
}
try {
  for (let i = 0; i < 100; i++) {
    try {
      if (
        (
          await fetch(base + "/api/actor", {
            signal: AbortSignal.timeout(1000),
          })
        ).status < 500
      )
        break;
    } catch {}
    if (i === 99) throw new Error("Local preview did not start.");
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  const leftovers =
    await db`select id from auth.users where raw_app_meta_data->>'movx_test_ticket'='DEV0382'`;
  assert.equal(
    leftovers.length,
    0,
    "Resolve prior exact test fixtures before rerun.",
  );
  const owner = await person(`Shared Picture ${randomUUID().slice(0, 8)}`);
  people.push(owner);
  const stranger = await person(`Picture Stranger ${randomUUID().slice(0, 8)}`);
  people.push(stranger);
  await writeFile(
    `${evidence}/recovery-ids.json`,
    JSON.stringify(
      people.map((p) => ({ id: p.id, profileId: p.actor.profileId })),
    ),
    { mode: 0o600 },
  );
  const { submitOwnedCoachApplicationRecord } =
    await import("../src/server/db/coaches/application-repository");
  const { upsertOwnedCoachProfileRecord } =
    await import("../src/server/db/coaches/repository");
  const profile = {
    displayName: owner.name,
    bio: "Isolated shared picture rehearsal with clear and adaptable boxing coaching for developing athletes.",
    disciplines: ["Boxing"] as const,
    timezone: "Europe/Berlin",
    visibility: "hidden" as const,
    selectedGymId: "40000000-0000-4000-8000-000000000001",
    independentLocation: null,
  };
  await work(owner, submitOwnedCoachApplicationRecord);
  await work(owner, (tx) => upsertOwnedCoachProfileRecord(tx, profile));
  const bytes = [] as Uint8Array<ArrayBuffer>[];
  for (const color of ["#286052", "#9a4065"]) {
    const source = new Uint8Array(
      await sharp({
        create: { width: 512, height: 512, channels: 3, background: color },
      })
        .webp()
        .toBuffer(),
    );
    bytes.push((await normalizeCanonicalProfileImage(source)).bytes);
  }
  const expectedBytes = await Promise.all(
    bytes.map(
      async (source) => (await normalizeCanonicalProfileImage(source)).bytes,
    ),
  );
  await mutation("/api/profile/avatar", owner, "POST", bytes[0]);
  const selected = await mutation("/api/coach/portrait/account", owner);
  assert.equal(selected.status, "saved");
  assert.ok(
    selected.imageUrl?.startsWith(
      `/api/coaches/portraits/${owner.actor.profileId}?v=`,
    ),
  );
  const first = selected.imageUrl!;
  await image(first, expectedBytes[0], owner);
  await denied(first);
  await denied(first, stranger);
  const [pending] =
    await db`select a.status,c.visibility,c.portrait_source,c.portrait_path,p.avatar_storage_path from app.coach_applications a join app.coach_profiles c on c.profile_id=a.profile_id join app.profiles p on p.id=c.profile_id where c.profile_id=${owner.actor.profileId}::uuid`;
  assert.equal(pending.status, "pending");
  assert.equal(pending.visibility, "hidden");
  assert.equal(pending.portrait_source, "account");
  assert.equal(pending.portrait_path, owner.actor.profileId);
  assert.ok(pending.avatar_storage_path);
  const publicStorage = createClient(status.apiUrl, status.publishableKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  assert.ok(
    (
      await publicStorage.storage
        .from("account-avatars")
        .download(pending.avatar_storage_path)
    ).error,
  );
  checked.push(
    "pending private owner bytes; anonymous/other/direct Storage denial; unchanged application/visibility",
  );
  assert.equal(
    (
      await request("/api/coach/portrait/account", undefined, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ profileId: owner.actor.profileId }),
      })
    ).status,
    401,
  );
  assert.equal(
    (
      await request("/api/coach/portrait/account", owner, {
        method: "POST",
        headers: { origin: "https://wrong.invalid" },
      })
    ).status,
    403,
  );
  assert.equal(
    (
      await request("/api/coach/portrait/account", stranger, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ profileId: stranger.actor.profileId }),
      })
    ).status,
    403,
  );
  assert.equal(
    (
      await request("/api/coach/portrait/account", stranger, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ profileId: owner.actor.profileId }),
      })
    ).status,
    409,
  );
  checked.push("signed-out, wrong-origin and non-coach mutation denial");
  await approveCoach(owner);
  await work(owner, (tx) =>
    upsertOwnedCoachProfileRecord(tx, { ...profile, visibility: "visible" }),
  );
  await image(first, expectedBytes[0]);
  assert.equal(
    (
      await publicStorage.storage
        .from("account-avatars")
        .download(pending.avatar_storage_path)
    ).error,
    null,
  );
  checked.push(
    "approved published opt-in anonymous application and ordinary Storage bytes",
  );
  await work(owner, (tx) => upsertOwnedCoachProfileRecord(tx, profile));
  await denied(first);
  assert.ok(
    (
      await publicStorage.storage
        .from("account-avatars")
        .download(pending.avatar_storage_path)
    ).error,
  );
  await image(first, expectedBytes[0], owner);
  await work(owner, (tx) =>
    upsertOwnedCoachProfileRecord(tx, { ...profile, visibility: "visible" }),
  );
  await mutation("/api/profile/avatar", owner, "POST", bytes[1]);
  const { currentCoachPortraitReference } =
    await import("../src/server/db/profile-images/repository");
  const { sharedCoachPictureUrl } =
    await import("../src/profile-images/contracts");
  const ref = await work(owner, (tx) =>
    currentCoachPortraitReference(tx, owner.actor),
  );
  assert.ok(ref?.updatedAt);
  const second = sharedCoachPictureUrl(owner.actor.profileId, ref.updatedAt)!;
  assert.notEqual(second, first);
  await denied(first);
  await image(second, expectedBytes[1]);
  checked.push(
    "hide revokes public reads; account replacement updates both identities and revokes old version",
  );
  const removed = await mutation("/api/profile/avatar", owner, "DELETE");
  assert.equal(removed.status, "removed");
  await denied(second);
  const [stillShared] =
    await db`select portrait_source from app.coach_profiles where profile_id=${owner.actor.profileId}::uuid`;
  assert.equal(stillShared.portrait_source, "account");
  await mutation("/api/profile/avatar", owner, "POST", bytes[0]);
  const restored = await work(owner, (tx) =>
    currentCoachPortraitReference(tx, owner.actor),
  );
  const third = sharedCoachPictureUrl(
    owner.actor.profileId,
    restored!.updatedAt!,
  )!;
  await image(third, expectedBytes[0]);
  checked.push(
    "account removal shows no picture, keeps opt-in and follows a subsequent upload",
  );
  await mutation("/api/coach/portrait/account", owner, "DELETE");
  await denied(third);
  assert.ok((await request("/api/profile/avatar", owner)).ok);
  const [unshared] =
    await db`select avatar_storage_path from app.profiles where id=${owner.actor.profileId}::uuid`;
  assert.ok(
    (
      await publicStorage.storage
        .from("account-avatars")
        .download(unshared.avatar_storage_path)
    ).error,
  );
  await mutation("/api/coach/portrait/account", owner);
  const portrait = await mutation(
    "/api/coach/portrait",
    owner,
    "POST",
    bytes[1],
  );
  assert.ok(portrait.imageUrl?.includes("/coach-portraits/"));
  assert.ok((await request("/api/profile/avatar", owner)).ok);
  const [separate] =
    await db`select portrait_source from app.coach_profiles where profile_id=${owner.actor.profileId}::uuid`;
  assert.equal(separate.portrait_source, "storage");
  checked.push(
    "unsharing revokes public access without deleting account bytes; separate portrait replacement preserves account image",
  );
  const { setCurrentCoachAccountPicture, ProfileImageReferenceConflictError } =
    await import("../src/server/db/profile-images/repository");
  await assert.rejects(
    work(owner, (tx) => setCurrentCoachAccountPicture(tx, true, restored!)),
    ProfileImageReferenceConflictError,
  );
  const lastShared = await mutation("/api/coach/portrait/account", owner);
  await image(lastShared.imageUrl!, expectedBytes[0]);
  await db`select app.review_coach_application(${owner.actor.profileId}::uuid,'approved','suspended','Isolated shared picture suspension test.','local-test','movx-identity-application-v1')`;
  await denied(lastShared.imageUrl!);
  await image(lastShared.imageUrl!, expectedBytes[0], owner);
  assert.equal(
    (
      await request("/api/coach/portrait/account", owner, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ profileId: owner.actor.profileId }),
      })
    ).status,
    403,
  );
  const suspendedReference = await work(owner, (tx) =>
    currentCoachPortraitReference(tx, owner.actor),
  );
  await assert.rejects(
    work(owner, (tx) =>
      setCurrentCoachAccountPicture(tx, true, suspendedReference!),
    ),
    ProfileImageReferenceConflictError,
  );
  checked.push(
    "stale reference cannot overwrite a newer separate portrait; suspension revokes public bytes and both HTTP/SQL sharing mutation authority",
  );
  console.log(
    JSON.stringify({ checks: checked.length, passed: checked, evidence }),
  );
} finally {
  await cleanup();
  assert.deepEqual(
    await originals(),
    baseline,
    "Original local profile/application/Storage records changed.",
  );
  await writeFile(
    `${evidence}/result.json`,
    JSON.stringify(
      { checks: checked, preservation: "exact original fingerprints match" },
      null,
      2,
    ),
  );
  await db.end();
  child.kill("SIGTERM");
  console.log(
    "Exact temporary cleanup and original-record preservation passed.",
  );
}
