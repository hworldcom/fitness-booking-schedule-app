"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, MessageSquare, Send, ShieldBan, X } from "lucide-react";
import { useActor } from "@/auth/client/actor-provider";
import { isCanonicalUuid } from "@/domain/coach-bookings";
import {
  messageStatusLabel,
  validMessageBody,
  type MessageInbox,
  type MessageThread,
  type MessageContext,
  type MessageEntry,
  type MessageConversation,
} from "@/domain/private-messages";
import {
  accessRevoked,
  definitiveMessageFailure,
  messageError,
  messageRead,
  messageWrite,
} from "@/messages/client";
const date = (value: string) =>
  new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Europe/Berlin",
  }).format(new Date(value));
const contextLabel = (context: MessageContext) =>
  context.kind === "inquiry"
    ? "Coach inquiry"
    : `${context.bookingId ? "Session" : "Session request"} · ${context.startsAt ? date(context.startsAt) : "Details"}`;
function mergeThread(
  old: MessageThread | null,
  next: MessageThread,
): MessageThread {
  if (!old || old.conversation.id !== next.conversation.id) return next;
  return {
    ...next,
    entries: [
      ...new Map(
        [...old.entries, ...next.entries].map((e) => [e.id, e]),
      ).values(),
    ].sort((a, b) => a.seq - b.seq),
    contexts: [
      ...new Map(
        [...old.contexts, ...next.contexts].map((c) => [c.id, c]),
      ).values(),
    ],
  };
}
export function Mailbox(props: {
  coachId?: string;
  conversationId?: string;
  pairId?: string;
}) {
  const { actor } = useActor();
  if (actor.status !== "authorized")
    return <p role="status">Sign in to open your messages.</p>;
  return (
    <MailboxWorkspace
      key={`${actor.demoRun.slug}:${actor.profile.slug}`}
      {...props}
    />
  );
}
function MailboxWorkspace({
  coachId,
  conversationId,
  pairId,
}: {
  coachId?: string;
  conversationId?: string;
  pairId?: string;
}) {
  const [selected, setSelected] = useState<string | null>(
    conversationId && isCanonicalUuid(conversationId) ? conversationId : null,
  );
  const [contact, setContact] = useState(
    coachId && isCanonicalUuid(coachId) ? coachId : null,
  );
  const [filter, setFilter] = useState("all");
  const [inbox, setInbox] = useState<MessageInbox | null>(null);
  const [error, setError] = useState("");
  const [more, setMore] = useState(false);
  useEffect(() => {
    if (!pairId || !isCanonicalUuid(pairId)) return;
    let active = true;
    void messageWrite("open", { pairId })
      .then((v) => {
        if (active) {
          setContact(null);
          setSelected((v as { conversationId: string }).conversationId);
        }
      })
      .catch((e) => {
        if (active) setError(messageError(e));
      });
    return () => {
      active = false;
    };
  }, [pairId]);
  const generation = useRef(0);
  const busy = useRef(false);
  const revoked = useRef(false);
  const refresh = useCallback(async () => {
    if (
      busy.current ||
      revoked.current ||
      document.visibilityState === "hidden"
    )
      return;
    busy.current = true;
    const version = generation.current;
    try {
      const value = (await messageRead("inbox", { filter })) as MessageInbox;
      if (version === generation.current) {
        setInbox(value);
        setMore(value.items.length === 20);
        setError("");
      }
    } catch (e) {
      if (version === generation.current) {
        if (accessRevoked(e)) {
          revoked.current = true;
          generation.current++;
          setInbox(null);
          setSelected(null);
          setContact(null);
        }
        setError(messageError(e));
      }
    } finally {
      if (version === generation.current) busy.current = false;
    }
  }, [filter]);
  useEffect(() => {
    const version = ++generation.current;
    busy.current = false;
    const initial = window.setTimeout(refresh, 0);
    const timer = window.setInterval(refresh, 30000);
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    window.addEventListener("movx:messages", refresh);
    return () => {
      generation.current = version + 1;
      clearTimeout(initial);
      clearInterval(timer);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
      window.removeEventListener("movx:messages", refresh);
    };
  }, [refresh]);
  const select = (id: string) => {
    setContact(null);
    setSelected(id);
    window.history.replaceState(null, "", `/messages?conversation=${id}`);
  };
  const loadMore = async () => {
    if (!inbox?.items.length) return;
    const version = generation.current;
    const last = inbox.items.at(-1)!;
    try {
      const value = (await messageRead("inbox", {
        filter,
        beforeAt: last.activityAt,
        beforeId: last.id,
      })) as MessageInbox;
      if (version !== generation.current) return;
      setInbox((current) =>
        current
          ? {
              ...value,
              items: [
                ...current.items,
                ...value.items.filter(
                  (item) =>
                    !current.items.some((existing) => existing.id === item.id),
                ),
              ],
            }
          : value,
      );
      setMore(value.items.length === 20);
    } catch (e) {
      setError(messageError(e));
    }
  };
  return (
    <div className="mailbox-page">
      <header className="mailbox-heading">
        <span className="eyebrow">YOUR CONVERSATIONS</span>
        <h1>Messages</h1>
        <p>
          Questions, session requests and updates, together with your coach or
          athlete.
        </p>
      </header>
      <div
        className={`mailbox-layout ${selected || contact ? "has-conversation" : ""}`}
      >
        <aside className="mailbox-list" aria-label="Conversations">
          <div className="mailbox-filters" aria-label="Filter conversations">
            {[
              ["all", "All"],
              ["unread", "Unread"],
              ["requests", "Message requests"],
            ].map(([key, label]) => (
              <button
                type="button"
                key={key}
                aria-pressed={filter === key}
                onClick={() => {
                  setInbox(null);
                  setFilter(key);
                }}
              >
                {label}
              </button>
            ))}
          </div>
          {error && (
            <p className="mailbox-error" role="alert">
              {error} <button onClick={refresh}>Try again</button>
            </p>
          )}
          {!inbox && !error && <p role="status">Loading conversations…</p>}
          {inbox && inbox.items.length === 0 && (
            <div className="mailbox-empty">
              <MessageSquare aria-hidden="true" />
              <h2>
                {filter === "requests"
                  ? "No message requests"
                  : filter === "unread"
                    ? "You’re all caught up"
                    : "Your conversations start here"}
              </h2>
              <p>
                Ask a coach a question from their profile, or send a session
                request.
              </p>
              <Link href="/explore">Discover coaches</Link>
            </div>
          )}
          {inbox?.items.map((c) => (
            <button
              className={`mailbox-list-item ${selected === c.id ? "selected" : ""}`}
              key={c.id}
              onClick={() => select(c.id)}
              aria-current={selected === c.id ? "true" : undefined}
            >
              <span className="mailbox-initial" aria-hidden="true">
                {c.counterpartName
                  .split(" ")
                  .map((s) => s[0])
                  .slice(0, 2)
                  .join("")}
              </span>
              <span>
                <strong>{c.counterpartName}</strong>
                <small>
                  {c.role === "coach" ? "Your athlete" : "Your coach"}
                  {c.consent?.status === "pending" ? " · Message request" : ""}
                </small>
                <small>{date(c.activityAt)}</small>
              </span>
              {c.unread && (
                <span className="mailbox-unread" aria-label="Unread" />
              )}
            </button>
          ))}
          {more && (
            <button className="mailbox-load" onClick={loadMore}>
              Load more conversations
            </button>
          )}
        </aside>
        {contact ? (
          <Inquiry
            key={contact}
            coachId={contact}
            back={() => setContact(null)}
            saved={(id) => {
              select(id);
              void refresh();
            }}
          />
        ) : selected ? (
          <Conversation
            key={selected}
            id={selected}
            back={() => {
              setSelected(null);
              window.history.replaceState(null, "", "/messages");
            }}
          />
        ) : (
          <section className="mailbox-welcome">
            <MessageSquare size={40} aria-hidden="true" />
            <h2>A little conversation goes a long way.</h2>
            <p>Choose a conversation to see messages and session details.</p>
          </section>
        )}
      </div>
    </div>
  );
}
function Inquiry({
  coachId,
  back,
  saved,
}: {
  coachId: string;
  back: () => void;
  saved: (id: string) => void;
}) {
  const [coach, setCoach] = useState<{ name: string } | null>(null);
  const [body, setBody] = useState("");
  const [error, setError] = useState("");
  const [sending, setSending] = useState(false);
  const [pending, setPending] = useState<{ body: string; id: string } | null>(
    null,
  );
  useEffect(() => {
    const controller = new AbortController();
    void messageRead("contact", { coachId }, controller.signal)
      .then((v) => setCoach(v as { name: string }))
      .catch((e) => {
        if (!controller.signal.aborted) setError(messageError(e));
      });
    return () => controller.abort();
  }, [coachId]);
  const send = async () => {
    if (sending || !validMessageBody(body)) return;
    setSending(true);
    setError("");
    const submission = pending ?? { body, id: crypto.randomUUID() };
    setPending(submission);
    try {
      const v = (await messageWrite("inquire", {
        coachId,
        body: submission.body,
        submissionId: submission.id,
      })) as { conversationId: string };
      saved(v.conversationId);
    } catch (e) {
      if (accessRevoked(e)) {
        setBody("");
        setPending(null);
      }
      if (definitiveMessageFailure(e)) setPending(null);
      setError(messageError(e));
    } finally {
      setSending(false);
    }
  };
  return (
    <section className="mailbox-thread">
      <header className="mailbox-thread-header">
        <button className="mailbox-back" onClick={back}>
          <ArrowLeft size={18} />
          Back
        </button>
        <div>
          <h2>{coach ? `Message ${coach.name}` : "Message coach"}</h2>
          <p>Ask a question before choosing a session.</p>
        </div>
      </header>
      <div className="mailbox-contact-intro">
        <MessageSquare size={36} />
        <h3>What would you like to work on?</h3>
        <p>
          Your question starts a private conversation. It doesn’t book a session
          or create a connection.
        </p>
      </div>
      {error && (
        <p role="alert" className="mailbox-error">
          {error}
        </p>
      )}
      <div className="mailbox-composer">
        <label htmlFor="inquiry-body">Your question</label>
        <textarea
          id="inquiry-body"
          rows={4}
          value={body}
          readOnly={sending || pending !== null}
          disabled={!coach}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Tell the coach a little about your goals…"
        />
        <small>{[...body].length} / 4,000 characters</small>
        <button
          className="button dark"
          disabled={!coach || sending || !validMessageBody(body)}
          onClick={send}
        >
          <Send size={16} />
          {sending
            ? "Sending…"
            : pending
              ? "Retry same message"
              : "Send message"}
        </button>
      </div>
    </section>
  );
}
function Conversation({ id, back }: { id: string; back: () => void }) {
  const [thread, setThread] = useState<MessageThread | null>(null);
  const latest = useRef<MessageThread | null>(null);
  const [error, setError] = useState("");
  const [details, setDetails] = useState<MessageContext | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmBlock, setConfirmBlock] = useState(false);
  const [body, setBody] = useState("");
  const [context, setContext] = useState<string>("");
  const [notice, setNotice] = useState("");
  const inFlight = useRef(false);
  const revision = useRef(0);
  const queued = useRef<Record<string, number> | null>(null);
  const mounted = useRef(true);
  const [pending, setPending] = useState<{
    id: string;
    body: string;
    contextId: string | null;
    action: "send" | "request-consent";
  } | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const refresh = useCallback(
    async function load(cursor: Record<string, number> = {}) {
      if (!mounted.current || document.visibilityState === "hidden") return;
      if (inFlight.current) {
        queued.current = cursor;
        return;
      }
      inFlight.current = true;
      const version = revision.current;
      try {
        const next = (await messageRead("thread", {
          conversationId: id,
          ...cursor,
        })) as MessageThread;
        if (mounted.current && version === revision.current) {
          if (!latest.current)
            setContext(
              next.conversation.canSendGeneral
                ? "general"
                : (next.contexts.find((c) => c.canSend)?.id ?? "general"),
            );
          const merged = mergeThread(latest.current, next);
          latest.current = merged;
          setThread(merged);
          setDetails((old) =>
            old ? (merged.contexts.find((c) => c.id === old.id) ?? old) : null,
          );
          setError("");
        }
      } catch (e) {
        if (mounted.current && version === revision.current) {
          if (accessRevoked(e)) {
            latest.current = null;
            setThread(null);
            setBody("");
            setPending(null);
            mounted.current = false;
          }
          setError(messageError(e));
        }
      } finally {
        inFlight.current = false;
        if (queued.current && mounted.current) {
          const next = queued.current;
          queued.current = null;
          window.setTimeout(() => void load(next), 0);
        }
      }
    },
    [id],
  );
  useEffect(() => {
    mounted.current = true;
    const initial = window.setTimeout(refresh, 0);
    const update = () => {
      const seq = latest.current?.entries.at(-1)?.seq;
      void refresh(seq ? { after: seq } : {});
    };
    const timer = window.setInterval(update, 30000);
    window.addEventListener("focus", update);
    document.addEventListener("visibilitychange", update);
    return () => {
      mounted.current = false;
      clearTimeout(initial);
      clearInterval(timer);
      window.removeEventListener("focus", update);
      document.removeEventListener("visibilitychange", update);
    };
  }, [refresh]);
  // Acknowledge only content actually rendered in the visible scroll viewport. The
  // observer also handles keyboard scrolling and long histories loaded above it.
  useEffect(() => {
    const root = listRef.current;
    if (!root || !thread) return;
    let through = thread.readThrough;
    let timer: number | undefined;
    const observer = new IntersectionObserver(
      (entries) => {
        if (document.visibilityState !== "visible" || !document.hasFocus())
          return;
        for (const entry of entries)
          if (entry.isIntersecting)
            through = Math.max(
              through,
              Number((entry.target as HTMLElement).dataset.seq),
            );
        clearTimeout(timer);
        timer = window.setTimeout(() => {
          if (through > thread.readThrough)
            void messageWrite("read", { conversationId: id, through }).catch(
              (error) => setError(messageError(error)),
            );
        }, 200);
      },
      { root, threshold: 0.5 },
    );
    for (const entry of root.querySelectorAll("[data-seq]"))
      observer.observe(entry);
    return () => {
      observer.disconnect();
      clearTimeout(timer);
    };
  }, [thread, id]);
  const action = async (
    type: "consent" | "block" | "unblock",
    args: Record<string, unknown> = {},
  ) => {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await messageWrite(type, { conversationId: id, ...args });
      revision.current++;
      setConfirmBlock(false);
      await refresh();
    } catch (e) {
      setError(messageError(e));
    } finally {
      setBusy(false);
    }
  };
  if (!thread)
    return (
      <section className="mailbox-thread">
        <button className="mailbox-back" onClick={back}>
          <ArrowLeft size={18} />
          Back
        </button>
        <p role={error ? "alert" : "status"}>
          {error || "Loading conversation…"}
        </p>
        {error && <button onClick={() => refresh()}>Try again</button>}
      </section>
    );
  const c = thread.conversation;
  const chosen = thread.contexts.find((v) => v.id === context);
  const activeContext = context || "general";
  const service = thread.contexts.find((v) => v.id === activeContext);
  const canSend =
    activeContext === "general" ? c.canSendGeneral : !!service?.canSend;
  const requestMode =
    activeContext === "general" &&
    !c.canSendGeneral &&
    c.canRequestGeneral &&
    c.consent?.status !== "pending";
  const send = async () => {
    if (busy || !validMessageBody(body) || (!canSend && !requestMode)) return;
    setBusy(true);
    setError("");
    setNotice("");
    const submission = pending ?? {
      id: crypto.randomUUID(),
      body,
      contextId: service?.id ?? null,
      action: requestMode ? "request-consent" : "send",
    };
    setPending(submission);
    try {
      await messageWrite(submission.action, {
        conversationId: id,
        body: submission.body,
        contextId: submission.contextId,
        submissionId: submission.id,
      });
      revision.current++;
      setPending(null);
      setBody("");
      setNotice(
        submission.action === "request-consent"
          ? "Message request sent. Wait for their decision."
          : "Message sent.",
      );
      await refresh({ after: thread.entries.at(-1)?.seq ?? 0 });
    } catch (e) {
      if (accessRevoked(e)) {
        setBody("");
        setPending(null);
        setThread(null);
        latest.current = null;
      }
      if (definitiveMessageFailure(e)) setPending(null);
      setError(messageError(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <section
      className="mailbox-thread"
      aria-label={`Conversation with ${c.counterpartName}`}
    >
      <header className="mailbox-thread-header">
        <button className="mailbox-back" onClick={back}>
          <ArrowLeft size={18} />
          Back
        </button>
        <div>
          <h2>{c.counterpartName}</h2>
          <p>
            {c.role === "coach"
              ? "You’re the coach in this conversation"
              : "You’re the athlete in this conversation"}
          </p>
        </div>
        <button
          className="mailbox-block-control"
          onClick={() =>
            c.blockedByMe ? void action("unblock") : setConfirmBlock(true)
          }
          disabled={busy}
        >
          <ShieldBan size={16} />
          {c.blockedByMe ? "Unblock" : "Block"}
        </button>
      </header>
      {confirmBlock && (
        <div className="mailbox-notice" role="group" aria-label="Confirm block">
          <strong>Block {c.counterpartName}?</strong>
          <p>
            This removes your connection and stops new contact. Existing
            bookings stay in place; eligible booking coordination remains
            available until 14 days after that session ends.
          </p>
          <button onClick={() => action("block")} disabled={busy}>
            Confirm block
          </button>
          <button onClick={() => setConfirmBlock(false)}>
            Keep conversation
          </button>
        </div>
      )}
      {c.blocked && (
        <p className="mailbox-notice">
          Contact is blocked. Only eligible existing session contexts can be
          used. Your history remains available.
        </p>
      )}
      {c.consent?.status === "pending" && (
        <div className="mailbox-consent">
          <strong>
            {c.consent.recipientProfileId === c.actorProfileId
              ? "New message request"
              : "Your message request is awaiting a decision"}
          </strong>
          <p>{c.consent.body}</p>
          {c.consent.recipientProfileId === c.actorProfileId ? (
            <>
              <button
                onClick={() =>
                  action("consent", {
                    consentId: c.consent!.id,
                    decision: "accept",
                  })
                }
                disabled={busy}
              >
                Accept messages
              </button>
              <button
                onClick={() =>
                  action("consent", {
                    consentId: c.consent!.id,
                    decision: "decline",
                  })
                }
                disabled={busy}
              >
                Decline
              </button>
            </>
          ) : (
            <button
              onClick={() =>
                action("consent", {
                  consentId: c.consent!.id,
                  decision: "withdraw",
                })
              }
              disabled={busy}
            >
              Withdraw message request
            </button>
          )}
        </div>
      )}
      {error && (
        <p role="alert" className="mailbox-error">
          {error}{" "}
          <button onClick={() => refresh()}>Refresh conversation</button>
        </p>
      )}
      <p className="sr-only" role="status">
        {thread.lastSeq} conversation entries.
      </p>
      <div
        className="mailbox-entry-list"
        ref={listRef}
        tabIndex={0}
        aria-label="Message history"
      >
        {(thread.entries[0]?.seq ?? 1) > 1 && (
          <button
            className="mailbox-load"
            onClick={() => refresh({ before: thread.entries[0].seq })}
          >
            Load earlier messages
          </button>
        )}
        {thread.entries.map((e) => (
          <Entry
            key={e.id}
            entry={e}
            conversation={c}
            context={thread.contexts.find((x) => x.id === e.contextId)}
            details={setDetails}
          />
        ))}
        {(thread.entries.at(-1)?.seq ?? 0) < thread.lastSeq && (
          <button
            className="mailbox-load"
            onClick={() => refresh({ after: thread.entries.at(-1)?.seq ?? 0 })}
          >
            Load newer messages
          </button>
        )}
        {!thread.entries.length && (
          <p className="mailbox-empty">
            Your conversation has no messages yet.
          </p>
        )}
      </div>
      {details && (
        <aside className="mailbox-details" aria-label="Session details">
          <button
            onClick={() => setDetails(null)}
            aria-label="Close session details"
          >
            <X size={18} />
          </button>
          <h3>{details.bookingId ? "Session details" : "Request details"}</h3>
          <p>{messageStatusLabel(details.status)}</p>
          {details.startsAt && (
            <p>
              {date(details.startsAt)} –{" "}
              {details.endsAt ? date(details.endsAt) : ""} · Berlin time
            </p>
          )}
          <p>{details.venue}</p>
          {details.deadline && !details.bookingId && (
            <p>Decision deadline: {date(details.deadline)}</p>
          )}
          <Link
            href={
              c.role === "coach"
                ? `/coach?view=bookings#${details.bookingId ? "coach-booking-" + details.bookingId : "booking-requests"}`
                : `/sessions#${details.bookingId ? "athlete-booking-" + details.bookingId : "booking-requests"}`
            }
          >
            {details.bookingId
              ? c.role === "coach"
                ? "View session"
                : "View session in My sessions"
              : "Review original request"}
            {c.role === "coach" ? " in Coach workspace" : ""}
          </Link>
          <small>Session notes are separate from this conversation.</small>
        </aside>
      )}
      <div className="mailbox-composer">
        <label htmlFor="message-context">Message context</label>
        <select
          id="message-context"
          value={activeContext}
          disabled={busy || pending !== null}
          onChange={(e) => setContext(e.target.value)}
        >
          <option value="general">
            General messages{!c.canSendGeneral ? " · consent required" : ""}
          </option>
          {thread.contexts.map((v) => (
            <option key={v.id} value={v.id}>
              {contextLabel(v)}
              {!v.canSend ? " · closed" : ""}
            </option>
          ))}
        </select>
        {!canSend && (
          <p>
            {requestMode
              ? "Send one opening message. General chat starts only after they accept."
              : "Messaging is paused in this context. Choose an available session or inquiry context."}
          </p>
        )}
        <label className="sr-only" htmlFor="message-body">
          Message to {c.counterpartName}
        </label>
        <textarea
          id="message-body"
          value={body}
          readOnly={busy || pending !== null}
          disabled={!canSend && !requestMode}
          rows={3}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Write a message…"
        />
        <div className="mailbox-composer-footer">
          <small>
            {[...body].length} / 4,000 characters
            {chosen?.kind === "inquiry" ? " · Coach inquiry" : ""}
          </small>
          <button
            className="button dark"
            disabled={
              busy || !validMessageBody(body) || (!canSend && !requestMode)
            }
            onClick={send}
          >
            <Send size={16} />
            {busy
              ? "Saving…"
              : pending
                ? "Retry same message"
                : requestMode
                  ? "Request messages"
                  : "Send"}
          </button>
        </div>
        <p role="status">{notice}</p>
      </div>
    </section>
  );
}
function Entry({
  entry: e,
  conversation: c,
  context,
  details,
}: {
  entry: MessageEntry;
  conversation: MessageConversation;
  context: MessageContext | undefined;
  details: (c: MessageContext) => void;
}) {
  if (e.kind !== "text")
    return (
      <article className="mailbox-session-card" data-seq={e.seq}>
        <span className="eyebrow">
          {e.kind === "request" ? "SESSION REQUEST" : "SESSION UPDATE"}
        </span>
        <strong>
          {messageStatusLabel(
            e.kind === "request" ? (context?.status ?? e.status) : e.status,
          )}
        </strong>
        {context?.startsAt && <p>{date(context.startsAt)}</p>}
        {context?.venue && <p>{context.venue}</p>}
        {context && <button onClick={() => details(context)}>Details</button>}
        <small>{date(e.createdAt)}</small>
      </article>
    );
  return (
    <article
      className={`mailbox-message ${e.senderProfileId === c.actorProfileId ? "own" : ""}`}
      data-seq={e.seq}
    >
      <span className="sr-only">
        {e.senderProfileId === c.actorProfileId ? "You" : c.counterpartName}
      </span>
      <p>{e.body}</p>
      <small>
        {context ? contextLabel(context) : "General message"} ·{" "}
        {date(e.createdAt)}
      </small>
    </article>
  );
}
