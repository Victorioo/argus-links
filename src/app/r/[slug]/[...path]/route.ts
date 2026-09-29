import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkReportAccess } from "@/lib/report-access";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ slug: string; path: string[] }> },
) {
  const { slug, path } = await params;
  const relPath = path.join("/");

  const report = await prisma.report.findUnique({
    where: { slug },
    include: { allowedViewers: { select: { userId: true } } },
  });

  if (!report) {
    return new NextResponse("Reporte no encontrado", { status: 404 });
  }

  const gate = await checkReportAccess(report, req, slug);
  if (!gate.ok) return gate.response;

  const asset = await prisma.reportAsset.findUnique({
    where: { reportId_path: { reportId: report.id, path: relPath } },
  });

  if (!asset) {
    return new NextResponse("Archivo no encontrado", { status: 404 });
  }

  // Proxy through our own server rather than redirecting to the blob URL
  // directly, so a password/restricted report's assets never leak a
  // directly-fetchable URL to anyone who bypassed the gate above.
  const range = req.headers.get("range");
  const blobRes = await fetch(asset.blobUrl, range ? { headers: { Range: range } } : undefined);

  if (!blobRes.ok && blobRes.status !== 206) {
    return new NextResponse("No se pudo cargar el archivo", { status: 502 });
  }

  const headers = new Headers();
  headers.set("Content-Type", asset.contentType);
  headers.set("Accept-Ranges", "bytes");
  headers.set("Cache-Control", "private, max-age=3600");
  const contentLength = blobRes.headers.get("content-length");
  if (contentLength) headers.set("Content-Length", contentLength);
  const contentRange = blobRes.headers.get("content-range");
  if (contentRange) headers.set("Content-Range", contentRange);

  return new NextResponse(blobRes.body, { status: blobRes.status, headers });
}
