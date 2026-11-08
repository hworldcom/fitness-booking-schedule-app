"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import type {
  ExternalClient,
  ExternalClientDetail,
  ExternalClientPage,
} from "@/domain/external-clients";
import { SessionActorBoundary } from "@/features/session-types/actor-boundary";
import { CoachAthletesWorkspace } from "@/features/coaches/coach-athletes-workspace";
import { ClientForm } from "./client-form";
import "@/features/session-types/session-types.css";
export function ExternalAthletesTab() {
  const [pending, setPending] = useState(false);
  return (
    <CoachAthletesWorkspace active="external" navigationDisabled={pending}>
      <ExternalClientsWorkspace embedded onPendingChange={setPending} />
    </CoachAthletesWorkspace>
  );
}
export function ExternalClientsWorkspace({
  clientId,
  embedded = false,
  onPendingChange,
}: {
  clientId?: string;
  embedded?: boolean;
  onPendingChange?: (pending: boolean) => void;
}) {
  const Heading = embedded ? "h2" : "h1";
  return (
    <section
      className={
        embedded
          ? "session-types-page schedule-tab-content"
          : "session-types-page"
      }
    >
      {!embedded && (
        <Link href={clientId ? "/coach/athletes/external" : "/coach/athletes"}>
          {clientId ? "← External athletes" : "← My athletes"}
        </Link>
      )}
      <Heading>{clientId ? "External athlete" : "External athletes"}</Heading>
      <SessionActorBoundary>
        {(identity) => (
          <Workspace
            key={`${identity}:${clientId ?? "list"}`}
            clientId={clientId}
            onPendingChange={onPendingChange}
          />
        )}
      </SessionActorBoundary>
    </section>
  );
}
function Workspace({
  clientId,
  onPendingChange,
}: {
  clientId?: string;
  onPendingChange?: (pending: boolean) => void;
}) {
  useEffect(() => () => onPendingChange?.(false), [onPendingChange]);
  function pendingChanged(pending: boolean) {
    setClientPending(pending);
    onPendingChange?.(pending);
  }
  const [page, setPage] = useState<ExternalClientPage | null>(null),
    [detail, setDetail] = useState<ExternalClientDetail | null>(null),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false),
    [version, setVersion] = useState(0),
    [review, setReview] = useState<Record<string, unknown> | null>(null),
    [unknown, setUnknown] = useState(false),
    [clientPending, setClientPending] = useState(false);
  useEffect(() => {
    let active = true;
    void fetch(
      clientId
        ? `/api/coach/external-clients?id=${clientId}`
        : "/api/coach/external-clients",
      { cache: "no-store" },
    )
      .then((r) => r.json())
      .then((r) => {
        if (!active) return;
        if (r.status !== "ready") throw Error();
        if (clientId) setDetail(r.detail);
        else setPage(r.page);
      })
      .catch(() => {
        if (active)
          setMessage(
            "Athlete records could not be verified. Reload to try again.",
          );
      });
    return () => {
      active = false;
    };
  }, [clientId, version]);
  async function more() {
    setBusy(true);
    try {
      const url = detail
        ? `/api/coach/external-clients?id=${clientId}&offset=${detail.nextOffset}`
        : `/api/coach/external-clients?after=${page?.next}`;
      const r = await (await fetch(url, { cache: "no-store" })).json();
      if (r.status !== "ready") throw Error();
      if (detail) {
        if (r.detail.client.revision !== detail.client.revision) throw Error();
        setDetail({
          ...r.detail,
          sessions: [...detail.sessions, ...r.detail.sessions].filter(
            (s, i, a) => a.findIndex((x) => x.id === s.id) === i,
          ),
        });
      } else if (page)
        setPage({
          items: [...page.items, ...r.page.items].filter(
            (c, i, a) => a.findIndex((x) => x.id === c.id) === i,
          ),
          next: r.page.next,
        });
    } catch {
      setMessage(
        "More records could not be verified. Reload to check current records.",
      );
    } finally {
      setBusy(false);
    }
  }
  function saved(c: ExternalClient) {
    setMessage("Athlete saved.");
    if (detail) {
      setDetail({ ...detail, client: c });
      setVersion((v) => v + 1);
    } else
      setPage((p) =>
        p
          ? { ...p, items: [c, ...p.items.filter((x) => x.id !== c.id)] }
          : null,
      );
  }
  function invitationReview(action: string) {
    if (!detail) return;
    setReview({
      action,
      operationId: crypto.randomUUID(),
      externalClientId: detail.client.id,
      clientRevision: detail.client.revision,
      expectedInvitationId: detail.invitation?.id ?? null,
      expectedRevision: detail.invitation?.revision ?? null,
    });
    setMessage("");
  }
  async function invite() {
    if (!review) return;
    setBusy(true);
    try {
      const r = await (
        await fetch("/api/coach/external-clients?invitation=true", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(review),
        })
      ).json();
      if (r.status === "ready") {
        setReview(null);
        setUnknown(false);
        setVersion((v) => v + 1);
        setMessage(
          review.action === "revoke"
            ? "Invitation revoked."
            : "Invitation saved. Check its delivery status below.",
        );
      } else if (
        ["invalid", "conflict", "forbidden", "signed-out"].includes(r.status)
      ) {
        setUnknown(false);
        setReview(null);
        setMessage(
          "Invitation wasn’t changed. Reload current details and check your email, access and resend limit (one minute between sends; five per day).",
        );
      } else {
        setUnknown(true);
        setMessage(
          "Invitation outcome is unverified. Retry this exact action before editing the athlete or sending another invitation.",
        );
      }
    } catch {
      setUnknown(true);
      setMessage("Invitation outcome is unverified. Retry this exact action.");
    } finally {
      setBusy(false);
    }
  }
  const c = detail?.client,
    inv = detail?.invitation;
  return (
    <>
      {message && <p role="status">{message}</p>}
      {!page && !detail && !message && (
        <p role="status">Loading athlete records…</p>
      )}
      {page && (
        <>
          <p>
            Book sessions for people who haven’t joined MovX yet. Invite them
            later to share their session history.
          </p>
          <ClientForm onSaved={saved} onPendingChange={pendingChanged} />
          <div className="session-type-list">
            {page.items.length === 0 && <p>No external athletes yet.</p>}
            {page.items.map((client) => (
              <article className="session-type-card" key={client.id}>
                <div>
                  <h2>
                    <Link href={`/coach/athletes/external/${client.id}`}>
                      {client.name}
                    </Link>
                  </h2>
                  <p>
                    {client.email ?? "No email added"} ·{" "}
                    {client.linkedProfileId
                      ? "Joined MovX"
                      : "External athlete"}
                  </p>
                </div>
                <Link href={`/coach/athletes/external/${client.id}`}>
                  Sessions & notes
                </Link>
              </article>
            ))}
          </div>
          {page.next && (
            <button disabled={busy} onClick={() => void more()}>
              Load more athletes
            </button>
          )}
        </>
      )}
      {detail && c && (
        <>
          <h2 className="external-client-name">{c.name}</h2>
          <p>
            {c.linkedProfileId
              ? "This athlete joined MovX. Their shared session records are available in My training."
              : "Only you can see this athlete’s records until they accept an invitation."}
          </p>
          {!c.linkedProfileId && !clientPending && (
            <Link
              className="button dark"
              href={`/coach/bookings/new?externalClientId=${c.id}`}
            >
              Schedule a session
            </Link>
          )}
          <ClientForm
            key={`${c.id}:${c.revision}`}
            client={c}
            onSaved={saved}
            disabled={busy || !!review}
            onPendingChange={pendingChanged}
          />
          <section
            className="session-type-editor external-client-invitation"
            aria-label="Athlete invitation"
          >
            <h2>
              {c.linkedProfileId
                ? "Connected to MovX"
                : "Invite athlete to MovX"}
            </h2>
            {c.linkedProfileId ? (
              <p>
                Invitation accepted. Shared history is linked to their account;
                your private notes remain yours.
              </p>
            ) : (
              <>
                <p>
                  Email {c.name} an invitation to join MovX and access their
                  shared sessions, plans and notes.
                </p>
                {c.email ? (
                  <p>
                    Invitation email: <strong>{c.email}</strong>. They’ll need
                    to sign in or register with this same address, then accept
                    your invitation.
                  </p>
                ) : (
                  <p>
                    Add an email in Athlete details above, then choose Save
                    athlete details to enable invitations.
                  </p>
                )}
                <div className="session-type-toolbar">
                  <button
                    type="button"
                    className="button dark"
                    disabled={!c.email || busy || !!review || clientPending}
                    onClick={() => invitationReview(inv ? "resend" : "send")}
                  >
                    {inv ? "Resend invitation" : "Invite athlete"}
                  </button>
                  {inv?.status === "pending" && (
                    <button
                      type="button"
                      className="button secondary"
                      disabled={busy || !!review || clientPending}
                      onClick={() => invitationReview("revoke")}
                    >
                      Revoke invitation
                    </button>
                  )}
                </div>
                <p>You’ll confirm the email address before sending.</p>
                {inv && (
                  <p>
                    Sending again replaces older pending links. Wait at least
                    one minute between sends.
                  </p>
                )}
              </>
            )}
            {inv && (
              <p>
                Invitation: {inv.status}. Email:{" "}
                {inv.delivery === "accepted"
                  ? "accepted by email provider"
                  : inv.delivery === "unknown"
                    ? "delivery unverified"
                    : inv.delivery}
                . Expires {new Date(inv.expiresAt).toLocaleDateString("en-GB")}.
              </p>
            )}
            {review && (
              <div role="region" aria-label="Review invitation">
                <h3>
                  {review.action === "revoke"
                    ? "Revoke this invitation?"
                    : "Confirm invitation email"}
                </h3>
                <p>
                  {review.action === "revoke"
                    ? "The current link will stop granting access."
                    : `An invitation will be sent to ${c.email}. Accepting connects this athlete’s original sessions and shared notes to their verified account.`}
                </p>
                <div className="session-type-toolbar">
                  <button
                    type="button"
                    className="button dark"
                    disabled={busy}
                    onClick={() => void invite()}
                  >
                    {busy
                      ? "Saving…"
                      : unknown
                        ? "Retry exact action"
                        : review.action === "revoke"
                          ? "Confirm revocation"
                          : "Send email invitation"}
                  </button>
                  {!unknown && (
                    <button
                      type="button"
                      className="button secondary"
                      disabled={busy}
                      onClick={() => setReview(null)}
                    >
                      Cancel
                    </button>
                  )}
                </div>
              </div>
            )}
          </section>
          <section
            className="session-type-editor"
            aria-label="Athlete session history"
          >
            <h2>Sessions & notes</h2>
            <p>
              Open any session to read its plan, shared notes, videos and your
              private notes.
            </p>
            {detail.sessions.length === 0 ? (
              <p>No sessions recorded yet.</p>
            ) : (
              <ul className="external-session-list">
                {detail.sessions.map((s) => (
                  <li key={s.id}>
                    <Link href={`/coach/sessions/${s.id}`}>
                      {new Intl.DateTimeFormat("en-GB", {
                        dateStyle: "medium",
                        timeStyle: "short",
                        timeZone: "Europe/Berlin",
                      }).format(new Date(s.startsAt))}{" "}
                      · {s.status}
                      <span>Open session & notes →</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
            {detail.nextOffset !== null && (
              <button disabled={busy} onClick={() => void more()}>
                Load older sessions
              </button>
            )}
          </section>
        </>
      )}
    </>
  );
}
