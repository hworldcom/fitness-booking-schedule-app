"use client";
import { useEffect, useState } from "react";
import type { MessageInbox } from "@/domain/private-messages";
import { messageRead } from "./client";
export function useUnreadMessages(actorKey: string | null) {
  const [state, setState] = useState<{
    key: string;
    count: number | null;
  } | null>(null);
  useEffect(() => {
    if (!actorKey) return;
    let active = true,
      busy = false;
    const controller = new AbortController();
    const refresh = async () => {
      if (busy || document.visibilityState === "hidden") return;
      busy = true;
      try {
        const inbox = (await messageRead(
          "inbox",
          {},
          controller.signal,
        )) as MessageInbox;
        if (active) setState({ key: actorKey, count: inbox.unreadCount });
      } catch {
        if (active) setState({ key: actorKey, count: null });
      } finally {
        busy = false;
      }
    };
    void refresh();
    const timer = window.setInterval(refresh, 30000);
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    window.addEventListener("movx:messages", refresh);
    return () => {
      active = false;
      controller.abort();
      clearInterval(timer);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
      window.removeEventListener("movx:messages", refresh);
    };
  }, [actorKey]);
  return state?.key === actorKey ? state.count : null;
}
