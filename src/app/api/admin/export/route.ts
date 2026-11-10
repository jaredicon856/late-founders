import { NextResponse } from "next/server";
import { COURSES, courseLabel } from "@/content/catalog";
import { memberRows } from "@/lib/admin";
import { getUser } from "@/lib/auth";

const cell = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;

// Every member with their progress per course, for a spreadsheet.
export async function GET(req: Request) {
  const me = await getUser();
  if (!me?.isAdmin) return NextResponse.json({ error: "Not allowed" }, { status: 403 });
  const withTests = new URL(req.url).searchParams.get("tests") === "1";
  const rows = (await memberRows()).filter((r) => withTests || !r.test);
  const head = ["Name", "Email", "Role", "Joined", "Last active", "Founder type", "Freedom Number", "Tools complete", ...COURSES.map((c) => courseLabel(c.number)), "Assistant messages (30 days)", "Turned off"];
  const lines = rows.map((r) => [
    r.name, r.email, r.role, r.createdAt.toISOString().slice(0, 10), r.lastSeenAt?.toISOString().slice(0, 10) ?? "",
    r.founderType, r.freedomNumber ?? "", r.done,
    ...COURSES.map((c) => `${c.assets.filter((a) => r.doneIds.has(a)).length}/${c.assets.length}`),
    r.messagesMonth, r.disabled ? "yes" : "",
  ]);
  const csv = [head, ...lines].map((l) => l.map(cell).join(",")).join("\n");
  return new NextResponse(csv, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="late-founders-members-${new Date().toISOString().slice(0, 10)}.csv"`,
      "cache-control": "private, no-store",
    },
  });
}
