// MOV-135: only the caller's wholly disposable Auth/SQL profile-editor stack.
import assert from "node:assert/strict";
import path from "node:path";
import { expect as baseExpect } from "@playwright/test";
const expect = baseExpect.configure({ timeout: 20000 });

export async function rehearseCoachSocialsLanguages({
  page,
  publicPage,
  base,
  publicPath,
  output,
  pass,
  database,
  coach,
}) {
  assert.equal(new URL(base).port, "3169");
  const canvas = page.locator(".coach-profile-canvas");
  const drawer = page.locator("dialog.profile-edit-drawer");
  const language = () =>
    drawer.getByLabel("Languages spoken (optional, one per line, up to 8)");
  const field = (name) =>
    drawer.getByLabel(`${name} (optional)`, { exact: true });
  const close = () =>
    drawer
      .getByRole("button", { name: "Close editing panel", exact: true })
      .click();
  const edit = (name) =>
    canvas.getByRole("button", { name: `Edit ${name}`, exact: true }).click();
  async function save() {
    const [response] = await Promise.all([
      page.waitForResponse(
        (r) =>
          r.url() === base + "/api/coach/website" &&
          r.request().method() === "PUT",
      ),
      drawer
        .getByRole("button", { name: "Save website content", exact: true })
        .click(),
    ]);
    assert.equal(response.status(), 200);
  }
  const website = async () =>
    (await (await page.request.get(base + "/api/coach/website")).json())
      .website;
  const before = await website();
  const [privateContact] =
    await database`select details,revision from app.coach_application_contacts where profile_id=${coach.profileId}::uuid`;
  await expect(
    publicPage.getByRole("heading", { name: "Languages spoken", exact: true }),
  ).toHaveCount(0);
  await edit("languages spoken");
  await expect(language()).toBeFocused();
  await language().fill("English\nenglish");
  await field("Instagram").fill("https://instagram.com.evil.test/coach");
  await field("Personal website").fill("http://example.com");
  await drawer
    .getByRole("button", { name: "Save website content", exact: true })
    .click();
  await expect(drawer.locator(".website-content-errors")).toBeFocused();
  await expect(drawer.locator(".website-content-errors")).toContainText(
    "duplicate language",
  );
  await expect(field("Instagram")).toHaveAttribute("aria-invalid", "true");
  await expect(field("Personal website")).toHaveAttribute(
    "aria-invalid",
    "true",
  );
  await expect(field("Instagram")).toHaveValue(
    "https://instagram.com.evil.test/coach",
  );
  assert.equal((await website()).revision, before.revision);
  await drawer
    .locator(".website-content-errors a")
    .filter({ hasText: "Instagram" })
    .click();
  await expect(field("Instagram")).toBeFocused();
  await language().fill("English\nDeutsch\nTiếng Việt");
  await field("Instagram").fill("https://www.instagram.com/movx.qa");
  await field("Facebook").fill("https://www.facebook.com/movx.qa");
  await field("LinkedIn").fill("https://www.linkedin.com/in/movx-qa");
  await field("Personal website").fill("https://coach.example.com/");
  await field("Personal website").focus();
  await page.keyboard.press("Tab");
  await expect(field("Instagram")).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(field("Facebook")).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(field("LinkedIn")).toBeFocused();
  await close();
  await expect(
    canvas.getByRole("list", { name: "Languages spoken" }),
  ).toContainText("Tiếng Việt");
  await canvas
    .getByRole("button", { name: "Saved preview", exact: true })
    .click();
  await expect(
    canvas.getByRole("heading", { name: "Languages spoken", exact: true }),
  ).toHaveCount(0);
  await canvas
    .getByRole("button", { name: "Back to editing", exact: true })
    .click();
  await edit("social profiles");
  await expect(
    drawer.getByRole("heading", {
      name: "Public website & social profiles",
      exact: true,
    }),
  ).toBeFocused();
  await save();
  await close();
  await page.reload();
  const saved = await website();
  assert.deepEqual(saved.content.links, before.content.links);
  assert.equal(saved.content.websiteUrl, "https://coach.example.com/");
  assert.deepEqual(saved.content.languages, [
    "English",
    "Deutsch",
    "Tiếng Việt",
  ]);
  assert.equal(
    saved.content.socialLinks.instagram,
    "https://www.instagram.com/movx.qa",
  );
  for (const width of [1440, 375, 320]) {
    await publicPage.setViewportSize({ width, height: 1000 });
    await publicPage.goto(base + publicPath);
    await expect(
      publicPage.getByRole("list", { name: "Languages spoken" }),
    ).toContainText("Tiếng Việt");
    const links = publicPage.locator(".coach-website-social-links a");
    await expect(links).toHaveCount(4);
    for (const [i, label] of [
      "Website",
      "Instagram",
      "Facebook",
      "LinkedIn",
    ].entries()) {
      const link = links.nth(i);
      await expect(link).toHaveAccessibleName(`${label} (opens in a new tab)`);
      await link.focus();
      await expect(link).toBeFocused();
      const bounds = await link.boundingBox();
      assert.ok(
        bounds &&
          bounds.height >= 44 &&
          bounds.x >= 0 &&
          bounds.x + bounds.width <= width,
      );
      assert.equal(await link.getAttribute("rel"), "noopener noreferrer");
      await expect(link.locator("svg[aria-hidden='true']")).toHaveCount(1);
    }
    assert.equal(
      await publicPage.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      ),
      false,
    );
    await publicPage.locator("#about").screenshot({
      path: path.join(output, `coach-socials-languages-${width}.png`),
    });
    await page.setViewportSize({ width, height: 1000 });
    await edit("languages spoken");
    await expect(language()).toBeFocused();
    assert.equal(
      await drawer.evaluate((el) => el.scrollWidth > el.clientWidth),
      false,
    );
    await drawer.screenshot({
      path: path.join(output, `coach-socials-languages-editor-${width}.png`),
    });
    await drawer
      .getByRole("button", { name: "Cancel content edits", exact: true })
      .click();
    await close();
  }
  await edit("social profiles");
  await field("Instagram").fill("https://instagram.com/cancelled-draft");
  await field("Personal website").fill("https://cancelled.example.com/");
  await language().fill("Discarded language");
  await drawer
    .getByRole("button", { name: "Cancel content edits", exact: true })
    .click();
  await close();
  assert.deepEqual((await website()).content, saved.content);
  await edit("social profiles");
  for (const name of ["Instagram", "Facebook", "LinkedIn"])
    await field(name).fill("");
  await field("Personal website").fill("");
  await language().fill("");
  await save();
  await close();
  await publicPage.reload();
  await expect(
    publicPage.getByRole("heading", { name: "Languages spoken", exact: true }),
  ).toHaveCount(0);
  await expect(publicPage.locator(".coach-website-social-links a")).toHaveCount(
    0,
  );
  await page.reload();
  await edit("social profiles");
  await expect(field("Instagram")).toHaveValue("");
  await expect(field("Personal website")).toHaveValue("");
  await expect(language()).toHaveValue("");
  await drawer
    .getByRole("button", { name: "Cancel content edits", exact: true })
    .click();
  await close();
  const [afterContact] =
    await database`select details,revision from app.coach_application_contacts where profile_id=${coach.profileId}::uuid`;
  assert.deepEqual(afterContact, privateContact);
  assert.deepEqual((await website()).content.links, before.content.links);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await publicPage.setViewportSize({ width: 1440, height: 1000 });
  pass(
    "MOV-135 real Auth/API/SQL personal website/social/language save/reload/clear, invalid URL/list draft recovery, cancel/saved preview, stable names and Tab order, four local icons/public links at 1440/375/320px, and unchanged private contacts/legacy links",
  );
}
