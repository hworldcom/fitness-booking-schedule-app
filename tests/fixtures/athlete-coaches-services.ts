// MOV-292: fictional services, imported only by the runner-owned UI source copy.
import "server-only";
import { readFileSync, writeFileSync, renameSync } from "node:fs";
import { randomUUID } from "node:crypto";
import {
  initialAuthorizationState,
  fixtureScenario,
} from "./coach-athletes-auth";
import type {
  AthleteCoach,
  AthleteCoachCursor,
  AthleteCoachFilter,
} from "@/domain/athlete-coaches";
import type { ConnectionProjection } from "@/domain/coach-athlete-connections";
const uuid = (n: number) =>
  `29200000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const owner = uuid(500),
  dataset = uuid(501);
type MutableCoach = { -readonly [K in keyof AthleteCoach]: AthleteCoach[K] };
type Store = {
  rows: MutableCoach[];
  commands: Record<string, string>[];
  reads: number;
  results: Record<string, ConnectionProjection>;
};
const file = () => {
  if (!process.env.MOV292_UI_STORE)
    throw Error("Owned athlete roster store required");
  return process.env.MOV292_UI_STORE;
};
function save(state: Store) {
  const next = file() + "." + randomUUID() + ".tmp";
  writeFileSync(next, JSON.stringify(state));
  renameSync(next, file());
}
function connection(
  n: number,
  status: ConnectionProjection["status"],
): ConnectionProjection {
  return {
    id: uuid(n + 100),
    pairId: uuid(n + 200),
    attemptNumber: 1,
    coachProfileId: uuid(n),
    athleteProfileId: owner,
    senderProfileId: n === 5 ? uuid(n) : owner,
    recipientProfileId: n === 5 ? owner : uuid(n),
    status,
    createdAt: "2026-11-20T10:00:00Z",
    updatedAt: "2026-11-20T10:00:00Z",
    decidedAt: status === "pending" ? null : "2026-11-20T11:00:00Z",
    removedAt: status === "removed" ? "2026-11-21T11:00:00Z" : null,
    coachDisplayName: "Fixture coach",
    athleteDisplayName: "Fixture athlete",
    coachSlug: `fixture-${n}`,
    coachPublic: n !== 4,
    coachPortraitUrl: null,
    athleteAvatarUrl: null,
    canAccept: status === "pending" && n === 5,
    canDecline: status === "pending" && n === 5,
    canWithdraw: status === "pending" && n !== 5,
    canDisconnect: status === "accepted",
  };
}
function read(): Store {
  try {
    return JSON.parse(readFileSync(file(), "utf8"));
  } catch {
    const rows: MutableCoach[] = [];
    for (let n = 1; n <= 25; n++) {
      const status =
        n === 1 || n === 4
          ? "connected"
          : n === 5 || n === 6
            ? "pending"
            : "unconnected";
      const name =
        (
          {
            1: "Maya Patel",
            2: "Alex Morgan",
            3: "Nora Group",
            4: "Hidden Coach",
            5: "Incoming Coach",
            6: "Outgoing Coach",
            7: "Reconnect Coach",
          } as Record<number, string>
        )[n] ??
        (process.env.MOV293_UI_REQUESTS === "1" && n === 8
          ? "Request-only Coach"
          : `Group Coach ${n}`);
      const initialConnection =
        status === "connected"
          ? connection(n, "accepted")
          : status === "pending"
            ? connection(n, "pending")
            : n === 7
              ? connection(n, "removed")
              : null;
      const c = initialConnection
        ? { ...initialConnection, coachDisplayName: name }
        : null;
      rows.push({
        key: `p:${uuid(n)}`,
        profileId: uuid(n),
        name,
        status,
        lastSessionAt: n === 1 ? "2026-11-20T10:00:00Z" : null,
        nextSessionAt:
          process.env.MOV293_UI_REQUESTS === "1" && n === 8
            ? null
            : "2035-01-01T10:00:00Z",
        sortAt: `2026-11-27T10:00:00.${String(100000 - n).padStart(6, "0")}+00:00`,
        bookingId: [1, 2, 4, 5, 6, 7].includes(n) ? uuid(n + 300) : null,
        connection: c,
        canSend: n === 2 || n === 7,
        profileHref: n === 4 ? null : `/coaches/fixture-${n}`,
        portraitUrl: null,
      });
    }
    const state = { rows, commands: [], reads: 0, results: {} };
    save(state);
    return state;
  }
}
async function context() {
  const auth = await initialAuthorizationState(),
    scenario = await fixtureScenario();
  return {
    ...auth,
    fault: scenario.fault,
    scope:
      auth.session.status === "signed-in"
        ? `${auth.session.subject}:${owner}:${auth.actor.status === "authorized" && auth.actor.demoRun.slug === "other-dataset" ? uuid(502) : dataset}:member`
        : "",
  };
}
export async function protectedPageAccess() {
  const c = await context();
  return {
    status: c.session.status === "signed-in" ? "authorized" : "preview",
  };
}
export async function currentPendingCoachInvitation() {
  const c = await context();
  return c.fault === "pending-invitation"
    ? { status: "pending" as const, coachName: "Inviting Coach" }
    : c.fault === "invitation-unavailable"
      ? { status: "unavailable" as const }
      : null;
}
export async function currentAthleteCoachWorkspace(
  filter: AthleteCoachFilter | null,
) {
  const c = await context();
  if (c.session.status !== "signed-in" || c.actor.status !== "authorized")
    return { status: "unavailable" as const };
  const r =
    filter === null ? null : await currentAthleteCoaches(c.scope, filter);
  return {
    status: "authorized" as const,
    subject: c.session.subject,
    actorIdentity: [
      c.actor.profile.slug,
      c.actor.demoRun.slug,
      c.actor.role,
    ].join(":"),
    scope: c.scope,
    page: r?.status === "ready" ? r.page : null,
  };
}
export async function currentAthleteCoaches(
  scope: string,
  filter: AthleteCoachFilter,
  cursor: AthleteCoachCursor | null = null,
) {
  const c = await context();
  if (scope !== c.scope) return { status: "forbidden" as const };
  const state = read();
  state.reads++;
  save(state);
  if (c.fault === "slow-read") await new Promise((r) => setTimeout(r, 1000));
  if (c.fault === "read-failed") return { status: "unavailable" as const };
  const items = state.rows
    .filter(
      (r) =>
        filter === "all" ||
        r.status === filter ||
        (filter === "unconnected" && r.status === "pending"),
    )
    .filter(
      (r) =>
        !cursor ||
        r.sortAt < cursor.at ||
        (r.sortAt === cursor.at && r.key < cursor.key),
    )
    .slice(0, 21);
  const visible = items.slice(0, 20),
    last = visible.at(-1);
  return {
    status: "ready" as const,
    page: {
      items: visible,
      nextCursor:
        items.length > 20 && last ? { at: last.sortAt, key: last.key } : null,
    },
  };
}
export async function sendCoachAthleteConnection(
  bookingId: string,
  operationId: string,
  previous: string | null,
  expectedScope?: string,
) {
  const c = await context();
  if (expectedScope !== c.scope) return { status: "conflict" as const };
  const state = read();
  state.commands.push({
    intent: "send",
    bookingId,
    operationId,
    previousId: previous ?? "",
    ownerScope: expectedScope,
  });
  let value = state.results[operationId];
  if (!value) {
    const r = state.rows.find((r) => r.bookingId === bookingId)!;
    value = {
      ...connection(Number(r.profileId.slice(-12)), "pending"),
      coachDisplayName: r.name,
    };
    r.status = "pending";
    r.connection = value;
    r.canSend = false;
    state.results[operationId] = value;
  }
  save(state);
  return c.fault === "mutation-lost"
    ? { status: "unavailable" as const }
    : { status: "ready" as const, value };
}
export async function decideCoachAthleteConnection(
  id: string,
  action: string,
  expectedScope?: string,
) {
  const c = await context();
  if (expectedScope && expectedScope !== c.scope)
    return { status: "conflict" as const };
  const state = read();
  state.commands.push({
    intent: action,
    connectionId: id,
    ownerScope: expectedScope ?? "",
  });
  const r = state.rows.find((r) => r.connection?.id === id);
  if (!r) return { status: "conflict" as const };
  r.status = action === "accept" ? "connected" : "unconnected";
  r.connection = {
    ...r.connection!,
    status:
      action === "accept"
        ? "accepted"
        : action === "disconnect"
          ? "removed"
          : action === "decline"
            ? "declined"
            : "withdrawn",
    canAccept: false,
    canDecline: false,
    canWithdraw: false,
    canDisconnect: action === "accept",
  };
  r.canSend = r.status === "unconnected";
  save(state);
  return c.fault === "mutation-lost"
    ? { status: "unavailable" as const }
    : { status: "ready" as const, value: r.connection };
}
export async function currentConnectionPendingCount() {
  return {
    status: "ready" as const,
    value: read().rows.filter(
      (r) =>
        r.status === "pending" && r.connection?.recipientProfileId === owner,
    ).length,
  };
}
export async function currentConnectionPage(_role: string, section: string) {
  const { fault } = await context();
  if (fault === "incoming-unavailable" && section === "incoming")
    return { status: "unavailable" as const };
  return {
    status: "ready" as const,
    value: {
      items: read().rows.flatMap((r) =>
        r.connection &&
        ((section === "accepted" && r.status === "connected") ||
          (section === "incoming" &&
            r.status === "pending" &&
            r.connection.recipientProfileId === owner) ||
          (section === "outgoing" &&
            r.status === "pending" &&
            r.connection.senderProfileId === owner) ||
          (section === "history" && r.connection.status === "removed"))
          ? [r.connection]
          : [],
      ),
      nextCursor: null,
    },
  };
}
export async function currentConnectionHistory() {
  return { status: "ready" as const, value: { items: [], nextCursor: null } };
}
export async function currentBookingConnectionContext() {
  return { status: "unavailable" as const };
}
