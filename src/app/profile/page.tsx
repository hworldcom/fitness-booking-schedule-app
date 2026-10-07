import { Profile } from "@/features/profile/profile";
import { ProtectedAccessUnavailable } from "@/features/auth/protected-access";
import { protectedPageAccess } from "@/server/authorization/page-access";
import { currentPrivateBookingWorkspace } from "@/server/coaches/booking-service";
export const metadata = { title: "Your profile" };
export default async function Page() {
  const access = await protectedPageAccess("/profile");
  if (access.status === "unavailable") {
    return <ProtectedAccessUnavailable />;
  }
  const bookingState = await currentPrivateBookingWorkspace();
  return (
    <Profile
      bookings={
        bookingState.status === "authorized" ? bookingState.bookings : null
      }
      referenceTime={new Date().toISOString()}
    />
  );
}
