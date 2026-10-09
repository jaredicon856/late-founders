import { redirect } from "next/navigation";
import { getUser } from "@/lib/auth";
import LoginForm from "./LoginForm";

export default async function LoginPage() {
  if (await getUser()) redirect("/dashboard");
  return (
    <main className="auth">
      <div className="card">
        <img src="/brand/lf_horizontal_bright_transparent.png" alt="Late Founders" style={{ height: 44, margin: "0 0 6px -8px" }} />
        <div className="eyebrow" style={{ marginBottom: 20 }}>Command Center</div>
        <LoginForm needsCode={!!process.env.SIGNUP_CODE} />
      </div>
    </main>
  );
}
