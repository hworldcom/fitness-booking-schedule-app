"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CircleAlert,
  ExternalLink,
  RotateCcw,
  ShieldCheck,
} from "lucide-react";
import { useConnectedWallet } from "@solana/kit-plugin-wallet/react";
import { useAuthSession } from "@/auth/client/session-provider";
import { Empty } from "@/components/ui";
import type {
  MembershipPlanId,
  MembershipPlanSummary,
  PublicCatalogue,
  PublicCatalogueResult,
} from "@/domain/catalogue";
import {
  isMembershipDraftReviewable,
  membershipDraftGyms,
  membershipDraftPlan,
  REQUIRED_CORE_GYMS,
  type MembershipDraftIssue,
} from "@/domain/membership-draft";
import type { MemberMembershipState } from "@/domain/membership-activation";
import { useMembershipDraft } from "@/features/membership/draft-store";
import {
  membershipPaymentRecoveryMatchesOperation,
  readMembershipPaymentRecovery,
  writeMembershipPaymentRecovery,
  type MembershipPaymentRecovery,
} from "@/features/membership/payment-recovery";
import type { PersonalWalletSnapshot } from "@/solana/personal-wallet";
import {
  membershipPaymentAmountLabel,
  membershipPaymentExplorerUrl,
} from "@/solana/membership-payment";
import {
  approveAndBroadcastMembershipPayment,
  MembershipPaymentClientError,
  prepareMembershipPaymentTransaction,
  type PreparedMembershipPaymentTransaction,
} from "@/solana/client/membership-payment-client";
import { fetchPersonalWallet } from "@/solana/client/personal-wallet-client";
import { walletClient } from "@/solana/client/wallet-client";
import { shortenWalletAddress } from "@/solana/client/wallet-presentation";
import {
  cancelMembershipActivationRequest,
  fetchMembershipState,
  prepareMembershipActivationRequest,
  reconcileMembershipActivationRequest,
  submitMembershipActivationRequest,
} from "./activation-client";

function accessLabel(plan: MembershipPlanSummary) {
  return plan.access.model === "limited"
    ? `${plan.access.includedCheckins} included check-ins`
    : "Unlimited included check-ins";
}

function issueMessage(issue: MembershipDraftIssue | null) {
  switch (issue) {
    case "choose-plan-first":
      return "Choose Basic or Classic before selecting gyms.";
    case "gym-ineligible":
      return "That gym is not eligible for the selected plan.";
    case "maximum-gyms":
      return "Your core set already has four gyms. Remove one before choosing another.";
    case "unknown-gym":
    case "unknown-plan":
      return "That preview option is no longer available. Please choose again.";
    default:
      return null;
  }
}

function paymentErrorMessage(error: unknown) {
  if (!(error instanceof MembershipPaymentClientError)) {
    return "The Devnet payment check could not be completed. No membership was activated.";
  }
  switch (error.code) {
    case "configuration-unavailable":
      return "Devnet payment configuration is unavailable. Try again after the environment is configured.";
    case "wallet-mismatch":
      return "The connected Phantom account does not match your linked personal wallet.";
    case "unsupported-wallet":
      return "This Phantom connection does not support the required Devnet sign-and-send method. Update or reconnect Phantom and try again.";
    case "source-account-unavailable":
      return "The linked wallet has no usable Devnet EURC token account.";
    case "insufficient-eurc":
      return "The linked wallet does not have enough test EURC for this membership.";
    case "destination-mismatch":
      return "The configured membership-pool token account did not pass validation.";
    case "simulation-failed":
      return "The exact Devnet transaction did not pass simulation, so Phantom was not opened.";
    case "wallet-cancelled":
      return "You cancelled the Phantom approval. No membership was activated.";
    case "broadcast-failed":
      return "Phantom did not return a transaction signature. The pending payment will be checked by its unique reference; do not approve another payment yet.";
    default:
      return "The Devnet payment could not be completed. No membership was activated.";
  }
}

