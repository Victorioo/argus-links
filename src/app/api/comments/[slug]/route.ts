import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

const createSchema = z.object({
  selector: z.string().trim().max(500).optional(),
  page: z.string().max(300).optional(),
  parentId: z.string().max(100).optional(),
  authorName: z.string().trim().max(80).optional(),
  text: z.string().trim().min(1, "El comentario no puede estar vacío").max(2000),
});

// Signed-in Report Hub users comment under their account name; everyone else
// is anonymous and supplies their own.
async function getViewerName(): Promise<string | null> {
  const session = await auth();
  return session?.user?.id ? session.user.name || session.user.email || null : null;
}

export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const report = await prisma.report.findUnique({
    where: { slug },
    select: { id: true, allowComments: true },
  });

  const viewerName = await getViewerName();
  const viewer = viewerName ? { name: viewerName } : null;

  if (!report || !report.allowComments) {
    return NextResponse.json({ comments: [], viewer });
  }

  const comments = await prisma.comment.findMany({
    where: { reportId: report.id },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json({ comments, viewer });
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

  const viewerName = await getViewerName();
  const authorName = viewerName || parsed.data.authorName || "Anónimo";

  // A reply inherits selector/page from its thread's top-level comment.
  // Replying to a reply attaches to the same top-level comment.
  if (parsed.data.parentId) {
    const target = await prisma.comment.findFirst({
      where: { id: parsed.data.parentId, reportId: report.id },
    });
    if (!target) {
      return NextResponse.json({ error: "El comentario original ya no existe" }, { status: 404 });
    }
    const rootId = target.parentId ?? target.id;
    const root = target.parentId
      ? await prisma.comment.findUnique({ where: { id: rootId } })
      : target;
    if (!root) {
      return NextResponse.json({ error: "El comentario original ya no existe" }, { status: 404 });
    }

    const comment = await prisma.comment.create({
      data: {
        reportId: report.id,
        parentId: root.id,
        selector: root.selector,
        page: root.page,
        authorName,
        text: parsed.data.text,
      },
    });
    return NextResponse.json({ comment });
  }

  if (!parsed.data.selector) {
    return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
  }

  const comment = await prisma.comment.create({
    data: {
      reportId: report.id,
      selector: parsed.data.selector,
      page: parsed.data.page ?? "",
      authorName,
      text: parsed.data.text,
    },
  });

  return NextResponse.json({ comment });
}
