export type SessionTitleDetails = Readonly<{
  title: string;
  titleRevision: number;
  canEditTitle: boolean;
}>;

export function validSessionTitle(value: unknown): value is string {
  return (
    typeof value === "string" &&
    !/[\p{Cc}\p{Zl}\p{Zp}\p{Cs}]/u.test(value) &&
    [...value.trim()].length <= 100 &&
    new TextEncoder().encode(value.trim()).length <= 400
  );
}

export function sessionTitle(value: string | null | undefined) {
  return value || "Training session";
}
