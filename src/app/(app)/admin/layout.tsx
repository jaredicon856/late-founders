import AdminTabs from "@/components/AdminTabs";
import { requireAdmin } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin();
  return (
    <>
      <div className="eyebrow">Admin</div>
      <AdminTabs />
      {children}
    </>
  );
}
