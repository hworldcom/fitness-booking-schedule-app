"use client";

import { RotateCcw, TriangleAlert } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  prepareGroupEventOperationRequest,
  recoverGroupEventOperationRequest,
} from "@/solana/client/group-event-client";
import type {
  GroupEventOperationApiResult,
  PrepareGroupEventOperationRequest,
  PreparedGroupEventOperationResult,
} from "@/solana/group-event-operation";
import {
  isGroupEventOperationIdRequest,
  isPrepareGroupEventOperationRequest,
} from "@/solana/group-event-operation";
import {
  GroupEventOperationReview,
  groupEventOperationStatusMessage,
} from "./group-event-operation-review";

function recoveryKey(eventId: string) {
  return `movx:group-event-operation:${eventId}`;
}

type StoredGroupEventOperation = Readonly<{
  operationId: string;
  request: PrepareGroupEventOperationRequest | null;
}>;

export function decodeStoredGroupEventOperation(
  raw: string | null,
  eventId: string,
): StoredGroupEventOperation | null {
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed === "object" && parsed !== null) {
      const operationCandidate = {
        operationId: "operationId" in parsed ? parsed.operationId : undefined,
      };
      const requestCandidate = "request" in parsed ? parsed.request : undefined;
      if (
        isGroupEventOperationIdRequest(operationCandidate) &&
        isPrepareGroupEventOperationRequest(requestCandidate) &&
        requestCandidate.eventId === eventId
      ) {
        return Object.freeze({
          operationId: operationCandidate.operationId,
          request: requestCandidate,
        });
      }
    }
  } catch {
    // Older sessions stored only the operation ID.
  }
  const legacyCandidate = { operationId: raw };
  return isGroupEventOperationIdRequest(legacyCandidate)
    ? Object.freeze({ operationId: legacyCandidate.operationId, request: null })
    : null;
}

export function encodeStoredGroupEventOperation(
  operationId: string,
  request: PrepareGroupEventOperationRequest,
) {
  if (!isGroupEventOperationIdRequest({ operationId })) {
    throw new Error("Group-event recovery ID is invalid.");
  }
  return JSON.stringify({ operationId, request });
}

function storedOperation(eventId: string) {
  return decodeStoredGroupEventOperation(
    window.sessionStorage.getItem(recoveryKey(eventId)),
    eventId,
  );
}

function storeOperation(
  eventId: string,
  operationId: string,
  request: PrepareGroupEventOperationRequest,
) {
  window.sessionStorage.setItem(
    recoveryKey(eventId),
    encodeStoredGroupEventOperation(operationId, request),
  );
}

export function groupEventPreparationStatusMessage(
  result: GroupEventOperationApiResult,
  request?: PrepareGroupEventOperationRequest,
) {
  if (result.status === "conflict" && request?.kind === "fund") {
    return "The pool, linked wallet, contribution account or test-EURC account/balance is not eligible for this seat. Refresh before retrying; no transaction was sent.";
  }
  return groupEventOperationStatusMessage(result);
}

type GroupEventOperationPanelProps =
  | Readonly<{
      mode: "prepare";
      request: PrepareGroupEventOperationRequest;
      label: string;
      description: string;
      className?: string;
    }>
  | Readonly<{
      mode: "recover";
      eventId: string;
      description: string;
    }>;

