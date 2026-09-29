import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { NextResponse } from "next/server";
import { auth } from "@/auth";

const MAX_ZIP_BYTES = 300 * 1024 * 1024; // 300MB

export async function POST(request: Request): Promise<NextResponse> {
  const body = (await request.json()) as HandleUploadBody;

  try {
    const jsonResponse = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async () => {
        const session = await auth();
        if (!session?.user?.id) {
          throw new Error("No autorizado");
        }
        return {
          allowedContentTypes: [
            "application/zip",
            "application/x-zip-compressed",
            "application/octet-stream",
            "multipart/x-zip",
          ],
          addRandomSuffix: true,
          maximumSizeInBytes: MAX_ZIP_BYTES,
          tokenPayload: JSON.stringify({ userId: session.user.id }),
        };
      },
      onUploadCompleted: async () => {
        // The client calls /api/reports/from-zip itself right after upload()
        // resolves, so there's nothing to do here.
      },
    });

    return NextResponse.json(jsonResponse);
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 400 });
  }
}
