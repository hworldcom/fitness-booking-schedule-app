import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { GroupSession } from "@/domain/group-sessions";
import {
  appendEventPage,
  eventDirectoryHref,
  eventMapPoints,
  fetchEventPage,
} from "@/features/events/directory-contract";
import {
  compareEventCursors,
  parseEventDirectory,
  parseEventDirectoryPage,
} from "@/events/parsers";
import type { EventDirectoryPage } from "@/events/contracts";
import { visibleEventCover } from "@/features/events/event-card-cover";
import { EventCard } from "@/features/events/event-ui";
import { layoutLocationMapMarkers } from "@/location/marker-layout";

const id = (n: number) =>
  `93580000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const filters = { discipline: null, location: "", after: null };
function session(n: number): GroupSession {
  return {
    id: id(n),
    slug: "group-" + id(n).replaceAll("-", ""),
    title: `Public class ${n}`,
    description: "A meaningful public class.",
    discipline: "Boxing",
    intendedLevel: "All levels",
    venue: {
      id: id(99),
      name: "Published venue",
      label: "Berlin",
      kind: "independent",
      latitude: 52.5,
      longitude: 13.4,
    },
    startsAt: `2027-10-20T10:00:00.${String(n).padStart(6, "0")}+00:00`,
    endsAt: "2027-10-20T11:00:00+00:00",
    decisionDeadlineAt: "2027-10-19T10:00:00+00:00",
    minimumParticipants: 2,
    maximumParticipants: 8,
    participantCount: 2,
    approvedParticipantCount: 2,
    priceCents: 1550,
    currency: "EUR",
    status: "open",
    displayStatus: "open",
    revision: 1,
    createdAt: "2026-10-16T10:00:00Z",
    updatedAt: "2026-10-16T10:00:00Z",
    publishedAt: "2026-10-16T10:00:00Z",
    confirmedAt: null,
    closedAt: null,
    coach: { name: "Public Coach", slug: "public-coach", trustKind: "demo" },
    canJoin: true,
    canConfirm: false,
    canCancel: false,
    canEdit: false,
  };
}
function batch(start: number, count: number, more = false): EventDirectoryPage {
  const items = Array.from({ length: count }, (_, i) => session(start + i));
  const last = items.at(-1)!;
  return {
    status: "ready",
    queryKey: "/events",
    page: {
      items,
      nextCursor: more ? { at: last.startsAt, id: last.id } : null,
    },
    presentations: Object.fromEntries(
      items.map((item) => [
        item.id,
        {
          coachHref: "/@public_coach",
          portraitUrl: "/images/coaches/daniel-park.webp",
          eventBanner: null,
          coachBanner: {
            url: "/api/coaches/public-coach/website/banner/card?v=3",
            width: 800,
            height: 300,
          },
        },
      ]),
    ),
  };
}
test("event view URLs preserve core filters/cursor and reject ambiguous queries", () => {
  const cursor = { at: session(20).startsAt, id: id(20) };
  const href = eventDirectoryHref(
    { ...filters, discipline: "Boxing", location: "A&B / Berlin" },
    cursor,
    "map",
  );
  const directory = parseEventDirectory(
    Object.fromEntries(new URL(href, "http://localhost").searchParams),
  );
  assert.equal(directory?.view, "map");
  assert.equal(directory?.filters.location, "A&B / Berlin");
  assert.deepEqual(directory?.filters.after, cursor);
  for (const query of [
    { view: ["list", "map"] },
    { view: "other" },
    { secret: "x" },
    { afterAt: cursor.at },
  ])
    assert.equal(parseEventDirectory(query), null);
  assert.equal(parseEventDirectory({})?.explicitView, false);
  assert.equal(
    compareEventCursors(
      { at: "2027-10-20T12:00:00.000020+02:00", id: id(20) },
      cursor,
    ),
    0,
  );
  assert.equal(
    compareEventCursors({ at: session(21).startsAt, id: id(21) }, cursor),
    1,
  );
});
test("public batches verify filters, order, cursor advance, exact media and bounded IDs", () => {
  const first = batch(1, 20, true);
  const cursor = first.page.nextCursor!;
  assert.ok(parseEventDirectoryPage(first, filters, null));
  const next = batch(21, 2);
  assert.ok(parseEventDirectoryPage(next, filters, cursor));
  const changed = { ...first, queryKey: "/events?discipline=Boxing" };
  assert.equal(parseEventDirectoryPage(changed, filters, null), null);
  assert.equal(parseEventDirectoryPage(first, filters, cursor), null);
  const repeated = {
    ...first,
    page: { ...first.page, items: [...first.page.items] },
  };
  repeated.page.items[1] = repeated.page.items[0];
  assert.equal(parseEventDirectoryPage(repeated, filters, null), null);
  const backwards = {
    ...first,
    page: {
      ...first.page,
      nextCursor: { at: session(19).startsAt, id: id(19) },
    },
  };
  assert.equal(parseEventDirectoryPage(backwards, filters, null), null);
  const privateMedia = structuredClone(next) as unknown as {
    presentations: Record<string, Record<string, unknown>>;
  };
  privateMedia.presentations[id(21)].portraitUrl =
    "http://localhost:55321/storage/v1/object/public/account-avatars/secret.webp";
  assert.equal(parseEventDirectoryPage(privateMedia, filters, cursor), null);
  const foreign = structuredClone(next) as unknown as {
    presentations: Record<string, Record<string, unknown>>;
  };
  foreign.presentations[id(21)].eventBanner = {
    url: `/api/events/${session(22).slug}/banner/card?v=1`,
    width: 800,
    height: 300,
  };
  assert.equal(parseEventDirectoryPage(foreign, filters, cursor), null);
  assert.equal(
    parseEventDirectoryPage(
      { ...next, storagePath: "private" },
      filters,
      cursor,
    ),
    null,
  );
});
test("appending deduplicates identities, updates loaded venue pins and retains prior batches on fetch failure", async () => {
  const first = batch(1, 20, true);
  const cursor = first.page.nextCursor!;
  const next = batch(20, 3);
  const combined = appendEventPage(first, next);
  assert.equal(combined.page.items.length, 22);
  assert.equal(combined.page.nextCursor, null);
  const points = eventMapPoints(combined.page.items, combined.presentations);
  assert.equal(points.length, 22);
  assert.equal(new Set(points.map((point) => point.id)).size, 22);
  assert.ok(
    points.every(
      (point) => point.latitude === 52.5 && point.longitude === 13.4,
    ),
  );
  const markers = layoutLocationMapMarkers(points);
  assert.equal(markers.length, 22);
  assert.equal(new Set(markers.map((marker) => marker.offset.join())).size, 22);
  const before = structuredClone(first);
  assert.equal(
    await fetchEventPage(
      filters,
      cursor,
      async () => new Response("unavailable", { status: 503 }),
    ),
    null,
  );
  assert.equal(
    await fetchEventPage(filters, cursor, async () => Response.json(first)),
    null,
  );
  assert.deepEqual(first, before);
  let requested = "";
  const fetched = await fetchEventPage(filters, cursor, async (url, init) => {
    requested = String(url);
    assert.equal(init?.cache, "no-store");
    return Response.json(batch(21, 2));
  });
  assert.equal(fetched?.page.items.length, 2);
  assert.match(requested, /^\/api\/events\?/);
  assert.match(requested, /000020/);
  assert.equal(
    parseEventDirectory({ discipline: "Boxing" })?.filters.after,
    null,
  );
  assert.throws(() =>
    appendEventPage(first, { ...next, queryKey: "/events?discipline=Boxing" }),
  );
});
test("cards use separate event and public coach links, truthful terms and image failure fallbacks", () => {
  const event = session(1);
  const coach = batch(1, 1).presentations[event.id].coachBanner!;
  const image = { ...coach, url: `/api/events/${event.slug}/banner/card?v=2` };
  assert.equal(visibleEventCover(image, coach, [])?.url, image.url);
  assert.equal(visibleEventCover(image, coach, [image.url])?.url, coach.url);
  assert.equal(visibleEventCover(image, coach, [image.url, coach.url]), null);
  const html = renderToStaticMarkup(
    createElement(EventCard, {
      session: event,
      presentation: {
        ...batch(1, 1).presentations[event.id],
        eventBanner: image,
      },
    }),
  );
  assert.match(html, new RegExp(`href="/events/${event.slug}"`));
  assert.match(html, /href="\/@public_coach"/);
  assert.match(html, /Demo coach/);
  assert.match(html, /Waiting for coach confirmation/);
  assert.match(html, /2 \/ 8 seats reserved/);
  assert.match(html, /Pay at session/);
  assert.match(html, /daniel-park.webp/);
  assert.doesNotMatch(
    html,
    /account-avatars|participantId|storagePath|Demo reviews/,
  );
});
