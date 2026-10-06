import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { queueVerificationEmail } from "@/lib/email-verification";

const registerSchema = z.object({
  name: z.string().trim().min(1, "El nombre es obligatorio").max(100),
  email: z.string().trim().toLowerCase().email("Email inválido"),
  password: z.string().min(8, "La contraseña debe tener al menos 8 caracteres").max(200),
});

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = registerSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Datos inválidos" },
      { status: 400 },
    );
  }

  const { name, email, password } = parsed.data;

  const allowedDomain = process.env.ALLOWED_EMAIL_DOMAIN?.trim().toLowerCase();
  if (allowedDomain && !email.endsWith(`@${allowedDomain}`)) {
    return NextResponse.json(
      { error: `Solo se permiten cuentas con email @${allowedDomain}` },
      { status: 403 },
    );
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing?.emailVerified) {
    return NextResponse.json(
      { error: "Ya existe una cuenta con ese email" },
      { status: 409 },
    );
  }

  const passwordHash = await bcrypt.hash(password, 12);

  // An unverified account can't sign in or own anything, so the real owner of
  // the address may re-register over it (e.g. someone typed their email).
  const user = existing
    ? await prisma.user.update({ where: { id: existing.id }, data: { name, passwordHash } })
    : await prisma.user.create({ data: { name, email, passwordHash } });

  await queueVerificationEmail(user);

  return NextResponse.json({ ok: true, needsVerification: true });
}
