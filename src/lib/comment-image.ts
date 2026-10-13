import { del, put } from "@vercel/blob";
import { prisma } from "@/lib/prisma";

// Screenshots attached to comments. Anyone with a report link can comment, so
// uploads are checked by what the file really is (its first bytes), never by the
// name or content-type the browser claims.

// The overlay shrinks images in the browser first; this is the hard ceiling
// (Vercel's request body limit is ~4.5MB, and the comment text rides along).
export const MAX_IMAGE_BYTES = 3 * 1024 * 1024;

// Images a single report accepts per hour, so a leaked link can't be used to
// fill the storage.
export const MAX_IMAGES_PER_REPORT_HOUR = 40;

export class CommentImageError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}

export type SniffedImage = { ext: string; type: string };

// PNG, JPEG, GIF and WebP only. SVG is excluded on purpose: it can carry script.
export function sniffImage(bytes: Uint8Array): SniffedImage | null {
  const startsWith = (sig: number[], offset = 0) => sig.every((b, i) => bytes[offset + i] === b);
  if (startsWith([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return { ext: "png", type: "image/png" };
  if (startsWith([0xff, 0xd8, 0xff])) return { ext: "jpg", type: "image/jpeg" };
  if (startsWith([0x47, 0x49, 0x46, 0x38]) && (bytes[4] === 0x37 || bytes[4] === 0x39) && bytes[5] === 0x61) {
    return { ext: "gif", type: "image/gif" };
  }
  // RIFF....WEBP
  if (startsWith([0x52, 0x49, 0x46, 0x46]) && startsWith([0x57, 0x45, 0x42, 0x50], 8)) {
    return { ext: "webp", type: "image/webp" };
  }
  return null;
}

export async function saveCommentImage(reportId: string, file: File): Promise<string> {
  if (file.size > MAX_IMAGE_BYTES) {
    throw new CommentImageError("La imagen pesa demasiado (máximo 3MB).", 413);
  }
  const bytes = new Uint8Array(await file.arrayBuffer());
  const kind = sniffImage(bytes);
  if (!kind) {
    throw new CommentImageError("Solo se pueden adjuntar imágenes PNG, JPG, GIF o WebP.", 415);
  }
  try {
    const stored = await put(`comments/${reportId}/image.${kind.ext}`, Buffer.from(bytes), {
      access: "public",
      contentType: kind.type,
      addRandomSuffix: true,
      // Shortest cache allowed, so a deleted screenshot stops being served within a minute.
      cacheControlMaxAge: 60,
    });
    return stored.url;
  } catch (err) {
    console.error("comment image upload failed", err);
    throw new CommentImageError("No se pudo subir la imagen. Probá de nuevo.", 502);
  }
}

// Only ever touch blobs this feature created.
export function isCommentImageUrl(url: string | null | undefined): url is string {
  if (!url) return false;
  try {
    const u = new URL(url);
    return u.protocol === "https:" && u.hostname.endsWith(".public.blob.vercel-storage.com") && u.pathname.startsWith("/comments/");
  } catch {
    return false;
  }
}

export async function deleteCommentImages(urls: (string | null | undefined)[]): Promise<void> {
  const own = urls.filter(isCommentImageUrl);
  if (!own.length) return;

  // "Replace this image with the attached one" puts the comment's image into the
  // report itself. Deleting that comment (e.g. once it was applied) must not
  // break the report, so images a report still references are kept.
  const doomed: string[] = [];
  for (const url of own) {
    const inUse = await prisma.report.findFirst({ where: { html: { contains: url } }, select: { id: true } });
    if (!inUse) doomed.push(url);
  }
  if (!doomed.length) return;
  await del(doomed).catch((err) => console.error("could not delete comment images", err));
}
