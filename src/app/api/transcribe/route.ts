import { NextResponse } from "next/server";
import { getUser } from "@/lib/auth";

export const maxDuration = 300;
const MAX = 200 * 1024 * 1024;

// Speech-to-text for SOP Generator uploads. Any provider that accepts a
// multipart "file" field with a Bearer key and returns JSON { text } works;
// set TRANSCRIPTION_API_URL and TRANSCRIPTION_API_KEY.
export async function POST(req: Request) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  const url = process.env.TRANSCRIPTION_API_URL;
  const key = process.env.TRANSCRIPTION_API_KEY;
  if (!url || !key) {
    return NextResponse.json(
      { error: "Recordings can't be turned into text here yet. Paste a transcript instead, or upload a .txt, .vtt or .srt file. Free ways to get one: Zoom or Google Meet's built-in transcript, or your phone's voice memo app (iPhone and most Android phones can show a transcript you can copy)." },
      { status: 501 },
    );
  }
  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "No file" }, { status: 400 });
  if (file.size > MAX) return NextResponse.json({ error: "That recording is over 200 MB. Trim it to one task." }, { status: 413 });
  const fd = new FormData();
  fd.append("file", file, file.name);
  const res = await fetch(url, { method: "POST", headers: { authorization: `Bearer ${key}` }, body: fd });
  if (!res.ok) return NextResponse.json({ error: "Transcription failed. Paste a transcript instead." }, { status: 502 });
  const body = (await res.json().catch(() => ({}))) as { text?: string };
  if (!body.text) return NextResponse.json({ error: "The transcription came back empty." }, { status: 502 });
  return NextResponse.json({ text: body.text });
}
