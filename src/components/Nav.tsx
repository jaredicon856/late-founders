"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/courses", label: "Courses" },
  { href: "/files", label: "My Files" },
];

export default function Nav({ logout, isAdmin }: { logout: () => Promise<void>; isAdmin?: boolean }) {
  const path = usePathname();
  const links = isAdmin ? [...LINKS, { href: "/admin", label: "Admin" }] : LINKS;
  return (
    <nav className="nav">
      {links.map((l) => (
        <Link key={l.href} href={l.href} className={`pill ${path.startsWith(l.href) ? "active" : ""}`}>
          {l.label}
        </Link>
      ))}
      <form action={logout}>
        <button className="pill">Log out</button>
      </form>
    </nav>
  );
}
