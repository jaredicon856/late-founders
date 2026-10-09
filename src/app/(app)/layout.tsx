import Link from "next/link";
import Nav from "@/components/Nav";
import { requireUser } from "@/lib/auth";
import { logout } from "../login/actions";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  await requireUser();
  return (
    <div className="wrap">
      <header className="topbar">
        <Link href="/dashboard" className="brand">
          <img src="/brand/lf_horizontal_bright_transparent.png" alt="Late Founders" />
          <span className="cc">Command Center</span>
        </Link>
        <Nav logout={logout} />
      </header>
      <main className="page">{children}</main>
      <footer className="footer">latefounders.com</footer>
    </div>
  );
}
