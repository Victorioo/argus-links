import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { isValidSlug, slugify } from "@/lib/slug";

const MAX_HTML_BYTES = 4 * 1024 * 1024; // stay under Vercel's serverless body limit

const createSchema = z.object({
  title: z.string().trim().min(1, "El título es obligatorio").max(200),
  slug: z.string().trim().optional(),
  description: z.string().trim().max(500).optional(),
  html: z.string().min(1, "El HTML no puede estar vacío"),
});

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Datos inválidos" },
      { status: 400 },
    );
  }

  const { title, description, html } = parsed.data;
  const sizeBytes = Buffer.byteLength(html, "utf8");
  if (sizeBytes > MAX_HTML_BYTES) {
    return NextResponse.json(
      { error: `El archivo pesa demasiado (${(sizeBytes / 1024 / 1024).toFixed(1)}MB). Límite: 4MB.` },
      { status: 413 },
    );
  }

  let slug = parsed.data.slug ? slugify(parsed.data.slug) : slugify(title);
  if (!slug || !isValidSlug(slug)) {
    return NextResponse.json({ error: "No se pudo generar un link válido para ese título" }, { status: 400 });
  }

  const existing = await prisma.report.findUnique({ where: { slug } });
  if (existing) {
    // Auto-disambiguate rather than fail outright
    slug = `${slug}-${Math.random().toString(36).slice(2, 7)}`;
  }

  const report = await prisma.report.create({
    data: {
      title,
      slug,
      description: description || null,
      html,
      sizeBytes,
      createdById: session.user.id,
    },
  });

  return NextResponse.json({ id: report.id, slug: report.slug });
}
