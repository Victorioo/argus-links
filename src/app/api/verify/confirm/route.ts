import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { hashResetToken } from "@/lib/password-reset";

const schema = z.object({ token: z.string().min(20).max(200) });

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Link inválido" }, { status: 400 });
  }

  const record = await prisma.emailVerificationToken.findUnique({
    where: { tokenHash: hashResetToken(parsed.data.token) },
  });

  if (!record || record.expiresAt < new Date()) {
    return NextResponse.json(
      { error: "El link venció o ya fue usado. Pedí uno nuevo desde el inicio de sesión." },
      { status: 400 },
    );
  }

  await prisma.$transaction([
    prisma.user.update({ where: { id: record.userId }, data: { emailVerified: new Date() } }),
    prisma.emailVerificationToken.deleteMany({ where: { userId: record.userId } }),
  ]);

  return NextResponse.json({ ok: true });
}
