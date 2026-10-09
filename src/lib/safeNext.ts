// Only same-site paths, so ?next= can't send a member to another website.
export function safeNext(v: unknown): string | null {
  if (typeof v !== "string") return null;
  if (!v.startsWith("/") || v.startsWith("//") || v.startsWith("/\\") || v.startsWith("/login")) return null;
  return v.slice(0, 500);
}
