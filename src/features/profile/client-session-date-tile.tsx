export function clientSessionDateParts(timestamp: string, timeZone: string) {
  const values = Object.fromEntries(
    new Intl.DateTimeFormat("en-GB", {
      timeZone,
      weekday: "short",
      day: "2-digit",
      month: "short",
    })
      .formatToParts(new Date(timestamp))
      .map((part) => [part.type, part.value]),
  );
  return Object.freeze({
    day: values.day,
    month: values.month.toUpperCase(),
    weekday: values.weekday.toUpperCase(),
  });
}

export function ClientSessionDateTile({
  timestamp,
  timeZone,
}: {
  timestamp: string;
  timeZone: string;
}) {
  const date = clientSessionDateParts(timestamp, timeZone);
  return (
    <time
      className="client-session-date-tile"
      dateTime={timestamp}
      aria-hidden="true"
    >
      <strong>{date.day}</strong>
      <span>{date.month}</span>
      <small>{date.weekday}</small>
    </time>
  );
}
