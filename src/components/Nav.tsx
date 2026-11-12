"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect } from "react";

const MEMBER = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/courses", label: "Courses" },
  { href: "/resources", label: "Resources" },
  { href: "/files", label: "My Files" },
];

// Admins run the community rather than take the courses, so they get the
// team's menu instead of the member one.
const ADMIN = [
  { href: "/admin", label: "Overview", exact: true },
  { href: "/admin/members", label: "Members" },
  { href: "/admin/courses", label: "Courses" },
  { href: "/admin/files", label: "Files" },
  { href: "/admin/announcements", label: "Announcements" },
  { href: "/admin/team", label: "Team" },
];

export default function Nav({ logout, isAdmin, unread }: { logout: () => Promise<void>; isAdmin?: boolean; unread?: number }) {
  // Saves the device's time zone so the server dates saves in the member's day.
  useEffect(() => {
    try {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      if (tz) document.cookie = `tz=${encodeURIComponent(tz)}; path=/; max-age=31536000; samesite=lax`;
    } catch {}
  }, []);
  const path = usePathname();
  const links = isAdmin ? ADMIN : MEMBER;
  const active = (l: { href: string; exact?: boolean }) => (l.exact ? path === l.href : path.startsWith(l.href));
  return (
    <nav className="nav">
      {links.map((l) => (
        <Link key={l.href} href={l.href} className={`pill ${active(l) ? "active" : ""}`}>
          {l.label}
        </Link>
      ))}
      {!isAdmin && (
        <Link
          href="/notifications"
          className={`pill bell ${path === "/notifications" ? "active" : ""}`}
          aria-label={unread ? `Notifications, ${unread} new` : "Notifications"}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
            <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
          </svg>
          {!!unread && path !== "/notifications" && <span className="bell-count">{unread > 9 ? "9+" : unread}</span>}
        </Link>
      )}
      <form action={logout}>
        <button className="pill">Log out</button>
      </form>
    </nav>
  );
}
