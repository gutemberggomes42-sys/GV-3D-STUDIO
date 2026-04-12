import { readFile } from "node:fs/promises";
import { resolveShowcaseFilesystemAsset } from "@/lib/showcase-filesystem";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ segments: string[] }> },
) {
  const { segments } = await params;
  const asset = await resolveShowcaseFilesystemAsset(segments ?? []);

  if (!asset) {
    return new Response("Arquivo não encontrado.", { status: 404 });
  }

  const fileBytes = new Uint8Array(await readFile(asset.absolutePath));

  return new Response(fileBytes, {
    headers: {
      "Content-Type": asset.contentType,
      "Cache-Control": "public, max-age=60",
    },
  });
}
