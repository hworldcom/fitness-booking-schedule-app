import { isSubmitCoachPassBootstrapRequest } from "@/solana/coach-pass-bootstrap";
import {
  coachPassRequestJson,
  coachPassResponse,
  hasCoachPassCanonicalOrigin,
} from "@/server/solana/coach-pass-http";
import { submitApprovedCoachPassBootstrap } from "@/server/solana/coach-pass-bootstrap-service";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!hasCoachPassCanonicalOrigin(request)) {
    return coachPassResponse({ status: "forbidden" });
  }
  const body = await coachPassRequestJson(request);
  if (!isSubmitCoachPassBootstrapRequest(body)) {
    return coachPassResponse({ status: "invalid-request" });
  }
  return coachPassResponse(await submitApprovedCoachPassBootstrap(body));
}
