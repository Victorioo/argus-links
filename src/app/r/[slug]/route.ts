import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

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

  return new NextResponse(report.html, {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "X-Robots-Tag": "noindex",
    },
  });
}
