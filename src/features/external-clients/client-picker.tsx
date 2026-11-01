"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import type {
  ExternalClient,
  ExternalClientPage,
} from "@/domain/external-clients";
import { ClientForm } from "./client-form";
export function ExternalClientPicker({
  initial,
  initialId,
  value,
  onChange,
  disabled,
  onPendingChange,
}: {
  initial: ExternalClientPage;
  initialId?: string;
  value: string;
  onChange: (id: string) => void;
  disabled: boolean;
  onPendingChange: (pending: boolean) => void;
}) {
  const [page, setPage] = useState(initial),
    [adding, setAdding] = useState(false),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false),
    [creating, setCreating] = useState(false);
  useEffect(() => {
    if (!initialId || initial.items.some((c) => c.id === initialId)) return;
    let active = true;
    void fetch(`/api/coach/external-clients?id=${initialId}`, {
      cache: "no-store",
    })
      .then((r) => r.json())
      .then((r) => {
        if (!active) return;
        if (r.status === "ready" && !r.detail.client.linkedProfileId)
          setPage((p) => ({
            ...p,
            items: [...p.items, r.detail.client].filter(
              (c, i, a) => a.findIndex((x) => x.id === c.id) === i,
            ),
          }));
        else
          setMessage(
            "This external client could not be selected. Choose a current client.",
          );
      })
      .catch(() => {
        if (active) setMessage("Client could not be loaded. Try reloading.");
      });
    return () => {
      active = false;
    };
  }, [initialId, initial.items]);
  async function more() {
    setBusy(true);
    try {
      const r = await (
        await fetch(
          `/api/coach/external-clients?unlinked=true&after=${page.next}`,
          { cache: "no-store" },
        )
      ).json();
      if (r.status !== "ready") throw Error();
      setPage((p) => ({
        items: [...p.items, ...r.page.items].filter(
          (c, i, a) => a.findIndex((x) => x.id === c.id) === i,
        ),
        next: r.page.next,
      }));
    } catch {
      setMessage("More clients could not be loaded. Try again.");
    } finally {
      setBusy(false);
    }
  }
  function saved(c: ExternalClient) {
    setPage((p) => ({
      ...p,
      items: [...p.items.filter((x) => x.id !== c.id), c],
    }));
    onChange(c.id);
    setAdding(false);
    setMessage(
      "Client saved. Choose the session details below to book their slot.",
    );
  }
  return (
    <section aria-label="External client selection">
      <div className="session-type-editor">
        <label>
          External client
          <select
            aria-label="External client"
            value={value}
            disabled={disabled || busy || creating}
            onChange={(e) => onChange(e.target.value)}
          >
            <option value="">Choose a saved client</option>
            {page.items.map((c) => (
              <option value={c.id} key={c.id}>
                {c.name}
                {c.email ? ` · ${c.email}` : ""}
              </option>
            ))}
          </select>
        </label>
        <div className="session-type-toolbar">
          {page.next && (
            <button
              type="button"
              disabled={disabled || busy || creating}
              onClick={() => void more()}
            >
              Load more clients
            </button>
          )}
          <button
            type="button"
            disabled={disabled || creating}
            onClick={() => setAdding((v) => !v)}
          >
            {adding ? "Close new client form" : "Add a new external client"}
          </button>
          <Link href="/coach/athletes/external">Manage external clients</Link>
        </div>
        <p>
          They can access shared session notes after accepting an invitation. A
          platform account isn’t needed to reserve their slot.
        </p>
        {message && <p role="status">{message}</p>}
      </div>
      {adding && (
        <ClientForm
          onSaved={saved}
          disabled={disabled}
          onPendingChange={(pending) => {
            setCreating(pending);
            onPendingChange(pending);
          }}
        />
      )}
    </section>
  );
}
