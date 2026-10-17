import type { Metadata } from "next";
import {
  AuthenticationPage,
  type AuthenticationSearchParams,
} from "../_auth/auth-page";

export const metadata: Metadata = {
  title: "Choose a new password",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};
export default function Page({
  searchParams,
}: {
  searchParams: AuthenticationSearchParams;
}) {
  return (
    <AuthenticationPage stage="reset-password" searchParams={searchParams} />
  );
}
