import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const userId = session.user.id;

  const [unread, rows] = await Promise.all([
    prisma.notification.count({ where: { userId, readAt: null } }),
    prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 30,
      include: { report: { select: { slug: true, title: true } } },
    }),
  ]);

  const items = rows.map((n) => ({
    id: n.id,
    type: n.type,
    actorName: n.actorName,
    snippet: n.snippet,
    reportTitle: n.report.title,
    read: !!n.readAt,
    createdAt: n.createdAt,
    // Opens the right page of the report and the overlay focuses the comment.
    href: `/r/${n.report.slug}${n.page ? `/${n.page}` : ""}#rh-comment=${n.commentId}`,
  }));

  return NextResponse.json({ unread, items });
}
