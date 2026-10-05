"use client";

import { useSignTransaction } from "@solana/react";
import {
  CheckCircle2,
  ExternalLink,
  ShieldCheck,
  TriangleAlert,
} from "lucide-react";
import { useState } from "react";
import { useConnectedWallet } from "@solana/kit-plugin-wallet/react";
import {
  formatEurcBaseUnits,
  shortenChainReference,
} from "@/domain/coach-marketplace";
import {
  recoverCoachPassOperationRequest,
  rejectCoachPassOperationRequest,
  signPreparedCoachPassOperation,
  submitCoachPassOperationRequest,
} from "@/solana/client/coach-pass-client";
import {
  SOLANA_WALLET_CHAIN,
  walletClient,
} from "@/solana/client/wallet-client";
import type {
  CoachPassOperationApiResult,
  PreparedCoachPassOperationResult,
} from "@/solana/coach-pass-operation";

type ConnectedAccount = NonNullable<
  ReturnType<(typeof walletClient.wallet)["getState"]>["connected"]
>["account"];

function explorerAddress(address: string) {
  return `https://explorer.solana.com/address/${address}?cluster=devnet`;
}

function explorerTransaction(signature: string) {
  return `https://explorer.solana.com/tx/${signature}?cluster=devnet`;
}

function operationTitle(result: PreparedCoachPassOperationResult) {
  switch (result.prepared.summary.operation) {
    case "purchase-first-offer":
    case "purchase-offer":
      return `Buy ${result.prepared.summary.creditsPurchased} coach credit${result.prepared.summary.creditsPurchased === 1 ? "" : "s"}`;
    case "reserve-booking-credit":
      return "Reserve one coach credit";
    case "return-booking-credit":
      return "Return one reserved credit";
    case "consume-booking-credit":
      return "Complete one booked class";
  }
}

function statusMessage(result: CoachPassOperationApiResult) {
  switch (result.status) {
    case "submitted":
      return "Submitted to Devnet. MovX will recover the result from the signature and finalized account state; it will not send a duplicate.";
    case "finalized":
      return "Finalized and verified against the coach-pass accounts.";
    case "expired":
      return "The prepared blockhash expired without verified state. Prepare a fresh review before signing again.";
    case "failed":
      return result.failureCode === "wallet-rejected"
        ? "The wallet did not approve this operation. No replacement transaction was sent."
        : "The operation failed without being presented as finalized marketplace state.";
    case "conflict":
      return "The marketplace or chain state changed. Refresh before preparing another operation.";
    case "signed-out":
    case "preview":
      return "Sign in before preparing a wallet operation.";
    case "forbidden":
      return "The signed-in account or linked wallet is not authorized for this operation.";
    case "invalid-request":
      return "The prepared transaction no longer matches the reviewed request.";
    case "unavailable":
      return "The Devnet service is temporarily unavailable. No transaction was assumed to have succeeded.";
    case "prepared":
      return "Simulation passed. Review the exact terms before opening Phantom.";
  }
}

