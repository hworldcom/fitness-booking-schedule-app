"use client";
import { useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { Plus, UsersRound, X } from "lucide-react";
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
  const formId = useId();
  const form = useRef<HTMLDivElement>(null);
  const selection = useRef<HTMLSelectElement>(null);
  const focusSavedClient = useRef(false);
  const toggle = useRef<HTMLButtonElement>(null);
  const navigationBlocked = disabled || creating;
  useEffect(() => {
    if (adding) form.current?.querySelector<HTMLInputElement>("input")?.focus();
  }, [adding]);
  useEffect(() => {
    if (!adding && !creating && !disabled && focusSavedClient.current) {
      focusSavedClient.current = false;
      selection.current?.focus();
    }
  }, [adding, creating, disabled]);
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
    focusSavedClient.current = true;
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
    <section
      className="external-client-picker"
      aria-label="External client selection"
    >
      <div className="session-type-editor external-client-chooser">
        <h3>Choose or add an external client</h3>
        <p>Choose someone you’ve saved, or add a new client below.</p>
        <label>
          External client
          <select
            ref={selection}
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
        <div className="session-type-toolbar external-client-picker-actions">
          {page.next && (
            <button
              type="button"
              className="button secondary"
              disabled={disabled || busy || creating}
              onClick={() => void more()}
            >
              {busy ? "Loading clients…" : "Load more clients"}
            </button>
          )}
          <button
            type="button"
            ref={toggle}
            className={`button ${adding ? "secondary" : "dark"}`}
            aria-expanded={adding}
            aria-controls={formId}
            disabled={disabled || creating}
            onClick={() => {
              setAdding((v) => !v);
              if (adding) toggle.current?.focus();
            }}
          >
            {adding ? (
              <X size={18} aria-hidden="true" />
            ) : (
              <Plus size={18} aria-hidden="true" />
            )}
            {adding ? "Close new client form" : "Add a new external client"}
          </button>
          <Link
            className="button secondary"
            href="/coach/athletes/external"
            aria-disabled={navigationBlocked || undefined}
            tabIndex={navigationBlocked ? -1 : undefined}
            onClick={(event) => {
              if (navigationBlocked) event.preventDefault();
            }}
          >
            <UsersRound size={18} aria-hidden="true" /> Manage external clients
          </Link>
        </div>
        {page.items.length === 0 && !page.next && (
          <p>
            No saved external clients yet. Add your first client to get started.
          </p>
        )}
        <p>
          They can access shared session notes after accepting an invitation. A
          platform account isn’t needed to reserve their slot.
        </p>
        {message && <p role="status">{message}</p>}
      </div>
      {adding && (
        <div id={formId} ref={form}>
          <ClientForm
            onSaved={saved}
            disabled={disabled}
            onPendingChange={(pending) => {
              setCreating(pending);
              onPendingChange(pending);
            }}
          />
        </div>
      )}
    </section>
  );
}
