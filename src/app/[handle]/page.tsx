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
export const metadata: Metadata = { title: "Coach profile" };
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
