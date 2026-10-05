import { isPrepareCoachPassOperationRequest } from "@/solana/coach-pass-operation";
import {
  coachPassRequestJson,
  coachPassResponse,
  hasCoachPassCanonicalOrigin,
} from "@/server/solana/coach-pass-http";
import { prepareCoachPassOperation } from "@/server/solana/coach-pass-service";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!hasCoachPassCanonicalOrigin(request)) {
    return coachPassResponse({ status: "forbidden" });
  }
  const body = await coachPassRequestJson(request);
  if (!isPrepareCoachPassOperationRequest(body)) {
    return coachPassResponse({ status: "invalid-request" });
  }
  return coachPassResponse(await prepareCoachPassOperation(body));
}
