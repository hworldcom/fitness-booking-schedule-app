import { supabasePublicConfig } from "@/auth/config";
import { trainingCommand } from "@/server/training/service";
import { trainingHandler } from "@/server/training/http";
export const dynamic = "force-dynamic";
export const POST = trainingHandler(
  trainingCommand,
  () => supabasePublicConfig()?.siteUrl,
);
