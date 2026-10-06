import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { hashResetToken } from "@/lib/password-reset";

const schema = z.object({
  token: z.string().min(20).max(200),
  password: z.string().min(8, "La contraseña debe tener al menos 8 caracteres").max(200),
});

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Datos inválidos" },
      { status: 400 },
    );
  }

  const record = await prisma.passwordResetToken.findUnique({
    where: { tokenHash: hashResetToken(parsed.data.token) },
  });

  if (!record || record.expiresAt < new Date()) {
    return NextResponse.json(
      { error: "El link venció o ya fue usado. Pedí uno nuevo." },
      { status: 400 },
    );
  }

  const passwordHash = await bcrypt.hash(parsed.data.password, 12);

  await prisma.$transaction([
    prisma.user.update({ where: { id: record.userId }, data: { passwordHash } }),
    prisma.passwordResetToken.deleteMany({ where: { userId: record.userId } }),
  ]);

  return NextResponse.json({ ok: true });
}
