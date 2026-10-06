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
