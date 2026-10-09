import { NextResponse, type NextRequest } from "next/server";

// Passes the requested path to server components, so a logged-out member who
// clicks a tool link in Skool is sent back to that tool after logging in.
export function middleware(req: NextRequest) {
  const headers = new Headers(req.headers);
  headers.set("x-pathname", req.nextUrl.pathname + req.nextUrl.search);
  return NextResponse.next({ request: { headers } });
}

export const config = {
  matcher: ["/((?!_next/|api/|brand/|fonts/|icon\\.png|favicon\\.ico).*)"],
};
