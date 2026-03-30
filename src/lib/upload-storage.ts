import { access, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { sanitizeFileName } from "@/lib/pricing";

const runtimeUploadsDirectory = path.join(process.cwd(), "storage", "uploads");
const legacyUploadsDirectory = path.join(process.cwd(), "public", "uploads");

function getSafeUploadFileName(fileName: string) {
  return path.basename(fileName).trim();
}

function getStorageProvider() {
  return (process.env.PRINTFLOW_STORAGE_PROVIDER?.trim().toLowerCase() || "local") as "local" | "s3";
}

function encodeObjectKey(objectKey: string) {
  return objectKey
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
}

function getS3Config() {
  const bucket = process.env.PRINTFLOW_S3_BUCKET?.trim();
  const region = process.env.PRINTFLOW_S3_REGION?.trim() || "us-east-1";
  const accessKeyId = process.env.PRINTFLOW_S3_ACCESS_KEY_ID?.trim();
  const secretAccessKey = process.env.PRINTFLOW_S3_SECRET_ACCESS_KEY?.trim();
  const endpoint = process.env.PRINTFLOW_S3_ENDPOINT?.trim();
  const publicBaseUrl = process.env.PRINTFLOW_S3_PUBLIC_BASE_URL?.trim();
  const prefix = process.env.PRINTFLOW_S3_PREFIX?.trim().replace(/^\/+|\/+$/g, "") || "";
  const forcePathStyle = process.env.PRINTFLOW_S3_FORCE_PATH_STYLE?.trim() === "true";

  if (!bucket || !accessKeyId || !secretAccessKey) {
    throw new Error("Configure PRINTFLOW_S3_BUCKET, PRINTFLOW_S3_ACCESS_KEY_ID e PRINTFLOW_S3_SECRET_ACCESS_KEY.");
  }

  return {
    bucket,
    region,
    accessKeyId,
    secretAccessKey,
    endpoint,
    publicBaseUrl,
    prefix,
    forcePathStyle,
  };
}

let s3Client: S3Client | null = null;

function getS3Client() {
  const config = getS3Config();

  if (!s3Client) {
    s3Client = new S3Client({
      region: config.region,
      endpoint: config.endpoint || undefined,
      forcePathStyle: config.forcePathStyle,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
    });
  }

  return s3Client;
}

function buildS3ObjectKey(fileName: string) {
  const sanitizedName = `${Date.now()}-${sanitizeFileName(fileName)}`;
  const { prefix } = getS3Config();
  return prefix ? `${prefix}/${sanitizedName}` : sanitizedName;
}

function buildS3PublicUrl(objectKey: string) {
  const config = getS3Config();

  if (config.publicBaseUrl) {
    return `${config.publicBaseUrl.replace(/\/+$/g, "")}/${encodeObjectKey(objectKey)}`;
  }

  if (config.endpoint) {
    const normalizedEndpoint = config.endpoint.replace(/\/+$/g, "");
    if (config.forcePathStyle) {
      return `${normalizedEndpoint}/${config.bucket}/${encodeObjectKey(objectKey)}`;
    }

    try {
      const endpointUrl = new URL(normalizedEndpoint);
      return `${endpointUrl.protocol}//${config.bucket}.${endpointUrl.host}/${encodeObjectKey(objectKey)}`;
    } catch {
      throw new Error("Configure PRINTFLOW_S3_PUBLIC_BASE_URL para publicar uploads com endpoint customizado.");
    }
  }

  return `https://${config.bucket}.s3.${config.region}.amazonaws.com/${encodeObjectKey(objectKey)}`;
}

async function saveUploadedFileLocally(file: File) {
  await mkdir(runtimeUploadsDirectory, { recursive: true });
  const sanitizedName = `${Date.now()}-${sanitizeFileName(file.name)}`;
  const absolutePath = path.join(runtimeUploadsDirectory, sanitizedName);
  const bytes = await file.arrayBuffer();
  await writeFile(absolutePath, Buffer.from(bytes));
  return `/uploads/${sanitizedName}`;
}

async function saveUploadedFileToS3(file: File) {
  const client = getS3Client();
  const config = getS3Config();
  const objectKey = buildS3ObjectKey(file.name);
  const bytes = await file.arrayBuffer();

  await client.send(
    new PutObjectCommand({
      Bucket: config.bucket,
      Key: objectKey,
      Body: Buffer.from(bytes),
      ContentType: file.type || undefined,
    }),
  );

  return buildS3PublicUrl(objectKey);
}

export async function saveUploadedFile(file: File) {
  if (getStorageProvider() === "s3") {
    return saveUploadedFileToS3(file);
  }

  return saveUploadedFileLocally(file);
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
