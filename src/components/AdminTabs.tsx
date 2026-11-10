"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/admin", label: "Overview", exact: true },
  { href: "/admin/members", label: "Members" },
  { href: "/admin/team", label: "Team" },
];

export default function AdminTabs() {
  const path = usePathname();
  return (
    <div className="tabs admin-tabs">
      {TABS.map((t) => {
        const on = t.exact ? path === t.href : path.startsWith(t.href);
        return (
          <Link key={t.href} href={t.href} className={`pill ${on ? "active" : ""}`}>
            {t.label}
          </Link>
        );
      })}
    </div>
  );
}
