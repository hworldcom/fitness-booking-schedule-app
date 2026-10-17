import { NextResponse } from "next/server";
import { verifiedAuthSession } from "@/server/auth/session";
import { accountHasPassword } from "@/server/db/auth/repository";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const session = await verifiedAuthSession();
    if (session.status === "unavailable" || session.status === "disabled")
      return NextResponse.json(
        { status: "unavailable" },
        {
          status: 503,
          headers: { "cache-control": "private, no-store", vary: "Cookie" },
        },
      );
    if (session.status !== "signed-in")
      return NextResponse.json(
        {
          status:
            session.status === "recovery-required"
              ? "recovery-required"
              : "signed-out",
        },
        {
          status: 401,
          headers: { "cache-control": "private, no-store", vary: "Cookie" },
        },
      );
    return NextResponse.json(
      {
        status: "ready",
        email: session.email,
        hasPassword: await accountHasPassword(session.subject),
        emailCode: true,
      },
      { headers: { "cache-control": "private, no-store", vary: "Cookie" } },
    );
  } catch {
    return NextResponse.json(
      { status: "unavailable" },
      {
        status: 503,
        headers: { "cache-control": "private, no-store", vary: "Cookie" },
      },
    );
  }
}
