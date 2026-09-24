import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
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
  allowComments: z.boolean().optional(),
  visibility: z.enum(["PUBLIC", "PASSWORD", "RESTRICTED"]).optional(),
  password: z.string().max(200).optional(),
  viewerIds: z.array(z.string()).optional(),
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

  const { title, description, html, allowComments, viewerIds } = parsed.data;
  const visibility = parsed.data.visibility ?? "PUBLIC";
  const sizeBytes = Buffer.byteLength(html, "utf8");
  if (sizeBytes > MAX_HTML_BYTES) {
    return NextResponse.json(
      { error: `El archivo pesa demasiado (${(sizeBytes / 1024 / 1024).toFixed(1)}MB). Límite: 4MB.` },
      { status: 413 },
    );
  }

  if (visibility === "PASSWORD" && !parsed.data.password?.trim()) {
    return NextResponse.json({ error: "Ingresá una contraseña de acceso" }, { status: 400 });
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

  const passwordHash =
    visibility === "PASSWORD" && parsed.data.password
      ? await bcrypt.hash(parsed.data.password, 12)
      : null;

  const report = await prisma.report.create({
    data: {
      title,
      slug,
      description: description || null,
      html,
      sizeBytes,
      allowComments: allowComments ?? false,
      visibility,
      passwordHash,
      createdById: session.user.id,
      allowedViewers:
        visibility === "RESTRICTED" && viewerIds?.length
          ? { create: viewerIds.map((userId) => ({ userId })) }
          : undefined,
    },
  });

  return NextResponse.json({ id: report.id, slug: report.slug });
}
