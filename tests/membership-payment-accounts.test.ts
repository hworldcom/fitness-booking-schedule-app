import assert from "node:assert/strict";
import test from "node:test";
import { address, type Address } from "@solana/kit";
import { checkMembershipPaymentTokenAccounts } from "@/solana/membership-payment-accounts";

const sourceAddress = address("Aff9bmz6KmYJaFwtoB6VJxoT1PZi7QECsrh5KUcU99ow");
const sourceOwnerAddress = address(
  "3idZ8hddpfAZ1JWW3gmH7YD6yokUuFDb1Txem2H6kPFe",
);
const destinationAddress = address(
  "BQjoA2qcxpBF6sNCLvz8XwyiEaUnAW3osnyF76BBDtJ8",
);
const destinationOwnerAddress = address(
  "3AX3T287yKvEahS9dThua27dSmby8UV7DdVWtK8BgwDL",
);
const mintAddress = address("HzwqbKZw8HxMN6bF2yFZNrht3c2iXXzpKcFu7uBEDKtr");
const tokenProgramAddress = address(
  "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA",
);

function tokenAccount(input: {
  owner: Address;
  amount?: bigint;
  mint?: Address;
  program?: Address;
}) {
  return {
    exists: true as const,
    programAddress: input.program ?? tokenProgramAddress,
    data: {
      owner: input.owner,
      mint: input.mint ?? mintAddress,
      amount: input.amount ?? BigInt(149_000_000),
    },
  };
}

function check(
  fetchAccounts: Parameters<
    typeof checkMembershipPaymentTokenAccounts
  >[0]["fetchAccounts"],
) {
  return checkMembershipPaymentTokenAccounts({
    sourceAddress,
    sourceOwnerAddress,
    destinationAddress,
    destinationOwnerAddress,
    mintAddress,
    tokenProgramAddress,
    requiredAmount: BigInt(80_000_000),
    fetchAccounts,
  });
}

test("payment preflight loads source and destination in one ordered request", async () => {
  let calls = 0;
  const result = await check(async (addresses) => {
    calls += 1;
    assert.deepEqual(addresses, [sourceAddress, destinationAddress]);
    return [
      tokenAccount({ owner: sourceOwnerAddress }),
      tokenAccount({
        owner: destinationOwnerAddress,
        amount: BigInt(211_000_000),
      }),
    ];
  });

  assert.equal(calls, 1);
  assert.deepEqual(result, { status: "ready" });
});

test("payment preflight distinguishes missing source and destination accounts", async () => {
  assert.deepEqual(
    await check(async () => [
      { exists: false },
      tokenAccount({ owner: destinationOwnerAddress }),
    ]),
    { status: "source-account-unavailable" },
  );
  assert.deepEqual(
    await check(async () => [
      tokenAccount({ owner: sourceOwnerAddress }),
      { exists: false },
    ]),
    { status: "destination-account-unavailable" },
  );
});

test("payment preflight distinguishes RPC failure from account absence", async () => {
  assert.deepEqual(
    await check(async () => {
      throw new Error("RPC unavailable");
    }),
    { status: "rpc-unavailable" },
  );
  assert.deepEqual(await check(async () => []), {
    status: "rpc-unavailable",
  });
});

test("payment preflight validates both token accounts before the balance", async () => {
  assert.deepEqual(
    await check(async () => [
      tokenAccount({ owner: destinationOwnerAddress }),
      tokenAccount({ owner: destinationOwnerAddress }),
    ]),
    { status: "source-account-mismatch" },
  );
  assert.deepEqual(
    await check(async () => [
      tokenAccount({ owner: sourceOwnerAddress }),
      tokenAccount({ owner: sourceOwnerAddress }),
    ]),
    { status: "destination-mismatch" },
  );
  assert.deepEqual(
    await check(async () => [
      tokenAccount({
        owner: sourceOwnerAddress,
        amount: BigInt(79_999_999),
      }),
      tokenAccount({ owner: destinationOwnerAddress }),
    ]),
    { status: "insufficient-eurc" },
  );
});
