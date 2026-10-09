// The Assistant: one Claude conversation loop that runs every AI app as a
// mode. A mode supplies its own instructions, the slice of the member record
// it may read, and a save_output schema. The loop is append-only: every
// content block the API returns is stored verbatim and replayed unchanged.

import Anthropic from "@anthropic-ai/sdk";
import { getAsset } from "@/content/catalog";
import { getMode } from "@/content/registry";
import { SaveError } from "@/content/modes/util";
import type { ModeDef, ProfileData } from "@/content/types";
import { createVersion, setStatus } from "@/lib/assets";
import { db, parseJson } from "@/lib/db";
import { getProfile, writeProfile } from "@/lib/record";
import { afterSave } from "./sideEffects";

export const MODEL = process.env.ANTHROPIC_MODEL || "claude-opus-5-5";

// Models that accept {role:"system"} entries inside messages. Others get the
// member record in the top-level system prompt instead.
const MID_SYSTEM_MODELS = new Set([
  "claude-opus-5-5", "claude-opus-5", "claude-opus-4-8", "claude-fable-5", "claude-fable-5-1",
  "claude-sonnet-5-5", "claude-haiku-5-5",
]);
// Server-side refusal fallback ("default" routing) is accepted on these.
const FALLBACK_MODELS = new Set(["claude-fable-5-1", "claude-opus-5-5", "claude-opus-5", "claude-sonnet-5-5"]);

export const BASE_PROMPT = `You are the Late Founders Assistant inside the Late Founders Command Center, a workspace for people starting or running a business later in their career. The member talks to you across every tool in the community. Right now you are running one tool, described under "This tool".

How you work in every tool:
- Do this tool's job. If the member asks something off-topic, answer in a sentence or two, then bring them back to the task.
- The member's stored record arrives as JSON in system messages. Use it. Never ask for something already in it; say what you already have instead.
- Never invent the member's facts: numbers, quotes, events, buyers, results. If you need a figure they have not given, ask for it. Do not estimate it for them.
- Never promise results. Do not tell the member they will earn an amount by a date.
- Ask one question per message. Keep messages short. Use plain words and no internal labels or codes.
- The tool ends by calling save_output with the structured result, after the member has confirmed it. A run that produces only chat has failed. If save_output returns an error, fix what it names (asking the member when the fix needs their input) and call it again.
- After a successful save, tell the member in one or two lines what was saved and that the download is under the chat. Then offer the next useful step inside this tool.
- Formatting: plain text with light markdown (bold, numbered or bulleted lists). No headings.`;

export type ChatLine = { id: string; role: "user" | "assistant"; text: string; createdAt: string };

export type TurnResult = {
  messages: ChatLine[];
  saved?: { version: number; summary: string };
  notice?: string;
};

type Stored = { role: string; contentJson: string; hidden: boolean };

function slice(mode: ModeDef, profile: ProfileData): ProfileData {
  const keys = new Set([...mode.reads, ...mode.writes, "founder_type"]);
  const out: ProfileData = {};
  for (const k of keys) if (profile[k] !== undefined && profile[k] !== null) out[k] = profile[k];
  return out;
}

function recordMessage(mode: ModeDef, profile: ProfileData): string {
  const s = slice(mode, profile);
  return `Member record for this tool (current):\n${JSON.stringify(s, null, 1)}${
    mode.disclaimer ? `\n\nShow this statement with every result in this tool: "${mode.disclaimer}"` : ""
  }`;
}

function textOf(content: Anthropic.Beta.BetaContentBlock[] | Anthropic.Beta.BetaContentBlockParam[]): string {
  return content
    .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text")
    .map((b) => b.text)
    .join("\n\n")
    .trim();
}

export async function currentRun(userId: string, assetId: string): Promise<number> {
  const last = await db.message.findFirst({ where: { userId, assetId }, orderBy: { run: "desc" }, select: { run: true } });
  return last?.run ?? 1;
}

