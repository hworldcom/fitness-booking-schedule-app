// Owned, loopback-only source copy with fictional Auth/API data. No real accounts.
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import {
  cp,
  mkdir,
  mkdtemp,
  readFile,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { chromium, expect as baseExpect } from "@playwright/test";
const expect = baseExpect.configure({ timeout: 20000 }),
  root = process.cwd(),
  test = process.argv.includes("--test"),
  port = test ? 3194 : 3193,
  base = `http://127.0.0.1:${port}`;
const scratch = await mkdtemp(path.join(tmpdir(), "mov-notes-preview-")),
  output = path.join(root, "test-results/session-notes-ui");
let server,
  browser,
  log = "";
const checks = [],
  errors = [];
async function cleanup() {
  await browser?.close();
  if (server && server.exitCode === null) {
    server.kill("SIGTERM");
    await new Promise((resolve) => server.once("exit", resolve));
  }
  await rm(scratch, { recursive: true, force: true });
}
try {
  await mkdir(output, { recursive: true });
  for (const file of [
    "src",
    "tests",
    "package.json",
    "tsconfig.json",
    "postcss.config.mjs",
  ])
    await cp(path.join(root, file), path.join(scratch, file), {
      recursive: true,
    });
  await symlink(
    path.join(root, "node_modules"),
    path.join(scratch, "node_modules"),
    "dir",
  );
  const imports = (
    await readFile(path.join(root, "src/app/layout.tsx"), "utf8")
  )
    .split("\n")
    .filter((line) => /^import ".*(?:\.css|@fontsource[^\"]*)";$/.test(line));
  await writeFile(
    path.join(scratch, "src/app/layout.tsx"),
    imports.join("\n") +
      '\nexport default function Layout({children}:{children:React.ReactNode}){return <html lang="en"><body>{children}</body></html>;}',
  );
  await rm(path.join(scratch, "src/proxy.ts"));
  await mkdir(path.join(scratch, "src/app/notes-preview"), { recursive: true });
  await writeFile(
    path.join(scratch, "src/app/notes-preview/page.tsx"),
    `import {cookies} from "next/headers";import Preview from "../../../tests/fixtures/session-notes-preview";export const dynamic="force-dynamic";export default async function Page(){const mode=(await cookies()).get("notes_preview_mode")?.value;return <Preview initialMode={mode==="personal"||mode==="athlete"?mode:"coach"}/>;}`,
  );
  for (const [route, handler, methods] of [
    ["session-notes", "notesResponse", ["POST"]],
    ["training", "trainingResponse", ["POST"]],
    ["auth/actor", "actorResponse", ["GET"]],
  ]) {
    const dir = path.join(scratch, "src/app/api", route);
    await mkdir(dir, { recursive: true });
    const ref = path
      .relative(
        dir,
        path.join(scratch, "tests/fixtures/session-notes-preview-api"),
      )
      .split(path.sep)
      .join("/");
    await writeFile(
      path.join(dir, "route.ts"),
      `import {${handler}} from "${ref}";export const dynamic="force-dynamic";${methods.map((method) => `export const ${method}=${handler};`).join("\n")}`,
    );
  }
  await mkdir(path.join(scratch, "src/app/qa-notes-navigation"), {
    recursive: true,
  });
  await writeFile(
    path.join(scratch, "src/app/qa-notes-navigation/page.tsx"),
    `import {BookingNavigationPreview} from "../../../tests/fixtures/session-notes-preview";export default async function Page({searchParams}:{searchParams:Promise<{coach?:string}>}){return <BookingNavigationPreview coachView={(await searchParams).coach==="true"}/>;}`,
  );
  const dir = path.join(scratch, "src/app/api/auth/session");
  await mkdir(dir, { recursive: true });
  await writeFile(
    path.join(dir, "route.ts"),
    `export async function GET(){return Response.json({status:"signed-in",subject:"15000000-0000-4000-8000-000000000008",email:"preview@example.invalid",expiresAt:null});}`,
  );
  const env = Object.fromEntries(
    Object.entries(process.env).filter(
      ([key]) =>
        !/(DATABASE|SUPABASE|SITE_URL|MUX|RESEND|NOTIFICATION|CRON_SECRET|GEOAPIFY|AUTH|VERCEL|NEXT_PUBLIC|SMTP)/.test(
          key,
        ),
    ),
  );
  server = spawn(
    process.execPath,
    [
      path.join(root, "node_modules/next/dist/bin/next"),
      "dev",
      "--webpack",
      "--hostname",
      "127.0.0.1",
      "--port",
      String(port),
    ],
    {
      cwd: scratch,
      env: { ...env, NEXT_TELEMETRY_DISABLED: "1" },
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  server.stdout.on("data", (d) => {
    log += d;
    if (!test) process.stdout.write(d);
  });
  server.stderr.on("data", (d) => {
    log += d;
    if (!test) process.stderr.write(d);
  });
  for (
    const deadline = Date.now() + 90000;
    !log.includes("Ready") && Date.now() < deadline && server.exitCode === null;
  )
    await new Promise((resolve) => setTimeout(resolve, 200));
  assert.ok(log.includes("Ready"), log.slice(-2000));
  await writeFile(
    path.join(output, test ? "test-recovery.json" : "preview-recovery.json"),
    JSON.stringify(
      { scratch, port, pid: server.pid, fixtureOnly: true },
      null,
      2,
    ),
  );
  if (!test) {
    console.log(`Notes & videos preview: ${base}/notes-preview`);
    process.on("SIGTERM", () => server.kill("SIGTERM"));
    process.on("SIGINT", () => server.kill("SIGTERM"));
    await new Promise((resolve) => server.once("exit", resolve));
  } else {
    browser = await chromium.launch({ channel: "chrome", headless: true });
    for (const width of [1440, 430, 375, 320]) {
      const context = await browser.newContext({
          viewport: { width, height: width === 1440 ? 1000 : 850 },
        }),
        page = await context.newPage();
      page.on("pageerror", (e) => errors.push(e.message));
      await page.route("**/api/session-notes", async (route) => {
        const { command } = route.request().postDataJSON();
        if (command.action === "read")
          await route.fulfill({ status: 503, json: { status: "unavailable" } });
        else await route.continue();
      });
      await page.goto(base + "/notes-preview");
      const notes = page.getByRole("region", {
        name: "Session notes and videos",
      });
      await expect(
        notes.getByRole("heading", { name: "Notes & videos", exact: true }),
      ).toBeVisible();
      await expect(notes.getByRole("alert")).toContainText(
        "could not be loaded",
      );
      await expect(
        notes.getByText("Keep the useful things", { exact: true }),
      ).toHaveCount(0);
      await page.unroute("**/api/session-notes");
      await notes
        .getByRole("button", { name: "Reload saved notes", exact: true })
        .click();
      await notes
        .getByRole("button", { name: "Add a note", exact: true })
        .click();
      await expect(page.getByLabel("Your note", { exact: true })).toBeFocused();
      await page
        .getByLabel("Your note", { exact: true })
        .fill(`Coach reflection ${width}`);
      await page
        .getByRole("button", { name: "Add video link", exact: true })
        .click();
      await page
        .getByLabel("Video title", { exact: true })
        .fill("Technique reference");
      await page
        .getByLabel("YouTube or Instagram URL", { exact: true })
        .fill("https://example.com/not-a-video");
      await page
        .getByRole("button", { name: "Save note", exact: true })
        .click();
      await expect(
        page.getByRole("form", { name: "Edit shared note" }).getByRole("alert"),
      ).toContainText("video titles/URLs");
      await expect(page.getByLabel("Your note", { exact: true })).toHaveValue(
        `Coach reflection ${width}`,
      );
      await page
        .getByLabel("YouTube or Instagram URL", { exact: true })
        .fill("https://youtu.be/M7lc1UVf-VE?si=tracking");
      await page
        .getByRole("button", { name: "Save note", exact: true })
        .click();
      await expect(
        page.getByText(`Coach reflection ${width}`, { exact: true }),
      ).toBeVisible();
      await notes
        .getByRole("button", { name: "My private notes", exact: true })
        .click();
      await expect(
        page.getByText("Next session: start with the distance drill", {
          exact: false,
        }),
      ).toBeVisible();
      await page.screenshot({
        path: path.join(output, `coach-private-${width}.png`),
        fullPage: true,
      });
      await page
        .getByRole("button", { name: "Athlete session", exact: true })
        .click();
      await expect(
        page.getByRole("button", { name: "My private notes", exact: true }),
      ).toHaveCount(0);
      await expect(
        page.getByText("Next session: start with the distance drill", {
          exact: false,
        }),
      ).toHaveCount(0);
      await page
        .getByRole("button", { name: "Add a note", exact: true })
        .click();
      await page
        .getByLabel("Your note", { exact: true })
        .fill(`Athlete reflection ${width}`);
      let lost = false;
      const attempts = [];
      await page.route("**/api/session-notes", async (route) => {
        const { command } = route.request().postDataJSON();
        if (command.action === "save") {
          attempts.push(command);
          if (!lost) {
            lost = true;
            await route.fetch();
            await route.abort("failed");
            return;
          }
        }
        await route.continue();
      });
      await page
        .getByRole("button", { name: "Save note", exact: true })
        .click();
      await expect(notes.getByRole("alert")).toContainText(
        "Retry the same save",
      );
      await page
        .getByRole("button", { name: "Retry same save", exact: true })
        .click();
      await expect(
        page.getByText(`Athlete reflection ${width}`, { exact: true }),
      ).toBeVisible();
      assert.deepEqual(attempts[0], attempts[1]);
      await page.unroute("**/api/session-notes");
      await page.reload();
      await expect(
        page.getByText(`Athlete reflection ${width}`, { exact: true }),
      ).toBeVisible();
      await page.screenshot({
        path: path.join(output, `athlete-shared-${width}.png`),
        fullPage: true,
      });
      await page
        .getByRole("button", { name: "Personal workout", exact: true })
        .click();
      await page
        .getByRole("button", { name: "Edit workout", exact: true })
        .click();
      await expect(
        page
          .getByRole("dialog")
          .getByRole("heading", { name: "Notes & videos", exact: true }),
      ).toBeVisible();
      await expect(
        page.getByRole("textbox", { name: "Personal notes", exact: true }),
      ).toBeVisible();
      await page
        .getByRole("textbox", { name: "Personal notes", exact: true })
        .fill(`My private workout note ${width}`);
      await page
        .getByRole("button", { name: "Save training", exact: true })
        .click();
      await expect(page.getByRole("dialog")).toHaveCount(0);
      await expect(
        page.getByText(`My private workout note ${width}`, { exact: true }),
      ).toBeVisible();
      assert.equal(
        await page.evaluate(
          () => document.documentElement.scrollWidth > innerWidth + 1,
        ),
        false,
        `Overflow at ${width}`,
      );
      await page.screenshot({
        path: path.join(output, `personal-${width}.png`),
        fullPage: true,
      });
      await page.goto(base + "/qa-notes-navigation?coach=false");
      await expect(
        page.getByRole("link", { name: "← My training", exact: true }),
      ).toHaveAttribute("href", "/sessions");
      await page.goto(base + "/qa-notes-navigation?coach=true");
      await expect(
        page.getByRole("link", { name: "← Bookings", exact: true }),
      ).toHaveAttribute("href", "/coach?view=bookings");
      checks.push(
        `${width}px coach/shared/private and athlete privacy, video reference saves, committed-response-loss exact retry, personal editor notes, reload, keyboard focus and overflow`,
      );
      await context.close();
    }
    assert.deepEqual(errors, []);
    await writeFile(
      path.join(output, "results.json"),
      JSON.stringify({ checks, errors, fixtureOnly: true }, null, 2),
    );
    for (const check of checks) console.log("PASS " + check);
  }
} catch (error) {
  console.error(log.slice(-4000));
  throw error;
} finally {
  await cleanup();
  await writeFile(
    path.join(output, test ? "test-server.log" : "preview-server.log"),
    log,
  );
}
