import assert from "node:assert/strict";
import { resolve } from "node:path";
import test from "node:test";
import {
  address,
  createClient,
  createNoopSigner,
  generateKeyPairSigner,
  getProgramDerivedAddress,
  getUtf8Encoder,
  type Address,
  type Signature,
} from "@solana/kit";
import {
  TOKEN_PROGRAM_ADDRESS,
  fetchToken,
  getMintEncoder,
} from "@solana-program/token";
import { surfpool } from "@solana/surfpool/kit";
import { fetchCoachAuthority } from "../clients/js/src/generated/accounts/coachAuthority";
import {
  fetchContribution,
  fetchMaybeContribution,
} from "../clients/js/src/generated/accounts/contribution";
import { fetchEventPool } from "../clients/js/src/generated/accounts/eventPool";
import { getClaimEventPayoutInstructionAsync } from "../clients/js/src/generated/instructions/claimEventPayout";
import { getClaimEventRefundInstructionAsync } from "../clients/js/src/generated/instructions/claimEventRefund";
import { getCreateEventPoolInstructionAsync } from "../clients/js/src/generated/instructions/createEventPool";
import { getFundEventInstructionAsync } from "../clients/js/src/generated/instructions/fundEvent";
import { getInitializeCoachAuthorityInstructionAsync } from "../clients/js/src/generated/instructions/initializeCoachAuthority";
import { getSettleEventInstruction } from "../clients/js/src/generated/instructions/settleEvent";
import { MOVX_COACH_PASS_PROGRAM_ADDRESS } from "../clients/js/src/generated/programs/movxCoachPass";
import { ContributionStatus } from "../clients/js/src/generated/types/contributionStatus";
import { EventPoolStatus } from "../clients/js/src/generated/types/eventPoolStatus";
import {
  DEVNET_EURC_MINT_ADDRESS,
  deriveCoachAuthorityAddress,
  uuidToSeed,
} from "../src/solana/coach-pass";
import {
  deriveContributionAddress,
  deriveEventPoolAddress,
  deriveEventVaultAddress,
} from "../src/solana/group-event";

const RUN_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const PROFILE_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const BASE_TIMESTAMP = 1_900_000_000;
const SEAT_PRICE = BigInt(30_000_000);
const USER_STARTING_BALANCE = SEAT_PRICE * BigInt(2);
const MINT_RENT_LAMPORTS = 1_461_600;
const DEVNET_USDC_MINT_ADDRESS = address(
  "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU",
);

