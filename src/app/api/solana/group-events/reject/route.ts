import { isGroupEventOperationIdRequest } from "@/solana/group-event-operation";
import {
  groupEventRequestJson,
  groupEventResponse,
  hasGroupEventCanonicalOrigin,
} from "@/server/solana/group-event-http";
import { rejectGroupEventOperation } from "@/server/solana/group-event-service";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!hasGroupEventCanonicalOrigin(request)) {
    return groupEventResponse({ status: "forbidden" });
  }
  const body = await groupEventRequestJson(request);
  if (!isGroupEventOperationIdRequest(body)) {
    return groupEventResponse({ status: "invalid-request" });
  }
  return groupEventResponse(await rejectGroupEventOperation(body.operationId));
}
