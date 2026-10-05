import { isSubmitGroupEventOperationRequest } from "@/solana/group-event-operation";
import {
  groupEventRequestJson,
  groupEventResponse,
  hasGroupEventCanonicalOrigin,
} from "@/server/solana/group-event-http";
import { submitGroupEventOperation } from "@/server/solana/group-event-service";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!hasGroupEventCanonicalOrigin(request)) {
    return groupEventResponse({ status: "forbidden" });
  }
  const body = await groupEventRequestJson(request);
  if (!isSubmitGroupEventOperationRequest(body)) {
    return groupEventResponse({
      status: "invalid-request",
      reason: "submit-payload-invalid",
    });
  }
  return groupEventResponse(await submitGroupEventOperation(body));
}
