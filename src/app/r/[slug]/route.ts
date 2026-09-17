import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

function withCommentOverlay(html: string, slug: string): string {
  const tag = `<script src="/comment-overlay.js" data-report-slug="${slug}" defer></script>`;
  if (/<\/body>/i.test(html)) {
    return html.replace(/<\/body>/i, `${tag}</body>`);
  }
  return `${html}${tag}`;
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const report = await prisma.report.findUnique({ where: { slug } });

  if (!report) {
    return new NextResponse("Reporte no encontrado", { status: 404 });
  }

  prisma.report
    .update({ where: { id: report.id }, data: { views: { increment: 1 } } })
    .catch(() => {});

  const html = report.allowComments ? withCommentOverlay(report.html, report.slug) : report.html;

  return new NextResponse(html, {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "X-Robots-Tag": "noindex",
    },
  });
}
