import { ProtectedAccessUnavailable } from "@/features/auth/protected-access";
import { MyAccess } from "@/features/membership/my-membership";
import { protectedPageAccess } from "@/server/authorization/page-access";
import { currentPublicCatalogue } from "@/server/catalogue/service";
import { membershipStateForCurrentSession } from "@/server/membership/service";
import { memberClassSchedule } from "@/server/reservations/service";

export const metadata = {
  title: "My Membership",
  description:
    "Review your active, pending or browser-local MovX Club membership state.",
};

export default async function Page() {
  const access = await protectedPageAccess("/my-access");
  if (access.status === "unavailable") return <ProtectedAccessUnavailable />;
  const [catalogueResult, membershipResult, classScheduleResult] =
    await Promise.all([
      currentPublicCatalogue(),
      access.status === "preview"
        ? Promise.resolve({ status: "unavailable" as const })
        : membershipStateForCurrentSession(),
      access.status === "preview"
        ? Promise.resolve({ status: "unavailable" as const })
        : memberClassSchedule(),
    ]);
  return (
    <MyAccess
      preview={access.status === "preview"}
      catalogueResult={catalogueResult}
      membershipState={
        membershipResult.status === "ready" ? membershipResult.membership : null
      }
      classSchedule={
        classScheduleResult.status === "ready"
          ? classScheduleResult.schedule
          : null
      }
    />
  );
}
