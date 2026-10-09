import { createHash, randomBytes } from "node:crypto";

export const RESET_TTL_MINUTES = 60;
export const RESETS_PER_HOUR = 3;

// The emailed token is random; only its SHA-256 hash is stored.
export function newResetToken(): { token: string; hash: string } {
  const token = randomBytes(32).toString("hex");
  return { token, hash: hashResetToken(token) };
}

export function hashResetToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function resetUsable(r: { expiresAt: Date; usedAt: Date | null } | null, now = new Date()): boolean {
  return !!r && !r.usedAt && r.expiresAt > now;
}

// Where reset links point. Never built from the request's Host header, which
// a stranger controls: that would let them email a member a link to their own site.
export function appUrl(): string | null {
  const explicit = process.env.APP_URL?.replace(/\/+$/, "");
  if (explicit) return explicit;
  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  return vercel ? `https://${vercel}` : null;
}
