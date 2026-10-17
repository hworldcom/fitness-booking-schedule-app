import { AccountSettings } from "@/features/account/account-settings";
import { ProtectedAccessUnavailable } from "@/features/auth/protected-access";
import { protectedPageAccess } from "@/server/authorization/page-access";

export const metadata = { title: "Account settings" };

export default async function Page() {
  const access = await protectedPageAccess("/account");
  if (access.status === "unavailable") return <ProtectedAccessUnavailable />;
  return <AccountSettings />;
}
