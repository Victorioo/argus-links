import { after, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getAppUrl, passwordResetEmail, sendEmail } from "@/lib/email";
import {
  RESET_COOLDOWN_MS,
  RESET_TOKEN_TTL_MS,
  generateResetToken,
  hashResetToken,
} from "@/lib/password-reset";

const schema = z.object({
  email: z.string().trim().toLowerCase().email(),
});

// Same answer whether or not the account exists, so this endpoint can't be
// used to find out who is registered.
const GENERIC_OK = {
  ok: true,
  message: "Si existe una cuenta con ese email, te enviamos un link para restablecer la contraseña.",
};

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Email inválido" }, { status: 400 });
  }

  const user = await prisma.user.findUnique({ where: { email: parsed.data.email } });
  if (!user) return NextResponse.json(GENERIC_OK);

  const recent = await prisma.passwordResetToken.findFirst({
    where: { userId: user.id, createdAt: { gt: new Date(Date.now() - RESET_COOLDOWN_MS) } },
  });
  if (recent) return NextResponse.json(GENERIC_OK);

  const token = generateResetToken();
  await prisma.$transaction([
    prisma.passwordResetToken.deleteMany({ where: { userId: user.id } }),
    prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash: hashResetToken(token),
        expiresAt: new Date(Date.now() + RESET_TOKEN_TTL_MS),
      },
    }),
  ]);

  const link = `${getAppUrl()}/reset-password?token=${encodeURIComponent(token)}`;
  const mail = passwordResetEmail(user.name, link);
  after(() => sendEmail({ to: user.email, ...mail }));

  return NextResponse.json(GENERIC_OK);
}
