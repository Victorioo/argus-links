import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ slug: string; commentId: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { slug, commentId } = await params;
  await prisma.comment.deleteMany({ where: { id: commentId, report: { slug } } });

  return NextResponse.json({ ok: true });
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ slug: string; commentId: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  if (typeof body?.resolved !== "boolean") {
    return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
  }

  const { slug, commentId } = await params;
  const { count } = await prisma.comment.updateMany({
    where: { id: commentId, report: { slug } },
    data: { resolved: body.resolved },
  });
  if (!count) {
    return NextResponse.json({ error: "Comentario no encontrado" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
