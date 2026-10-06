import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

const schema = z.union([
  z.object({ all: z.literal(true) }),
  z.object({ id: z.string().min(1).max(100) }),
]);

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
  }

  // Always scoped to the signed-in user, so ids from other accounts are ignored.
  await prisma.notification.updateMany({
    where: {
      userId: session.user.id,
      readAt: null,
      ...("id" in parsed.data ? { id: parsed.data.id } : {}),
    },
    data: { readAt: new Date() },
  });

  return NextResponse.json({ ok: true });
}
