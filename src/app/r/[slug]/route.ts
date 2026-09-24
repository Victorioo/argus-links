import crypto from "crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

const HTML_HEADERS = {
  "Content-Type": "text/html; charset=utf-8",
  "X-Robots-Tag": "noindex",
};

function withCommentOverlay(html: string, slug: string): string {
  const tag = `<script src="/comment-overlay.js" data-report-slug="${slug}" defer></script>`;
  if (/<\/body>/i.test(html)) {
    return html.replace(/<\/body>/i, `${tag}</body>`);
  }
  return `${html}${tag}`;
}

function unlockCookieName(reportId: string) {
  return `rh_unlock_${reportId}`;
}

function unlockToken(reportId: string, passwordHash: string): string {
  const secret = process.env.AUTH_SECRET || "";
  return crypto.createHmac("sha256", secret).update(`${reportId}:${passwordHash}`).digest("hex");
}

function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

function renderLockScreen(slug: string, wrongPassword: boolean): string {
  return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Acceso protegido</title>
<style>
  * { box-sizing: border-box; }
  body { margin:0; min-height:100vh; display:flex; align-items:center; justify-content:center;
    background:#0B0714; color:#F3F0FA; font-family: Arial, Helvetica, sans-serif; padding: 20px; }
  .card { width:100%; max-width:380px; background:#131022; border:1px solid #2A2340; border-radius:22px; padding:32px; }
  .eyebrow { font-size:11px; letter-spacing:.14em; text-transform:uppercase; color:#F0B94D; margin-bottom:14px; display:block; }
  h1 { font-size:1.4rem; margin: 0 0 8px; }
  p { color:#A79FC2; font-size:0.92rem; margin: 0 0 20px; line-height:1.5; }
  input { width:100%; background:#1A152C; border:1px solid #2A2340; color:#F3F0FA; border-radius:12px;
    padding:12px 14px; font-size:0.95rem; outline:none; margin-bottom:14px; }
  input:focus { border-color:#8B5CF6; }
  button { width:100%; border:none; border-radius:999px; padding:12px 20px; font-weight:700; font-size:0.9rem;
    cursor:pointer; background:linear-gradient(100deg,#6D28D9,#8B5CF6); color:#fff; }
  .err { color:#F0729B; font-size:0.85rem; margin: -6px 0 14px; }
</style>
</head>
<body>
  <div class="card">
    <span class="eyebrow">Contenido protegido</span>
    <h1>Esta página pide contraseña</h1>
    <p>Ingresá la contraseña que te compartieron para ver este reporte.</p>
    <form method="POST" action="/r/${slug}">
      <input type="password" name="password" placeholder="Contraseña" autofocus required />
      ${wrongPassword ? '<div class="err">Contraseña incorrecta.</div>' : ""}
      <button type="submit">Entrar</button>
    </form>
  </div>
</body>
</html>`;
}

function renderNoAccessPage(): string {
  return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Sin acceso</title>
<style>
  * { box-sizing: border-box; }
  body { margin:0; min-height:100vh; display:flex; align-items:center; justify-content:center;
    background:#0B0714; color:#F3F0FA; font-family: Arial, Helvetica, sans-serif; padding: 20px; text-align:center; }
  .card { width:100%; max-width:380px; background:#131022; border:1px solid #2A2340; border-radius:22px; padding:32px; }
  .eyebrow { font-size:11px; letter-spacing:.14em; text-transform:uppercase; color:#F0729B; margin-bottom:14px; display:block; }
  h1 { font-size:1.4rem; margin: 0 0 8px; }
  p { color:#A79FC2; font-size:0.92rem; margin: 0; line-height:1.5; }
</style>
</head>
<body>
  <div class="card">
    <span class="eyebrow">Acceso restringido</span>
    <h1>No tenés acceso a este reporte</h1>
    <p>Este reporte solo es visible para usuarios específicos del equipo. Pedile a quien te lo compartió que te sume a la lista.</p>
  </div>
</body>
</html>`;
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

  if (report.visibility === "RESTRICTED") {
    const session = await auth();
    if (!session?.user?.id) {
      const url = new URL("/login", req.url);
      url.searchParams.set("from", `/r/${slug}`);
      return NextResponse.redirect(url);
    }
    const allowed =
      session.user.id === report.createdById ||
      report.allowedViewers.some((v) => v.userId === session.user.id);
    if (!allowed) {
      return new NextResponse(renderNoAccessPage(), { status: 403, headers: HTML_HEADERS });
    }
  }

  if (report.visibility === "PASSWORD") {
    const cookieStore = await cookies();
    const token = cookieStore.get(unlockCookieName(report.id))?.value;
    const expected = report.passwordHash ? unlockToken(report.id, report.passwordHash) : null;
    const unlocked = !!token && !!expected && safeEqual(token, expected);
    if (!unlocked) {
      return new NextResponse(renderLockScreen(slug, false), { status: 200, headers: HTML_HEADERS });
    }
  }

  prisma.report
    .update({ where: { id: report.id }, data: { views: { increment: 1 } } })
    .catch(() => {});

  const html = report.allowComments ? withCommentOverlay(report.html, report.slug) : report.html;

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
