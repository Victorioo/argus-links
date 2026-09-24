import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { isValidSlug, slugify } from "@/lib/slug";

const MAX_HTML_BYTES = 4 * 1024 * 1024;

const updateSchema = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  slug: z.string().trim().optional(),
  description: z.string().trim().max(500).optional(),
  html: z.string().min(1).optional(),
  allowComments: z.boolean().optional(),
  visibility: z.enum(["PUBLIC", "PASSWORD", "RESTRICTED"]).optional(),
  password: z.string().max(200).optional(),
  viewerIds: z.array(z.string()).optional(),
});

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { id } = await params;
  const existing = await prisma.report.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Reporte no encontrado" }, { status: 404 });
  }

  const body = await req.json().catch(() => null);
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Datos inválidos" },
      { status: 400 },
    );
  }

  const data: {
    title?: string;
    slug?: string;
    description?: string | null;
    html?: string;
    sizeBytes?: number;
    allowComments?: boolean;
    visibility?: "PUBLIC" | "PASSWORD" | "RESTRICTED";
    passwordHash?: string | null;
    updatedById: string;
  } = { updatedById: session.user.id };

  if (parsed.data.title !== undefined) data.title = parsed.data.title;
  if (parsed.data.description !== undefined) data.description = parsed.data.description || null;
  if (parsed.data.allowComments !== undefined) data.allowComments = parsed.data.allowComments;

  if (parsed.data.visibility !== undefined) {
    const visibility = parsed.data.visibility;
    data.visibility = visibility;

    if (visibility === "PASSWORD") {
      if (parsed.data.password?.trim()) {
        data.passwordHash = await bcrypt.hash(parsed.data.password, 12);
      } else if (existing.visibility !== "PASSWORD" || !existing.passwordHash) {
        return NextResponse.json({ error: "Ingresá una contraseña de acceso" }, { status: 400 });
      }
      // otherwise keep the existing passwordHash untouched
    } else {
      data.passwordHash = null;
    }
  }

  if (parsed.data.html !== undefined) {
    const sizeBytes = Buffer.byteLength(parsed.data.html, "utf8");
    if (sizeBytes > MAX_HTML_BYTES) {
      return NextResponse.json(
        { error: `El archivo pesa demasiado (${(sizeBytes / 1024 / 1024).toFixed(1)}MB). Límite: 4MB.` },
        { status: 413 },
      );
    }
    data.html = parsed.data.html;
    data.sizeBytes = sizeBytes;
  }

  if (parsed.data.slug !== undefined) {
    const newSlug = slugify(parsed.data.slug);
    if (!newSlug || !isValidSlug(newSlug)) {
      return NextResponse.json({ error: "Link inválido" }, { status: 400 });
    }
    if (newSlug !== existing.slug) {
      const clash = await prisma.report.findUnique({ where: { slug: newSlug } });
      if (clash) {
        return NextResponse.json({ error: "Ese link ya está en uso por otro reporte" }, { status: 409 });
      }
      data.slug = newSlug;
    }
  }

  const viewerIds = parsed.data.viewerIds;
  const report = await prisma.$transaction(async (tx) => {
    const updated = await tx.report.update({ where: { id }, data });
    if (parsed.data.visibility === "RESTRICTED" && viewerIds !== undefined) {
      await tx.reportViewer.deleteMany({ where: { reportId: id } });
      if (viewerIds.length) {
        await tx.reportViewer.createMany({
          data: viewerIds.map((userId) => ({ reportId: id, userId })),
          skipDuplicates: true,
        });
      }
    } else if (parsed.data.visibility !== undefined && parsed.data.visibility !== "RESTRICTED") {
      await tx.reportViewer.deleteMany({ where: { reportId: id } });
    }
    return updated;
  });

  return NextResponse.json({ id: report.id, slug: report.slug });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { id } = await params;
  const existing = await prisma.report.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Reporte no encontrado" }, { status: 404 });
  }

  await prisma.report.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
