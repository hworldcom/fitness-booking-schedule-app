export function isConnectionCountIdentity(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}:[a-z0-9-]{1,80}:[a-z0-9-]{1,80}:(member|operator)$/i.test(
      value,
    )
  );
}
