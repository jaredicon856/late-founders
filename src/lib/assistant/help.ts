// "Ask for help" on worksheets: a short Q&A with the Assistant about the sheet
// in front of the member. No tools and nothing saved to the record; the thread
// is kept (run 0 of the worksheet's messages) so it counts toward the daily cap
// and shows the team where members get stuck.

import Anthropic from "@anthropic-ai/sdk";
import { getAsset } from "@/content/catalog";
import { getWorksheet } from "@/content/registry";
import type { WorksheetDef } from "@/content/types";
import { loadSheet } from "@/lib/assets";
import { db } from "@/lib/db";
import { MODEL, anthropic, type ChatLine } from "./engine";

export const HELP_RUN = 0;
const HISTORY = 20;

const HELP_PROMPT = `You are the Late Founders Assistant inside the Late Founders Command Center, a workspace for people starting or running a business later in their career. The member is filling in a worksheet and pressed "Ask for help". Help them understand what a section or field is asking for and how to answer it well, using their own situation. Rules:
- Explain; do not fill it in for them. Suggest what kind of answer fits, with a short example, and let them write it.
- Never invent the member's facts or numbers.
- Keep answers short: a few sentences or a short list. Plain words, light markdown (bold, lists), no headings.
- If they ask something unrelated, answer in a sentence and bring them back to the worksheet.
- The worksheet saves as they type. "Mark complete" or "Save a new version" keeps a dated snapshot in My Files.`;

export function outline(def: WorksheetDef): string {
  const out: string[] = [];
  for (const s of def.sections) {
    out.push(`## ${s.title}${s.intro ? `\n${s.intro}` : ""}`);
    for (const b of s.blocks) {
      if (b.kind === "fields") for (const f of b.fields) out.push(`- Field "${f.label}"${f.hint ? `: ${f.hint}` : ""}${f.screenHint ? ` (${f.screenHint})` : ""}`);
      else if (b.kind === "table") out.push(`- Table${b.label ? ` "${b.label}"` : ""} with columns: ${b.table.columns.map((c) => c.label).join(", ")}`);
      else if (b.kind === "checklist") out.push(`- Checklist: ${b.items.map((i) => i.label).join("; ")}`);
      else if (b.kind === "callout") out.push(`- Note: ${b.text}`);
      else if (b.kind === "prose") out.push(`- Text: ${[...(b.paragraphs ?? []), ...(b.bullets ?? []), ...(b.numbered ?? [])].join(" ")}`);
      else if (b.kind === "computed") out.push(`- Calculated: ${b.label}`);
      else if (b.kind === "library") out.push(`- Library entries: ${b.entries.map((e) => `${e.title} (${e.category})`).join("; ")}`);
    }
  }
  return out.join("\n");
}

export async function helpTranscript(userId: string, assetId: string): Promise<ChatLine[]> {
  const rows = await db.message.findMany({
    where: { userId, assetId, run: HELP_RUN, hidden: false },
    orderBy: { createdAt: "asc" },
  });
  return rows.map((r) => ({ id: r.id, role: r.role as ChatLine["role"], text: r.text, createdAt: r.createdAt.toISOString() }));
}

async function store(userId: string, assetId: string, role: "user" | "assistant", text: string) {
  const m = await db.message.create({
    data: { userId, assetId, run: HELP_RUN, role, text, contentJson: JSON.stringify([{ type: "text", text }]), hidden: false },
  });
  return { id: m.id, role, text, createdAt: m.createdAt.toISOString() } satisfies ChatLine;
}

export async function askHelp(userId: string, assetId: string, question: string): Promise<{ messages: ChatLine[]; notice?: string }> {
  const def = getWorksheet(assetId);
  const asset = getAsset(assetId);
  const sheet = await loadSheet(userId, assetId);
  if (!def || !asset || !sheet) throw new Error("Unknown worksheet");

  const history = (await helpTranscript(userId, assetId)).slice(-HISTORY);
  const u = await store(userId, assetId, "user", question);
  const answers = JSON.stringify(sheet.data).slice(0, 8000);
  const system = `${HELP_PROMPT}\n\nWorksheet: ${asset.title}${asset.lesson ? ` (${asset.lesson})` : ""}\n${outline(def)}\n\nWhat the member has entered so far (JSON):\n${answers}`;

  try {
    const res = await anthropic().messages.create({
      model: MODEL,
      max_tokens: 2000,
      system,
      messages: [...history, u].map((l) => ({ role: l.role, content: l.text })),
    });
    const text =
      (res.stop_reason as string) === "refusal"
        ? "I can't help with that here. Ask me about this worksheet."
        : res.content
            .filter((b): b is Anthropic.TextBlock => b.type === "text")
            .map((b) => b.text)
            .join("\n\n")
            .trim() || "Sorry, I lost my train of thought. Ask again?";
    return { messages: [u, await store(userId, assetId, "assistant", text)] };
  } catch (e) {
    if (!(e instanceof Anthropic.APIError)) throw e;
    console.error("help error", e);
    return { messages: [u], notice: "The Assistant couldn't answer just now. Try again in a minute." };
  }
}
