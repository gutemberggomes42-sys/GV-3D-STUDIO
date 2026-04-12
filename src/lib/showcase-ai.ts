import "server-only";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import OpenAI from "openai";
import type { DbShowcaseItem } from "@/lib/db-types";
import { resolveShowcaseFilesystemAsset } from "@/lib/showcase-filesystem";
import { readDb, updateDb } from "@/lib/store";
import { resolveStoredUpload } from "@/lib/upload-storage";

type ResolvedPreviewImage =
  | {
      kind: "data_url";
      value: string;
      signature: string;
    }
  | {
      kind: "url";
      value: string;
      signature: string;
    };

const showcaseAiModel = process.env.PRINTFLOW_SHOWCASE_AI_MODEL?.trim() || "gpt-5.4-mini";
const showcaseAiWaitTimeoutMs = 8000;
const inFlightPreviewGenerations = new Map<string, Promise<string | null>>();

let openAiClient: OpenAI | null | undefined;

function getOpenAiClient() {
  if (openAiClient !== undefined) {
    return openAiClient;
  }

  const apiKey = process.env.OPENAI_API_KEY?.trim();
  openAiClient = apiKey ? new OpenAI({ apiKey }) : null;
  return openAiClient;
}

function getPrimaryShowcaseImageUrl(item: Pick<DbShowcaseItem, "imageUrl" | "galleryImageUrls">) {
  return item.imageUrl ?? item.galleryImageUrls[0] ?? undefined;
}

async function createDataUrlFromBuffer(buffer: Buffer, contentType: string) {
  const signature = createHash("sha1").update(buffer).digest("hex");
  return {
    kind: "data_url" as const,
    value: `data:${contentType};base64,${buffer.toString("base64")}`,
    signature,
  };
}

async function resolveFilesystemPreviewImage(imageUrl: string) {
  const relativePath = imageUrl.replace(/^\/biblioteca-arquivos\//, "");
  const segments = relativePath
    .split("/")
    .map((segment) => decodeURIComponent(segment))
    .filter(Boolean);
  const asset = await resolveShowcaseFilesystemAsset(segments);

  if (!asset) {
    return null;
  }

  const bytes = await readFile(asset.absolutePath);
  return createDataUrlFromBuffer(bytes, asset.contentType);
}

async function resolveUploadedPreviewImage(imageUrl: string) {
  const fileName = decodeURIComponent(path.basename(imageUrl));
  const upload = await resolveStoredUpload(fileName);

  if (!upload) {
    return null;
  }

  if (upload.kind === "inline") {
    return createDataUrlFromBuffer(upload.body, upload.contentType);
  }

  const bytes = await readFile(upload.path);
  return createDataUrlFromBuffer(bytes, upload.contentType);
}

async function resolvePreviewImage(imageUrl: string): Promise<ResolvedPreviewImage | null> {
  if (!imageUrl.trim()) {
    return null;
  }

  if (imageUrl.startsWith("/biblioteca-arquivos/")) {
    return resolveFilesystemPreviewImage(imageUrl);
  }

  if (imageUrl.startsWith("/uploads/")) {
    return resolveUploadedPreviewImage(imageUrl);
  }

  if (/^https?:\/\//i.test(imageUrl)) {
    return {
      kind: "url",
      value: imageUrl,
      signature: imageUrl,
    };
  }

  return null;
}

function buildPreviewPrompt(item: Pick<DbShowcaseItem, "name" | "category">) {
  return [
    `Analise a foto principal da peça "${item.name}" da categoria "${item.category}".`,
    "Escreva um preview em português do Brasil com 2 ou 3 frases curtas, tom elegante e comercial.",
    "Descreva o visual da peça, a composição, a pose, o impacto decorativo ou colecionável e o que mais chama atenção.",
    "Não invente material, acabamento, prazo, preço, peso ou medidas exatas.",
    "Se houver marca d'água, texto técnico ou régua na foto, ignore isso no texto final.",
    "Não diga que está olhando uma imagem e não mencione o nome do arquivo.",
  ].join(" ");
}

async function generatePreviewWithAi(
  item: Pick<DbShowcaseItem, "name" | "category">,
  image: ResolvedPreviewImage,
) {
  const client = getOpenAiClient();

  if (!client) {
    return null;
  }

  const response = await client.responses.create({
    model: showcaseAiModel,
    input: [
      {
        role: "user",
        content: [
          {
            type: "input_text",
            text: buildPreviewPrompt(item),
          },
          {
            type: "input_image",
            image_url: image.value,
            detail: "auto",
          },
        ],
      },
    ],
    max_output_tokens: 220,
  });

  const previewText = response.output_text.replace(/\s+/g, " ").trim();
  return previewText || null;
}

function shouldUseCachedPreview(item: DbShowcaseItem, imageSignature: string) {
  return (
    Boolean(item.aiPreviewDescription?.trim()) &&
    item.aiPreviewImageSignature === imageSignature
  );
}

async function waitForPreviewResult(generationPromise: Promise<string | null>) {
  return Promise.race<string | null>([
    generationPromise,
    new Promise<string | null>((resolve) => {
      setTimeout(() => resolve(null), showcaseAiWaitTimeoutMs);
    }),
  ]);
}

export async function getShowcaseAiPreview(itemId: string) {
  const db = await readDb();
  const item = db.showcaseItems.find((candidate) => candidate.id === itemId);

  if (!item) {
    return null;
  }

  const primaryImageUrl = getPrimaryShowcaseImageUrl(item);

  if (!primaryImageUrl) {
    return null;
  }

  const resolvedImage = await resolvePreviewImage(primaryImageUrl);

  if (!resolvedImage) {
    return null;
  }

  if (shouldUseCachedPreview(item, resolvedImage.signature)) {
    return item.aiPreviewDescription ?? null;
  }

  const inFlightKey = `${item.id}:${resolvedImage.signature}`;
  const inFlightGeneration = inFlightPreviewGenerations.get(inFlightKey);

  if (inFlightGeneration) {
    return waitForPreviewResult(inFlightGeneration);
  }

  const generationPromise = (async () => {
    try {
      const generatedPreview = await generatePreviewWithAi(item, resolvedImage);

      if (!generatedPreview) {
        return null;
      }

      await updateDb((mutableDb) => {
        const mutableItem = mutableDb.showcaseItems.find((candidate) => candidate.id === item.id);

        if (!mutableItem) {
          return;
        }

        mutableItem.aiPreviewDescription = generatedPreview;
        mutableItem.aiPreviewGeneratedAt = new Date().toISOString();
        mutableItem.aiPreviewImageSignature = resolvedImage.signature;
      });

      return generatedPreview;
    } catch (error) {
      console.error("[showcase-ai] Falha ao gerar preview com IA:", error);
      return null;
    } finally {
      inFlightPreviewGenerations.delete(inFlightKey);
    }
  })();

  inFlightPreviewGenerations.set(inFlightKey, generationPromise);
  return waitForPreviewResult(generationPromise);
}
