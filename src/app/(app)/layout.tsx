import Link from "next/link";
import Nav from "@/components/Nav";
import { requireUser } from "@/lib/auth";
import { logout, saveLastName } from "../login/actions";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  return (
    <div className="wrap">
      <header className="topbar">
        <Link href="/dashboard" className="brand">
          <img src="/brand/lf_horizontal_bright_transparent.png" alt="Late Founders" />
          <span className="cc">Command Center</span>
        </Link>
        <Nav logout={logout} isAdmin={user.isAdmin} />
      </header>
      {!user.lastName && (
        <form action={saveLastName} className="name-prompt">
          <label htmlFor="lastName">Add your last name so your files and support requests match your Skool account:</label>
          <input className="input" id="lastName" name="lastName" autoComplete="family-name" required />
          <button className="btn-primary">Save</button>
        </form>
      )}
      <main className="page">{children}</main>
      <footer className="footer">latefounders.com</footer>
    </div>
  );
}
