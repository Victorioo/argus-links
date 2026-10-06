import { after } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAppUrl, sendEmail, verificationEmail } from "@/lib/email";
import { generateResetToken, hashResetToken } from "@/lib/password-reset";

export const VERIFY_TOKEN_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
export const VERIFY_COOLDOWN_MS = 60 * 1000; // at most one email per minute per account

// Replaces any pending token and sends a fresh confirmation email after the
// response is returned. Returns false when skipped by the per-account cooldown.
export async function queueVerificationEmail(user: {
  id: string;
  name: string;
  email: string;
}): Promise<boolean> {
  const recent = await prisma.emailVerificationToken.findFirst({
    where: { userId: user.id, createdAt: { gt: new Date(Date.now() - VERIFY_COOLDOWN_MS) } },
  });
  if (recent) return false;

  const token = generateResetToken();
  await prisma.$transaction([
    prisma.emailVerificationToken.deleteMany({ where: { userId: user.id } }),
    prisma.emailVerificationToken.create({
      data: {
        userId: user.id,
        tokenHash: hashResetToken(token),
        expiresAt: new Date(Date.now() + VERIFY_TOKEN_TTL_MS),
      },
    }),
  ]);

  const link = `${getAppUrl()}/verify-email?token=${encodeURIComponent(token)}`;
  const mail = verificationEmail(user.name, link);
  after(() => sendEmail({ to: user.email, ...mail }));
  return true;
}
