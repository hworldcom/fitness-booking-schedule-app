import { AccountSettings } from "@/features/account/account-settings";
import { ProtectedAccessUnavailable } from "@/features/auth/protected-access";
import { protectedPageAccess } from "@/server/authorization/page-access";
import { accountSection, accountSectionHref } from "@/account/sections";

export const metadata = { title: "Account settings" };

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const section = accountSection(params.section);
  const access = await protectedPageAccess(accountSectionHref(section));
  if (access.status === "unavailable") return <ProtectedAccessUnavailable />;
  return (
    <AccountSettings
      section={section}
      calendarNotice={
        typeof params.calendar === "string" ? params.calendar : undefined
      }
    />
  );
}
