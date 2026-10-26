import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { signInHref } from "@/auth/return-to";
import { MemberProfileCard } from "@/features/profile/member-profile";
import { currentMemberProfile } from "@/server/member-profiles/service";
import "./profile.css";

export const metadata: Metadata = {
  title: "Member profile",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";
export default async function Page({
  params,
}: {
  params: Promise<{ profileId: string }>;
}) {
  const { profileId } = await params;
  const result = await currentMemberProfile(profileId);
  if (result.status === "signed-out" || result.status === "preview")
    redirect(signInHref(`/members/${profileId}`));
  if (
    result.status === "not-found" ||
    result.status === "forbidden" ||
    (result.status === "authorized" && !result.value.profile)
  )
    notFound();
  if (result.status !== "authorized" || !result.value.profile)
    return (
      <section role="alert">
        <h1>Profile unavailable</h1>
        <p>We couldn’t load this profile. Please try again.</p>
        <Link className="button secondary" href={`/members/${profileId}`}>
          Try again
        </Link>
      </section>
    );
  return (
    <MemberProfileCard
      profile={result.value.profile}
      actorKey={result.value.actorKey}
    />
  );
}
