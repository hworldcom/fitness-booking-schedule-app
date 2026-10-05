"use client";

import { useSignTransaction } from "@solana/react";
import { useConnectedWallet } from "@solana/kit-plugin-wallet/react";
import {
  CheckCircle2,
  ExternalLink,
  ShieldCheck,
  TriangleAlert,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import {
  formatEurcBaseUnits,
  shortenChainReference,
} from "@/domain/coach-marketplace";
import {
  recoverGroupEventOperationRequest,
  rejectGroupEventOperationRequest,
  signPreparedGroupEventOperation,
  submitGroupEventOperationRequest,
} from "@/solana/client/group-event-client";
import {
  SOLANA_WALLET_CHAIN,
  walletClient,
} from "@/solana/client/wallet-client";
import type {
  GroupEventOperationApiResult,
  PreparedGroupEventOperationResult,
} from "@/solana/group-event-operation";

type ConnectedAccount = NonNullable<
  ReturnType<(typeof walletClient.wallet)["getState"]>["connected"]
>["account"];

function explorerAddress(address: string) {
  return `https://explorer.solana.com/address/${address}?cluster=devnet`;
}

function explorerTransaction(signature: string) {
  return `https://explorer.solana.com/tx/${signature}?cluster=devnet`;
}

function operationTitle(result: PreparedGroupEventOperationResult) {
  switch (result.prepared.summary.operation) {
    case "create-event-pool":
      return "Create this event pool";
    case "fund-event-seat":
      return "Fund one event seat";
    case "settle-event-pool":
      return "Settle the funding result";
    case "claim-event-payout":
      return "Claim the coach payout";
    case "claim-event-refund":
      return "Claim your seat refund";
  }
}

export function groupEventOperationStatusMessage(
  result: GroupEventOperationApiResult,
) {
  switch (result.status) {
    case "submitted":
      return "Submitted to Devnet. MovX can recover the result from the signature and finalized accounts; it will not send a duplicate.";
    case "finalized":
      return "Finalized on Devnet and verified against the event accounts.";
    case "expired":
      return "The prepared blockhash expired without verified state. Prepare a fresh review before signing again.";
    case "failed":
      return result.failureCode === "wallet-rejected"
        ? "The wallet did not approve this operation. No replacement transaction was sent."
        : "The operation failed without being presented as finalized marketplace state.";
    case "conflict":
      return "The event or chain state changed. Refresh before preparing another operation.";
    case "signed-out":
    case "preview":
      return "Sign in before preparing a wallet operation.";
    case "forbidden":
      return "The signed-in account or linked wallet is not authorized for this operation.";
    case "invalid-request":
      switch (result.reason) {
        case "submit-payload-invalid":
          return "MovX could not read the bounded signed-transaction request. Nothing was submitted.";
        case "sponsor-mismatch":
          return "The configured MovX sponsor no longer matches the reviewed transaction. Nothing was submitted.";
        case "wallet-transaction-invalid":
          return "The wallet returned bytes that are not a valid Solana transaction. Nothing was submitted.";
        case "wallet-message-mismatch":
          return "The wallet changed the reviewed transaction message. Nothing was submitted.";
        case "wallet-signer-set-invalid":
          return "The wallet returned an unexpected signer layout. Nothing was submitted.";
        case "wallet-sponsor-pre-signed":
          return "The wallet response unexpectedly included the MovX sponsor signature. Nothing was submitted.";
        case "wallet-authority-signature-missing":
          return "The wallet returned the transaction without the required user signature. Nothing was submitted.";
        case "wallet-authority-signature-invalid":
          return "The wallet signature does not verify against the reviewed transaction. Nothing was submitted.";
      }
      return "The request no longer matches a valid event operation. Nothing was submitted.";
    case "unavailable":
      return "The Devnet service is temporarily unavailable. No transaction was assumed to have succeeded.";
    case "prepared":
      return "Simulation passed. Review these exact terms before opening your wallet.";
  }
}

function unixDateTime(seconds: string) {
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Europe/Berlin",
  }).format(new Date(Number(seconds) * 1_000));
}

