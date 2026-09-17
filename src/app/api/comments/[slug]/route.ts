import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

const createSchema = z.object({
  selector: z.string().trim().min(1).max(500),
  authorName: z.string().trim().max(80).optional(),
  text: z.string().trim().min(1, "El comentario no puede estar vacío").max(2000),
});

export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const report = await prisma.report.findUnique({
    where: { slug },
    select: { id: true, allowComments: true },
  });

  if (!report || !report.allowComments) {
    return NextResponse.json({ comments: [] });
  }

  const comments = await prisma.comment.findMany({
    where: { reportId: report.id },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json({ comments });
}

export async function POST(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const report = await prisma.report.findUnique({
    where: { slug },
    select: { id: true, allowComments: true },
  });

  if (!report) {
    return NextResponse.json({ error: "Reporte no encontrado" }, { status: 404 });
  }
  if (!report.allowComments) {
    return NextResponse.json(
      { error: "Los comentarios están deshabilitados para este reporte" },
      { status: 403 },
    );
  }

  const body = await req.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Datos inválidos" },
      { status: 400 },
    );
  }

  const comment = await prisma.comment.create({
    data: {
      reportId: report.id,
      selector: parsed.data.selector,
      authorName: parsed.data.authorName || "Anónimo",
      text: parsed.data.text,
    },
  });

  return NextResponse.json({ comment });
}
