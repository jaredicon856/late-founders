// Quick replies: the Assistant may end a message with a line like
//   [[Yes, save it | Change something]]
// when it asks the member to confirm or choose. The chat shows them as buttons
// under its latest message and hides the marker from the text.
const MARKER = /\n*\s*\[\[([^\]\n]+)\]\]\s*$/;

export function splitReplies(text: string): { body: string; replies: string[] } {
  const m = MARKER.exec(text);
  if (!m) return { body: text, replies: [] };
  const replies = m[1]
    .split("|")
    .map((r) => r.trim())
    .filter((r) => r && r.length <= 60)
    .slice(0, 4);
  return { body: text.slice(0, m.index).trimEnd(), replies };
}
