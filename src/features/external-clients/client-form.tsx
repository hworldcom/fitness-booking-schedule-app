"use client";
import { useState } from "react";
import { clientFields, type ExternalClient } from "@/domain/external-clients";
export function ClientForm({
  client,
  onSaved,
  disabled = false,
  onPendingChange,
}: {
  client?: ExternalClient;
  onSaved: (client: ExternalClient) => void;
  disabled?: boolean;
  onPendingChange?: (pending: boolean) => void;
}) {
  const [name, setName] = useState(client?.name ?? ""),
    [email, setEmail] = useState(client?.email ?? ""),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [current, setCurrent] = useState<ExternalClient | null>(null);
  const [command, setCommand] = useState<Record<string, unknown> | null>(null);
  async function save() {
    const fields = clientFields({ name, email });
    if (!fields) {
      setMessage(
        "Enter a name up to 120 characters and a valid email, or leave email empty.",
      );
      return;
    }
    const payload = command ?? {
      action: client ? "update" : "create",
      operationId: crypto.randomUUID(),
      ...fields,
      ...(client ? { id: client.id, revision: client.revision } : {}),
    };
    setCommand(payload);
    onPendingChange?.(true);
    setBusy(true);
    setMessage("");
    try {
      const r = await (
        await fetch("/api/coach/external-clients", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(payload),
        })
      ).json();
      if (r.status === "ready") {
        setCommand(null);
        onPendingChange?.(false);
        setMessage("Athlete saved.");
        if (!client) {
          setName("");
          setEmail("");
        }
        onSaved(r.client);
      } else if (
        ["invalid", "conflict", "forbidden", "signed-out"].includes(r.status)
      ) {
        setCommand(null);
        if (r.status === "conflict" && r.current) {
          setCurrent(r.current);
          onPendingChange?.(true);
        } else onPendingChange?.(false);
        setMessage(
          r.status === "conflict"
            ? "This record changed or the email is already in your roster. Keep this draft and reload the current record, or choose the existing athlete."
            : "Athlete could not be saved. Check the fields and your coach access.",
        );
      } else
        setMessage(
          "Save outcome is unverified. Retry this exact save before making more changes.",
        );
    } catch {
      setMessage(
        "Save outcome is unverified. Retry this exact save before making more changes.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <form
      className="session-type-editor"
      onSubmit={(e) => {
        e.preventDefault();
        void save();
      }}
    >
      <h2>{client ? "Athlete details" : "Add an external athlete"}</h2>
      <p>Start with a name. Add an email when you’re ready to invite them.</p>
      <label>
        Name
        <input
          required
          maxLength={240}
          autoComplete="off"
          value={name}
          disabled={disabled || busy || !!command}
          onChange={(e) => setName(e.target.value)}
        />
      </label>
      <label>
        Email · optional
        <input
          type="email"
          maxLength={254}
          autoComplete="off"
          value={email}
          disabled={disabled || busy || !!command || !!client?.linkedProfileId}
          onChange={(e) => setEmail(e.target.value)}
        />
      </label>
      <button className="button dark" disabled={disabled || busy}>
        {busy
          ? "Saving…"
          : command
            ? "Retry exact save"
            : client
              ? "Save athlete details"
              : "Save athlete"}
      </button>
      {message && <p role="status">{message}</p>}
      {current && (
        <aside aria-label="Current saved athlete">
          <p>
            Current saved athlete: {current.name} ·{" "}
            {current.email ?? "No email"}. Your draft remains in the fields
            above.
          </p>
          <a href={`/coach/athletes/external/${current.id}`}>
            Reload current athlete details
          </a>
        </aside>
      )}
    </form>
  );
}
