import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

const schema = z.object({ clientId: z.string().min(1).max(100) });

// Disconnect an app: removes every token this person granted to that client.
export async function DELETE(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
  }

  const result = await prisma.oAuthToken.deleteMany({
    where: { userId: session.user.id, client: { clientId: parsed.data.clientId } },
  });
  return NextResponse.json({ ok: true, revoked: result.count });
}