function PreparedTerms({
  result,
}: {
  result: PreparedGroupEventOperationResult;
}) {
  const summary = result.prepared.summary;
  return (
    <dl className="group-event-operation-terms">
      <div>
        <dt>Network</dt>
        <dd>Solana Devnet</dd>
      </div>
      <div>
        <dt>Test asset</dt>
        <dd>EURC</dd>
      </div>
      {summary.operation === "create-event-pool" && (
        <>
          <div>
            <dt>Seat price</dt>
            <dd>{formatEurcBaseUnits(summary.seatPriceEurcBaseUnits)} EURC</dd>
          </div>
          <div>
            <dt>Funding threshold</dt>
            <dd>{summary.minimumParticipants} seats</dd>
          </div>
          <div>
            <dt>Capacity</dt>
            <dd>{summary.maximumParticipants} seats</dd>
          </div>
          <div>
            <dt>Funding closes</dt>
            <dd>{unixDateTime(summary.fundingDeadlineUnixSeconds)}</dd>
          </div>
        </>
      )}
      {summary.operation === "fund-event-seat" && (
        <>
          <div>
            <dt>Contribution</dt>
            <dd>{formatEurcBaseUnits(summary.seatPriceEurcBaseUnits)} EURC</dd>
          </div>
          <div>
            <dt>Seat</dt>
            <dd>One seat in this event pool</dd>
          </div>
        </>
      )}
      {summary.operation === "settle-event-pool" && (
        <div>
          <dt>Chain-derived result</dt>
          <dd>
            {summary.expectedOutcome === "succeeded" ? "Success" : "Failed"} ·{" "}
            {summary.participantCount} of {summary.minimumParticipants} needed
          </dd>
        </div>
      )}
      {(summary.operation === "claim-event-payout" ||
        summary.operation === "claim-event-refund") && (
        <div>
          <dt>
            {summary.operation === "claim-event-payout" ? "Payout" : "Refund"}
          </dt>
          <dd>{formatEurcBaseUnits(summary.amountEurcBaseUnits)} EURC</dd>
        </div>
      )}
      <div>
        <dt>SOL fee and rent</dt>
        <dd>Paid by MovX</dd>
      </div>
      <div>
        <dt>Your authority</dt>
        <dd title={summary.authorityAddress}>
          {shortenChainReference(summary.authorityAddress)}
        </dd>
      </div>
      <div>
        <dt>Platform payer</dt>
        <dd title={summary.platformPayerAddress}>
          {shortenChainReference(summary.platformPayerAddress)}
        </dd>
      </div>
    </dl>
  );
}

function ConnectedApproval({
  account,
  result,
  onResult,
}: {
  account: ConnectedAccount;
  result: PreparedGroupEventOperationResult;
  onResult: (result: GroupEventOperationApiResult) => void;
}) {
  const signTransaction = useSignTransaction(account, SOLANA_WALLET_CHAIN);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const expectedAddress = result.prepared.summary.authorityAddress;
  const matchingWallet = account.address === expectedAddress;

  async function approve() {
    if (busy || !matchingWallet) return;
    setBusy(true);
    setError(null);
    let walletSignedTransactionBase64: string;
    try {
      walletSignedTransactionBase64 = await signPreparedGroupEventOperation(
        result,
        signTransaction,
      );
    } catch {
      try {
        onResult(await rejectGroupEventOperationRequest(result.operationId));
      } catch {
        setError(
          "The wallet did not return a signature, and MovX could not record the rejection. Recover this operation before retrying.",
        );
      } finally {
        setBusy(false);
      }
      return;
    }

    try {
      onResult(
        await submitGroupEventOperationRequest({
          operationId: result.operationId,
          walletSignedTransactionBase64,
        }),
      );
    } catch {
      setError(
        "The signed operation may have reached MovX. Recover by operation ID; do not approve a replacement yet.",
      );
    } finally {
      setBusy(false);
    }
  }

  if (!matchingWallet) {
    return (
      <p className="group-event-operation-alert" role="alert">
        <TriangleAlert size={17} aria-hidden="true" /> Connected account{" "}
        {shortenChainReference(account.address)} is not the linked authority{" "}
        {shortenChainReference(expectedAddress)}. Switch accounts before
        signing.
      </p>
    );
  }

  return (
    <>
      {error && (
        <p className="group-event-operation-alert" role="alert">
          <TriangleAlert size={17} aria-hidden="true" /> {error}
        </p>
      )}
      <button
        type="button"
        className="button dark"
        disabled={busy}
        onClick={() => void approve()}
      >
        {busy ? "Waiting for wallet…" : "Approve this exact transaction"}
      </button>
    </>
  );
}