test("Surfpool executes platform-funded threshold payout and pull-refund lifecycles", async (t) => {
  const client = await createClient().use(
    surfpool({ surfnet: { offline: true } }),
  );
  t.after(() => client.surfnet.stop());

  const deploymentSignature = client.surfnet.deploy({
    programId: MOVX_COACH_PASS_PROGRAM_ADDRESS,
    soPath: resolve("target/deploy/movx_coach_pass.so"),
    idlPath: resolve("idl/movx_coach_pass.json"),
  });
  assert.ok(deploymentSignature.length > 0);
  await client.cheatcodes
    .timeTravel({ absoluteTimestamp: BASE_TIMESTAMP * 1_000 })
    .send();

  const coachWallet = await generateKeyPairSigner();
  const recoveryAuthority = await generateKeyPairSigner();
  const participantOne = await generateKeyPairSigner();
  const participantTwo = await generateKeyPairSigner();
  const participantThree = await generateKeyPairSigner();
  const participantFour = await generateKeyPairSigner();
  const attacker = await generateKeyPairSigner();
  const wrongRecipient = await generateKeyPairSigner();
  const platformPayer = client.payer;
  const userWallets = [
    coachWallet.address,
    recoveryAuthority.address,
    participantOne.address,
    participantTwo.address,
    participantThree.address,
    participantFour.address,
    attacker.address,
    wrongRecipient.address,
  ];

  const getLamports = async (accountAddress: Address) =>
    (await client.rpc.getBalance(accountAddress).send()).value;
  const assertUsersNeedNoSol = async () => {
    assert.deepEqual(
      await Promise.all(userWallets.map(getLamports)),
      userWallets.map(() => BigInt(0)),
    );
  };
  const rentEvidence: Array<{
    label: string;
    accountRentLamports: string;
    platformDebitLamports: string;
  }> = [];
  const computeEvidence: Array<{ label: string; computeUnits: string }> = [];
  const recordCompute = async (label: string, signature: Signature) => {
    const transaction = await client.rpc
      .getTransaction(signature, {
        commitment: "confirmed",
        encoding: "base64",
        maxSupportedTransactionVersion: 0,
      })
      .send();
    assert.ok(transaction?.meta?.computeUnitsConsumed !== undefined);
    computeEvidence.push({
      label,
      computeUnits: transaction.meta.computeUnitsConsumed.toString(),
    });
  };
  const recordPlatformRent = async (
    label: string,
    balanceBefore: bigint,
    createdAccounts: readonly Address[],
  ) => {
    const [balanceAfter, ...accountRents] = await Promise.all([
      getLamports(platformPayer.address),
      ...createdAccounts.map(getLamports),
    ]);
    const totalRent = accountRents.reduce(
      (sum, accountRent) => sum + accountRent,
      BigInt(0),
    );
    assert.ok(totalRent > BigInt(0));
    assert.ok(balanceBefore - balanceAfter >= totalRent);
    rentEvidence.push({
      label,
      accountRentLamports: totalRent.toString(),
      platformDebitLamports: (balanceBefore - balanceAfter).toString(),
    });
    await assertUsersNeedNoSol();
  };

  const mintData = getMintEncoder().encode({
    decimals: 6,
    freezeAuthority: null,
    isInitialized: true,
    mintAuthority: null,
    supply: USER_STARTING_BALANCE * BigInt(4),
  });
  for (const mint of [DEVNET_EURC_MINT_ADDRESS, DEVNET_USDC_MINT_ADDRESS]) {
    client.surfnet.setAccount(
      mint,
      MINT_RENT_LAMPORTS,
      Uint8Array.from(mintData),
      TOKEN_PROGRAM_ADDRESS,
    );
  }
  for (const wallet of [
    participantOne,
    participantTwo,
    participantThree,
    participantFour,
  ]) {
    client.surfnet.setTokenAccount(wallet.address, DEVNET_EURC_MINT_ADDRESS, {
      amount: Number(USER_STARTING_BALANCE),
      state: "initialized",
    });
  }
  client.surfnet.setTokenAccount(
    participantOne.address,
    DEVNET_USDC_MINT_ADDRESS,
    { amount: Number(SEAT_PRICE), state: "initialized" },
  );
  for (const wallet of [coachWallet, wrongRecipient, attacker]) {
    client.surfnet.setTokenAccount(wallet.address, DEVNET_EURC_MINT_ADDRESS, {
      amount: 0,
      state: "initialized",
    });
  }

  const tokenAccount = (
    wallet: Address,
    mint: Address = DEVNET_EURC_MINT_ADDRESS,
  ) => address(client.surfnet.getAta(wallet, mint));
  const participantOneToken = tokenAccount(participantOne.address);
  const participantTwoToken = tokenAccount(participantTwo.address);
  const participantThreeToken = tokenAccount(participantThree.address);
  const participantFourToken = tokenAccount(participantFour.address);
  const participantOneUsdcToken = tokenAccount(
    participantOne.address,
    DEVNET_USDC_MINT_ADDRESS,
  );
  const coachToken = tokenAccount(coachWallet.address);
  const wrongRecipientToken = tokenAccount(wrongRecipient.address);
  const attackerToken = tokenAccount(attacker.address);

  const [eventAuthority] = await getProgramDerivedAddress({
    programAddress: MOVX_COACH_PASS_PROGRAM_ADDRESS,
    seeds: [getUtf8Encoder().encode("__event_authority")],
  });
  const [coachAuthority] = await deriveCoachAuthorityAddress({
    programAddress: MOVX_COACH_PASS_PROGRAM_ADDRESS,
    runId: RUN_ID,
    profileId: PROFILE_ID,
    originalWallet: coachWallet.address,
  });

  await assertUsersNeedNoSol();
  const authorityBalanceBefore = await getLamports(platformPayer.address);
  const authoritySignature = await client.sendTransaction([
    await getInitializeCoachAuthorityInstructionAsync({
      coachWallet,
      recoveryAuthority,
      platformPayer,
      eventAuthority,
      program: MOVX_COACH_PASS_PROGRAM_ADDRESS,
      runId: [...uuidToSeed(RUN_ID)],
      profileId: [...uuidToSeed(PROFILE_ID)],
    }),
  ]);
  await recordPlatformRent("CoachAuthority", authorityBalanceBefore, [
    coachAuthority,
  ]);
  await recordCompute(
    "initialize_coach_authority",
    authoritySignature.context.signature,
  );
  assert.equal(
    (await fetchCoachAuthority(client.rpc, coachAuthority)).data.currentWallet,
    coachWallet.address,
  );

  const failedPoolNonce = BigInt(1);
  const successfulPoolNonce = BigInt(2);
  const rejectedPoolNonce = BigInt(99);
  const poolTerms = (nonce: bigint, minimumParticipants: number) => ({
    nonce,
    priceEurcBaseUnits: SEAT_PRICE,
    minimumParticipants,
    maximumParticipants: minimumParticipants,
    fundingDeadline: BigInt(BASE_TIMESTAMP + 100),
    eventStartAt: BigInt(BASE_TIMESTAMP + 200),
    eventEndAt: BigInt(BASE_TIMESTAMP + 3_800),
  });
  const [failedPool] = await deriveEventPoolAddress({
    programAddress: MOVX_COACH_PASS_PROGRAM_ADDRESS,
    coachAuthority,
    nonce: failedPoolNonce,
  });
  const [failedVault] = await deriveEventVaultAddress({
    programAddress: MOVX_COACH_PASS_PROGRAM_ADDRESS,
    eventPool: failedPool,
  });
  const [successfulPool] = await deriveEventPoolAddress({
    programAddress: MOVX_COACH_PASS_PROGRAM_ADDRESS,
    coachAuthority,
    nonce: successfulPoolNonce,
  });
  const [successfulVault] = await deriveEventVaultAddress({
    programAddress: MOVX_COACH_PASS_PROGRAM_ADDRESS,
    eventPool: successfulPool,
  });
  const [rejectedPool] = await deriveEventPoolAddress({
    programAddress: MOVX_COACH_PASS_PROGRAM_ADDRESS,
    coachAuthority,
    nonce: rejectedPoolNonce,
  });

  await assert.rejects(async () =>
    client.sendTransaction([
      await getCreateEventPoolInstructionAsync({
        coachWallet: createNoopSigner(coachWallet.address),
        platformPayer,
        coachAuthority,
        eventPool: rejectedPool,
        eventAuthority,
        program: MOVX_COACH_PASS_PROGRAM_ADDRESS,
        args: poolTerms(rejectedPoolNonce, 2),
      }),
    ]),
  );
  assert.equal(await getLamports(rejectedPool), BigInt(0));

  const createPool = async (
    label: string,
    eventPool: Address,
    vault: Address,
    args: ReturnType<typeof poolTerms>,
  ) => {
    const platformBalanceBefore = await getLamports(platformPayer.address);
    const signature = await client.sendTransaction([
      await getCreateEventPoolInstructionAsync({
        coachWallet,
        platformPayer,
        coachAuthority,
        eventPool,
        vault,
        eventAuthority,
        program: MOVX_COACH_PASS_PROGRAM_ADDRESS,
        args,
      }),
    ]);
    await recordPlatformRent(label, platformBalanceBefore, [eventPool, vault]);
    await recordCompute("create_event_pool", signature.context.signature);
  };
  await createPool(
    "Failed EventPool + vault",
    failedPool,
    failedVault,
    poolTerms(failedPoolNonce, 3),
  );
  await createPool(
    "Successful EventPool + vault",
    successfulPool,
    successfulVault,
    poolTerms(successfulPoolNonce, 2),
  );
  const createdFailedPool = await fetchEventPool(client.rpc, failedPool);
  assert.equal(createdFailedPool.data.status, EventPoolStatus.Funding);
  assert.equal(createdFailedPool.data.vault, failedVault);
  assert.equal(createdFailedPool.data.payoutRecipient, coachWallet.address);

  const fund = async (
    label: string,
    eventPool: Address,
    vault: Address,
    participant: typeof participantOne,
    participantTokenAccount: Address,
  ) => {
    const [contribution] = await deriveContributionAddress({
      programAddress: MOVX_COACH_PASS_PROGRAM_ADDRESS,
      eventPool,
      participantWallet: participant.address,
    });
    const platformBalanceBefore = await getLamports(platformPayer.address);
    const signature = await client.sendTransaction([
      await getFundEventInstructionAsync({
        participantWallet: participant,
        platformPayer,
        eventPool,
        contribution,
        participantTokenAccount,
        vault,
        eventAuthority,
        program: MOVX_COACH_PASS_PROGRAM_ADDRESS,
      }),
    ]);
    await recordPlatformRent(label, platformBalanceBefore, [contribution]);
    await recordCompute("fund_event", signature.context.signature);
    return contribution;
  };

  const [failedContributionOne] = await deriveContributionAddress({
    programAddress: MOVX_COACH_PASS_PROGRAM_ADDRESS,
    eventPool: failedPool,
    participantWallet: participantOne.address,
  });
  await assert.rejects(async () =>
    client.sendTransaction([
      await getFundEventInstructionAsync({
        participantWallet: participantOne,
        platformPayer,
        eventPool: failedPool,
        contribution: failedContributionOne,
        paymentMint: DEVNET_USDC_MINT_ADDRESS,
        participantTokenAccount: participantOneUsdcToken,
        vault: failedVault,
        eventAuthority,
        program: MOVX_COACH_PASS_PROGRAM_ADDRESS,
      }),
    ]),
  );
  assert.equal(
    (await fetchMaybeContribution(client.rpc, failedContributionOne)).exists,
    false,
  );
  await assert.rejects(async () =>
    client.sendTransaction([
      await getFundEventInstructionAsync({
        participantWallet: participantOne,
        platformPayer,
        eventPool: failedPool,
        contribution: failedContributionOne,
        participantTokenAccount: participantTwoToken,
        vault: failedVault,
        eventAuthority,
        program: MOVX_COACH_PASS_PROGRAM_ADDRESS,
      }),
    ]),
  );

  const failedContributionOneCreated = await fund(
    "Failed contribution one",
    failedPool,
    failedVault,
    participantOne,
    participantOneToken,
  );
  assert.equal(failedContributionOneCreated, failedContributionOne);
  const participantOneAfterFunding = (
    await fetchToken(client.rpc, participantOneToken)
  ).data.amount;
  await assert.rejects(async () =>
    client.sendTransaction([
      await getFundEventInstructionAsync({
        participantWallet: participantOne,
        platformPayer,
        eventPool: failedPool,
        contribution: failedContributionOne,
        participantTokenAccount: participantOneToken,
        vault: failedVault,
        eventAuthority,
        program: MOVX_COACH_PASS_PROGRAM_ADDRESS,
      }),
    ]),
  );
  assert.equal(
    (await fetchToken(client.rpc, participantOneToken)).data.amount,
    participantOneAfterFunding,
  );
  const failedContributionTwo = await fund(
    "Failed contribution two",
    failedPool,
    failedVault,
    participantTwo,
    participantTwoToken,
  );
  const successfulContributionThree = await fund(
    "Successful contribution three",
    successfulPool,
    successfulVault,
    participantThree,
    participantThreeToken,
  );
  const successfulContributionFour = await fund(
    "Successful contribution four",
    successfulPool,
    successfulVault,
    participantFour,
    participantFourToken,
  );

  await assert.rejects(() =>
    client.sendTransaction([
      getSettleEventInstruction({
        settler: platformPayer,
        eventPool: failedPool,
        eventAuthority,
        program: MOVX_COACH_PASS_PROGRAM_ADDRESS,
      }),
    ]),
  );
  const [fullPoolRejectedContribution] = await deriveContributionAddress({
    programAddress: MOVX_COACH_PASS_PROGRAM_ADDRESS,
    eventPool: successfulPool,
    participantWallet: participantOne.address,
  });
  await assert.rejects(async () =>
    client.sendTransaction([
      await getFundEventInstructionAsync({
        participantWallet: participantOne,
        platformPayer,
        eventPool: successfulPool,
        contribution: fullPoolRejectedContribution,
        participantTokenAccount: participantOneToken,
        vault: successfulVault,
        eventAuthority,
        program: MOVX_COACH_PASS_PROGRAM_ADDRESS,
      }),
    ]),
  );
  assert.equal(
    (await fetchMaybeContribution(client.rpc, fullPoolRejectedContribution))
      .exists,
    false,
  );

  await client.cheatcodes
    .timeTravel({ absoluteTimestamp: (BASE_TIMESTAMP + 100) * 1_000 })
    .send();
  await assert.rejects(async () =>
    client.sendTransaction([
      await getFundEventInstructionAsync({
        participantWallet: participantOne,
        platformPayer,
        eventPool: successfulPool,
        contribution: fullPoolRejectedContribution,
        participantTokenAccount: participantOneToken,
        vault: successfulVault,
        eventAuthority,
        program: MOVX_COACH_PASS_PROGRAM_ADDRESS,
      }),
    ]),
  );

  const failedSettlementSignature = await client.sendTransaction([
    getSettleEventInstruction({
      settler: platformPayer,
      eventPool: failedPool,
      eventAuthority,
      program: MOVX_COACH_PASS_PROGRAM_ADDRESS,
    }),
  ]);
  await recordCompute(
    "settle_event_failed",
    failedSettlementSignature.context.signature,
  );
  const successfulSettlementSignature = await client.sendTransaction([
    getSettleEventInstruction({
      settler: platformPayer,
      eventPool: successfulPool,
      eventAuthority,
      program: MOVX_COACH_PASS_PROGRAM_ADDRESS,
    }),
  ]);
  await recordCompute(
    "settle_event_succeeded",
    successfulSettlementSignature.context.signature,
  );
  assert.equal(
    (await fetchEventPool(client.rpc, failedPool)).data.status,
    EventPoolStatus.Failed,
  );
  assert.equal(
    (await fetchEventPool(client.rpc, successfulPool)).data.status,
    EventPoolStatus.Succeeded,
  );
  await assert.rejects(() =>
    client.sendTransaction([
      getSettleEventInstruction({
        settler: platformPayer,
        eventPool: successfulPool,
        eventAuthority,
        program: MOVX_COACH_PASS_PROGRAM_ADDRESS,
      }),
    ]),
  );

  await assert.rejects(async () =>
    client.sendTransaction([
      await getClaimEventPayoutInstructionAsync({
        coachWallet,
        coachAuthority,
        eventPool: failedPool,
        vault: failedVault,
        payoutTokenAccount: coachToken,
        eventAuthority,
        program: MOVX_COACH_PASS_PROGRAM_ADDRESS,
      }),
    ]),
  );
  await assert.rejects(async () =>
    client.sendTransaction([
      await getClaimEventRefundInstructionAsync({
        participantWallet: attacker,
        eventPool: failedPool,
        contribution: failedContributionOne,
        vault: failedVault,
        participantTokenAccount: attackerToken,
        eventAuthority,
        program: MOVX_COACH_PASS_PROGRAM_ADDRESS,
      }),
    ]),
  );
  await assert.rejects(async () =>
    client.sendTransaction([
      await getClaimEventRefundInstructionAsync({
        participantWallet: participantOne,
        eventPool: failedPool,
        contribution: failedContributionOne,
        vault: failedVault,
        participantTokenAccount: participantTwoToken,
        eventAuthority,
        program: MOVX_COACH_PASS_PROGRAM_ADDRESS,
      }),
    ]),
  );

  const refundOneSignature = await client.sendTransaction([
    await getClaimEventRefundInstructionAsync({
      participantWallet: participantOne,
      eventPool: failedPool,
      contribution: failedContributionOne,
      vault: failedVault,
      participantTokenAccount: participantOneToken,
      eventAuthority,
      program: MOVX_COACH_PASS_PROGRAM_ADDRESS,
    }),
  ]);
  await recordCompute(
    "claim_event_refund",
    refundOneSignature.context.signature,
  );
  assert.equal(
    (await fetchToken(client.rpc, participantOneToken)).data.amount,
    USER_STARTING_BALANCE,
  );
  assert.equal(
    (await fetchContribution(client.rpc, failedContributionOne)).data.status,
    ContributionStatus.Refunded,
  );
  await assert.rejects(async () =>
    client.sendTransaction([
      await getClaimEventRefundInstructionAsync({
        participantWallet: participantOne,
        eventPool: failedPool,
        contribution: failedContributionOne,
        vault: failedVault,
        participantTokenAccount: participantOneToken,
        eventAuthority,
        program: MOVX_COACH_PASS_PROGRAM_ADDRESS,
      }),
    ]),
  );
  await client.sendTransaction([
    await getClaimEventRefundInstructionAsync({
      participantWallet: participantTwo,
      eventPool: failedPool,
      contribution: failedContributionTwo,
      vault: failedVault,
      participantTokenAccount: participantTwoToken,
      eventAuthority,
      program: MOVX_COACH_PASS_PROGRAM_ADDRESS,
    }),
  ]);
  const refundedPool = await fetchEventPool(client.rpc, failedPool);
  assert.equal(
    refundedPool.data.totalRefundedBaseUnits,
    SEAT_PRICE * BigInt(2),
  );
  assert.equal(
    (await fetchToken(client.rpc, failedVault)).data.amount,
    BigInt(0),
  );

  await assert.rejects(async () =>
    client.sendTransaction([
      await getClaimEventRefundInstructionAsync({
        participantWallet: participantThree,
        eventPool: successfulPool,
        contribution: successfulContributionThree,
        vault: successfulVault,
        participantTokenAccount: participantThreeToken,
        eventAuthority,
        program: MOVX_COACH_PASS_PROGRAM_ADDRESS,
      }),
    ]),
  );
  await assert.rejects(async () =>
    client.sendTransaction([
      await getClaimEventPayoutInstructionAsync({
        coachWallet: platformPayer,
        coachAuthority,
        eventPool: successfulPool,
        vault: successfulVault,
        payoutTokenAccount: coachToken,
        eventAuthority,
        program: MOVX_COACH_PASS_PROGRAM_ADDRESS,
      }),
    ]),
  );
  await assert.rejects(async () =>
    client.sendTransaction([
      await getClaimEventPayoutInstructionAsync({
        coachWallet,
        coachAuthority,
        eventPool: successfulPool,
        vault: successfulVault,
        payoutTokenAccount: wrongRecipientToken,
        eventAuthority,
        program: MOVX_COACH_PASS_PROGRAM_ADDRESS,
      }),
    ]),
  );

  const payoutSignature = await client.sendTransaction([
    await getClaimEventPayoutInstructionAsync({
      coachWallet,
      coachAuthority,
      eventPool: successfulPool,
      vault: successfulVault,
      payoutTokenAccount: coachToken,
      eventAuthority,
      program: MOVX_COACH_PASS_PROGRAM_ADDRESS,
    }),
  ]);
  await recordCompute("claim_event_payout", payoutSignature.context.signature);
  assert.equal(
    (await fetchEventPool(client.rpc, successfulPool)).data.status,
    EventPoolStatus.Paid,
  );
  assert.equal(
    (await fetchToken(client.rpc, coachToken)).data.amount,
    SEAT_PRICE * BigInt(2),
  );
  assert.equal(
    (await fetchToken(client.rpc, successfulVault)).data.amount,
    BigInt(0),
  );
  await assert.rejects(async () =>
    client.sendTransaction([
      await getClaimEventPayoutInstructionAsync({
        coachWallet,
        coachAuthority,
        eventPool: successfulPool,
        vault: successfulVault,
        payoutTokenAccount: coachToken,
        eventAuthority,
        program: MOVX_COACH_PASS_PROGRAM_ADDRESS,
      }),
    ]),
  );
  assert.equal(
    (await fetchContribution(client.rpc, successfulContributionThree)).data
      .status,
    ContributionStatus.Funded,
  );
  assert.equal(
    (await fetchContribution(client.rpc, successfulContributionFour)).data
      .status,
    ContributionStatus.Funded,
  );

  await assertUsersNeedNoSol();
  t.diagnostic(`platform rent evidence ${JSON.stringify(rentEvidence)}`);
  t.diagnostic(`compute evidence ${JSON.stringify(computeEvidence)}`);
});
