import "server-only";

import { accountDetailsInput, type AccountResult } from "@/account/contracts";
import { withAuthorizedActor } from "@/server/authorization/service";
import {
  currentAccountDetailsRecord,
  saveAccountDetailsRecord,
} from "@/server/db/account/repository";

export async function currentAccountDetails(): Promise<AccountResult> {
  const result = await withAuthorizedActor(currentAccountDetailsRecord);
  return result.status === "authorized"
    ? result.value
    : { status: result.status === "preview" ? "forbidden" : result.status };
}

export async function saveCurrentAccountDetails(
  input: unknown,
): Promise<AccountResult> {
  const details = accountDetailsInput(input);
  if (!details) return { status: "invalid" };
  const result = await withAuthorizedActor((transaction) =>
    saveAccountDetailsRecord(transaction, details),
  );
  return result.status === "authorized"
    ? result.value
    : { status: result.status === "preview" ? "forbidden" : result.status };
}
