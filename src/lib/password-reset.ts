import crypto from "crypto";

export const RESET_TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hour
export const RESET_COOLDOWN_MS = 60 * 1000; // at most one email per minute per account

export function generateResetToken(): string {
  return crypto.randomBytes(32).toString("base64url");
}

// Only the hash is stored, so a database leak doesn't hand out usable links.
export function hashResetToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}
