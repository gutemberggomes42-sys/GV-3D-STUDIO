import type {
  DbStorefrontCampaignBanner,
  DbStorefrontGalleryCard,
  DbStorefrontReelCard,
  DbShowcaseItem,
  DbShowcaseVariant,
  ShowcaseDeliveryMode,
} from "@/lib/db-types";
import { studioCollectionName } from "@/lib/branding";

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

function lineEntries(value: FormDataEntryValue | FormDataEntryValue[] | null | undefined) {
  const rawValues = Array.isArray(value) ? value : value ? [value] : [];

  return rawValues.flatMap((entry) =>
    entry
      .toString()
      .split(/\r?\n/)
      .map((chunk) => chunk.trim())
      .filter(Boolean),
  );
}

function normalizeOptionalDate(value: string | undefined) {
  const trimmed = value?.trim();

  if (!trimmed) {
    return undefined;
  }

  const parsed = new Date(trimmed);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed.toISOString();
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

export function parseStorefrontCampaignField(
  value: FormDataEntryValue | FormDataEntryValue[] | null | undefined,
) {
  return lineEntries(value).flatMap((line, index): DbStorefrontCampaignBanner[] => {
    const [badge, title, subtitle, startsAt, endsAt, ctaLabel, ctaHref] = line
      .split("|")
      .map((entry) => entry.trim());

    if (!title || !subtitle) {
      return [];
    }

    return [
      {
        id: `campaign-${index + 1}-${normalizeShowcaseSearchText(title).replace(/\s+/g, "-") || "banner"}`,
        badge: badge || undefined,
        title,
        subtitle,
        startsAt: normalizeOptionalDate(startsAt),
        endsAt: normalizeOptionalDate(endsAt),
        ctaLabel: ctaLabel || undefined,
        ctaHref: ctaHref || undefined,
      },
    ];
  });
}

export function serializeStorefrontCampaigns(campaigns: DbStorefrontCampaignBanner[] | undefined) {
  return (campaigns ?? [])
    .map((campaign) =>
      [
        campaign.badge ?? "",
        campaign.title,
        campaign.subtitle,
        campaign.startsAt ? campaign.startsAt.slice(0, 10) : "",
        campaign.endsAt ? campaign.endsAt.slice(0, 10) : "",
        campaign.ctaLabel ?? "",
        campaign.ctaHref ?? "",
      ].join(" | "),
    )
    .join("\n");
}

export function parseStorefrontGalleryField(
  value: FormDataEntryValue | FormDataEntryValue[] | null | undefined,
) {
  return lineEntries(value).flatMap((line, index): DbStorefrontGalleryCard[] => {
    const [title, imageUrl, linkUrl] = line.split("|").map((entry) => entry.trim());

    if (!title || !imageUrl) {
      return [];
    }

    return [
      {
        id: `gallery-${index + 1}-${normalizeShowcaseSearchText(title).replace(/\s+/g, "-") || "item"}`,
        title,
        imageUrl,
        linkUrl: linkUrl || undefined,
      },
    ];
  });
}

export function serializeStorefrontGallery(cards: DbStorefrontGalleryCard[] | undefined) {
  return (cards ?? [])
    .map((card) => [card.title, card.imageUrl, card.linkUrl ?? ""].join(" | "))
    .join("\n");
}

export function parseStorefrontReelsField(
  value: FormDataEntryValue | FormDataEntryValue[] | null | undefined,
) {
  return lineEntries(value).flatMap((line, index): DbStorefrontReelCard[] => {
    const [title, reelUrl, thumbnailUrl, caption] = line.split("|").map((entry) => entry.trim());

    if (!title || !reelUrl) {
      return [];
    }

    return [
      {
        id: `reel-${index + 1}-${normalizeShowcaseSearchText(title).replace(/\s+/g, "-") || "video"}`,
        title,
        reelUrl,
        thumbnailUrl: thumbnailUrl || undefined,
        caption: caption || undefined,
      },
    ];
  });
}

export function serializeStorefrontReels(reels: DbStorefrontReelCard[] | undefined) {
  return (reels ?? [])
    .map((reel) => [reel.title, reel.reelUrl, reel.thumbnailUrl ?? "", reel.caption ?? ""].join(" | "))
    .join("\n");
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
  return item.category?.trim() || studioCollectionName;
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

export function getActiveStorefrontCampaigns(
  campaigns: DbStorefrontCampaignBanner[] | undefined,
  now = new Date(),
) {
  const nowTime = now.getTime();

  return (campaigns ?? []).filter((campaign) => {
    const startsAt = campaign.startsAt ? new Date(campaign.startsAt).getTime() : undefined;
    const endsAt = campaign.endsAt ? new Date(campaign.endsAt).getTime() : undefined;

    if (startsAt != null && !Number.isNaN(startsAt) && startsAt > nowTime) {
      return false;
    }

    if (endsAt != null && !Number.isNaN(endsAt)) {
      const inclusiveEnd = endsAt + 24 * 60 * 60 * 1000 - 1;
      if (inclusiveEnd < nowTime) {
        return false;
      }
    }

    return true;
  });
}
