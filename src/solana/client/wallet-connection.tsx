"use client";

import { Wallet } from "lucide-react";
import Link from "next/link";
import {
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type FormEvent,
} from "react";
import {
  useConnect,
  useConnectedWallet,
  useDisconnect,
  useIsWalletReady,
  useSignMessage,
  useWalletStatus,
  useWallets,
} from "@solana/kit-plugin-wallet/react";
import { supabasePublicConfig } from "@/auth/config";
import { browserAuthClient } from "@/auth/client/browser-client";
import { useAuthSession } from "@/auth/client/session-provider";
import {
  emailOtpErrorMessage,
  normalizeEmail,
  normalizeEmailOtp,
} from "@/auth/email-otp";
import { Pill } from "@/components/ui";
import {
  walletSignatureToBase64,
  type PersonalWalletMutationResult,
  type PersonalWalletPurpose,
  type PersonalWalletSnapshot,
} from "../personal-wallet";
import {
  fetchPersonalWallet,
  requestPersonalWalletChallenge,
  submitPersonalWalletProof,
  unlinkPersonalWalletBinding,
} from "./personal-wallet-client";
import { PHANTOM_DOWNLOAD_URL, walletClient } from "./wallet-client";
import {
  shortenWalletAddress,
  walletErrorMessage,
  walletProofErrorMessage,
} from "./wallet-presentation";

const subscribeToHydration = () => () => {};

export function WalletStatusButton({ onOpen }: { onOpen: () => void }) {
  const mounted = useSyncExternalStore(
    subscribeToHydration,
    () => true,
    () => false,
  );
  const connected = useConnectedWallet(walletClient);
  const isReady = useIsWalletReady(walletClient);
  const status = useWalletStatus(walletClient);
  const address = mounted ? connected?.account.address : undefined;
  const isConnecting = status === "connecting";
  const isBusy =
    !mounted || !isReady || isConnecting || status === "disconnecting";

  const visibleLabel = address
    ? shortenWalletAddress(address)
    : isConnecting
      ? "Connecting…"
      : isBusy
        ? "Wallet loading"
        : "Connect Phantom";

  return (
    <button
      type="button"
      className={`wallet-button ${address ? "connected" : ""}`}
      aria-label={
        address
          ? `Phantom wallet connected: ${address}`
          : isConnecting
            ? "Phantom wallet connection is waiting for approval"
            : isBusy
              ? "Phantom wallet state is loading"
              : "Connect Phantom wallet"
      }
      disabled={isBusy}
      onClick={onOpen}
    >
      <Wallet size={17} aria-hidden="true" />
      <span>{visibleLabel}</span>
    </button>
  );
}

export function WalletConnectionPanel({ onSignIn }: { onSignIn?: () => void }) {
  return <PersonalWalletConnectionPanel onSignIn={onSignIn} />;
}

