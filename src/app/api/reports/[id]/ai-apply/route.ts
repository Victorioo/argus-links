import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import {
  AI_DAILY_LIMIT,
  AI_MODEL,
  AiError,
  aiEnabled,
  editHtmlWithComments,
  type CommentForAi,
} from "@/lib/claude-edit";

// Claude can take a while on a large report.
export const maxDuration = 300;

const schema = z.object({
  commentIds: z.array(z.string().max(100)).min(1, "Elegí al menos un comentario").max(40),
  instructions: z.string().trim().max(1000).optional(),
});

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  if (!aiEnabled()) {
    return NextResponse.json({ error: "Claude todavía no está configurado en esta plataforma." }, { status: 503 });
  }

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Datos inválidos" },
      { status: 400 },
    );
  }

  const { id } = await params;
  const report = await prisma.report.findUnique({
    where: { id },
    select: { id: true, html: true },
  });
  if (!report) {
    return NextResponse.json({ error: "Reporte no encontrado" }, { status: 404 });
  }

  const userId = session.user.id;
  const used = await prisma.aiRun.count({
    where: { userId, createdAt: { gt: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
  });
  if (used >= AI_DAILY_LIMIT) {
    return NextResponse.json(
      { error: `Llegaste al límite de ${AI_DAILY_LIMIT} usos de Claude por día. Probá de nuevo mañana.` },
      { status: 429 },
    );
  }

  // Only top-level comments left on the main page of this report: that is the
  // HTML stored in report.html (inner pages of a .zip are separate files).
  const roots = await prisma.comment.findMany({
    where: { id: { in: parsed.data.commentIds }, reportId: report.id, parentId: null, page: "" },
    include: { replies: { orderBy: { createdAt: "asc" } } },
    orderBy: { createdAt: "asc" },
  });
  if (!roots.length) {
    return NextResponse.json({ error: "No se encontraron los comentarios elegidos" }, { status: 404 });
  }

  const comments: CommentForAi[] = roots.map((c) => ({
    id: c.id,
    selector: c.selector,
    authorName: c.authorName,
    text: c.text,
    replies: c.replies.map((r) => ({ authorName: r.authorName, text: r.text })),
  }));

  try {
    const result = await editHtmlWithComments({
      html: report.html,
      comments,
      instructions: parsed.data.instructions ?? "",
    });

    await prisma.aiRun.create({
      data: {
        userId,
        reportId: report.id,
        model: AI_MODEL,
        inputTokens: result.usage.inputTokens,
        outputTokens: result.usage.outputTokens,
      },
    });

    return NextResponse.json({
      html: result.html,
      changed: result.applied.length > 0,
      summary: result.summary,
      applied: result.applied.map((a) => ({ commentIds: a.commentIds, find: a.find, replace: a.replace })),
      failed: result.failed,
      skipped: result.skipped,
      newExternalHosts: result.newExternalHosts,
      remainingToday: Math.max(0, AI_DAILY_LIMIT - used - 1),
    });
  } catch (err) {
    if (err instanceof AiError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("ai-apply failed", err);
    return NextResponse.json({ error: "No se pudo procesar el pedido. Probá de nuevo." }, { status: 500 });
  }
}
