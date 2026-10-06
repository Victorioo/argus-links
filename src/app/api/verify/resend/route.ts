import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { queueVerificationEmail } from "@/lib/email-verification";

const schema = z.object({ email: z.string().trim().toLowerCase().email() });

// Same answer whether or not the account exists or is already verified.
const GENERIC_OK = {
  ok: true,
  message: "Si la cuenta existe y falta confirmarla, te enviamos un nuevo email.",
};

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Email inválido" }, { status: 400 });
  }

  const user = await prisma.user.findUnique({ where: { email: parsed.data.email } });
  if (user && !user.emailVerified) {
    await queueVerificationEmail(user);
  }

  return NextResponse.json(GENERIC_OK);
}