function PersonalWalletConnectionPanel({
  onSignIn,
}: {
  onSignIn?: () => void;
}) {
  const { session, refreshSession } = useAuthSession();
  const wallets = useWallets(walletClient);
  const connected = useConnectedWallet(walletClient);
  const isReady = useIsWalletReady(walletClient);
  const status = useWalletStatus(walletClient);
  const connect = useConnect(walletClient);
  const disconnect = useDisconnect(walletClient);
  const signMessage = useSignMessage(walletClient);
  const mounted = useSyncExternalStore(
    subscribeToHydration,
    () => true,
    () => false,
  );
  const phantom = wallets[0];
  const address = connected?.account.address;
  const config = supabasePublicConfig();
  const canonicalOrigin =
    mounted && config ? window.location.origin === config.siteUrl : false;
  const sessionKey = session.status === "signed-in" ? session.subject : null;
  const [walletResult, setWalletResult] = useState<{
    key: string;
    snapshot: PersonalWalletSnapshot;
  } | null>(null);
  const [activeAction, setActiveAction] = useState<
    "link" | "replace" | "unlink" | "request-code" | "verify-code" | null
  >(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionNotice, setActionNotice] = useState<string | null>(null);
  const [reauthAction, setReauthAction] = useState<"unlink" | "replace" | null>(
    null,
  );
  const [reauthSubject, setReauthSubject] = useState<string | null>(null);
  const [reauthCodeRequested, setReauthCodeRequested] = useState(false);
  const [reauthCode, setReauthCode] = useState("");
  const actionLock = useRef(false);
  const snapshot =
    sessionKey && walletResult?.key === sessionKey
      ? walletResult.snapshot
      : null;
  const activeReauthAction = reauthSubject === sessionKey ? reauthAction : null;
  const connectionError = walletErrorMessage(connect.error ?? disconnect.error);

  useEffect(() => {
    if (!sessionKey) return;
    let active = true;
    void fetchPersonalWallet().then((nextSnapshot) => {
      if (active) {
        setWalletResult({ key: sessionKey, snapshot: nextSnapshot });
      }
    });
    return () => {
      active = false;
    };
  }, [sessionKey]);

  function requireReauthentication(action: "unlink" | "replace") {
    setReauthAction(action);
    setReauthSubject(sessionKey);
    setReauthCodeRequested(false);
    setReauthCode("");
    setActionError(null);
    setActionNotice(null);
  }

  async function refreshWallet() {
    if (!sessionKey) return;
    const nextSnapshot = await fetchPersonalWallet();
    setWalletResult({ key: sessionKey, snapshot: nextSnapshot });
  }

  function handleMutationResult(
    result: PersonalWalletMutationResult,
    action: "link" | "replace" | "unlink",
  ) {
    if (result.status === "linked" || result.status === "unlinked") {
      if (sessionKey) {
        setWalletResult({ key: sessionKey, snapshot: result });
      }
      setActionNotice(
        action === "link"
          ? "Wallet linked to your MovX Club account."
          : action === "replace"
            ? "Linked wallet replaced. The previous link remains in the audit history."
            : "Wallet unlinked. Phantom may remain connected in this browser.",
      );
      setActionError(null);
      return;
    }
    if (result.status === "reauth-required") {
      requireReauthentication(action === "unlink" ? "unlink" : "replace");
      return;
    }
    setActionNotice(null);
    if (result.status === "conflict") {
      setActionError(
        "This wallet change conflicts with the current account state. No link was changed.",
      );
    } else if (result.status === "invalid-proof") {
      setActionError(
        "The ownership message could not be verified or was already used. Request a new message and try again.",
      );
    } else if (result.status === "signed-out") {
      setActionError(
        "Your session ended. Sign in again before changing a wallet link.",
      );
      void refreshSession();
    } else if (result.status === "forbidden") {
      setActionError(
        "Complete your MovX Club profile before linking a wallet.",
      );
    } else if (result.status === "invalid-request") {
      setActionError(
        "The wallet request was not accepted. Check the selected account and try again.",
      );
    } else {
      setActionError(
        "Wallet settings are unavailable. No link was changed; try again shortly.",
      );
    }
  }

  async function proveWallet(purpose: PersonalWalletPurpose) {
    if (!address) {
      setActionError("Connect the Phantom account you want to link first.");
      return;
    }
    const challengeResult = await requestPersonalWalletChallenge(
      purpose,
      address,
    );
    if (challengeResult.status === "reauth-required") {
      requireReauthentication("replace");
      return;
    }
    if (challengeResult.status !== "challenge") {
      handleMutationResult(
        { status: challengeResult.status },
        purpose === "link-personal-wallet" ? "link" : "replace",
      );
      return;
    }

    try {
      const signature = await signMessage.dispatchAsync(
        new TextEncoder().encode(challengeResult.challenge.message),
      );
      const proofResult = await submitPersonalWalletProof({
        challengeId: challengeResult.challenge.id,
        purpose,
        walletAddress: challengeResult.challenge.address,
        message: challengeResult.challenge.message,
        signature: walletSignatureToBase64(signature),
      });
      handleMutationResult(
        proofResult,
        purpose === "link-personal-wallet" ? "link" : "replace",
      );
    } catch (error) {
      setActionNotice(null);
      setActionError(walletProofErrorMessage(error));
    }
  }

  async function startProof(purpose: PersonalWalletPurpose) {
    if (actionLock.current) return;
    actionLock.current = true;
    setActiveAction(purpose === "link-personal-wallet" ? "link" : "replace");
    setActionError(null);
    setActionNotice(null);
    try {
      await proveWallet(purpose);
    } finally {
      actionLock.current = false;
      setActiveAction(null);
    }
  }

  async function performUnlink() {
    handleMutationResult(await unlinkPersonalWalletBinding(), "unlink");
  }

  async function startUnlink() {
    if (actionLock.current) return;
    actionLock.current = true;
    setActiveAction("unlink");
    setActionError(null);
    setActionNotice(null);
    try {
      await performUnlink();
    } finally {
      actionLock.current = false;
      setActiveAction(null);
    }
  }

  async function requestReauthenticationCode(event: FormEvent) {
    event.preventDefault();
    if (
      actionLock.current ||
      session.status !== "signed-in" ||
      !activeReauthAction ||
      !config ||
      !canonicalOrigin
    ) {
      return;
    }
    const client = browserAuthClient();
    if (!client) return;

    actionLock.current = true;
    setActiveAction("request-code");
    setActionError(null);
    try {
      const result = await client.auth.signInWithOtp({
        email: session.email,
        options: { shouldCreateUser: false },
      });
      if (result.error) throw result.error;
      setReauthCodeRequested(true);
      setReauthCode("");
      setActionNotice(`A six-digit code was sent to ${session.email}.`);
    } catch (error) {
      setActionError(emailOtpErrorMessage(error, "request"));
    } finally {
      actionLock.current = false;
      setActiveAction(null);
    }
  }

  async function verifyReauthenticationCode(event: FormEvent) {
    event.preventDefault();
    if (
      actionLock.current ||
      session.status !== "signed-in" ||
      !activeReauthAction ||
      !config ||
      !canonicalOrigin
    ) {
      return;
    }
    const token = normalizeEmailOtp(reauthCode);
    if (!token) {
      setActionError("Enter the six-digit code from your email.");
      return;
    }
    const client = browserAuthClient();
    if (!client) return;
    const expectedSubject = session.subject;
    const expectedEmail = session.email;
    const protectedAction = activeReauthAction;

    actionLock.current = true;
    setActiveAction("verify-code");
    setActionError(null);
    try {
      const result = await client.auth.verifyOtp({
        email: expectedEmail,
        token,
        type: "email",
      });
      if (result.error) throw result.error;
      if (
        result.data.user?.id !== expectedSubject ||
        normalizeEmail(result.data.user?.email) !== expectedEmail
      ) {
        await client.auth.signOut({ scope: "local" });
        await refreshSession();
        throw new Error("Verified account did not match the active session.");
      }
      const verifiedSession = await refreshSession();
      if (
        verifiedSession.status !== "signed-in" ||
        verifiedSession.subject !== expectedSubject ||
        verifiedSession.email !== expectedEmail
      ) {
        await client.auth.signOut({ scope: "local" });
        await refreshSession();
        throw new Error("The server could not verify this email session.");
      }
      setReauthAction(null);
      setReauthSubject(null);
      setReauthCodeRequested(false);
      setReauthCode("");
      setActionNotice(null);
      if (protectedAction === "unlink") {
        await performUnlink();
      } else {
        await proveWallet("replace-personal-wallet");
      }
    } catch (error) {
      setActionError(emailOtpErrorMessage(error, "verify"));
    } finally {
      actionLock.current = false;
      setActiveAction(null);
    }
  }

  if (!isReady) {
    return (
      <div className="wallet-state" role="status" aria-live="polite">
        <div className="wallet-illustration">
          <Wallet size={38} strokeWidth={1.2} aria-hidden="true" />
          <Pill tone="lime">Devnet only</Pill>
        </div>
        <strong>Checking for Phantom…</strong>
        <p>Waiting for wallet discovery and any saved connection to settle.</p>
      </div>
    );
  }

  if (session.status !== "signed-in") {
    return (
      <div className="wallet-state">
        <div className="wallet-illustration">
          <Wallet size={38} strokeWidth={1.2} aria-hidden="true" />
          <Pill tone={address ? "lime" : "neutral"}>
            {address ? "Connected" : "Devnet only"}
          </Pill>
        </div>
        {address && (
          <div className="wallet-address" role="status" aria-live="polite">
            <span>Connected Phantom account</span>
            <strong>{shortenWalletAddress(address)}</strong>
            <code>{address}</code>
          </div>
        )}
        <div className="notice">
          <strong>
            {address
              ? "Phantom connected. MovX Club account signed out."
              : "A wallet is optional."}
          </strong>
          <p>
            {address
              ? "This connection shares only a public address. Sign in with email before choosing whether to link it to your account."
              : "Connecting does not sign you in or request a message or transaction signature. Sign in with email first, then explicitly link a wallet only when you need wallet-backed features."}
          </p>
        </div>
        {!address && !phantom && (
          <div className="notice">
            <strong>Phantom was not detected.</strong>
            <p>
              Install and unlock Phantom in desktop Chrome, then reload this
              page. Public browsing still works without a wallet.
            </p>
          </div>
        )}
        {connectionError && (
          <p className="wallet-error" role="alert">
            {connectionError}
          </p>
        )}
        {address ? (
          <button
            type="button"
            className="button secondary full"
            disabled={disconnect.isRunning || status === "disconnecting"}
            onClick={() => disconnect.dispatch()}
          >
            {disconnect.isRunning || status === "disconnecting"
              ? "Disconnecting…"
              : "Disconnect Phantom"}
          </button>
        ) : phantom ? (
          <button
            type="button"
            className="button secondary full"
            disabled={connect.isRunning || status === "connecting"}
            onClick={() => connect.dispatch(phantom)}
          >
            {connect.isRunning || status === "connecting"
              ? "Waiting for Phantom…"
              : "Connect Phantom"}
          </button>
        ) : (
          <a
            className="button secondary full"
            href={PHANTOM_DOWNLOAD_URL}
            target="_blank"
            rel="noreferrer"
          >
            Get Phantom from the official site
          </a>
        )}
        <Link href="/sign-in" className="button dark full" onClick={onSignIn}>
          Sign in with email
        </Link>
        <p className="wallet-safety">
          Never enter a recovery phrase or private key on this website.
        </p>
      </div>
    );
  }

  const walletHeading = address
    ? shortenWalletAddress(address)
    : snapshot?.status === "linked"
      ? shortenWalletAddress(snapshot.wallet.address)
      : "No wallet connected";

  return (
    <div className="wallet-state">
      <div className="wallet-illustration">
        <Wallet size={38} strokeWidth={1.2} aria-hidden="true" />
        <Pill tone={snapshot?.status === "linked" ? "lime" : "neutral"}>
          {snapshot?.status === "linked" ? "Linked" : "Devnet only"}
        </Pill>
      </div>
      <div className="wallet-address" role="status" aria-live="polite">
        <span>{address ? "Connected Phantom account" : "Wallet status"}</span>
        <strong>{walletHeading}</strong>
        {address && <code>{address}</code>}
      </div>
      <div className="wallet-context" aria-label="Wallet context">
        <Pill>Email account active</Pill>
        <Pill>External wallet</Pill>
        <Pill>Solana Devnet</Pill>
      </div>

      {!snapshot && (
        <div className="notice" role="status">
          <strong>Checking your wallet settings…</strong>
          <p>The server is checking whether this account has a durable link.</p>
        </div>
      )}

      {snapshot?.status === "forbidden" && (
        <div className="notice">
          <strong>Complete your profile first.</strong>
          <p>A verified email profile is required before linking a wallet.</p>
          <Link href="/sign-in" className="button dark full" onClick={onSignIn}>
            Finish profile setup
          </Link>
        </div>
      )}

      {(snapshot?.status === "unavailable" ||
        snapshot?.status === "preview") && (
        <div className="notice">
          <strong>Wallet settings are unavailable.</strong>
          <p>
            No link is being assumed. Check the local services and try again.
          </p>
          <button
            type="button"
            className="text-button"
            onClick={() => void refreshWallet()}
          >
            Check again
          </button>
        </div>
      )}

      {snapshot?.status === "signed-out" && (
        <div className="notice">
          <strong>Your session ended.</strong>
          <p>Sign in again before changing your wallet settings.</p>
        </div>
      )}

      {activeReauthAction && (
        <div className="notice">
          <strong>Confirm your email before this security change.</strong>
          <p>
            We will send a new six-digit code to {session.email}. The current
            wallet link remains unchanged until the full action succeeds.
          </p>
          {!reauthCodeRequested ? (
            <form className="auth-form" onSubmit={requestReauthenticationCode}>
              <button
                type="submit"
                className="button dark full"
                disabled={activeAction !== null}
              >
                {activeAction === "request-code"
                  ? "Sending code…"
                  : "Send confirmation code"}
              </button>
            </form>
          ) : (
            <form className="auth-form" onSubmit={verifyReauthenticationCode}>
              <label htmlFor="wallet-reauth-code">Six-digit email code</label>
              <input
                id="wallet-reauth-code"
                name="wallet-reauth-code"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={7}
                value={reauthCode}
                disabled={activeAction !== null}
                onChange={(event) => setReauthCode(event.target.value)}
              />
              <button
                type="submit"
                className="button dark full"
                disabled={activeAction !== null}
              >
                {activeAction === "verify-code"
                  ? "Confirming…"
                  : activeReauthAction === "unlink"
                    ? "Confirm and unlink wallet"
                    : "Confirm and request new-wallet proof"}
              </button>
            </form>
          )}
          <button
            type="button"
            className="text-button"
            disabled={activeAction !== null}
            onClick={() => {
              setReauthAction(null);
              setReauthSubject(null);
              setReauthCodeRequested(false);
              setReauthCode("");
              setActionError(null);
              setActionNotice(null);
            }}
          >
            Cancel security change
          </button>
        </div>
      )}

      {!activeReauthAction && snapshot?.status === "unlinked" && (
        <>
          <div className="notice">
            <strong>
              {address ? "Connected, but not linked." : "No wallet is linked."}
            </strong>
            <p>
              {address
                ? "Linking requires one readable ownership message. It does not create a transaction or move funds."
                : "Connect Phantom, then explicitly approve one readable ownership message to create a durable link."}
            </p>
          </div>
          {address ? (
            <>
              <button
                type="button"
                className="button dark full"
                disabled={activeAction !== null}
                onClick={() => void startProof("link-personal-wallet")}
              >
                {activeAction === "link"
                  ? "Waiting for ownership proof…"
                  : "Link this wallet"}
              </button>
              <button
                type="button"
                className="button secondary full"
                disabled={disconnect.isRunning || status === "disconnecting"}
                onClick={() => disconnect.dispatch()}
              >
                Disconnect Phantom
              </button>
            </>
          ) : phantom ? (
            <button
              type="button"
              className="button dark full"
              disabled={connect.isRunning || status === "connecting"}
              onClick={() => connect.dispatch(phantom)}
            >
              {connect.isRunning || status === "connecting"
                ? "Waiting for Phantom…"
                : "Connect Phantom"}
            </button>
          ) : (
            <a
              className="button dark full"
              href={PHANTOM_DOWNLOAD_URL}
              target="_blank"
              rel="noreferrer"
            >
              Get Phantom from the official site
            </a>
          )}
        </>
      )}

      {!activeReauthAction && snapshot?.status === "linked" && !address && (
        <>
          <div className="notice success">
            <strong>Wallet linked; Phantom disconnected.</strong>
            <p>
              The durable link to{" "}
              {shortenWalletAddress(snapshot.wallet.address)}
              remains. Reconnect that Phantom account for wallet-backed actions.
            </p>
          </div>
          {phantom ? (
            <button
              type="button"
              className="button dark full"
              disabled={connect.isRunning || status === "connecting"}
              onClick={() => connect.dispatch(phantom)}
            >
              {connect.isRunning || status === "connecting"
                ? "Waiting for Phantom…"
                : "Reconnect Phantom"}
            </button>
          ) : (
            <a
              className="button dark full"
              href={PHANTOM_DOWNLOAD_URL}
              target="_blank"
              rel="noreferrer"
            >
              Get Phantom from the official site
            </a>
          )}
          <button
            type="button"
            className="button secondary full"
            disabled={activeAction !== null}
            onClick={() => void startUnlink()}
          >
            {activeAction === "unlink" ? "Checking…" : "Unlink wallet"}
          </button>
        </>
      )}

      {!activeReauthAction &&
        snapshot?.status === "linked" &&
        address === snapshot.wallet.address && (
          <>
            <div className="notice success">
              <strong>Linked wallet connected.</strong>
              <p>
                MovX Club recognizes this address as your active personal
                wallet. Transactions, if introduced later, still need separate
                approval.
              </p>
            </div>
            <button
              type="button"
              className="button secondary full"
              disabled={disconnect.isRunning || status === "disconnecting"}
              onClick={() => disconnect.dispatch()}
            >
              Disconnect Phantom
            </button>
            <button
              type="button"
              className="button secondary full"
              disabled={activeAction !== null}
              onClick={() => void startUnlink()}
            >
              {activeAction === "unlink" ? "Checking…" : "Unlink wallet"}
            </button>
          </>
        )}

      {!activeReauthAction &&
        snapshot?.status === "linked" &&
        address &&
        address !== snapshot.wallet.address && (
          <>
            <div className="notice">
              <strong>
                Connected wallet does not match the linked wallet.
              </strong>
              <p>
                This account is linked to{" "}
                {shortenWalletAddress(snapshot.wallet.address)}. Replacing it
                requires a recent email confirmation and an ownership message
                from the connected wallet. We will request a new email code if
                your current confirmation is more than ten minutes old.
              </p>
            </div>
            <button
              type="button"
              className="button dark full"
              disabled={activeAction !== null}
              onClick={() => void startProof("replace-personal-wallet")}
            >
              {activeAction === "replace"
                ? "Checking replacement…"
                : "Replace linked wallet"}
            </button>
            <button
              type="button"
              className="button secondary full"
              disabled={disconnect.isRunning || status === "disconnecting"}
              onClick={() => disconnect.dispatch()}
            >
              Disconnect this Phantom account
            </button>
          </>
        )}

      {actionNotice && (
        <p className="notice success" role="status" aria-live="polite">
          <strong>{actionNotice}</strong>
        </p>
      )}
      {(actionError || connectionError) && (
        <p className="wallet-error" role="alert">
          {actionError ?? connectionError}
        </p>
      )}
      <p className="wallet-safety">
        Never enter a recovery phrase or private key on this website.
      </p>
    </div>
  );
}
