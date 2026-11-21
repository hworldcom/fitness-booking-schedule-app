import { LoaderCircle } from "lucide-react";

export function BookingPageLoading({
  active,
}: {
  active: "private" | "group";
}) {
  const label = active === "private" ? "private sessions" : "group sessions";
  return (
    <section
      className="booking-content-loading booking-page-loading"
      aria-label={`${label} loading`}
    >
      <p role="status">
        <LoaderCircle
          size={18}
          className="session-link-pending"
          aria-hidden="true"
        />
        Loading {label}…
      </p>
      <div className="booking-loading-cards" aria-hidden="true">
        {[0, 1].map((card) => (
          <div className="booking-loading-card" key={card}>
            <span />
            <span />
            <span />
          </div>
        ))}
      </div>
    </section>
  );
}
