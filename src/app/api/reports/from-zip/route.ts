import { NextResponse } from "next/server";
import { put, del } from "@vercel/blob";
import JSZip from "jszip";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { isValidSlug, slugify } from "@/lib/slug";

export const maxDuration = 300;

const MAX_ZIP_BYTES = 300 * 1024 * 1024; // 300MB
const MAX_HTML_TEXT_BYTES = 4 * 1024 * 1024; // the entry document itself stays a normal-sized page
const MAX_TOTAL_ASSET_BYTES = 500 * 1024 * 1024; // 500MB of photos/video per report
const MAX_FILES = 500;

const ALLOWED_EXT: Record<string, string> = {
  html: "text/html",
  htm: "text/html",
  css: "text/css",
  js: "text/javascript",
  mjs: "text/javascript",
  json: "application/json",
  map: "application/json",
  txt: "text/plain",
  xml: "application/xml",
  webmanifest: "application/manifest+json",
  csv: "text/csv",
  md: "text/markdown",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  svg: "image/svg+xml",
  webp: "image/webp",
  avif: "image/avif",
  ico: "image/x-icon",
  bmp: "image/bmp",
  woff: "font/woff",
  woff2: "font/woff2",
  ttf: "font/ttf",
  otf: "font/otf",
  eot: "application/vnd.ms-fontobject",
  mp4: "video/mp4",
  webm: "video/webm",
  mov: "video/quicktime",
  m4v: "video/x-m4v",
  ogg: "video/ogg",
  mp3: "audio/mpeg",
  wav: "audio/wav",
  m4a: "audio/mp4",
  pdf: "application/pdf",
};

const schema = z.object({
  blobUrl: z.string().url(),
  title: z.string().trim().min(1, "El título es obligatorio").max(200),
  slug: z.string().trim().optional(),
  description: z.string().trim().max(500).optional(),
  allowComments: z.boolean().optional(),
  visibility: z.enum(["PUBLIC", "PASSWORD", "RESTRICTED"]).optional(),
  password: z.string().max(200).optional(),
  viewerIds: z.array(z.string()).optional(),
});