export function GroupEventOperationReview({
  prepared,
  onFinalized,
  onClose,
}: {
  prepared: PreparedGroupEventOperationResult;
  onFinalized: () => void;
  onClose: () => void;
}) {
  const connected = useConnectedWallet(walletClient);
  const reviewRef = useRef<HTMLElement>(null);
  const [result, setResult] = useState<GroupEventOperationApiResult>(prepared);
  const [recovering, setRecovering] = useState(false);
  const [recoveryError, setRecoveryError] = useState<string | null>(null);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      reviewRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      reviewRef.current?.focus({ preventScroll: true });
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);

  async function recover() {
    if (recovering) return;
    setRecovering(true);
    setRecoveryError(null);
    try {
      const recovered = await recoverGroupEventOperationRequest(
        prepared.operationId,
      );
      setResult(recovered);
      if (recovered.status === "finalized") onFinalized();
    } catch {
      setRecoveryError(
        "Finalized state is not readable right now. Keep this recovery ID and do not submit a duplicate.",
      );
    } finally {
      setRecovering(false);
    }
  }

  function receiveResult(next: GroupEventOperationApiResult) {
    setResult(next);
    if (next.status === "finalized") onFinalized();
  }

  const transactionSignature =
    "transactionSignature" in result ? result.transactionSignature : null;

  return (
    <section
      ref={reviewRef}
      className="group-event-operation-review"
      aria-live="polite"
      tabIndex={-1}
    >
      <div className="group-event-operation-heading">
        <ShieldCheck size={23} aria-hidden="true" />
        <div>
          <span className="eyebrow">SIMULATED TRANSACTION REVIEW</span>
          <h3>{operationTitle(prepared)}</h3>
        </div>
      </div>
      <PreparedTerms result={prepared} />
      <p>{groupEventOperationStatusMessage(result)}</p>
      <p className="group-event-operation-id">
        Recovery ID <code>{prepared.operationId}</code>
      </p>
      {transactionSignature && (
        <a
          className="group-event-operation-link"
          href={explorerTransaction(transactionSignature)}
          target="_blank"
          rel="noreferrer"
        >
          View Devnet transaction <ExternalLink size={14} aria-hidden="true" />
        </a>
      )}
      <a
        className="group-event-operation-link"
        href={explorerAddress(prepared.prepared.summary.eventPoolAddress)}
        target="_blank"
        rel="noreferrer"
      >
        Inspect event pool <ExternalLink size={14} aria-hidden="true" />
      </a>
      {recoveryError && (
        <p className="group-event-operation-alert" role="alert">
          <TriangleAlert size={17} aria-hidden="true" /> {recoveryError}
        </p>
      )}
      <div className="group-event-operation-actions">
        {result.status === "prepared" && connected && (
          <ConnectedApproval
            account={connected.account}
            result={prepared}
            onResult={receiveResult}
          />
        )}
        {result.status === "prepared" && !connected && (
          <p className="group-event-operation-alert" role="status">
            Connect the linked wallet from the header before approving.
            Preparing did not request a signature or move EURC.
          </p>
        )}
        {result.status === "submitted" && (
          <button
            type="button"
            className="button dark"
            disabled={recovering}
            onClick={() => void recover()}
          >
            {recovering ? "Checking finalized state…" : "Check finalized state"}
          </button>
        )}
        {result.status === "finalized" && (
          <span className="group-event-operation-success">
            <CheckCircle2 size={17} aria-hidden="true" /> Verified
          </span>
        )}
        {result.status !== "prepared" && result.status !== "submitted" && (
          <button type="button" className="button secondary" onClick={onClose}>
            Close
          </button>
        )}
      </div>
    </section>
  );
}
