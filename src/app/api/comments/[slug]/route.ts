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
async function getViewer(): Promise<{ id: string; name: string } | null> {
  const session = await auth();
  if (!session?.user?.id) return null;
  return { id: session.user.id, name: session.user.name || session.user.email || "Usuario" };
}

// Comments are public; the internal account id of the author is not.
function toPublic<T extends { authorId: string | null }>(c: T): Omit<T, "authorId"> {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { authorId, ...rest } = c;
  return rest;
}

// Tells signed-in people about activity on their reports and comments.
// Anonymous commenters have no account, so only account holders are notified.
async function notify(opts: {
  comment: { id: string; text: string; page: string };
  actor: { id: string | null; name: string };
  reportId: string;
  reportOwnerId: string | null;
  threadAuthorIds: (string | null)[];
}) {
  const { comment, actor, reportId, reportOwnerId, threadAuthorIds } = opts;
  const recipients = new Map<string, "REPLY" | "COMMENT">();

  for (const id of threadAuthorIds) {
    if (id && id !== actor.id) recipients.set(id, "REPLY");
  }
  if (reportOwnerId && reportOwnerId !== actor.id && !recipients.has(reportOwnerId)) {
    recipients.set(reportOwnerId, "COMMENT");
  }
  if (!recipients.size) return;

  await prisma.notification.createMany({
    data: [...recipients].map(([userId, type]) => ({
      userId,
      type,
      reportId,
      commentId: comment.id,
      actorName: actor.name,
      snippet: comment.text.slice(0, 140),
      page: comment.page,
    })),
  });
}

export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const report = await prisma.report.findUnique({
    where: { slug },
    select: { id: true, allowComments: true },
  });

  const viewerInfo = await getViewer();
  const viewer = viewerInfo ? { name: viewerInfo.name } : null;

  if (!report || !report.allowComments) {
    return NextResponse.json({ comments: [], viewer });
  }

  const comments = await prisma.comment.findMany({
    where: { reportId: report.id },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json({ comments: comments.map(toPublic), viewer });
}

export async function POST(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const report = await prisma.report.findUnique({
    where: { slug },
    select: { id: true, allowComments: true, createdById: true },
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

  const viewer = await getViewer();
  const authorName = viewer?.name || parsed.data.authorName || "Anónimo";
  const actor = { id: viewer?.id ?? null, name: authorName };

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
        authorId: actor.id,
        authorName,
        text: parsed.data.text,
      },
    });
    await notify({
      comment,
      actor,
      reportId: report.id,
      reportOwnerId: report.createdById,
      threadAuthorIds: [target.authorId, root.authorId],
    }).catch((err) => console.error("notify failed", err));
    return NextResponse.json({ comment: toPublic(comment) });
  }

  if (!parsed.data.selector) {
    return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
  }

  const comment = await prisma.comment.create({
    data: {
      reportId: report.id,
      selector: parsed.data.selector,
      page: parsed.data.page ?? "",
      authorId: actor.id,
      authorName,
      text: parsed.data.text,
    },
  });
  await notify({
    comment,
    actor,
    reportId: report.id,
    reportOwnerId: report.createdById,
    threadAuthorIds: [],
  }).catch((err) => console.error("notify failed", err));

  return NextResponse.json({ comment: toPublic(comment) });
}