function pathIsSafe(name: string): boolean {
  const parts = name.split("/");
  return parts.every((p) => p !== "" && p !== "." && p !== ".." && p !== "__MACOSX" && !p.startsWith("."));
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Datos inválidos" },
      { status: 400 },
    );
  }

  const { blobUrl, title, description, allowComments, viewerIds } = parsed.data;
  const visibility = parsed.data.visibility ?? "PUBLIC";
  if (visibility === "PASSWORD" && !parsed.data.password?.trim()) {
    return NextResponse.json({ error: "Ingresá una contraseña de acceso" }, { status: 400 });
  }

  let zipBuffer: ArrayBuffer;
  try {
    const zipRes = await fetch(blobUrl);
    if (!zipRes.ok) throw new Error("No se pudo descargar el archivo subido");
    zipBuffer = await zipRes.arrayBuffer();
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message || "No se pudo leer el ZIP" }, { status: 400 });
  } finally {
    del(blobUrl).catch(() => {});
  }

  if (zipBuffer.byteLength > MAX_ZIP_BYTES) {
    return NextResponse.json(
      { error: `El ZIP pesa demasiado (límite ${MAX_ZIP_BYTES / 1024 / 1024}MB)` },
      { status: 413 },
    );
  }

  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(zipBuffer);
  } catch {
    return NextResponse.json({ error: "No se pudo abrir el ZIP. ¿Está dañado?" }, { status: 400 });
  }

  type Entry = { name: string; ext: string; contentType: string; file: JSZip.JSZipObject };
  const entries: Entry[] = [];
  zip.forEach((relPath, file) => {
    if (file.dir) return;
    const name = relPath.replace(/\\/g, "/");
    if (!pathIsSafe(name)) return;
    const ext = name.split(".").pop()?.toLowerCase() ?? "";
    const contentType = ALLOWED_EXT[ext];
    if (!contentType) return; // silently skip disallowed file types
    entries.push({ name, ext, contentType, file });
  });

  if (!entries.length) {
    return NextResponse.json({ error: "El ZIP no trae archivos web válidos" }, { status: 400 });
  }
  if (entries.length > MAX_FILES) {
    return NextResponse.json(
      { error: `El ZIP tiene demasiados archivos (máximo ${MAX_FILES})` },
      { status: 400 },
    );
  }

  // Find the entry document: the shallowest index.html/index.htm, else the
  // one lone .html file in the archive.
  let entryPath: string | null = null;
  let bestDepth = Infinity;
  for (const e of entries) {
    const base = e.name.split("/").pop()!.toLowerCase();
    if (base === "index.html" || base === "index.htm") {
      const depth = e.name.split("/").length;
      if (depth < bestDepth) {
        bestDepth = depth;
        entryPath = e.name;
      }
    }
  }
  if (!entryPath) {
    const htmls = entries.filter((e) => e.ext === "html" || e.ext === "htm");
    if (htmls.length === 1) {
      entryPath = htmls[0].name;
    } else if (htmls.length > 1) {
      return NextResponse.json(
        { error: "El ZIP tiene varios HTML y ninguno se llama index.html" },
        { status: 400 },
      );
    } else {
      return NextResponse.json({ error: "El ZIP no trae ningún archivo .html" }, { status: 400 });
    }
  }

  const root = entryPath.includes("/") ? entryPath.slice(0, entryPath.lastIndexOf("/") + 1) : "";
  const entryEntry = entries.find((e) => e.name === entryPath)!;
  const htmlText = await entryEntry.file.async("string");
  const htmlBytes = Buffer.byteLength(htmlText, "utf8");
  if (htmlBytes > MAX_HTML_TEXT_BYTES) {
    return NextResponse.json({ error: "El HTML principal del ZIP pesa demasiado" }, { status: 413 });
  }

  let slug = parsed.data.slug ? slugify(parsed.data.slug) : slugify(title);
  if (!slug || !isValidSlug(slug)) {
    return NextResponse.json(
      { error: "No se pudo generar un link válido para ese título" },
      { status: 400 },
    );
  }
  const existing = await prisma.report.findUnique({ where: { slug } });
  if (existing) {
    slug = `${slug}-${Math.random().toString(36).slice(2, 7)}`;
  }

  const passwordHash =
    visibility === "PASSWORD" && parsed.data.password
      ? await bcrypt.hash(parsed.data.password, 12)
      : null;

  const assetUploads: { path: string; blobUrl: string; contentType: string; sizeBytes: number }[] = [];
  let totalAssetBytes = 0;

  async function cleanupUploaded() {
    if (assetUploads.length) {
      await del(assetUploads.map((a) => a.blobUrl)).catch(() => {});
    }
  }

  try {
    for (const e of entries) {
      if (e.name === entryPath) continue;
      if (root && !e.name.startsWith(root)) continue; // only assets that live alongside the entry document
      const relPath = root ? e.name.slice(root.length) : e.name;
      if (!relPath) continue;

      const buf = await e.file.async("nodebuffer");
      totalAssetBytes += buf.byteLength;
      if (totalAssetBytes > MAX_TOTAL_ASSET_BYTES) {
        await cleanupUploaded();
        return NextResponse.json(
          { error: `Los archivos del ZIP pesan demasiado en total (límite ${MAX_TOTAL_ASSET_BYTES / 1024 / 1024}MB)` },
          { status: 413 },
        );
      }

      const stored = await put(`reports/${slug}/${relPath}`, buf, {
        access: "public",
        contentType: e.contentType,
        addRandomSuffix: true,
      });

      assetUploads.push({
        path: relPath,
        blobUrl: stored.url,
        contentType: e.contentType,
        sizeBytes: buf.byteLength,
      });
    }
  } catch {
    await cleanupUploaded();
    return NextResponse.json({ error: "No se pudieron guardar los archivos del ZIP" }, { status: 500 });
  }

  try {
    const report = await prisma.report.create({
      data: {
        title,
        slug,
        description: description || null,
        html: htmlText,
        sizeBytes: htmlBytes + totalAssetBytes,
        allowComments: allowComments ?? false,
        visibility,
        passwordHash,
        createdById: session.user.id,
        allowedViewers:
          visibility === "RESTRICTED" && viewerIds?.length
            ? { create: viewerIds.map((userId) => ({ userId })) }
            : undefined,
        assets: assetUploads.length ? { create: assetUploads } : undefined,
      },
    });

    return NextResponse.json({ id: report.id, slug: report.slug });
  } catch {
    await cleanupUploaded();
    return NextResponse.json({ error: "No se pudo crear el reporte" }, { status: 500 });
  }
}