function PreparedTerms({
  result,
}: {
  result: PreparedCoachPassOperationResult;
}) {
  const summary = result.prepared.summary;
  const purchase =
    summary.operation === "purchase-first-offer" ||
    summary.operation === "purchase-offer"
      ? summary
      : null;
  return (
    <dl className="coach-operation-terms">
      <div>
        <dt>Network</dt>
        <dd>Solana Devnet</dd>
      </div>
      <div>
        <dt>Test asset</dt>
        <dd>EURC</dd>
      </div>
      {purchase ? (
        <>
          <div>
            <dt>Exact price</dt>
            <dd>{formatEurcBaseUnits(purchase.priceEurcBaseUnits)} EURC</dd>
          </div>
          <div>
            <dt>Credits</dt>
            <dd>{purchase.creditsPurchased}</dd>
          </div>
          <div>
            <dt>Recipient</dt>
            <dd title={purchase.paymentRecipientAddress}>
              {shortenChainReference(purchase.paymentRecipientAddress)}
            </dd>
          </div>
        </>
      ) : (
        <div>
          <dt>Credit movement</dt>
          <dd>Exactly one coach-specific credit</dd>
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
  result: PreparedCoachPassOperationResult;
  onResult: (result: CoachPassOperationApiResult) => void;
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
      walletSignedTransactionBase64 = await signPreparedCoachPassOperation(
        result,
        signTransaction,
      );
    } catch {
      try {
        onResult(await rejectCoachPassOperationRequest(result.operationId));
      } catch {
        setError(
          "Phantom did not return a signed transaction, and MovX could not record the rejection. Recover this operation before retrying.",
        );
      } finally {
        setBusy(false);
      }
      return;
    }

    try {
      onResult(
        await submitCoachPassOperationRequest({
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
      <p className="coach-operation-alert" role="alert">
        <TriangleAlert size={17} aria-hidden="true" /> Connected Phantom account{" "}
        {shortenChainReference(account.address)} is not the linked authority{" "}
        {shortenChainReference(expectedAddress)}. Switch accounts before
        signing.
      </p>
    );
  }

  return (
    <>
      {error && (
        <p className="coach-operation-alert" role="alert">
          <TriangleAlert size={17} aria-hidden="true" /> {error}
        </p>
      )}
      <button
        type="button"
        className="button dark"
        disabled={busy}
        onClick={() => void approve()}
      >
        {busy ? "Waiting for Phantom…" : "Approve this exact transaction"}
      </button>
    </>
  );
}

export function CoachPassOperationReview({
  prepared,
  onFinalized,
  onClose,
}: {
  prepared: PreparedCoachPassOperationResult;
  onFinalized: () => void;
  onClose: () => void;
}) {
  const connected = useConnectedWallet(walletClient);
  const [result, setResult] = useState<CoachPassOperationApiResult>(prepared);
  const [recovering, setRecovering] = useState(false);
  const [recoveryError, setRecoveryError] = useState<string | null>(null);

  async function recover() {
    if (recovering) return;
    setRecovering(true);
    setRecoveryError(null);
    try {
      const recovered = await recoverCoachPassOperationRequest(
        prepared.operationId,
      );
      setResult(recovered);
      if (recovered.status === "finalized") onFinalized();
    } catch {
      setRecoveryError(
        "Finalized state is not readable right now. Keep this operation ID and check again; do not submit a duplicate.",
      );
    } finally {
      setRecovering(false);
    }
  }

  function receiveResult(next: CoachPassOperationApiResult) {
    setResult(next);
    if (next.status === "finalized") onFinalized();
  }

  const snapshot = result.status === "prepared" ? null : result;
  const terminal =
    snapshot?.status === "finalized" ||
    snapshot?.status === "failed" ||
    snapshot?.status === "expired";
  const transactionSignature =
    "transactionSignature" in result ? result.transactionSignature : null;

  return (
    <section className="coach-operation-review" aria-live="polite">
      <div className="coach-operation-heading">
        <ShieldCheck size={23} aria-hidden="true" />
        <div>
          <span className="eyebrow">SIMULATED TRANSACTION REVIEW</span>
          <h3>{operationTitle(prepared)}</h3>
        </div>
      </div>
      <PreparedTerms result={prepared} />
      <p className="coach-operation-copy">{statusMessage(result)}</p>
      <p className="coach-operation-id">
        Recovery ID <code>{prepared.operationId}</code>
      </p>
      {transactionSignature && (
        <a
          className="coach-operation-link"
          href={explorerTransaction(transactionSignature)}
          target="_blank"
          rel="noreferrer"
        >
          View Devnet transaction <ExternalLink size={14} aria-hidden="true" />
        </a>
      )}
      <a
        className="coach-operation-link"
        href={explorerAddress(prepared.prepared.summary.coachAuthorityAddress)}
        target="_blank"
        rel="noreferrer"
      >
        Verify coach authority <ExternalLink size={14} aria-hidden="true" />
      </a>
      {recoveryError && (
        <p className="coach-operation-alert" role="alert">
          <TriangleAlert size={17} aria-hidden="true" /> {recoveryError}
        </p>
      )}
      <div className="coach-operation-actions">
        {result.status === "prepared" && connected && (
          <ConnectedApproval
            account={connected.account}
            result={prepared}
            onResult={receiveResult}
          />
        )}
        {result.status === "prepared" && !connected && (
          <p className="coach-operation-alert" role="status">
            Connect the linked Phantom account from the header before approving.
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
          <span className="coach-operation-success">
            <CheckCircle2 size={17} aria-hidden="true" /> Verified
          </span>
        )}
        {(terminal || result.status === "conflict") && (
          <button type="button" className="button secondary" onClick={onClose}>
            Close
          </button>
        )}
      </div>
    </section>
  );
}
