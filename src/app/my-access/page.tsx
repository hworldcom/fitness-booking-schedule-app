import { ProtectedAccessUnavailable } from "@/features/auth/protected-access";
import { MyAccess } from "@/features/membership/my-membership";
import { protectedPageAccess } from "@/server/authorization/page-access";

export const metadata = {
  title: "My Membership",
  description:
    "Review the browser-local MovX Club membership draft saved on this device.",
};

export default async function Page() {
  const access = await protectedPageAccess("/my-access");
  if (access.status === "unavailable") return <ProtectedAccessUnavailable />;
  return <MyAccess preview={access.status === "preview"} />;
}
