// The Portal's emails: welcome on sign-up, and a link to set a new password
// (member asks for it, or an admin sends it for support).

import { db } from "./db";
import { layout, plain, sendEmail } from "./email";
import { appUrl, newResetToken, RESET_TTL_MINUTES, RESETS_PER_HOUR } from "./resetToken";

const base = () => appUrl() ?? "https://portal.latefounders.com";

export async function sendWelcome(to: string, name: string) {
  const heading = `Welcome to the Late Founders Portal, ${name}`;
  const paras = [
    "Your account is ready. The Portal is where your tools, worksheets and saved work live, alongside the lessons in Skool.",
    "Start with the Founder Diagnostic. It takes 15 to 20 minutes, sets your founder type and your Freedom Number, and lays out your route through the courses.",
    "Log in any time with this email address and the password you chose.",
  ];
  const button = { label: "Start the Founder Diagnostic", url: `${base()}/assets/founder-diagnostic` };
  return sendEmail(to, "Welcome to the Late Founders Portal", plain(heading, paras, button), layout(heading, paras, button));
}

// kind "forgot": the member asked; one hour, limited per hour.
// kind "admin": sent from the Members page for support; 24 hours.
export async function sendResetLink(userId: string, kind: "forgot" | "admin"): Promise<{ sent: boolean; error?: string }> {
  const user = await db.user.findUnique({ where: { id: userId }, select: { id: true, email: true, name: true, disabled: true } });
  if (!user || user.disabled) return { sent: false, error: "No active account." };
  if (kind === "forgot") {
    const recent = await db.passwordReset.count({ where: { userId, createdAt: { gt: new Date(Date.now() - 3_600_000) } } });
    if (recent >= RESETS_PER_HOUR) return { sent: false, error: "Too many requests. Try again in an hour." };
  }
  const minutes = kind === "admin" ? 24 * 60 : RESET_TTL_MINUTES;
  const { token, hash } = newResetToken();
  await db.passwordReset.create({ data: { userId, tokenHash: hash, expiresAt: new Date(Date.now() + minutes * 60_000) } });
  const url = `${base()}/login/reset?token=${token}`;
  const heading = kind === "admin" ? `Your Late Founders Portal login, ${user.name}` : "Set a new password";
  const paras =
    kind === "admin"
      ? [
          "The Late Founders team sent you this link so you can get back into the Portal.",
          "Click the button to choose a new password. You'll be logged straight in, and all your saved work is where you left it. The link works for 24 hours.",
          `Your login email is ${user.email}. The Portal is always at ${base()}.`,
        ]
      : [
          "Someone asked to reset the password for your Late Founders Portal account. If that was you, click the button to choose a new one. The link works for one hour.",
          "If it wasn't you, ignore this email. Your password stays as it is.",
        ];
  const button = { label: "Choose a new password", url };
  return sendEmail(user.email, kind === "admin" ? "Your Late Founders Portal login" : "Reset your Late Founders Portal password", plain(heading, paras, button), layout(heading, paras, button));
}
