import {
  coachPassResponse,
  hasCoachPassCanonicalOrigin,
} from "@/server/solana/coach-pass-http";
import { prepareApprovedCoachPassBootstrap } from "@/server/solana/coach-pass-bootstrap-service";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!hasCoachPassCanonicalOrigin(request)) {
    return coachPassResponse({ status: "forbidden" });
  }
  return coachPassResponse(await prepareApprovedCoachPassBootstrap());
}
