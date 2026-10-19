import { publicCoachWebsiteMetadata } from "@/server/coaches/public-website-page";
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import {
  publicCoachHandle,
  coachRedirectHref,
  type PublicCoachQuery,
} from "@/domain/coach-public-url";
import { publicCoachHandleRecord } from "@/server/db/coaches/public-url-repository";
import { CoachProfileUnavailable } from "@/features/coaches/coach-discovery";
import { PublicCoachPage } from "@/app/_coaches/public-coach-page";
export const dynamic = "force-dynamic";
export async function generateMetadata({
  params,
}: {
  params: Promise<{ handle: string }>;
}): Promise<Metadata> {
  const username = publicCoachHandle((await params).handle);
  if (!username)
    return { title: "Coach profile unavailable", robots: { index: false } };
  try {
    const canonical = await publicCoachHandleRecord(username);
    return canonical
      ? publicCoachWebsiteMetadata(canonical.slug)
      : { title: "Coach profile unavailable", robots: { index: false } };
  } catch {
    return { title: "Coach profile unavailable", robots: { index: false } };
  }
}
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ handle: string }>;
  searchParams: Promise<PublicCoachQuery>;
}) {
  const { handle } = await params;
  const username = publicCoachHandle(handle);
  if (!username) notFound();
  let canonical;
  try {
    canonical = await publicCoachHandleRecord(username);
  } catch {
    return <CoachProfileUnavailable />;
  }
  if (!canonical) notFound();
  if ("/" + handle.replace(/^%40/i, "@") !== canonical.publicPath)
    redirect(coachRedirectHref(canonical.publicPath, await searchParams));
  return <PublicCoachPage slug={canonical.slug} searchParams={searchParams} />;
}
