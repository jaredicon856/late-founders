import { AsyncLocalStorage } from "node:async_hooks";
import { cookies } from "next/headers";

// Members are dated in their own time zone. The browser stores it in the "tz"
// cookie (see TimeZoneCookie); server code runs inside withTz so content's
// today() and dayLabel() use it. Without a cookie: US Eastern.
const DEFAULT_TZ = "America/New_York";
const als = new AsyncLocalStorage<string>();

function valid(tz: string | undefined): tz is string {
  if (!tz) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

export function dayIn(tz: string, d = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
}

(globalThis as { __lfToday?: () => string }).__lfToday = () => dayIn(als.getStore() ?? DEFAULT_TZ);

export async function memberTz(): Promise<string> {
  try {
    const v = (await cookies()).get("tz")?.value;
    const tz = v ? decodeURIComponent(v) : undefined;
    return valid(tz) ? tz : DEFAULT_TZ;
  } catch {
    return DEFAULT_TZ;
  }
}

export async function withTz<T>(fn: () => Promise<T>): Promise<T> {
  return als.run(await memberTz(), fn);
}

// "Nov 12, 2026" in the member's zone.
export function dayLabel(d: Date, tz: string): string {
  return d.toLocaleDateString("en-US", { dateStyle: "medium", timeZone: tz });
}
