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
      const submittedSaves = [],
        submittedTraining = [];
      page.on("request", (request) => {
        if (
          request.url() === base + "/api/session-notes" &&
          request.method() === "POST"
        ) {
          const { command } = request.postDataJSON();
          if (command.action === "save") submittedSaves.push(command);
        }
        if (
          request.url() === base + "/api/training" &&
          request.method() === "POST"
        ) {
          const { command } = request.postDataJSON();
          if (command.action !== "list") submittedTraining.push(command);
        }
      });
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
      const form = page.getByRole("form", { name: "Edit shared note" }),
        body = page.getByLabel("Your note", { exact: true }),
        saveNote = page.getByRole("button", { name: "Save note", exact: true });
      await saveNote.click();
      await expect(form.getByRole("alert")).toContainText(
        "Your note: Write a note before saving.",
      );
      await expect(body).toBeFocused();
      await expect(body).toHaveAttribute("aria-invalid", "true");
      await body.fill("😀".repeat(2001));
      await expect(
        form.getByText("2,001 / 2,000 characters", { exact: true }),
      ).toBeVisible();
      await saveNote.click();
      await expect(form.getByRole("alert")).toContainText("Remove 1 character");
      await expect(body).toHaveAccessibleDescription(
        /2,001.*Remove 1 character/,
      );
      await body.fill("😀".repeat(2000));
      await expect(form.getByRole("alert")).toHaveCount(0);
      await expect(body).not.toHaveAttribute("aria-invalid", "true");
      await expect(
        form.getByText("2,000 / 2,000 characters", { exact: true }),
      ).toBeVisible();
      await page
        .getByLabel("Your note", { exact: true })
        .fill(`Coach reflection ${width}`);
      await page
        .getByRole("button", { name: "Add video link", exact: true })
        .click();
      await saveNote.click();
      await expect(form.getByRole("alert")).toContainText(
        "Video 1 title: Add a title",
      );
      await expect(
        page.getByLabel("Video title", { exact: true }),
      ).toBeFocused();
      await page
        .getByLabel("Video title", { exact: true })
        .fill("x".repeat(81));
      await saveNote.click();
      await expect(form.getByRole("alert")).toContainText(
        "Video 1 title: Shorten the video title to 80",
      );
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
      ).toContainText(
        "Video 1 URL: Use a YouTube video/Shorts or Instagram post/Reel URL. Other websites are not supported.",
      );
      await expect(
        page.getByLabel("YouTube or Instagram URL", { exact: true }),
      ).toBeFocused();
      await expect(
        page.getByLabel("YouTube or Instagram URL", { exact: true }),
      ).toHaveAccessibleDescription(/Other websites are not supported/);
      await expect(page.getByLabel("Your note", { exact: true })).toHaveValue(
        `Coach reflection ${width}`,
      );
      await page
        .getByLabel("YouTube or Instagram URL", { exact: true })
        .fill("https://youtu.be/M7lc1UVf-VE?si=tracking");
      await expect(form.getByRole("alert")).toHaveCount(0);
      await page
        .getByRole("button", { name: "Add video link", exact: true })
        .click();
      const secondVideo = form.getByRole("group", {
        name: "Video 2",
        exact: true,
      });
      await secondVideo
        .getByLabel("Video title", { exact: true })
        .fill("Second reference");
      const secondUrl = secondVideo.getByLabel("YouTube or Instagram URL", {
        exact: true,
      });
      await secondUrl.fill("not-a-url");
      await saveNote.click();
      await expect(form.getByRole("alert")).toContainText(
        "Video 2 URL: Paste the full video URL",
      );
      await expect(secondUrl).toBeFocused();
      await secondUrl.fill("https://instagram.com/username/");
      await saveNote.click();
      await expect(form.getByRole("alert")).toContainText(
        "Video 2 URL: Paste an Instagram post or Reel URL. Profile links cannot be saved.",
      );
      await expect(secondUrl).toBeFocused();
      await form.getByRole("link", { name: /^Video 2 URL:/ }).focus();
      await page.keyboard.press("Enter");
      await expect(secondUrl).toBeFocused();
      assert.equal(
        submittedSaves.length,
        0,
        "Invalid input must not issue a save",
      );
      assert.equal(
        await page.evaluate(
          () => document.documentElement.scrollWidth > innerWidth + 1,
        ),
        false,
      );
      await page.screenshot({
        path: path.join(output, `validation-${width}.png`),
        fullPage: true,
      });
      await secondUrl.fill(
        "https://instagram.com/reels/ABC_123/?igsh=tracking",
      );
      await expect(form.getByRole("alert")).toHaveCount(0);
      await expect(secondUrl).not.toHaveAttribute("aria-invalid", "true");
      await expect(body).toHaveValue(`Coach reflection ${width}`);
      await page
        .getByRole("button", { name: "Save note", exact: true })
        .click();
      await expect(
        page.getByText(`Coach reflection ${width}`, { exact: true }),
      ).toBeVisible();
      assert.deepEqual(submittedSaves[0].args.videos, [
        {
          label: "Technique reference",
          url: "https://www.youtube.com/watch?v=M7lc1UVf-VE",
        },
        {
          label: "Second reference",
          url: "https://www.instagram.com/reel/ABC_123/",
        },
      ]);
      const beforePlan = submittedSaves.length;
      await notes
        .getByRole("button", { name: "Edit plan", exact: true })
        .click();
      const planForm = page.getByRole("form", { name: "Edit training plan" }),
        planBody = page.getByLabel("Training plan", { exact: true });
      await planBody.fill("");
      await planForm
        .getByRole("button", { name: "Save plan", exact: true })
        .click();
      await expect(planForm.getByRole("alert")).toContainText(
        "Add training plan text, or remove all video links to clear the plan.",
      );
      await expect(planBody).toBeFocused();
      await planBody.fill("x".repeat(8001));
      await planForm
        .getByRole("button", { name: "Save plan", exact: true })
        .click();
      await expect(planForm.getByRole("alert")).toContainText(
        "8,000 character limit",
      );
      await expect(
        planForm.getByText("8,001 / 8,000 characters", { exact: true }),
      ).toBeVisible();
      assert.equal(submittedSaves.length, beforePlan);
      await planForm
        .getByRole("button", { name: "Cancel", exact: true })
        .click();
      await notes
        .getByRole("button", { name: "My private notes", exact: true })
        .click();
      await expect(
        page.getByText("Next session: start with the distance drill", {
          exact: false,
        }),
      ).toBeVisible();
      const beforePrivate = submittedSaves.length;
      await notes
        .getByRole("button", { name: "Add a note", exact: true })
        .click();
      const privateForm = page.getByRole("form", {
        name: "Edit private note",
        exact: true,
      });
      await privateForm
        .getByRole("button", { name: "Save note", exact: true })
        .click();
      await expect(privateForm.getByRole("alert")).toContainText(
        "Your note: Write a note before saving.",
      );
      await expect(
        privateForm.getByLabel("Your note", { exact: true }),
      ).toBeFocused();
      assert.equal(submittedSaves.length, beforePrivate);
      await privateForm
        .getByLabel("Your note", { exact: true })
        .fill(`Private validation ${width}`);
      await privateForm
        .getByRole("button", { name: "Save note", exact: true })
        .click();
      await expect(
        notes.getByText(`Private validation ${width}`, { exact: true }),
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
      await expect(
        page.getByText(`Private validation ${width}`, { exact: true }),
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
        .getByLabel("YouTube or Instagram URL", { exact: true })
        .fill("https://www.instagram.com/reels/ABC_123/?igsh=tracking");
      await page
        .getByRole("button", { name: "Save training", exact: true })
        .click();
      await expect(page.getByRole("dialog")).toHaveCount(0);
      assert.equal(
        submittedTraining.at(-1).args.videos[0].url,
        "https://www.instagram.com/reel/ABC_123/",
      );
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
        `${width}px exact field errors, Unicode counters, numbered video title/URL, first-error focus/aria/keyboard links, correction and no invalid save; coach/shared/private and athlete privacy, canonical video saves, committed-response-loss exact retry, personal editor notes, reload and overflow`,
      );
      await context.close();
    }
    const context = await browser.newContext(),
      page = await context.newPage();
    let contextSaves = 0;
    await page.route("**/api/session-notes", async (route) => {
      const { command } = route.request().postDataJSON();
      if (command.action === "save") {
        contextSaves++;
        return route.continue();
      }
      const response = await route.fetch(),
        payload = await response.json();
      payload.value.plan.revision = -1;
      await route.fulfill({ response, json: payload });
    });
    await page.goto(base + "/notes-preview");
    await page.getByRole("button", { name: "Edit plan", exact: true }).click();
    const contextForm = page.getByRole("form", { name: "Edit training plan" });
    await contextForm
      .getByLabel("Training plan", { exact: true })
      .fill("Valid draft with an invalid session revision");
    await contextForm
      .getByRole("button", { name: "Save plan", exact: true })
      .click();
    await expect(contextForm.getByRole("alert")).toContainText(
      "This note could not be submitted. Your draft is still here.",
    );
    await expect(contextForm.locator('[aria-invalid="true"]')).toHaveCount(0);
    await expect(
      contextForm.getByLabel("Training plan", { exact: true }),
    ).toHaveValue("Valid draft with an invalid session revision");
    assert.equal(contextSaves, 0);
    checks.push(
      "invalid save context does not blame valid content, retains the draft and submits no request",
    );
    await page.unroute("**/api/session-notes");
    await page.reload();
    await page.getByRole("button", { name: "Add a note", exact: true }).click();
    await page
      .getByLabel("Your note", { exact: true })
      .fill("Valid draft rejected by the session");
    await page.route("**/api/session-notes", async (route) => {
      if (route.request().postDataJSON().command.action === "save")
        await route.fulfill({ status: 400, json: { status: "invalid" } });
      else await route.continue();
    });
    await page.getByRole("button", { name: "Save note", exact: true }).click();
    await expect(
      page
        .getByRole("region", { name: "Session notes and videos" })
        .getByRole("alert"),
    ).toContainText(
      "This session could not accept the save. Your draft is still here.",
    );
    await expect(page.getByLabel("Your note", { exact: true })).toHaveValue(
      "Valid draft rejected by the session",
    );
    await expect(page.locator('[aria-invalid="true"]')).toHaveCount(0);
    checks.push(
      "server rejection of valid input stays distinct from field errors and retains the draft without false success",
    );
    await context.close();
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
