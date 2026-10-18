import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  RevisionEditor,
  type EditorReply,
} from "@/features/coaches/website/revision-editor";
import {
  editorRequest,
  parseOwnedRate,
  parseOwnedWebsite,
  rateDraft,
} from "@/features/coaches/website/website-client";
import {
  EMPTY_COACH_WEBSITE_CONTENT,
  projectCoachWebsite,
} from "@/domain/coach-website";
import { CoachWebsitePreview } from "@/features/coaches/website/coach-website-preview";
import type { CoachProjection } from "@/domain/coaches";

type Value = { revision: number; text: string };
const ready = (revision = 0, text = "saved"): EditorReply<Value> => ({
  status: "ready",
  value: { revision, text },
});
async function editing() {
  const editor = new RevisionEditor<Value, string>((value) => value.text);
  await editor.load(async () => ready());
  editor.edit();
  editor.change("my draft");
  return editor;
}
test("stale saves cannot overwrite until saved state is loaded and draft explicitly rebased", async () => {
  const editor = await editing();
  await editor.mutate(async () => ({ status: "conflict" }));
  assert.equal(editor.getSnapshot().draft, "my draft");
  let writes = 0;
  await editor.mutate(async () => {
    writes++;
    return { status: "unavailable" };
  });
  assert.equal(writes, 0);
  editor.cancel();
  assert.equal(editor.getSnapshot().draft, "my draft");
  await editor.load(async () => ready(2, "other tab"));
  assert.equal(editor.getSnapshot().recovery, "choose");
  assert.equal(editor.getSnapshot().saved?.text, "other tab");
  editor.choose(true);
  await editor.mutate(async (revision) => {
    assert.equal(revision, 2);
    return { status: "saved", value: { revision: 3, text: "my draft" } };
  });
  assert.equal(editor.getSnapshot().saved?.text, "my draft");
  assert.equal(editor.getSnapshot().editing, false);
});
test("uncertain writes require reconciliation; failed reads retain recovery and draft", async () => {
  const editor = await editing();
  await editor.mutate(async () => {
    throw new Error("response lost");
  });
  assert.equal(editor.getSnapshot().recovery, "load");
  await editor.load(async () => ({ status: "unavailable" }));
  assert.equal(editor.getSnapshot().recovery, "load");
  assert.equal(editor.getSnapshot().draft, "my draft");
  await editor.load(async () => ready(1, "my draft"));
  editor.choose(false);
  assert.equal(editor.getSnapshot().editing, false);
  assert.equal(editor.getSnapshot().saved?.revision, 1);
});
test("invalid writes retain editable drafts without claiming a save", async () => {
  const editor = await editing();
  await editor.mutate(async () => ({ status: "invalid" }));
  assert.equal(editor.getSnapshot().saved?.revision, 0);
  assert.equal(editor.getSnapshot().draft, "my draft");
  assert.equal(editor.getSnapshot().recovery, null);
  editor.cancel();
  assert.equal(editor.getSnapshot().draft, "saved");
});
test("banner mutations serialize with text, retain drafts and advance only the website revision", async () => {
  const editor = await editing();
  let resolve!: (value: EditorReply<Value>) => void;
  const pending = editor.mutate(
    () =>
      new Promise((done) => {
        resolve = done;
      }),
    true,
  );
  let secondWrite = false;
  await editor.mutate(async () => {
    secondWrite = true;
    return { status: "conflict" };
  });
  assert.equal(secondWrite, false);
  resolve({
    status: "saved",
    value: { revision: 1, text: "saved" },
    cleanupPending: true,
  });
  await pending;
  assert.equal(editor.getSnapshot().draft, "my draft");
  assert.equal(editor.getSnapshot().editing, true);
  assert.match(editor.getSnapshot().message, /cleanup is pending/);
  editor.cancel();
  assert.equal(editor.getSnapshot().saved?.revision, 1);
});
test("revoked or disposed workspaces discard private data and ignore late responses", async () => {
  for (const action of ["revoke", "dispose"] as const) {
    const editor = await editing();
    let resolve!: (value: EditorReply<Value>) => void;
    const pending = editor.load(
      () =>
        new Promise((done) => {
          resolve = done;
        }),
    );
    editor[action]();
    resolve(ready(9, "late private data"));
    await pending;
    assert.equal(editor.getSnapshot().saved, null);
    assert.equal(editor.getSnapshot().draft, null);
  }
  const editor = await editing();
  await editor.mutate(async () => ({ status: "forbidden" }));
  assert.equal(editor.getSnapshot().accessLost, true);
  assert.equal(editor.getSnapshot().draft, null);
});
test("owner DTO parsing rejects external/private images, unsafe content and malformed money", () => {
  const website = projectCoachWebsite(
    EMPTY_COACH_WEBSITE_CONTENT,
    7,
    true,
    null,
  );
  assert.ok(parseOwnedWebsite(website));
  assert.equal(
    parseOwnedWebsite({
      ...website,
      banner: {
        ...website.banner,
        hero: { ...website.banner!.hero, url: "https://example.com/private" },
      },
    }),
    null,
  );
  assert.equal(
    parseOwnedWebsite({
      ...website,
      content: { links: [{ label: "Bad", url: "javascript:alert(1)" }] },
    }),
    null,
  );
  const rate = {
    schemaVersion: 1,
    revision: 3,
    amountCents: 6050,
    currency: "EUR",
    context: "private-session",
    showPublicly: false,
  };
  assert.equal(rateDraft(parseOwnedRate(rate)!).amount, "60.50");
  for (const amountCents of [-1, 1.5, "6000", 2147483648])
    assert.equal(parseOwnedRate({ ...rate, amountCents }), null);
});
test("HTTP/DTO disagreement is uncertain and credentials never cross origins", async (context) => {
  const mocked = context.mock.method(
    globalThis,
    "fetch",
    async (path: unknown, init?: RequestInit) => {
      assert.equal(path, "/api/coach/website");
      assert.equal(init?.cache, "no-store");
      assert.equal(init?.credentials, "same-origin");
      return Response.json(
        {
          status: "saved",
          website: projectCoachWebsite(
            EMPTY_COACH_WEBSITE_CONTENT,
            1,
            false,
            null,
          ),
        },
        { status: 503 },
      );
    },
  );
  await assert.rejects(
    editorRequest("/api/coach/website", parseOwnedWebsite, "website"),
  );
  mocked.mock.restore();
});
const coach: CoachProjection = {
  profileId: "test-owner",
  slug: "test-coach",
  displayName: "Public Coach",
  bio: "Existing public biography.",
  serviceMode: "private-training",
  timezone: "Europe/Berlin",
  primaryLocationId: "none",
  locations: [],
  selectedGymId: null,
  gymName: null,
  location: {
    kind: "independent",
    label: "Public location",
    latitude: 52,
    longitude: 13,
    source: "manual",
    provider: null,
    confirmedAt: "2026-10-18T00:00:00Z",
  },
  visibility: "visible",
  recordSource: "user",
  trustKind: null,
  portraitUrl: null,
  disciplines: ["Boxing"],
};
test("preview suppresses hidden/absent amounts and marks zero, pending and unsaved states truthfully", () => {
  function render(
    amountCents: number | null,
    showPublicly: boolean,
    publicationAllowed = true,
  ) {
    return renderToStaticMarkup(
      createElement(CoachWebsitePreview, {
        coach,
        content: EMPTY_COACH_WEBSITE_CONTENT,
        bannerUrl: null,
        rate: { amountCents, showPublicly },
        publicationAllowed,
        unsaved: true,
      }),
    );
  }
  const hidden = render(192837, false);
  assert.doesNotMatch(hidden, /1928|1,928|192837|api\/profile\/avatar/);
  assert.match(hidden, /Contact the coach for pricing/);
  assert.match(render(0, true), /€0 \(Free\)/);
  assert.match(render(null, true), /Contact the coach for pricing/);
  assert.match(render(6000, true, false), /Private draft/);
  assert.match(hidden, /Unsaved draft preview/);
  assert.match(hidden, /Preview only/);
  assert.doesNotMatch(hidden, /rating|stars|10:00|Alex Rivera/);
});
