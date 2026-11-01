"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import type {
  ExternalClient,
  ExternalClientDetail,
  ExternalClientPage,
} from "@/domain/external-clients";
import { SessionActorBoundary } from "@/features/session-types/actor-boundary";
import { ClientForm } from "./client-form";
import "@/features/session-types/session-types.css";
export function ExternalClientsWorkspace({ clientId }: { clientId?: string }) {
  return (
    <section className="session-types-page">
      <Link href={clientId ? "/coach/athletes/external" : "/coach/athletes"}>
        {clientId ? "← External clients" : "← My athletes"}
      </Link>
      <h1>{clientId ? "External client" : "External clients"}</h1>
      <SessionActorBoundary>
        {(identity) => (
          <Workspace
            key={`${identity}:${clientId ?? "list"}`}
            clientId={clientId}
          />
        )}
      </SessionActorBoundary>
    </section>
  );
}
function Workspace({ clientId }: { clientId?: string }) {
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
            "Client records could not be verified. Reload to try again.",
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
    setMessage("Client saved.");
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
          "Invitation outcome is unverified. Retry this exact action before editing the client or sending another invitation.",
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
        <p role="status">Loading client records…</p>
      )}
      {page && (
        <>
          <p>
            Book sessions for people who haven’t joined MovX yet. Invite them
            later to share their session history.
          </p>
          <ClientForm onSaved={saved} />
          <div className="session-type-list">
            {page.items.length === 0 && <p>No external clients yet.</p>}
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
                    {client.linkedProfileId ? "Joined MovX" : "External client"}
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
              Load more clients
            </button>
          )}
        </>
      )}
      {detail && c && (
        <>
          <h2>{c.name}</h2>
          <p>
            {c.linkedProfileId
              ? "This client joined MovX. Their shared session records are available in My training."
              : "Only you can see this client’s records until they accept an invitation."}
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
            onPendingChange={setClientPending}
          />
          <section
            className="session-type-editor"
            aria-label="Client invitation"
          >
            <h2>Invite to MovX</h2>
            {c.linkedProfileId ? (
              <p>
                Invitation accepted. Shared history is linked to their account;
                your private notes remain yours.
              </p>
            ) : (
              <>
                <p>
                  Send to {c.email ?? "an email you add above"}. The client will
                  sign in or register with that email and choose whether to
                  accept.
                </p>
                {!c.email && (
                  <p>Add and save an email above before inviting.</p>
                )}
                <div className="session-type-toolbar">
                  <button
                    disabled={!c.email || busy || !!review || clientPending}
                    onClick={() => invitationReview(inv ? "resend" : "send")}
                  >
                    {inv ? "Review new invitation" : "Review invitation"}
                  </button>
                  {inv?.status === "pending" && (
                    <button
                      disabled={busy || !!review || clientPending}
                      onClick={() => invitationReview("revoke")}
                    >
                      Revoke invitation
                    </button>
                  )}
                </div>
                <p>
                  New invitations replace older pending links. Wait at least one
                  minute between sends.
                </p>
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
                    : "Send this invitation?"}
                </h3>
                <p>
                  {review.action === "revoke"
                    ? "The current link will stop granting access."
                    : `An invitation will be sent to ${c.email}. Accepting connects this client’s original sessions and shared notes to their verified account.`}
                </p>
                <button
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
                        : "Send invitation"}
                </button>
                {!unknown && (
                  <button disabled={busy} onClick={() => setReview(null)}>
                    Cancel
                  </button>
                )}
              </div>
            )}
          </section>
          <section
            className="session-type-editor"
            aria-label="Client session history"
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
