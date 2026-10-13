import { MAX_IMAGE_BYTES, isCommentImageUrl, sniffImage } from "@/lib/comment-image";

// Screenshots attached to comments, fetched so Claude can actually look at them.

// Each image costs tokens (roughly width*height/750), so cap how many go in one request.
export const MAX_AI_IMAGES = 8;
const FETCH_TIMEOUT_MS = 10_000;

export type ImageRef = { commentId: string; url: string | null | undefined };

export type LoadedImage = {
  commentId: string;
  url: string;
  mediaType: "image/png" | "image/jpeg" | "image/gif" | "image/webp";
  data: string; // base64
};

export type LoadedImages = {
  images: LoadedImage[];
  // Referenced by a comment but not shown to Claude (limit reached, deleted, unreadable...).
  unavailable: number;
};

// Only URLs of blobs this app created are ever fetched (never a URL taken from
// a comment's text), and what comes back must really be an image.
export async function loadCommentImages(refs: ImageRef[]): Promise<LoadedImages> {
  const wanted = refs.filter((r): r is { commentId: string; url: string } => isCommentImageUrl(r.url));
  const seen = new Set<string>();
  const unique = wanted.filter((r) => (seen.has(r.url) ? false : (seen.add(r.url), true)));

  const slice = unique.slice(0, MAX_AI_IMAGES);
  let unavailable = unique.length - slice.length;

  const results = await Promise.all(
    slice.map(async (ref): Promise<LoadedImage | null> => {
      try {
        const res = await fetch(ref.url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
        if (!res.ok) return null;
        const bytes = new Uint8Array(await res.arrayBuffer());
        if (bytes.length === 0 || bytes.length > MAX_IMAGE_BYTES) return null;
        const kind = sniffImage(bytes);
        if (!kind) return null;
        return {
          commentId: ref.commentId,
          url: ref.url,
          mediaType: kind.type as LoadedImage["mediaType"],
          data: Buffer.from(bytes).toString("base64"),
        };
      } catch {
        return null;
      }
    }),
  );

  const images = results.filter((r): r is LoadedImage => r !== null);
  unavailable += results.length - images.length;
  return { images, unavailable };
}
