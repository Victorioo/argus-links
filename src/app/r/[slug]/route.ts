import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import {
  HTML_HEADERS,
  checkReportAccess,
  renderLockScreen,
  unlockCookieName,
  unlockToken,
} from "@/lib/report-access";

function withCommentOverlay(html: string, slug: string): string {
  const tag = `<script src="/comment-overlay.js" data-report-slug="${slug}" defer></script>`;
  if (/<\/body>/i.test(html)) {
    return html.replace(/<\/body>/i, `${tag}</body>`);
  }
  return `${html}${tag}`;
}

// The page is served at /r/<slug> (no trailing slash), so a relative asset
// path like "img/logo.png" would otherwise resolve against "/r/" instead of
// "/r/<slug>/". A <base> tag fixes that regardless of the document URL.
function withBaseHref(html: string, slug: string): string {
  if (/<base[\s>]/i.test(html)) return html;
  const baseTag = `<base href="/r/${slug}/">`;
  if (/<head[^>]*>/i.test(html)) {
    return html.replace(/<head[^>]*>/i, (m) => `${m}${baseTag}`);
  }
  if (/<html[^>]*>/i.test(html)) {
    return html.replace(/<html[^>]*>/i, (m) => `${m}<head>${baseTag}</head>`);
  }
  return `${baseTag}${html}`;
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const report = await prisma.report.findUnique({
    where: { slug },
    include: { allowedViewers: { select: { userId: true } } },
  });

  if (!report) {
    return new NextResponse("Reporte no encontrado", { status: 404 });
  }

  const gate = await checkReportAccess(report, req, slug);
  if (!gate.ok) return gate.response;

  prisma.report
    .update({ where: { id: report.id }, data: { views: { increment: 1 } } })
    .catch(() => {});

  let html = withBaseHref(report.html, report.slug);
  if (report.allowComments) html = withCommentOverlay(html, report.slug);

  return new NextResponse(html, { status: 200, headers: HTML_HEADERS });
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const report = await prisma.report.findUnique({ where: { slug } });

  if (!report) {
    return new NextResponse("Reporte no encontrado", { status: 404 });
  }

  if (report.visibility !== "PASSWORD" || !report.passwordHash) {
    return NextResponse.redirect(new URL(`/r/${slug}`, req.url), 303);
  }

  const form = await req.formData().catch(() => null);
  const password = String(form?.get("password") || "");
  const valid = await bcrypt.compare(password, report.passwordHash);

  if (!valid) {
    return new NextResponse(renderLockScreen(slug, true), { status: 401, headers: HTML_HEADERS });
  }

  const res = NextResponse.redirect(new URL(`/r/${slug}`, req.url), 303);
  res.cookies.set(unlockCookieName(report.id), unlockToken(report.id, report.passwordHash), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: `/r/${slug}`,
    maxAge: 60 * 60 * 24 * 30,
  });
  return res;
}
