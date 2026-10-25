import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  EMPTY_COACH_WEBSITE_CONTENT,
  type CoachWebsite,
  type CoachWebsiteContent,
} from "@/domain/coach-website";
import type { OwnedCoachStartingRate } from "@/domain/coach-starting-rate";
import { RevisionEditor } from "@/features/coaches/website/revision-editor";
import {
  rateDraft,
  type RateDraft,
} from "@/features/coaches/website/website-client";
import { profilePreviewWebsite } from "@/features/coaches/website/profile-edit-preview";
import { PublicCoachWebsite } from "@/features/coaches/website/public-coach-website";
import { PUBLIC_SCHEDULE_COACH as coach } from "./fixtures/public-schedule-data";

const saved: CoachWebsite = {
  schemaVersion: 1,
  revision: 2,
  content: {
    ...EMPTY_COACH_WEBSITE_CONTENT,
    introduction: "Saved introduction",
  },
  banner: null,
};
const savedRate: OwnedCoachStartingRate = {
  schemaVersion: 1,
  revision: 4,
  amountCents: 4500,
  currency: "EUR",
  context: "private-session",
  showPublicly: false,
};
async function editors() {
  const content = new RevisionEditor<CoachWebsite, CoachWebsiteContent>(
    (value) => value.content,
  );
  const rate = new RevisionEditor<OwnedCoachStartingRate, RateDraft>(rateDraft);
  await content.load(async () => ({ status: "ready", value: saved }));
  await rate.load(async () => ({ status: "ready", value: savedRate }));
  return {
    content,
    rate,
    snapshot: () => ({
      content: content.getSnapshot(),
      rate: rate.getSnapshot(),
      editContent: () => content.edit(),
      editRate: () => rate.edit(),
    }),
  };
}

test("live content and opted-in rate drafts stay separate from saved preview and section cancellation", async () => {
  const e = await editors();
  e.content.edit();
  e.content.change({ ...saved.content, introduction: "Unsaved introduction" });
  e.rate.edit();
  e.rate.change({ amount: "52.50", showPublicly: true });
  assert.equal(
    profilePreviewWebsite(e.snapshot(), false).content.introduction,
    "Unsaved introduction",
  );
  assert.equal(
    profilePreviewWebsite(e.snapshot(), false).startingRate?.amountCents,
    5250,
  );
  assert.equal(
    profilePreviewWebsite(e.snapshot(), true).content.introduction,
    "Saved introduction",
  );
  assert.equal(
    profilePreviewWebsite(e.snapshot(), true).startingRate,
    undefined,
  );
  e.content.cancel();
  assert.equal(
    profilePreviewWebsite(e.snapshot(), false).content.introduction,
    "Saved introduction",
  );
  assert.equal(
    profilePreviewWebsite(e.snapshot(), false).startingRate?.amountCents,
    5250,
  );
  e.rate.change({ amount: "52.50", showPublicly: false });
  assert.equal(
    profilePreviewWebsite(e.snapshot(), false).startingRate,
    undefined,
  );
  e.rate.change({ amount: "invalid", showPublicly: true });
  assert.equal(
    profilePreviewWebsite(e.snapshot(), false).startingRate,
    undefined,
  );
});

test("an uncertain save retains the draft without promoting it to saved content; recovery reconciles independently", async () => {
  const e = await editors();
  e.content.edit();
  e.content.change({ ...saved.content, introduction: "Possibly saved text" });
  await e.content.mutate(async () => {
    throw new Error("Lost response");
  });
  assert.equal(e.content.getSnapshot().recovery, "load");
  assert.equal(
    profilePreviewWebsite(e.snapshot(), true).content.introduction,
    "Saved introduction",
  );
  assert.equal(
    profilePreviewWebsite(e.snapshot(), false).content.introduction,
    "Possibly saved text",
  );
  await e.content.load(async () => ({
    status: "ready",
    value: {
      ...saved,
      revision: 3,
      content: { ...saved.content, introduction: "Other tab text" },
    },
  }));
  assert.equal(e.content.getSnapshot().recovery, "choose");
  assert.equal(
    profilePreviewWebsite(e.snapshot(), true).content.introduction,
    "Other tab text",
  );
  e.content.choose(true);
  assert.equal(
    profilePreviewWebsite(e.snapshot(), false).content.introduction,
    "Possibly saved text",
  );
  assert.equal(
    profilePreviewWebsite(e.snapshot(), true).content.introduction,
    "Other tab text",
  );
});

test("owner layout exposes absent editable fields, keeps real locations and never creates unsafe draft links", () => {
  const html = renderToStaticMarkup(
    createElement(PublicCoachWebsite, {
      state: {
        status: "ready",
        coach,
        slots: [],
        website: {
          ...saved,
          content: {
            ...EMPTY_COACH_WEBSITE_CONTENT,
            links: [{ label: "Incomplete draft", url: "javascript:alert(1)" }],
          },
        },
      },
      marketplace: createElement(
        "section",
        { id: "private-schedule" },
        "Actual schedule slot",
      ),
      ownProfile: true,
      ownerPreview: true,
      onEdit: () => {},
      mediaContent: createElement("p", null, "Owner media"),
    }),
  );
  for (const field of [
    "banner",
    "portrait",
    "displayName",
    "disciplines",
    "bio",
    "introduction",
    "brandLabel",
    "focusLabels",
    "approach",
    "experience",
    "faqs",
    "links",
    "rate",
    "media",
  ])
    assert.ok(html.includes(`data-edit-field="${field}"`), field);
  assert.ok(html.includes(coach.locations[0]!.publicName));
  assert.ok(html.includes("Actual schedule slot"));
  assert.ok(html.includes('href="#private-schedule"'));
  assert.doesNotMatch(html, /href="javascript:|Message coach|Share website/);
});