function membershipPaymentStorage() {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function ReadyMembershipSetup({
  initialPlan,
  catalogue,
}: {
  initialPlan: MembershipPlanId | null;
  catalogue: PublicCatalogue;
}) {
  const { plans, gyms } = catalogue;
  const router = useRouter();
  const { draft, recovery, storageUnavailable, dispatch } =
    useMembershipDraft(catalogue);
  const [notice, setNotice] = useState<string | null>(null);
  const { session } = useAuthSession();
  const connected = useConnectedWallet(walletClient);
  const [personalWallet, setPersonalWallet] =
    useState<PersonalWalletSnapshot | null>(null);
  const [membershipState, setMembershipState] =
    useState<MemberMembershipState | null>(null);
  const [paymentAction, setPaymentAction] = useState<
    "preparing" | "simulating" | "approving" | "reconciling" | null
  >(null);
  const [preparedPayment, setPreparedPayment] =
    useState<PreparedMembershipPaymentTransaction | null>(null);
  const [signedRecovery, setSignedRecovery] =
    useState<MembershipPaymentRecovery | null>(() => {
      const storage = membershipPaymentStorage();
      return storage ? readMembershipPaymentRecovery(storage) : null;
    });
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const reconciliationLock = useRef(false);
  const recoveryLock = useRef(false);
  const [reviewMode, setReviewMode] = useState(false);
  const initializedFromQuery = useRef(false);
  const reviewable = isMembershipDraftReviewable(draft, catalogue);
  const selectedPlan = membershipDraftPlan(draft, catalogue);
  const selectedGyms = membershipDraftGyms(draft, catalogue);
  const showReview = reviewMode && reviewable;
  const visibleMembershipState =
    session.status === "signed-in" ? membershipState : null;
  const visiblePersonalWallet =
    session.status === "signed-in" ? personalWallet : null;
  const pendingOperation = visibleMembershipState?.pending ?? null;
  const activePeriod = visibleMembershipState?.activePeriod ?? null;
  const signedRecoveryOperation = signedRecovery
    ? visibleMembershipState?.history.find(
        (operation) => operation.id === signedRecovery.operationId,
      )
    : null;
  const signedRecoverySettled = Boolean(
    signedRecovery &&
    ((visibleMembershipState && !signedRecoveryOperation) ||
      activePeriod?.activationOperationId === signedRecovery.operationId ||
      signedRecoveryOperation?.status === "confirmed" ||
      signedRecoveryOperation?.status === "failed" ||
      (pendingOperation?.id === signedRecovery.operationId &&
        pendingOperation.status === "submitted" &&
        pendingOperation.payment?.transactionSignature)),
  );
  const recoverableSignedPayment = signedRecoverySettled
    ? null
    : signedRecovery;
  const canResumeSignedPayment = membershipPaymentRecoveryMatchesOperation(
    recoverableSignedPayment,
    pendingOperation?.id,
  );
  const linkedWallet =
    visiblePersonalWallet?.status === "linked"
      ? visiblePersonalWallet.wallet.address
      : null;
  const connectedWallet = connected?.account.address ?? null;
  const walletMatches = Boolean(
    linkedWallet && connectedWallet && linkedWallet === connectedWallet,
  );

  function rememberSignedPayment(recovery: MembershipPaymentRecovery) {
    setSignedRecovery(recovery);
    const storage = membershipPaymentStorage();
    if (storage) writeMembershipPaymentRecovery(storage, recovery);
  }

  function forgetSignedPayment() {
    setSignedRecovery(null);
    const storage = membershipPaymentStorage();
    if (storage) writeMembershipPaymentRecovery(storage, null);
  }

  async function refreshActivationState() {
    const result = await fetchMembershipState();
    if (result.status === "ready") {
      setMembershipState(result.membership);
      return result.membership;
    }
    return null;
  }

  async function reconcile(operationId: string) {
    if (reconciliationLock.current) return;
    reconciliationLock.current = true;
    setPaymentAction("reconciling");
    try {
      const result = await reconcileMembershipActivationRequest(operationId);
      const nextState = await refreshActivationState();
      if (result.status === "confirmed" || result.status === "existing") {
        dispatch({ type: "reset" });
        router.push("/my-access");
        router.refresh();
        return;
      }
      if (result.status === "failed") {
        setPaymentError(
          "The submitted transaction did not match the authoritative payment quote. No membership was created.",
        );
      } else if (result.status === "pending") {
        setNotice(
          "Payment is still pending final Devnet verification. Do not send another transaction.",
        );
      } else if (!nextState) {
        setPaymentError("Membership status is temporarily unavailable.");
      }
    } finally {
      reconciliationLock.current = false;
      setPaymentAction(null);
    }
  }

  async function resumeSignedPayment(recovery: MembershipPaymentRecovery) {
    if (recoveryLock.current) return;
    recoveryLock.current = true;
    setPaymentAction("reconciling");
    setPaymentError(null);
    try {
      const submission = await submitMembershipActivationRequest(recovery);
      if (
        submission.status !== "submitted" &&
        submission.status !== "existing"
      ) {
        const nextState = await refreshActivationState();
        if (
          nextState?.activePeriod?.activationOperationId ===
          recovery.operationId
        ) {
          forgetSignedPayment();
          router.push("/my-access");
          router.refresh();
          return;
        }
        setPaymentError(
          "The signed transaction is saved in this browser, but the server could not record it yet. Resume this same transaction later; do not approve another payment.",
        );
        return;
      }
      forgetSignedPayment();
      setNotice(
        "Signed transaction recorded. Waiting for finalized server verification.",
      );
      await refreshActivationState();
      await reconcile(recovery.operationId);
    } finally {
      recoveryLock.current = false;
      setPaymentAction(null);
    }
  }

  useEffect(() => {
    if (!initialPlan || initializedFromQuery.current) return;
    initializedFromQuery.current = true;
    dispatch({ type: "select-plan", planId: initialPlan });
  }, [dispatch, initialPlan]);

  useEffect(() => {
    if (session.status !== "signed-in") return;
    let active = true;
    void Promise.all([fetchPersonalWallet(), fetchMembershipState()]).then(
      ([wallet, membership]) => {
        if (!active) return;
        setPersonalWallet(wallet);
        if (membership.status === "ready") {
          setMembershipState(membership.membership);
        }
      },
    );
    return () => {
      active = false;
    };
  }, [session.status]);

  useEffect(() => {
    if (
      !pendingOperation ||
      (pendingOperation.status !== "pending" &&
        pendingOperation.status !== "submitted") ||
      recoverableSignedPayment?.operationId === pendingOperation.id
    ) {
      return;
    }
    if (pendingOperation.status === "pending") {
      void reconcile(pendingOperation.id);
      return;
    }
    let checks = 0;
    const timer = window.setInterval(() => {
      checks += 1;
      void reconcile(pendingOperation.id);
      if (checks >= 8) window.clearInterval(timer);
    }, 2_500);
    void reconcile(pendingOperation.id);
    return () => window.clearInterval(timer);
    // Reconciliation intentionally keys only on the durable operation identity/status.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    pendingOperation?.id,
    pendingOperation?.status,
    recoverableSignedPayment?.operationId,
  ]);

  useEffect(() => {
    if (signedRecoverySettled) {
      const storage = membershipPaymentStorage();
      if (storage) writeMembershipPaymentRecovery(storage, null);
    }
  }, [signedRecoverySettled]);

  useEffect(() => {
    if (!recoverableSignedPayment) return;
    if (
      pendingOperation?.id === recoverableSignedPayment.operationId &&
      pendingOperation.status === "pending"
    ) {
      void resumeSignedPayment(recoverableSignedPayment);
    }
    // Recovery intentionally keys only on durable public operation/signature evidence.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    pendingOperation?.id,
    pendingOperation?.status,
    recoverableSignedPayment?.operationId,
    recoverableSignedPayment?.transactionSignature,
  ]);

  async function preparePaymentDetails() {
    if (
      !selectedPlan ||
      !reviewable ||
      session.status !== "signed-in" ||
      !walletMatches
    ) {
      return;
    }
    setPaymentAction("preparing");
    setPaymentError(null);
    setNotice(null);
    try {
      const result = await prepareMembershipActivationRequest({
        operationId: crypto.randomUUID(),
        planId: selectedPlan.id,
        gymIds: selectedGyms.map((gym) => gym.id),
      });
      if (result.status !== "prepared" && result.status !== "existing") {
        setPaymentError(
          result.status === "wallet-conflict"
            ? "Link the connected Phantom account as your personal wallet before preparing payment."
            : result.status === "state-conflict"
              ? "An active or submitted membership already exists. Open My Membership to continue."
              : "The server could not prepare an authoritative payment quote.",
        );
        return;
      }
      const nextState = await refreshActivationState();
      if (!nextState?.pending?.payment) {
        setPaymentError("The prepared payment quote could not be loaded.");
      }
    } finally {
      setPaymentAction(null);
    }
  }

  async function simulatePayment() {
    const payment = pendingOperation?.payment;
    if (!payment || !connected?.signer || !walletMatches) return;
    setPaymentAction("simulating");
    setPaymentError(null);
    setNotice(null);
    try {
      const prepared = await prepareMembershipPaymentTransaction({
        quote: payment,
        signer: connected.signer,
      });
      setPreparedPayment(prepared);
      setNotice(
        `Payment check passed${prepared.unitsConsumed ? ` (${prepared.unitsConsumed} compute units)` : ""}. Phantom has not been opened yet.`,
      );
    } catch (error) {
      setPreparedPayment(null);
      setPaymentError(paymentErrorMessage(error));
    } finally {
      setPaymentAction(null);
    }
  }

  async function approvePayment() {
    if (!preparedPayment || !pendingOperation?.payment) return;
    setPaymentAction("approving");
    setPaymentError(null);
    try {
      const broadcast = await approveAndBroadcastMembershipPayment({
        prepared: preparedPayment,
      });
      const recovery = Object.freeze({
        operationId: pendingOperation.id,
        transactionSignature: broadcast.signature,
      });
      rememberSignedPayment(recovery);
      setPreparedPayment(null);
      setNotice(
        "Transaction submitted. Waiting for finalized server verification.",
      );
      await resumeSignedPayment(recovery);
    } catch (error) {
      if (
        error instanceof MembershipPaymentClientError &&
        error.code === "wallet-cancelled"
      ) {
        await cancelMembershipActivationRequest(pendingOperation.id);
        await refreshActivationState();
      } else if (
        error instanceof MembershipPaymentClientError &&
        error.code === "broadcast-failed"
      ) {
        setPreparedPayment(null);
        setPaymentError(paymentErrorMessage(error));
        await reconcile(pendingOperation.id);
        return;
      }
      setPaymentError(paymentErrorMessage(error));
    } finally {
      setPaymentAction(null);
    }
  }

  function selectPlan(planId: MembershipPlanId) {
    const outcome = dispatch({ type: "select-plan", planId });
    setReviewMode(false);
    setPreparedPayment(null);
    if (outcome.removedGymIds.length) {
      const removedNames = outcome.removedGymIds
        .map((gymId) => gyms.find((candidate) => candidate.id === gymId)?.name)
        .filter(Boolean)
        .join(", ");
      setNotice(
        `${removedNames || "A selected gym"} was removed because it is not eligible for ${planId === "basic" ? "Basic" : "Classic"}.`,
      );
      return;
    }
    setNotice(`${planId === "basic" ? "Basic" : "Classic"} selected.`);
  }

  function toggleGym(gymId: string) {
    const outcome = dispatch({ type: "toggle-gym", gymId });
    setReviewMode(false);
    setPreparedPayment(null);
    setNotice(issueMessage(outcome.issue));
  }

  function resetDraft() {
    dispatch({ type: "reset" });
    setReviewMode(false);
    setNotice("Draft reset. No membership was created.");
  }

  return (
    <section className="membership-setup" aria-labelledby="membership-title">
      <div className="membership-setup-heading">
        <Link href="/explore" className="back-link">
          <ArrowLeft size={14} aria-hidden="true" /> Back to Explore
        </Link>
        <span className="eyebrow">MEMBERSHIP SETUP · DEVNET DEMO</span>
        <h1 id="membership-title">
          Build your membership draft<span className="lime-text">.</span>
        </h1>
        <p>
          Choose a plan and exactly four eligible core gyms. You will review an
          exact server quote before Phantom opens, and access starts only after
          finalized test-EURC verification.
        </p>
      </div>

      {recovery !== "none" && (
        <div className="membership-message warning" role="status">
          <CircleAlert size={17} aria-hidden="true" />
          {recovery === "catalogue-changed"
            ? "We updated your draft because gym or plan eligibility changed. Please review your choices."
            : "We could not safely use the saved draft, so the preview was reset."}
        </div>
      )}
      {storageUnavailable && (
        <div className="membership-message warning" role="status">
          <CircleAlert size={17} aria-hidden="true" />
          Browser storage is unavailable. This draft will last only until the
          page closes.
        </div>
      )}
      {notice && (
        <div className="membership-message" role="status">
          {notice}
        </div>
      )}

      {!showReview ? (
        <>
          <fieldset className="membership-choice-section">
            <legend>
              <span className="membership-step">01</span>
              <span>
                <strong>Choose your plan</strong>
                <small>Illustrative monthly demo pricing</small>
              </span>
            </legend>
            <div className="membership-plan-choices">
              {plans.map((plan) => (
                <label
                  key={plan.id}
                  className={`membership-plan-choice ${draft.planId === plan.id ? "selected" : ""}`}
                >
                  <input
                    type="radio"
                    name="membership-plan"
                    value={plan.id}
                    checked={draft.planId === plan.id}
                    onChange={() => selectPlan(plan.id)}
                  />
                  <span className="membership-choice-check" aria-hidden="true">
                    <Check size={15} />
                  </span>
                  <span className="membership-plan-choice-copy">
                    <span className="membership-plan-choice-topline">
                      <strong>{plan.name}</strong>
                      <b>
                        €{plan.price.amount}
                        <small> / month</small>
                      </b>
                    </span>
                    <span>{accessLabel(plan)}</span>
                    <small>
                      Four core gyms · one included check-in per venue-local day
                    </small>
                    <small>
                      Eligible non-core gym visits: €
                      {plan.nonCoreVisitPrice.amount}
                    </small>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>

          <fieldset className="membership-choice-section gym-choice-section">
            <legend>
              <span className="membership-step">02</span>
              <span>
                <strong>Choose four core gyms</strong>
                <small>Your selected set for this concept period</small>
              </span>
              <b className="membership-progress" aria-live="polite">
                {draft.gymIds.length}/{REQUIRED_CORE_GYMS}
              </b>
            </legend>
            {!draft.planId && (
              <p className="membership-field-hint">
                Choose Basic or Classic to see plan eligibility.
              </p>
            )}
            {draft.gymIds.length === REQUIRED_CORE_GYMS && (
              <p className="membership-field-hint complete">
                Your core set is complete. Remove one gym to choose another.
              </p>
            )}
            <div className="membership-gym-choices">
              {gyms.map((gym) => {
                const selected = draft.gymIds.includes(gym.id);
                const eligible = draft.planId
                  ? gym.eligiblePlans.includes(draft.planId)
                  : false;
                const selectionFull =
                  draft.gymIds.length >= REQUIRED_CORE_GYMS && !selected;
                const disabled = !draft.planId || !eligible || selectionFull;
                return (
                  <label
                    key={gym.id}
                    className={`membership-gym-choice ${selected ? "selected" : ""} ${disabled ? "disabled" : ""}`}
                  >
                    <input
                      type="checkbox"
                      checked={selected}
                      disabled={disabled}
                      onChange={() => toggleGym(gym.id)}
                    />
                    <span
                      className="membership-choice-check"
                      aria-hidden="true"
                    >
                      <Check size={15} />
                    </span>
                    <span>
                      <strong>{gym.name}</strong>
                      <small>
                        {gym.area} · {gym.activities.join(" · ")}
                      </small>
                      <em>
                        {!draft.planId
                          ? "Choose a plan first"
                          : eligible
                            ? `${draft.planId === "basic" ? "Basic" : "Classic"} eligible`
                            : `Not eligible for ${draft.planId === "basic" ? "Basic" : "Classic"}`}
                      </em>
                    </span>
                  </label>
                );
              })}
            </div>
          </fieldset>

          <div className="membership-setup-actions">
            <div>
              <strong>
                {reviewable
                  ? "Your draft is ready to review."
                  : `${REQUIRED_CORE_GYMS - draft.gymIds.length} gym${REQUIRED_CORE_GYMS - draft.gymIds.length === 1 ? "" : "s"} still needed.`}
              </strong>
              <small>
                No membership or payment is created during selection.
              </small>
            </div>
            <button
              type="button"
              className="button dark"
              disabled={!reviewable}
              onClick={() => setReviewMode(true)}
            >
              Review draft <ArrowRight size={17} aria-hidden="true" />
            </button>
          </div>
        </>
      ) : (
        <section className="membership-review" aria-labelledby="review-title">
          <div className="membership-review-heading">
            <div>
              <span className="eyebrow">DRAFT SELECTION · NOT ACTIVE</span>
              <h2 id="review-title">Review your membership.</h2>
            </div>
            <button
              type="button"
              className="text-link"
              onClick={() => setReviewMode(false)}
            >
              Edit choices
            </button>
          </div>
          {selectedPlan && (
            <div className="membership-review-plan">
              <div>
                <span>{selectedPlan.name}</span>
                <strong>{accessLabel(selectedPlan)}</strong>
              </div>
              <b>
                €{selectedPlan.price.amount}
                <small> / month</small>
              </b>
            </div>
          )}
          <div className="membership-review-gyms">
            {selectedGyms.map((gym, index) => (
              <div key={gym.id}>
                <span>{String(index + 1).padStart(2, "0")}</span>
                <p>
                  <strong>{gym.name}</strong>
                  <small>
                    {gym.area} · {gym.activities.join(" · ")}
                  </small>
                </p>
              </div>
            ))}
          </div>
          <div className="membership-review-rules">
            <p>
              <Check size={14} aria-hidden="true" /> One included check-in per
              venue-local day
            </p>
            <p>
              <Check size={14} aria-hidden="true" /> Eligible non-core gym
              visits cost an illustrative €15
            </p>
          </div>
          <div className="membership-review-notice">
            <CircleAlert size={18} aria-hidden="true" />
            <p>
              <strong>Devnet demo payment only.</strong>
              Activation uses test EURC on Solana Devnet. It never charges real
              euros, but your wallet needs test EURC and a small amount of test
              SOL for the network fee.
            </p>
          </div>
          {paymentError && (
            <div className="membership-message warning" role="alert">
              <CircleAlert size={17} aria-hidden="true" /> {paymentError}
            </div>
          )}
          {activePeriod && (
            <div className="membership-payment-panel">
              <strong>You already have an active membership.</strong>
              <p>Open My Membership to review the frozen plan and gym set.</p>
              <Link href="/my-access" className="text-link">
                View My Membership <ArrowRight size={14} aria-hidden="true" />
              </Link>
            </div>
          )}
          {!activePeriod && pendingOperation?.payment && (
            <div className="membership-payment-panel">
              <span className="eyebrow">AUTHORITATIVE PAYMENT SUMMARY</span>
              <h3>
                {membershipPaymentAmountLabel(
                  pendingOperation.payment.amountBaseUnits,
                  pendingOperation.payment.tokenDecimals,
                )}{" "}
                test EURC
              </h3>
              <dl>
                <div>
                  <dt>Network</dt>
                  <dd>Solana Devnet</dd>
                </div>
                <div>
                  <dt>Linked source wallet</dt>
                  <dd title={pendingOperation.payment.walletAddress}>
                    {shortenWalletAddress(
                      pendingOperation.payment.walletAddress,
                    )}
                  </dd>
                </div>
                <div>
                  <dt>Membership pool</dt>
                  <dd title={pendingOperation.payment.destinationTokenAddress}>
                    {shortenWalletAddress(
                      pendingOperation.payment.destinationTokenAddress,
                    )}
                  </dd>
                </div>
                <div>
                  <dt>Period</dt>
                  <dd>One calendar month · no automatic renewal</dd>
                </div>
              </dl>
              <p>
                The membership becomes active only after MovX independently
                verifies final settlement. Test SOL pays the network fee.
              </p>
              {pendingOperation.payment.transactionSignature && (
                <a
                  className="text-link"
                  href={membershipPaymentExplorerUrl(
                    pendingOperation.payment.transactionSignature,
                  )}
                  target="_blank"
                  rel="noreferrer"
                >
                  View Devnet transaction
                  <ExternalLink size={13} aria-hidden="true" />
                </a>
              )}
            </div>
          )}
          {!activePeriod && !pendingOperation && (
            <div className="membership-payment-readiness">
              {session.status !== "signed-in" ? (
                <p>Sign in before preparing a Devnet payment.</p>
              ) : visiblePersonalWallet?.status !== "linked" ? (
                <p>
                  Connect Phantom from the header and link it as your personal
                  wallet before continuing.
                </p>
              ) : !connectedWallet ? (
                <p>Reconnect your linked Phantom wallet before continuing.</p>
              ) : !walletMatches ? (
                <p>
                  Connected wallet {shortenWalletAddress(connectedWallet)} does
                  not match linked wallet {shortenWalletAddress(linkedWallet!)}.
                </p>
              ) : (
                <p>
                  <ShieldCheck size={16} aria-hidden="true" /> Linked and
                  connected wallet match. Prepare the exact server quote next.
                </p>
              )}
            </div>
          )}
          <div className="membership-review-actions">
            <button
              type="button"
              className="button secondary"
              onClick={() => setReviewMode(false)}
            >
              <ArrowLeft size={16} aria-hidden="true" /> Edit draft
            </button>
            {session.status !== "signed-in" ? (
              <Link
                href="/sign-in?returnTo=%2Fmembership%2Fsetup"
                className="button lime"
              >
                Sign in to activate <ArrowRight size={17} aria-hidden="true" />
              </Link>
            ) : canResumeSignedPayment ? (
              <button
                type="button"
                className="button lime"
                disabled={paymentAction !== null}
                onClick={() => {
                  if (recoverableSignedPayment) {
                    void resumeSignedPayment(recoverableSignedPayment);
                  }
                }}
              >
                {paymentAction === "reconciling"
                  ? "Recovering signed transaction…"
                  : "Resume signed transaction"}
              </button>
            ) : pendingOperation?.status === "submitted" ? (
              <button
                type="button"
                className="button lime"
                disabled={paymentAction !== null}
                onClick={() => void reconcile(pendingOperation.id)}
              >
                {paymentAction === "reconciling"
                  ? "Checking finality…"
                  : "Check payment status"}
              </button>
            ) : preparedPayment ? (
              <button
                type="button"
                className="button lime"
                disabled={paymentAction !== null}
                onClick={() => void approvePayment()}
              >
                {paymentAction === "approving"
                  ? "Waiting for Phantom…"
                  : `Approve ${membershipPaymentAmountLabel(preparedPayment.amountBaseUnits)} test EURC`}
              </button>
            ) : pendingOperation?.payment ? (
              <button
                type="button"
                className="button lime"
                disabled={!walletMatches || paymentAction !== null}
                onClick={() => void simulatePayment()}
              >
                {paymentAction === "simulating"
                  ? "Running payment check…"
                  : "Run payment check"}
              </button>
            ) : (
              <button
                type="button"
                className="button lime"
                disabled={!walletMatches || paymentAction !== null}
                onClick={() => void preparePaymentDetails()}
              >
                {paymentAction === "preparing"
                  ? "Preparing details…"
                  : "Prepare Devnet payment"}
              </button>
            )}
          </div>
        </section>
      )}

      {(draft.planId || draft.gymIds.length > 0) && (
        <button
          type="button"
          className="membership-reset text-link"
          onClick={resetDraft}
        >
          <RotateCcw size={14} aria-hidden="true" /> Reset draft
        </button>
      )}
    </section>
  );
}

export function MembershipSetup({
  initialPlan,
  catalogueResult,
}: {
  initialPlan: MembershipPlanId | null;
  catalogueResult: PublicCatalogueResult;
}) {
  if (catalogueResult.status === "ready") {
    return (
      <ReadyMembershipSetup
        initialPlan={initialPlan}
        catalogue={catalogueResult.catalogue}
      />
    );
  }

  const state =
    catalogueResult.status === "error"
      ? {
          title: "Membership setup is temporarily unavailable.",
          description: catalogueResult.message,
        }
      : catalogueResult.status === "empty"
        ? {
            title: "No membership plans are available yet.",
            description:
              "Join the waitlist while the fictional membership catalogue is prepared.",
          }
        : {
            title: "Loading membership plans…",
            description:
              "The fictional membership catalogue is being prepared.",
          };

  return (
    <section className="membership-setup" aria-labelledby="membership-title">
      <div className="membership-setup-heading">
        <Link href="/explore" className="back-link">
          <ArrowLeft size={14} aria-hidden="true" /> Back to Explore
        </Link>
        <span className="eyebrow">MEMBERSHIP SETUP · DEVNET DEMO</span>
        <h1 id="membership-title">
          Build your membership draft<span className="lime-text">.</span>
        </h1>
      </div>
      <div className="catalogue-state" role="status">
        <Empty title={state.title} description={state.description} />
        {catalogueResult.status !== "loading" && (
          <Link href="/coming-soon" className="button secondary">
            Join the waitlist <ArrowRight size={16} aria-hidden="true" />
          </Link>
        )}
      </div>
    </section>
  );
}
