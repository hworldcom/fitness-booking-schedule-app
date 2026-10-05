import type { Metadata } from "next";
import { ProtectedAccessUnavailable } from "@/features/auth/protected-access";
import { DevnetBootstrapPanel } from "@/features/coaches/devnet-bootstrap-panel";
import { protectedPageAccess } from "@/server/authorization/page-access";

export const metadata: Metadata = { title: "Devnet coach bootstrap" };

export default async function Page() {
  const access = await protectedPageAccess("/devnet-bootstrap");
  if (access.status === "unavailable") {
    return <ProtectedAccessUnavailable />;
  }
  return <DevnetBootstrapPanel />;
}
