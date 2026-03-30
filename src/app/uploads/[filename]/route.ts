import { readFile } from "node:fs/promises";
import { resolveStoredUpload } from "@/lib/upload-storage";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ filename: string }> },
) {
  const { filename } = await params;
  const upload = await resolveStoredUpload(filename);

  if (!upload) {
    return new Response("Arquivo não encontrado.", { status: 404 });
  }

  const fileBytes =
    upload.kind === "inline"
      ? Uint8Array.from(upload.body)
      : new Uint8Array(await readFile(upload.path));

  return new Response(fileBytes, {
    headers: {
      "Content-Type": upload.contentType,
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
