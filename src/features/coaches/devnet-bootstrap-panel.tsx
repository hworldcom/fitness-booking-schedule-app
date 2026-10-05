"use client";

import { useSignTransaction } from "@solana/react";
import { ExternalLink, ShieldCheck, TriangleAlert } from "lucide-react";
import { useState } from "react";
import { useConnectedWallet } from "@solana/kit-plugin-wallet/react";
import type {
  CoachPassBootstrapApiResult,
  PreparedCoachPassBootstrapResult,
} from "@/solana/coach-pass-bootstrap";
import {
  prepareCoachPassBootstrapRequest,
  signCoachPassBootstrapTransaction,
  submitSignedCoachPassBootstrap,
} from "@/solana/client/coach-pass-bootstrap-client";
import {
  SOLANA_WALLET_CHAIN,
  walletClient,
} from "@/solana/client/wallet-client";

type ConnectedAccount = NonNullable<
  ReturnType<(typeof walletClient.wallet)["getState"]>["connected"]
>["account"];

function shortAddress(value: string) {
  return `${value.slice(0, 5)}…${value.slice(-5)}`;
}

function explorerTransaction(signature: string) {
  return `https://explorer.solana.com/tx/${signature}?cluster=devnet`;
}

function resultMessage(result: CoachPassBootstrapApiResult) {
  switch (result.status) {
    case "prepared":
      return "Fresh Devnet simulation passed. The exact transaction is ready for Tom’s wallet signature.";
    case "submitted":
      return "The platform signature was added and the exact transaction was submitted once. Recheck finality without preparing a replacement.";
    case "finalized":
      return "The transaction finalized and all three program accounts match the approved bootstrap.";
    case "expired":
      return "The blockhash expired without a verified result. Start over to create a fresh transaction.";
    case "failed":
      return "Devnet recorded a failed transaction. No bootstrap state was accepted.";
    case "conflict":
      return "The actor, wallet, transaction, or on-chain state no longer matches the approved bootstrap.";
    case "signed-out":
    case "preview":
      return "Sign in as the approved Tom account before preparing the bootstrap.";
    case "forbidden":
      return "This local operator flow is not available to the current account.";
    case "invalid-request":
      switch (result.reason) {
        case "sponsor-mismatch":
          return "The configured sponsor no longer matches the reviewed transaction.";
        case "wallet-transaction-invalid":
          return "Phantom returned bytes that are not a valid Solana transaction.";
        case "wallet-message-mismatch":
          return "Phantom changed the reviewed transaction message. Nothing was submitted.";
        case "wallet-signer-set-invalid":
          return "Phantom returned an unexpected signer layout. Nothing was submitted.";
        case "wallet-sponsor-pre-signed":
          return "The wallet response unexpectedly included the MovX sponsor signature.";
        case "wallet-coach-signature-missing":
          return "Phantom returned the transaction without Tom’s required signature.";
        case "wallet-coach-signature-invalid":
          return "Phantom returned a Tom signature that does not verify against the reviewed message.";
      }
      return "The signed payload is not a valid approved bootstrap transaction.";
    case "unavailable":
      return "The local database, signature check, sponsor, or Devnet RPC was unavailable. If the wallet already signed, recheck these exact bytes before preparing a replacement.";
  }
}