// Starts the run's history: a hidden "opened" turn, the record, and the
// opener the member sees. Built without an API call.
async function ensureStarted(userId: string, assetId: string, run: number, mode: ModeDef, profile: ProfileData) {
  const count = await db.message.count({ where: { userId, assetId, run } });
  if (count) return;
  const opener = mode.opener(profile);
  const seed: { role: string; content: Anthropic.Beta.BetaContentBlockParam[]; hidden: boolean; text: string }[] = [
    { role: "user", content: [{ type: "text", text: "[The member opened this tool.]" }], hidden: true, text: "" },
    { role: "system", content: [{ type: "text", text: recordMessage(mode, profile) }], hidden: true, text: "" },
    { role: "assistant", content: [{ type: "text", text: opener }], hidden: false, text: opener },
  ];
  for (const m of seed) {
    await db.message.create({
      data: { userId, assetId, run, role: m.role, contentJson: JSON.stringify(m.content), text: m.text, hidden: m.hidden },
    });
  }
}

export async function getTranscript(userId: string, assetId: string, run?: number): Promise<ChatLine[]> {
  const mode = getMode(assetId);
  if (!mode) return [];
  const r = run ?? (await currentRun(userId, assetId));
  await ensureStarted(userId, assetId, r, mode, await getProfile(userId));
  const rows = await db.message.findMany({
    where: { userId, assetId, run: r, hidden: false, text: { not: "" } },
    orderBy: { createdAt: "asc" },
  });
  return rows.map((m) => ({ id: m.id, role: m.role as "user" | "assistant", text: m.text, createdAt: m.createdAt.toISOString() }));
}

export async function startNewRun(userId: string, assetId: string): Promise<number> {
  const mode = getMode(assetId);
  if (!mode) throw new Error("Unknown tool");
  const run = (await currentRun(userId, assetId)) + 1;
  await ensureStarted(userId, assetId, run, mode, await getProfile(userId));
  return run;
}

function toParams(rows: Stored[], midSystem: boolean): Anthropic.Beta.BetaMessageParam[] {
  const out: Anthropic.Beta.BetaMessageParam[] = [];
  for (const r of rows) {
    const content = parseJson<Anthropic.Beta.BetaContentBlockParam[]>(r.contentJson, []);
    if (r.role === "system") {
      if (!midSystem) continue;
      // Mid-conversation system messages are not in the SDK's MessageParam union yet.
      out.push({ role: "system", content } as unknown as Anthropic.Beta.BetaMessageParam);
    } else {
      out.push({ role: r.role as "user" | "assistant", content });
    }
  }
  return out;
}

async function store(
  userId: string,
  assetId: string,
  run: number,
  role: string,
  content: unknown,
  text: string,
  hidden: boolean,
) {
  return db.message.create({
    data: { userId, assetId, run, role, contentJson: JSON.stringify(content), text, hidden },
  });
}

async function handleSave(
  userId: string,
  mode: ModeDef,
  input: unknown,
): Promise<{ ok: true; version: number; summary: string } | { ok: false; error: string }> {
  const profile = await getProfile(userId);
  let result: ReturnType<ModeDef["onSave"]>;
  try {
    result = mode.onSave((input ?? {}) as Record<string, unknown>, profile);
  } catch (e) {
    if (e instanceof SaveError) return { ok: false, error: e.message };
    return { ok: false, error: "The output could not be read. Check every required field and call save_output again." };
  }
  const allowed = new Set(mode.writes);
  const writes = Object.fromEntries(Object.entries(result.profile).filter(([k]) => allowed.has(k)));
  await writeProfile(userId, writes, mode.assetId);
  const version = await createVersion(userId, mode.assetId, input, result.doc, result.summary);
  await setStatus(userId, mode.assetId, "complete");
  await afterSave(userId, mode.assetId, input as Record<string, unknown>, result.doc);
  return { ok: true, version, summary: result.summary };
}

let client: Anthropic | null = null;
function anthropic(): Anthropic {
  client ??= new Anthropic();
  return client;
}

export function aiConfigured(): boolean {
  return !!(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN);
}

