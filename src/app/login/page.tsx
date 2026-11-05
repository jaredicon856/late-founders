import { redirect } from "next/navigation";
import { getUser, safeNext } from "@/lib/auth";
import LoginForm from "./LoginForm";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const next = safeNext((await searchParams).next);
  if (await getUser()) redirect(next ?? "/dashboard");
  return (
    <main className="auth">
      <div className="card">
        <img src="/brand/lf_horizontal_bright_transparent.png" alt="Late Founders" style={{ height: 64, margin: "0 0 6px -12px" }} />
        <div className="eyebrow" style={{ marginBottom: 20 }}>Command Center</div>
        <LoginForm needsCode={!!process.env.SIGNUP_CODE} next={next} />
        <div className="auth-note">
          <strong>Separate from Skool.</strong> Skool holds the lessons and videos. The Command Center holds your
          tools, worksheets and files, with its own login, and tracks your progress on them on your dashboard.
          First time here? Choose Create account and enter the member code from Homeroom in Skool.
        </div>
      </div>
    </main>
  );
}
