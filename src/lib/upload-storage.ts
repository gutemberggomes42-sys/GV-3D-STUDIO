import { access, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { sanitizeFileName } from "@/lib/pricing";

const runtimeUploadsDirectory = path.join(process.cwd(), "storage", "uploads");
const legacyUploadsDirectory = path.join(process.cwd(), "public", "uploads");

function getSafeUploadFileName(fileName: string) {
  return path.basename(fileName).trim();
}

export async function saveUploadedFile(file: File) {
  await mkdir(runtimeUploadsDirectory, { recursive: true });
  const sanitizedName = `${Date.now()}-${sanitizeFileName(file.name)}`;
  const absolutePath = path.join(runtimeUploadsDirectory, sanitizedName);
  const bytes = await file.arrayBuffer();
  await writeFile(absolutePath, Buffer.from(bytes));
  return `/uploads/${sanitizedName}`;
}

export async function resolveUploadPath(fileName: string) {
  const safeFileName = getSafeUploadFileName(fileName);

  if (!safeFileName || safeFileName !== fileName) {
    return null;
  }

  const candidatePaths = [
    path.join(runtimeUploadsDirectory, safeFileName),
    path.join(legacyUploadsDirectory, safeFileName),
  ];

  for (const candidatePath of candidatePaths) {
    try {
      await access(candidatePath);
      return candidatePath;
    } catch {
      continue;
    }
  }

  return null;
}

export function getUploadContentType(fileName: string) {
  switch (path.extname(fileName).toLowerCase()) {
    case ".png":
      return "image/png";
    case ".jpg":
    case ".jpeg":
      return "image/jpeg";
    case ".webp":
      return "image/webp";
    case ".gif":
      return "image/gif";
    case ".mp4":
    case ".m4v":
      return "video/mp4";
    case ".webm":
      return "video/webm";
    case ".mov":
      return "video/quicktime";
    case ".svg":
      return "image/svg+xml";
    case ".obj":
      return "model/obj";
    case ".stl":
      return "model/stl";
    case ".3mf":
      return "model/3mf";
    default:
      return "application/octet-stream";
  }
}
