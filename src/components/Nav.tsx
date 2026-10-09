"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/courses", label: "Courses" },
  { href: "/files", label: "My Files" },
];

export default function Nav({ logout }: { logout: () => Promise<void> }) {
  const path = usePathname();
  return (
    <nav className="nav">
      {LINKS.map((l) => (
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