function BootstrapSigner({
  account,
  prepared,
  transactionBase64,
  onSigned,
}: {
  account: ConnectedAccount;
  prepared: PreparedCoachPassBootstrapResult;
  transactionBase64: string;
  onSigned: (value: string) => void;
}) {
  const signTransaction = useSignTransaction(account, SOLANA_WALLET_CHAIN);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const expected = prepared.prepared.summary.coachWalletAddress;
  const matches = account.address === expected;

  async function sign() {
    if (!matches || busy) return;
    setBusy(true);
    setError(null);
    try {
      onSigned(
        await signCoachPassBootstrapTransaction(
          transactionBase64,
          prepared.simulation.slot,
          signTransaction,
        ),
      );
    } catch {
      setError(
        "Phantom did not return the requested signature. Nothing was submitted.",
      );
    } finally {
      setBusy(false);
    }
  }

  if (!matches) {
    return (
      <p className="coach-operation-alert" role="alert">
        <TriangleAlert size={17} aria-hidden="true" /> Switch Phantom to the Tom
        coach account {shortAddress(expected)}. The connected account is{" "}
        {shortAddress(account.address)}.
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
        className="button dark"
        type="button"
        disabled={busy}
        onClick={() => void sign()}
      >
        {busy ? "Waiting for Phantom…" : "Sign as Tom"}
      </button>
    </>
  );
}

export function DevnetBootstrapPanel() {
  const connected = useConnectedWallet(walletClient);
  const [result, setResult] = useState<CoachPassBootstrapApiResult | null>(
    null,
  );
  const [prepared, setPrepared] =
    useState<PreparedCoachPassBootstrapResult | null>(null);
  const [fullyWalletSigned, setFullyWalletSigned] = useState<string | null>(
    null,
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function prepare() {
    if (busy) return;
    setBusy(true);
    setError(null);
    setFullyWalletSigned(null);
    setPrepared(null);
    try {
      const next = await prepareCoachPassBootstrapRequest();
      setResult(next);
      if (next.status === "prepared") setPrepared(next);
    } catch {
      setError(
        "The bootstrap preparation could not be read. Nothing was signed.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function submit(walletSigned: string) {
    if (!prepared || busy) return;
    setBusy(true);
    setError(null);
    setFullyWalletSigned(walletSigned);
    try {
      const next = await submitSignedCoachPassBootstrap(prepared, walletSigned);
      setResult(next);
      if (
        next.status === "expired" ||
        next.status === "failed" ||
        next.status === "conflict"
      ) {
        setPrepared(null);
      }
    } catch {
      setError(
        "The signed transaction may have reached the server. Keep these exact signed bytes in this page and use Recheck; do not prepare a replacement.",
      );
    } finally {
      setBusy(false);
    }
  }

  const signature =
    result && "transactionSignature" in result
      ? result.transactionSignature
      : null;

  return (
    <section className="coach-workspace">
      <header className="coach-workspace-header">
        <div>
          <span className="eyebrow">DEV0130 OPERATOR REHEARSAL</span>
          <h1>Devnet coach bootstrap</h1>
          <p>
            One atomic, zero-EURC transaction initializes Tom’s coach authority
            and publishes the approved one-credit and ten-credit offers. Tom is
            the only user-facing signer; the configured recovery address is
            recorded for later wallet replacement, and MovX pays the SOL fee and
            rent.
          </p>
        </div>
      </header>

      <section className="coach-operation-review" aria-live="polite">
        <div className="coach-operation-heading">
          <ShieldCheck size={23} aria-hidden="true" />
          <div>
            <span className="eyebrow">APPROVED TRANSACTION</span>
            <h3>Initialize authority and two public offers</h3>
          </div>
        </div>
        <dl className="coach-operation-terms">
          <div>
            <dt>Network</dt>
            <dd>Solana Devnet</dd>
          </div>
          <div>
            <dt>One credit</dt>
            <dd>10 test EURC</dd>
          </div>
          <div>
            <dt>Ten credits</dt>
            <dd>100 test EURC</dd>
          </div>
          <div>
            <dt>EURC moved now</dt>
            <dd>0 EURC</dd>
          </div>
          <div>
            <dt>SOL fee and rent</dt>
            <dd>Paid by MovX; approved ceiling 0.00533384 SOL</dd>
          </div>
        </dl>

        {result && (
          <p className="coach-operation-copy">{resultMessage(result)}</p>
        )}
        {prepared && (
          <p className="coach-operation-id">
            Fresh simulation slot <code>{prepared.simulation.slot}</code> ·{" "}
            {prepared.simulation.unitsConsumed ?? "unknown"} compute units
          </p>
        )}
        {error && (
          <p className="coach-operation-alert" role="alert">
            <TriangleAlert size={17} aria-hidden="true" /> {error}
          </p>
        )}
        {signature && (
          <a
            className="coach-operation-link"
            href={explorerTransaction(signature)}
            target="_blank"
            rel="noreferrer"
          >
            View Devnet transaction{" "}
            <ExternalLink size={14} aria-hidden="true" />
          </a>
        )}

        <div className="coach-operation-actions">
          {!prepared && result?.status !== "submitted" && (
            <button
              className="button dark"
              type="button"
              disabled={busy || result?.status === "finalized"}
              onClick={() => void prepare()}
            >
              {busy ? "Preparing and simulating…" : "Prepare fresh transaction"}
            </button>
          )}
          {prepared && !connected && (
            <p className="coach-operation-alert" role="status">
              Connect Phantom from the header, starting with Tom’s account.
            </p>
          )}
          {prepared && connected && !fullyWalletSigned && (
            <BootstrapSigner
              account={connected.account}
              prepared={prepared}
              transactionBase64={prepared.prepared.transactionBase64}
              onSigned={(signed) => void submit(signed)}
            />
          )}
          {result?.status === "submitted" && fullyWalletSigned && prepared && (
            <button
              className="button dark"
              type="button"
              disabled={busy}
              onClick={() => void submit(fullyWalletSigned)}
            >
              {busy ? "Checking Devnet…" : "Recheck finality"}
            </button>
          )}
          {result?.status === "prepared" && fullyWalletSigned && prepared && (
            <button
              className="button dark"
              type="button"
              disabled={busy}
              onClick={() => void submit(fullyWalletSigned)}
            >
              {busy ? "Checking server…" : "Recheck exact signed transaction"}
            </button>
          )}
          {result?.status === "unavailable" &&
            fullyWalletSigned &&
            prepared && (
              <button
                className="button dark"
                type="button"
                disabled={busy}
                onClick={() => void submit(fullyWalletSigned)}
              >
                {busy ? "Checking server…" : "Recheck exact signed transaction"}
              </button>
            )}
        </div>
      </section>
    </section>
  );
}
