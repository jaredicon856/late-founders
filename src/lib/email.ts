// Sends email through Resend (resend.com). Needs RESEND_API_KEY, and the sending
// domain verified in Resend. EMAIL_FROM sets the sender; the default uses the
// mail.latefounders.com subdomain. Without a key, nothing is sent and callers
// get { sent: false } so the app keeps working.

const FROM = process.env.EMAIL_FROM || "Late Founders Portal <portal@mail.latefounders.com>";

export function emailConfigured(): boolean {
  return !!process.env.RESEND_API_KEY;
}

export async function sendEmail(to: string, subject: string, text: string, html: string): Promise<{ sent: boolean; error?: string }> {
  const key = process.env.RESEND_API_KEY;
  if (!key) return { sent: false, error: "Email isn't set up yet." };
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
      body: JSON.stringify({ from: FROM, to: [to], subject, text, html }),
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { message?: string };
      console.error("email: resend refused", res.status, body.message);
      return { sent: false, error: body.message || `Resend answered ${res.status}` };
    }
    return { sent: true };
  } catch (e) {
    console.error("email: send failed", e);
    return { sent: false, error: "The email service didn't answer." };
  }
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

// One simple branded layout for every email: a heading, paragraphs, one button.
export function layout(heading: string, paragraphs: string[], button?: { label: string; url: string }, footer?: string): string {
  return `<!doctype html><html><body style="margin:0;background:#f4f4f2;font-family:Montserrat,Arial,sans-serif;color:#0b0b0d">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 16px">
<table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:12px">
<tr><td style="background:#0b0b0d;border-radius:12px 12px 0 0;padding:20px 28px;color:#73fed2;font-weight:800;letter-spacing:2px;font-size:13px">LATE FOUNDERS PORTAL</td></tr>
<tr><td style="padding:28px">
<h1 style="font-size:22px;margin:0 0 16px">${esc(heading)}</h1>
${paragraphs.map((p) => `<p style="font-size:15px;line-height:1.6;margin:0 0 14px">${esc(p)}</p>`).join("")}
${button ? `<p style="margin:24px 0"><a href="${esc(button.url)}" style="background:#73fed2;color:#0b0b0d;text-decoration:none;font-weight:700;padding:12px 22px;border-radius:8px;display:inline-block">${esc(button.label)}</a></p><p style="font-size:12px;color:#5c6169;margin:0">Or paste this into your browser: ${esc(button.url)}</p>` : ""}
</td></tr>
<tr><td style="padding:16px 28px 24px;font-size:12px;color:#5c6169">${esc(footer ?? "You're getting this because you have a Late Founders Portal account.")}</td></tr>
</table></td></tr></table></body></html>`;
}

export function plain(heading: string, paragraphs: string[], button?: { label: string; url: string }): string {
  return [heading, "", ...paragraphs.flatMap((p) => [p, ""]), ...(button ? [`${button.label}: ${button.url}`] : [])].join("\n");
}
