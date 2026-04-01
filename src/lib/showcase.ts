import type {
  DbShowcaseItem,
  DbShowcaseVariant,
  ShowcaseDeliveryMode,
} from "@/lib/db-types";

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

export const showcaseBadgeSuggestions = [
  "Novo",
  "Mais vendido",
  "Exclusivo",
  "Poucas unidades",
  "Destaque",
  "Feito por encomenda",
];

export const showcaseDeliveryModeLabels: Record<ShowcaseDeliveryMode, string> = {
  PICKUP: "Retirada",
  LOCAL_DELIVERY: "Entrega local",
  SHIPPING: "Envio",
};

const showcaseColorPalette = [
  { keywords: ["preto", "black", "grafite", "carbon"], hex: "#111827" },
  { keywords: ["branco", "white", "perola"], hex: "#f8fafc" },
  { keywords: ["cinza", "gray", "grey", "prata", "silver"], hex: "#94a3b8" },
  { keywords: ["dourado", "gold"], hex: "#d4a72c" },
  { keywords: ["amarelo", "yellow"], hex: "#facc15" },
  { keywords: ["laranja", "orange", "cobre", "copper"], hex: "#f97316" },
  { keywords: ["vermelho", "red", "vinho", "bordo"], hex: "#dc2626" },
  { keywords: ["rosa", "pink", "magenta"], hex: "#ec4899" },
  { keywords: ["roxo", "purple", "lilas", "violeta"], hex: "#8b5cf6" },
  { keywords: ["azul marinho", "navy"], hex: "#1e3a8a" },
  { keywords: ["azul", "blue", "ciano", "cyan", "turquesa"], hex: "#0ea5e9" },
  { keywords: ["verde", "green", "olive", "oliva"], hex: "#22c55e" },
  { keywords: ["marrom", "brown", "chocolate"], hex: "#7c3f00" },
  { keywords: ["bege", "areia", "creme", "nude"], hex: "#d6b48a" },
  { keywords: ["transparente", "cristal", "clear"], hex: "#dbeafe" },
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

function normalizeColorLabel(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

export function normalizeShowcaseSearchText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^\w\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
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

export function parseShowcaseVariantField(
  value: FormDataEntryValue | FormDataEntryValue[] | null | undefined,
) {
  const rawValues = Array.isArray(value) ? value : value ? [value] : [];
  const lines = rawValues.flatMap((entry) =>
    entry
      .toString()
      .split(/\r?\n/)
      .map((chunk) => chunk.trim())
      .filter(Boolean),
  );

  return lines.flatMap((line, index): DbShowcaseVariant[] => {
    const [label, color, size, finish, priceAdjustment, stockQuantity, galleryUrls] = line
      .split("|")
      .map((entry) => entry.trim());

    if (!label) {
      return [];
    }

    const parsedPriceAdjustment = Number(priceAdjustment ?? "0");
    const parsedStockQuantity = Number(stockQuantity ?? "");

    return [
      {
        id: `var-${index + 1}-${label.toLowerCase().replace(/\s+/g, "-")}`,
        label,
        color: color || undefined,
        size: size || undefined,
        finish: finish || undefined,
        priceAdjustment: Number.isFinite(parsedPriceAdjustment) ? parsedPriceAdjustment : 0,
        stockQuantity: Number.isFinite(parsedStockQuantity) ? Math.max(0, Math.round(parsedStockQuantity)) : undefined,
        galleryImageUrls: galleryUrls
          ? galleryUrls
              .split(",")
              .map((entry) => entry.trim())
              .filter(Boolean)
          : [],
        active: true,
      },
    ];
  });
}

export function serializeShowcaseVariants(variants: DbShowcaseVariant[] | undefined) {
  return (variants ?? [])
    .map((variant) =>
      [
        variant.label,
        variant.color ?? "",
        variant.size ?? "",
        variant.finish ?? "",
        variant.priceAdjustment || "",
        variant.stockQuantity ?? "",
        (variant.galleryImageUrls ?? []).join(", "),
      ].join(" | "),
    )
    .join("\n");
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

export function getShowcaseVariantGallery(item: Pick<DbShowcaseItem, "variants">) {
  return uniqueList(
    (item.variants ?? []).flatMap((variant) => variant.galleryImageUrls ?? []),
  );
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

export function getShowcaseDeliverySummary(item: Pick<DbShowcaseItem, "deliveryModes" | "shippingSummary">) {
  const deliveryLabels = (item.deliveryModes ?? [])
    .map((mode) => showcaseDeliveryModeLabels[mode])
    .filter(Boolean);

  if (item.shippingSummary?.trim()) {
    return item.shippingSummary.trim();
  }

  if (!deliveryLabels.length) {
    return "Entrega sob consulta";
  }

  return deliveryLabels.join(" • ");
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

export function getShowcaseColorHex(colorLabel: string) {
  const normalized = normalizeColorLabel(colorLabel);
  const match = showcaseColorPalette.find((entry) =>
    entry.keywords.some((keyword) => normalized.includes(keyword)),
  );

  return match?.hex ?? "#64748b";
}

export function getShowcaseLowestPrice(item: Pick<DbShowcaseItem, "price" | "variants">) {
  const variantPrices = (item.variants ?? [])
    .filter((variant) => variant.active)
    .map((variant) => item.price + (variant.priceAdjustment ?? 0));

  return variantPrices.length ? Math.min(item.price, ...variantPrices) : item.price;
}

export function getShowcaseHighestPrice(item: Pick<DbShowcaseItem, "price" | "variants">) {
  const variantPrices = (item.variants ?? [])
    .filter((variant) => variant.active)
    .map((variant) => item.price + (variant.priceAdjustment ?? 0));

  return variantPrices.length ? Math.max(item.price, ...variantPrices) : item.price;
}
