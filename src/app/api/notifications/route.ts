import { supabasePublicConfig } from "@/auth/config";
import { currentNotificationCommand } from "@/server/notifications/service";
import { notificationHandlers } from "@/server/notifications/http";
export const dynamic = "force-dynamic";
const handlers = notificationHandlers(
  currentNotificationCommand,
  () => supabasePublicConfig()?.siteUrl,
);
export const GET = handlers.GET;
export const POST = handlers.POST;
