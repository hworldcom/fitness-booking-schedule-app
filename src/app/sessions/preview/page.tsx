import Link from "next/link";
import { redirect } from "next/navigation";
import { signInHref } from "@/auth/return-to";
import { ProtectedAccessUnavailable } from "@/features/auth/protected-access";
import { MySessionsHeading } from "@/features/profile/my-sessions-navigation";
import { SessionHistoryPreview } from "@/features/profile/session-history-preview";
import {
  historyPreviewHref,
  historyPreviewView,
} from "@/features/profile/session-history-preview-model";
import { protectedPageAccess } from "@/server/authorization/page-access";
import { currentSessionHistoryPreview } from "@/server/coaches/session-history-preview-service";
import "@/features/profile/session-history-preview.css";

export const metadata = { title: "My training · History preview" };

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ view?: string | string[] }>;
}) {
  const view = historyPreviewView((await searchParams).view);
  const destination = historyPreviewHref(view);
  const access = await protectedPageAccess(destination);
  if (access.status === "unavailable") return <ProtectedAccessUnavailable />;
  if (access.status === "preview")
    return (
      <section className="protected-access-state">
        <h1>Sign in to preview your training history</h1>
        <Link href={signInHref(destination)}>Go to sign-in</Link>
      </section>
    );
  const result = await currentSessionHistoryPreview();
  if (result.status === "signed-out" || result.status === "forbidden")
    redirect(signInHref(destination));
  return (
    <div className="client-session-workspace">
      <MySessionsHeading active="private" />
      {result.status === "authorized" ? (
        <SessionHistoryPreview
          {...result.value}
          view={view}
          referenceTime={new Date().toISOString()}
        />
      ) : (
        <ProtectedAccessUnavailable />
      )}
    </div>
  );
}
