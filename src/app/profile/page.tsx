import { Profile } from "@/features/profile/profile";
import { ProtectedAccessUnavailable } from "@/features/auth/protected-access";
import { protectedPageAccess } from "@/server/authorization/page-access";
import { currentCoachAccess } from "@/server/coaches/service";
export const metadata = { title: "Your profile" };
export default async function Page() {
  const access = await protectedPageAccess("/profile");
  if (access.status === "unavailable") {
    return <ProtectedAccessUnavailable />;
  }
  const coachState = await currentCoachAccess();
  return (
    <Profile
      coachAccess={
        coachState.status === "authorized" ? coachState.coachAccess : null
      }
    />
  );
}
