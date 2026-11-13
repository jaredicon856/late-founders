import { NextResponse, type NextRequest } from "next/server";

// Passes the requested path to server components, so a logged-out member who
// clicks a tool link in Skool is sent back to that tool after logging in.
// The Portal lives at portal.latefounders.com. The older Vercel addresses
// forward every page there, so links already shared in Skool keep working.
const PORTAL = "https://portal.latefounders.com";
const OLD_HOSTS = new Set(["late-founders-command-center-project-icon-s-projects.vercel.app", "late-founders-command-center.vercel.app", "late-founders.vercel.app"]);

export function middleware(req: NextRequest) {
  const host = (req.headers.get("host") ?? "").toLowerCase();
  if (OLD_HOSTS.has(host)) return NextResponse.redirect(PORTAL + req.nextUrl.pathname + req.nextUrl.search, 308);
  const headers = new Headers(req.headers);
  headers.set("x-pathname", req.nextUrl.pathname + req.nextUrl.search);
  return NextResponse.next({ request: { headers } });
}

export const config = {
  matcher: ["/((?!_next/|api/|brand/|fonts/|icon\\.png|favicon\\.ico).*)"],
};