export async function runTurn(userId: string, assetId: string, userText: string): Promise<TurnResult> {
  const mode = getMode(assetId);
  const asset = getAsset(assetId);
  if (!mode || !asset) throw new Error("Unknown tool");
  const text = userText.trim().slice(0, 50_000);
  if (!text) return { messages: [] };

  if (!aiConfigured()) {
    return {
      messages: [],
      notice: "The Assistant is not connected yet. Add ANTHROPIC_API_KEY to the server environment and reload.",
    };
  }

  const run = await currentRun(userId, assetId);
  let profile = await getProfile(userId);
  await ensureStarted(userId, assetId, run, mode, profile);

  const midSystem = MID_SYSTEM_MODELS.has(MODEL);
  const newLines: ChatLine[] = [];
  const u = await store(userId, assetId, run, "user", [{ type: "text", text }], text, false);
  newLines.push({ id: u.id, role: "user", text, createdAt: u.createdAt.toISOString() });

  // Re-send the record only when it changed since the last injection.
  const lastSys = await db.message.findFirst({ where: { userId, assetId, run, role: "system" }, orderBy: { createdAt: "desc" } });
  const rec = recordMessage(mode, profile);
  if (midSystem && textOf(parseJson(lastSys?.contentJson, [])) !== rec) {
    await store(userId, assetId, run, "system", [{ type: "text", text: rec }], "", true);
  }

  const system: Anthropic.Beta.BetaTextBlockParam[] = [
    { type: "text", text: `${BASE_PROMPT}\n\nThis tool: ${asset.title}\n\n${mode.systemPrompt}`, cache_control: { type: "ephemeral" } },
  ];
  if (!midSystem) system.push({ type: "text", text: rec });

  const tool: Anthropic.Beta.BetaTool = {
    name: "save_output",
    description: `Save this tool's structured result to the member's record and produce their download. Call it only once the member has confirmed the result.`,
    input_schema: mode.outputSchema as Anthropic.Beta.BetaTool.InputSchema,
    strict: true,
  };

  let saved: TurnResult["saved"];
  let notice: string | undefined;

  for (let i = 0; i < 5; i++) {
    const rows = await db.message.findMany({ where: { userId, assetId, run }, orderBy: { createdAt: "asc" } });
    const betas = ["compact-2026-01-12", ...(FALLBACK_MODELS.has(MODEL) ? ["server-side-fallback-2026-07-01"] : [])];
    let response: Anthropic.Beta.BetaMessage;
    try {
      response = await anthropic().beta.messages.create({
        model: MODEL,
        max_tokens: 16000,
        betas,
        system,
        tools: [tool],
        messages: toParams(rows, midSystem),
        output_config: { effort: "medium" },
        context_management: { edits: [{ type: "compact_20260112" }] },
        ...(FALLBACK_MODELS.has(MODEL) ? { fallbacks: "default" } : {}),
      } as Anthropic.Beta.MessageCreateParamsNonStreaming);
    } catch (e) {
      if (e instanceof Anthropic.RateLimitError) notice = "The Assistant is busy right now. Wait a minute and send again.";
      else if (e instanceof Anthropic.AuthenticationError) notice = "The Assistant's API key was rejected. Check ANTHROPIC_API_KEY.";
      else if (e instanceof Anthropic.APIError) notice = `The Assistant hit an error (${e.status ?? "network"}). Your message is saved; send again to retry.`;
      else throw e;
      console.error("assistant error", e);
      break;
    }

    if (response.stop_reason === "refusal") {
      const msg = "I can't help with that here. Let's get back to the task in this tool.";
      const m = await store(userId, assetId, run, "assistant", [{ type: "text", text: msg }], msg, false);
      newLines.push({ id: m.id, role: "assistant", text: msg, createdAt: m.createdAt.toISOString() });
      break;
    }

    const visible = textOf(response.content);
    const m = await store(userId, assetId, run, "assistant", response.content, visible, !visible);
    if (visible) newLines.push({ id: m.id, role: "assistant", text: visible, createdAt: m.createdAt.toISOString() });

    if (response.stop_reason === "pause_turn") continue;
    if (response.stop_reason !== "tool_use") {
      if (response.stop_reason === "max_tokens") notice = "That reply ran long and was cut off. Ask the Assistant to continue.";
      break;
    }

    const results: Anthropic.Beta.BetaToolResultBlockParam[] = [];
    for (const block of response.content) {
      if (block.type !== "tool_use") continue;
      if (block.name !== "save_output") {
        results.push({ type: "tool_result", tool_use_id: block.id, is_error: true, content: "Unknown tool." });
        continue;
      }
      const r = await handleSave(userId, mode, block.input);
      if (r.ok) {
        saved = { version: r.version, summary: r.summary };
        profile = await getProfile(userId);
        results.push({ type: "tool_result", tool_use_id: block.id, content: `Saved as version ${r.version}. The download is ready under the chat.` });
      } else {
        results.push({ type: "tool_result", tool_use_id: block.id, is_error: true, content: r.error });
      }
    }
    await store(userId, assetId, run, "user", results, "", true);
  }

  return { messages: newLines, saved, notice };
}
