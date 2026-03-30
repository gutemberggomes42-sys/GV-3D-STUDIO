import type { DbShowcaseItem } from "@/lib/db-types";

export const showcaseCategorySuggestions = [
  "Geek",
  "Decoracao",
  "Organizacao",
  "Utilidades",
  "Colecionaveis",
  "Games",
  "Casa",
  "Presentes",
];

function uniqueList(values: Array<string | undefined | null>) {
  return Array.from(
    new Set(
      values
        .map((value) => value?.trim())
        .filter((value): value is string => Boolean(value)),
    ),
  );
}

export function parseShowcaseListField(value: FormDataEntryValue | FormDataEntryValue[] | null | undefined) {
  const rawValues = Array.isArray(value) ? value : value ? [value] : [];

  return uniqueList(
    rawValues.flatMap((entry) =>
      entry
        .toString()
        .split(/\r?\n|,/)
        .map((chunk) => chunk.trim()),
    ),
  );
}

export function serializeShowcaseList(values: string[] | undefined) {
  return (values ?? []).join("\n");
}

export function getShowcasePrimaryImage(item: Pick<DbShowcaseItem, "imageUrl" | "galleryImageUrls">) {
  return item.imageUrl ?? item.galleryImageUrls[0] ?? undefined;
}

export function getShowcasePrimaryVideo(item: Pick<DbShowcaseItem, "videoUrl">) {
  return item.videoUrl ?? undefined;
}

export function getShowcaseGallery(item: Pick<DbShowcaseItem, "imageUrl" | "galleryImageUrls">) {
  return uniqueList([item.imageUrl, ...(item.galleryImageUrls ?? [])]);
}

export function getShowcaseDescriptionPreview(description: string, maxLength = 140) {
  const normalized = description.replace(/\s+/g, " ").trim();

  if (normalized.length <= maxLength) {
    return normalized;
  }

  return `${normalized.slice(0, maxLength).trimEnd()}...`;
}

export function getShowcaseTagline(item: Pick<DbShowcaseItem, "tagline" | "description">) {
  return item.tagline?.trim() || getShowcaseDescriptionPreview(item.description, 88);
}

export function getShowcaseCategoryLabel(item: Pick<DbShowcaseItem, "category">) {
  return item.category?.trim() || "Colecao PrintFlow";
}

export function getShowcaseAvailabilityLabel(item: Pick<DbShowcaseItem, "fulfillmentType" | "stockQuantity">) {
  if (item.fulfillmentType === "MADE_TO_ORDER") {
    return "Sob encomenda";
  }

  if (item.stockQuantity <= 0) {
    return "Sem estoque";
  }

  if (item.stockQuantity <= 2) {
    return `Ultimas ${item.stockQuantity} unidades`;
  }

  return `${item.stockQuantity} em estoque`;
}

export function getShowcaseLeadTimeLabel(item: Pick<DbShowcaseItem, "fulfillmentType" | "leadTimeDays">) {
  if (item.fulfillmentType === "STOCK") {
    return "Pronta entrega";
  }

  if (!item.leadTimeDays) {
    return "Prazo sob consulta";
  }

  if (item.leadTimeDays === 1) {
    return "1 dia util";
  }

  return `${item.leadTimeDays} dias uteis`;
}

export function getShowcaseCategoryOptions(items: Array<Pick<DbShowcaseItem, "category">>) {
  return uniqueList(items.map((item) => item.category)).sort((a, b) => a.localeCompare(b, "pt-BR"));
}

export function getShowcaseColorSummary(item: Pick<DbShowcaseItem, "colorOptions">) {
  if (!item.colorOptions.length) {
    return "Cores sob consulta";
  }

  if (item.colorOptions.length <= 3) {
    return item.colorOptions.join(", ");
  }

  return `${item.colorOptions.slice(0, 3).join(", ")} +${item.colorOptions.length - 3}`;
}
