"use client";
import { useEffect, useId, useRef, useState } from "react";
import { Bell, Check, MessageSquare } from "lucide-react";
import Link from "next/link";
import type { ActorSnapshot } from "@/auth/actor-contracts";
import {
  notificationHref,
  type NotificationPage,
} from "@/notifications/contracts";
import {
  NotificationError,
  notificationList,
  notificationWrite,
} from "@/notifications/client";
import { Modal } from "./ui";

type Cursor = { beforeAt: string; beforeId: string } | null;
export function NotificationBell({ actor }: { actor: ActorSnapshot }) {
  if (actor.status !== "authorized") return null;
  const actorKey = `${actor.demoRun.slug}:${actor.profile.slug}`;
  return <RecipientBell key={actorKey} actorKey={actorKey} />;
}
function RecipientBell({ actorKey }: { actorKey: string }) {
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState<"all" | "unread">("all");
  const [cursor, setCursor] = useState<Cursor>(null);
  const [previous, setPrevious] = useState<Cursor[]>([]);
  const [state, setState] = useState<{
    key: string;
    page?: NotificationPage;
    error?: string;
  }>();
  const [working, setWorking] = useState(false);
  const [writeError, setWriteError] = useState<string | null>(null);
  const queryKey = JSON.stringify([actorKey, filter, cursor]);
  const current = state?.key === queryKey ? state : undefined;
  const page = current?.page;
  const labelId = useId();
  const version = useRef(0);
  const writing = useRef(false);
  const alive = useRef(false);
  const scope = useRef<AbortController | null>(null);
  const reload = useRef<(force?: boolean) => Promise<void>>(async () => {});
  useEffect(() => {
    let active = true,
      reading = false,
      inFlightToken = 0;
    alive.current = true;
    const controller = new AbortController();
    scope.current = controller;
    let request: AbortController | undefined;
    const refresh = async (force = false) => {
      if (
        !active ||
        writing.current ||
        document.visibilityState === "hidden" ||
        (reading && !force)
      )
        return;
      request?.abort();
      request = new AbortController();
      reading = true;
      const token = ++version.current;
      inFlightToken = token;
      try {
        const loaded = await notificationList(
          { filter, ...(cursor ?? {}) },
          AbortSignal.any([controller.signal, request.signal]),
        );
        if (active && token === version.current)
          setState({ key: queryKey, page: loaded });
      } catch (error) {
        if (active && token === version.current)
          setState((old) => ({
            key: queryKey,
            page:
              error instanceof NotificationError &&
              ["signed-out", "forbidden"].includes(error.status)
                ? undefined
                : old?.key === queryKey
                  ? old.page
                  : undefined,
            error:
              error instanceof Error
                ? error.message
                : "Notifications are unavailable. Please try again.",
          }));
      } finally {
        if (token === inFlightToken) reading = false;
      }
    };
    reload.current = refresh;
    const onRefresh = () => {
      void refresh();
    };
    void refresh();
    const timer = window.setInterval(onRefresh, 30000);
    window.addEventListener("focus", onRefresh);
    window.addEventListener("movx:messages", onRefresh);
    document.addEventListener("visibilitychange", onRefresh);
    return () => {
      active = false;
      alive.current = false;
      controller.abort();
      request?.abort();
      clearInterval(timer);
      window.removeEventListener("focus", onRefresh);
      window.removeEventListener("movx:messages", onRefresh);
      document.removeEventListener("visibilitychange", onRefresh);
    };
  }, [actorKey, filter, cursor, queryKey]);
  async function mark(id?: string) {
    if (!page || writing.current || !scope.current) return;
    writing.current = true;
    ++version.current;
    setWorking(true);
    setWriteError(null);
    try {
      await notificationWrite(
        id
          ? { action: "read", args: { id } }
          : { action: "read-all", args: { throughAt: page.snapshotAt } },
        scope.current.signal,
      );
      writing.current = false;
      if (alive.current) await reload.current(true);
    } catch (error) {
      if (alive.current)
        setWriteError(
          error instanceof Error
            ? error.message
            : "Could not mark notifications as read. Try again.",
        );
    } finally {
      writing.current = false;
      if (alive.current) setWorking(false);
    }
  }
  const unread = current?.error ? null : page?.unreadCount;
  const countLabel =
    unread === null
      ? "count unavailable"
      : unread === undefined
        ? "loading"
        : `${unread} unread`;
  return (
    <>
      <button
        type="button"
        className="notification-bell"
        aria-label={`Notifications, ${countLabel}`}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => {
          setOpen(true);
          void reload.current(true);
        }}
      >
        <Bell size={22} strokeWidth={1.8} aria-hidden="true" />
        {(unread === null || (unread ?? 0) > 0) && (
          <span className="notification-count" aria-hidden="true">
            {unread === null ? "?" : unread! > 99 ? "99+" : unread}
          </span>
        )}
      </button>
      {open && (
        <Modal
          title="Notifications"
          eyebrow="MOVX CLUB"
          className="notification-dialog"
          onClose={() => setOpen(false)}
        >
          <div className="notification-toolbar">
            <div role="group" aria-label="Filter notifications">
              {(["all", "unread"] as const).map((value) => (
                <button
                  type="button"
                  key={value}
                  aria-pressed={filter === value}
                  disabled={working}
                  onClick={() => {
                    setFilter(value);
                    setCursor(null);
                    setPrevious([]);
                    setWriteError(null);
                  }}
                >
                  {value === "all" ? "All" : "Unread"}
                </button>
              ))}
            </div>
            <button
              type="button"
              className="notification-mark-all"
              disabled={
                !page || working || !!current?.error || page.unreadCount === 0
              }
              onClick={() => void mark()}
            >
              <Check size={14} aria-hidden="true" />
              Mark all read
            </button>
          </div>
          <div role="status" className="notification-status" id={labelId}>
            {writeError ||
              (current?.error
                ? `${current.error}${page ? " Showing the last loaded notifications." : ""}`
                : !page
                  ? "Loading notifications…"
                  : working
                    ? "Updating notifications…"
                    : "")}
          </div>
          {(current?.error || writeError) && (
            <button
              type="button"
              className="notification-retry"
              disabled={working}
              onClick={() => {
                setWriteError(null);
                void reload.current(true);
              }}
            >
              Try again
            </button>
          )}
          {page && (
            <>
              {page.items.length === 0 ? (
                <div className="notification-empty">
                  <Bell size={24} aria-hidden="true" />
                  <strong>
                    {filter === "unread"
                      ? "You’re all caught up"
                      : "No notifications yet"}
                  </strong>
                  <p>New message notifications will appear here.</p>
                </div>
              ) : (
                <ul
                  className="notification-items"
                  aria-busy={working}
                  aria-describedby={labelId}
                >
                  {page.items.map((item) => (
                    <li
                      key={item.id}
                      className={item.readAt ? "" : "is-unread"}
                    >
                      <span className="notification-item-icon">
                        <MessageSquare size={16} aria-hidden="true" />
                      </span>
                      <div>
                        <Link
                          href={notificationHref(item)}
                          onClick={() => setOpen(false)}
                        >
                          <strong>New message from {item.senderName}</strong>
                          <span>Open your conversation to read and reply.</span>
                        </Link>
                        <time dateTime={item.createdAt}>
                          {new Intl.DateTimeFormat("en-GB", {
                            timeZone: "Europe/Berlin",
                            day: "numeric",
                            month: "short",
                            hour: "2-digit",
                            minute: "2-digit",
                          }).format(new Date(item.createdAt))}{" "}
                          Berlin
                        </time>
                        {!item.readAt && (
                          <button
                            type="button"
                            className="notification-mark-read"
                            disabled={working}
                            onClick={() => void mark(item.id)}
                            aria-label={`Mark message notification from ${item.senderName} as read`}
                          >
                            Mark read
                          </button>
                        )}
                      </div>
                      {!item.readAt && (
                        <span
                          className="notification-unread-dot"
                          aria-label="Unread"
                        />
                      )}
                    </li>
                  ))}
                </ul>
              )}
              {(previous.length > 0 || page.hasMore) && (
                <nav
                  className="notification-paging"
                  aria-label="Notification history"
                >
                  <button
                    type="button"
                    disabled={previous.length === 0 || working}
                    onClick={() => {
                      setCursor(previous.at(-1) ?? null);
                      setPrevious(previous.slice(0, -1));
                    }}
                  >
                    Newer
                  </button>
                  <button
                    type="button"
                    disabled={!page.hasMore || working}
                    onClick={() => {
                      const last = page.items.at(-1);
                      if (last) {
                        setPrevious([...previous, cursor]);
                        setCursor({
                          beforeAt: last.createdAt,
                          beforeId: last.id,
                        });
                      }
                    }}
                  >
                    Older
                  </button>
                </nav>
              )}
            </>
          )}
          <p className="notification-footnote">
            Notification read status is separate from unread messages.
          </p>
        </Modal>
      )}
    </>
  );
}
