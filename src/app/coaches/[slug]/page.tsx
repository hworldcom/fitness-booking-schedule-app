import { publicCoachWebsiteMetadata } from "@/server/coaches/public-website-page";
import { redirect } from "next/navigation";
import {
  coachRedirectHref,
  type PublicCoachQuery,
} from "@/domain/coach-public-url";
import { publicCoachHandleRecord } from "@/server/db/coaches/public-url-repository";
import { CoachProfileUnavailable } from "@/features/coaches/coach-discovery";
import { PublicCoachPage } from "@/app/_coaches/public-coach-page";
import type { Metadata } from "next";
export const dynamic = "force-dynamic";
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  return publicCoachWebsiteMetadata((await params).slug);
}

export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<PublicCoachQuery>;
}) {
  const { slug } = await params;
  let canonical;
  try {
    canonical = await publicCoachHandleRecord(slug, true);
  } catch {
    return <CoachProfileUnavailable />;
  }
  if (canonical)
    redirect(coachRedirectHref(canonical.publicPath, await searchParams));
  return <PublicCoachPage slug={slug} searchParams={searchParams} />;
}
