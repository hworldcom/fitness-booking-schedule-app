export const MESSAGE_VERSION_HEADER = "X-MovX-Message-Version";
export type MessageVersion = 1 | 2;

export function messageVersion(headers: Headers): MessageVersion | null {
  const value = headers.get(MESSAGE_VERSION_HEADER);
  return value === null || value === "1" ? 1 : value === "2" ? 2 : null;
}
