import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import {
  CommentImageError,
  MAX_IMAGES_PER_REPORT_HOUR,
  deleteCommentImages,
  saveCommentImage,
} from "@/lib/comment-image";

const createSchema = z.object({
  selector: z.string().trim().max(500).optional(),
  page: z.string().max(300).optional(),
  parentId: z.string().max(100).optional(),
  authorName: z.string().trim().max(80).optional(),
  // May be empty when a screenshot is attached (checked in POST).
  text: z.string().trim().max(2000).default(""),
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
      snippet: comment.text.slice(0, 140) || "📎 Imagen adjunta",
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

  // Text-only comments arrive as JSON; a comment with a screenshot arrives as
  // multipart/form-data so the image travels with it (no orphan uploads).
  let body: unknown;
  let image: File | null = null;
  if ((req.headers.get("content-type") || "").includes("multipart/form-data")) {
    const form = await req.formData().catch(() => null);
    if (!form) {
      return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
    }
    const field = (name: string) => {
      const v = form.get(name);
      return typeof v === "string" && v !== "" ? v : undefined;
    };
    body = {
      selector: field("selector"),
      page: field("page"),
      parentId: field("parentId"),
      authorName: field("authorName"),
      text: field("text"),
    };
    const file = form.get("image");
    if (file instanceof File && file.size > 0) image = file;
  } else {
    body = await req.json().catch(() => null);
  }

  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Datos inválidos" },
      { status: 400 },
    );
  }
  if (!parsed.data.text && !image) {
    return NextResponse.json({ error: "El comentario no puede estar vacío" }, { status: 400 });
  }

  // Uploaded only once everything else checked out, right before the comment is
  // created, so a rejected comment never leaves an image behind. Returns an
  // error response when the upload is refused.
  async function attachImage(): Promise<{ url: string | null } | { error: NextResponse }> {
    if (!image) return { url: null };
    const recent = await prisma.comment.count({
      where: { reportId: report!.id, imageUrl: { not: null }, createdAt: { gt: new Date(Date.now() - 60 * 60 * 1000) } },
    });
    if (recent >= MAX_IMAGES_PER_REPORT_HOUR) {
      return {
        error: NextResponse.json(
          { error: "Se subieron demasiadas imágenes en este reporte. Probá de nuevo más tarde." },
          { status: 429 },
        ),
      };
    }
    try {
      return { url: await saveCommentImage(report!.id, image) };
    } catch (err) {
      if (err instanceof CommentImageError) {
        return { error: NextResponse.json({ error: err.message }, { status: err.status }) };
      }
      throw err;
    }
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

    const attached = await attachImage();
    if ("error" in attached) return attached.error;
    const imageUrl = attached.url;

    const comment = await prisma.comment
      .create({
        data: {
          reportId: report.id,
          parentId: root.id,
          selector: root.selector,
          page: root.page,
          authorId: actor.id,
          authorName,
          text: parsed.data.text,
          imageUrl,
        },
      })
      .catch(async (err) => {
        await deleteCommentImages([imageUrl]);
        throw err;
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

  const attached = await attachImage();
  if ("error" in attached) return attached.error;
  const imageUrl = attached.url;

  const comment = await prisma.comment
    .create({
      data: {
        reportId: report.id,
        selector: parsed.data.selector,
        page: parsed.data.page ?? "",
        authorId: actor.id,
        authorName,
        text: parsed.data.text,
        imageUrl,
      },
    })
    .catch(async (err) => {
      await deleteCommentImages([imageUrl]);
      throw err;
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
