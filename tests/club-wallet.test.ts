import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  buildClubWalletMessage,
  isClubWalletChallengeResult,
  isClubWalletMutationResult,
  isClubWalletSnapshot,
} from "../src/solana/club-wallet";

const walletAddress = "11111111111111111111111111111111";
const challengeId = "96000000-0000-4000-8000-000000000001";

test("club wallet messages bind the administrator, club and security context", () => {
  const message = buildClubWalletMessage({
    email: "admin@movx.club",
    origin: "https://movx.club",
    organizationId: "30000000-0000-4000-8000-000000000001",
    clubSlug: "northside-combat",
    clubName: "Northside Combat",
    address: walletAddress,
    challengeId,
    nonce: "a-random-base64url-nonce",
    issuedAt: "2026-09-22T12:00:00.000Z",
    expiresAt: "2026-09-22T12:05:00.000Z",
  });

  for (const expected of [
    "MovX Club club wallet authority proof",
    "Action: Authorize club wallet",
    "Administrator: admin@movx.club",
    "Club: Northside Combat (northside-combat)",
    "Club ID: 30000000-0000-4000-8000-000000000001",
    "Origin: https://movx.club",
    "Network: solana:devnet",
    `Wallet: ${walletAddress}`,
    `Challenge ID: ${challengeId}`,
    "This grants short-lived club authority. It does not create a transaction or move funds.",
  ]) {
    assert.match(
      message,
      new RegExp(expected.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")),
    );
  }
});

test("club wallet transport validators reject expanded or malformed state", () => {
  const eligible = {
    status: "eligible",
    club: {
      slug: "northside-combat",
      name: "Northside Combat",
      wallet: {
        address: walletAddress,
        cluster: "solana:devnet",
        verifiedAt: "2026-09-22T12:00:00.000Z",
      },
    },
  } as const;
  assert.equal(isClubWalletSnapshot(eligible), true);
  assert.equal(
    isClubWalletSnapshot({
      ...eligible,
      club: {
        ...eligible.club,
        wallet: { ...eligible.club.wallet, cluster: "solana:mainnet" },
      },
    }),
    false,
  );
  assert.equal(
    isClubWalletChallengeResult({
      status: "challenge",
      challenge: {
        id: challengeId,
        purpose: "authorize-club-wallet",
        address: walletAddress,
        message: "proof",
        expiresAt: "2026-09-22T12:05:00.000Z",
      },
    }),
    true,
  );
  assert.equal(isClubWalletMutationResult({ status: "invalid-proof" }), true);
  assert.equal(isClubWalletMutationResult({ status: "preview" }), false);
});

test("club authority requests a message signature and no transaction", () => {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  const source = readFileSync(
    path.join(root, "src/solana/client/club-wallet-authority.tsx"),
    "utf8",
  );
  assert.match(source, /useSignMessage/);
  assert.match(source, /ClubWalletAuthorityGuard/);
  assert.match(source, /snapshot\.club\.wallet\.address !== address/);
  assert.match(source, /revokeClubWallet\(\)/);
  assert.doesNotMatch(source, /signTransaction|sendTransaction|signAndSend/);
});
