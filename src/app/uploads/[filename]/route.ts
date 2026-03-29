import { readFile } from "node:fs/promises";
import { getUploadContentType, resolveUploadPath } from "@/lib/upload-storage";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ filename: string }> },
) {
  const { filename } = await params;
  const uploadPath = await resolveUploadPath(filename);

  if (!uploadPath) {
    return new Response("Arquivo não encontrado.", { status: 404 });
  }

  const fileBuffer = await readFile(uploadPath);

  return new Response(fileBuffer, {
    headers: {
      "Content-Type": getUploadContentType(filename),
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
