import type { Metadata } from "next";
import {
  AuthenticationPage,
  type AuthenticationSearchParams,
} from "../_auth/auth-page";

export const metadata: Metadata = {
  title: "Complete your profile",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};
export default function Page({
  searchParams,
}: {
  searchParams: AuthenticationSearchParams;
}) {
  return (
    <AuthenticationPage stage="complete-profile" searchParams={searchParams} />
  );
}