export function GroupEventOperationPanel(props: GroupEventOperationPanelProps) {
  const request = props.mode === "prepare" ? props.request : undefined;
  const eventId =
    props.mode === "prepare" ? props.request.eventId : props.eventId;
  const router = useRouter();
  const [result, setResult] = useState<GroupEventOperationApiResult | null>(
    null,
  );
  const [storedRequest, setStoredRequest] =
    useState<PrepareGroupEventOperationRequest | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const effectiveRequest = request ?? storedRequest;

  useEffect(() => {
    const stored = storedOperation(eventId);
    if (!stored) return;
    let active = true;
    recoverGroupEventOperationRequest(stored.operationId)
      .then((recovered) => {
        if (!active) return;
        setStoredRequest(stored.request);
        setResult(recovered);
        if (recovered.status === "finalized") {
          window.sessionStorage.removeItem(recoveryKey(eventId));
          router.refresh();
        }
      })
      .catch(() => {
        if (active) {
          setError(
            `MovX could not recover operation ${stored.operationId}. Keep this ID and do not submit a duplicate yet.`,
          );
        }
      })
      .finally(() => {
        if (active) setBusy(false);
      });
    return () => {
      active = false;
    };
  }, [eventId, router]);

  async function prepare() {
    if (busy || !effectiveRequest) return;
    setBusy(true);
    setError(null);
    try {
      const prepared =
        await prepareGroupEventOperationRequest(effectiveRequest);
      setResult(prepared);
      if (prepared.status === "prepared" || prepared.status === "submitted") {
        storeOperation(eventId, prepared.operationId, effectiveRequest);
      }
    } catch {
      setError(
        "MovX could not prepare a simulated transaction. No wallet approval was requested and no EURC moved.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function recover() {
    const stored = storedOperation(eventId);
    if (!stored || busy) return;
    setBusy(true);
    setError(null);
    try {
      const recovered = await recoverGroupEventOperationRequest(
        stored.operationId,
      );
      setStoredRequest(stored.request);
      setResult(recovered);
      if (recovered.status === "finalized") {
        window.sessionStorage.removeItem(recoveryKey(eventId));
        router.refresh();
      }
    } catch {
      setError(
        `MovX could not recover operation ${stored.operationId}. Do not submit a replacement until its state is known.`,
      );
    } finally {
      setBusy(false);
    }
  }

  function finalized() {
    window.sessionStorage.removeItem(recoveryKey(eventId));
    router.refresh();
  }

  function close() {
    setResult(null);
    setError(null);
    router.refresh();
  }

  if (result?.status === "prepared") {
    return (
      <GroupEventOperationReview
        prepared={result as PreparedGroupEventOperationResult}
        onFinalized={finalized}
        onClose={close}
      />
    );
  }

  const submitted = result?.status === "submitted";
  return (
    <div className="group-event-operation-launcher" aria-live="polite">
      <p>{props.description}</p>
      {result && (
        <p
          className={
            result.status === "finalized"
              ? "group-event-operation-success"
              : "group-event-operation-alert"
          }
          role={result.status === "finalized" ? "status" : "alert"}
        >
          {result.status !== "finalized" && (
            <TriangleAlert size={17} aria-hidden="true" />
          )}
          {groupEventPreparationStatusMessage(
            result,
            effectiveRequest ?? undefined,
          )}
        </p>
      )}
      {error && (
        <p className="group-event-operation-alert" role="alert">
          <TriangleAlert size={17} aria-hidden="true" /> {error}
        </p>
      )}
      <div className="group-event-operation-actions">
        {submitted ? (
          <button
            type="button"
            className="button dark"
            disabled={busy}
            onClick={() => void recover()}
          >
            <RotateCcw size={16} aria-hidden="true" />
            {busy ? "Checking…" : "Recover submitted operation"}
          </button>
        ) : result?.status === "finalized" || !effectiveRequest ? null : (
          <button
            type="button"
            className={
              props.mode === "prepare"
                ? (props.className ?? "button dark")
                : "button dark"
            }
            disabled={busy}
            onClick={() => void prepare()}
          >
            {busy
              ? "Simulating…"
              : props.mode === "prepare"
                ? props.label
                : "Prepare this exact operation again"}
          </button>
        )}
        {result && !submitted && (
          <button type="button" className="button secondary" onClick={close}>
            Dismiss
          </button>
        )}
        {!effectiveRequest && !result && !error && (
          <span className="group-event-recovery-note" role="status">
            MovX will reopen the stored preparation from this browser when its
            recovery ID is available.
          </span>
        )}
      </div>
    </div>
  );
}
