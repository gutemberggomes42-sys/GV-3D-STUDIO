import type { DbShowcaseItem, ShowcaseDeliveryMode } from "@/lib/db-types";

export const deliveryModeLabels: Record<ShowcaseDeliveryMode, string> = {
  PICKUP: "Retirada no studio",
  LOCAL_DELIVERY: "Entrega local",
  SHIPPING: "Envio / transportadora",
};

const allowedDeliveryModes: ShowcaseDeliveryMode[] = ["PICKUP", "LOCAL_DELIVERY", "SHIPPING"];
const localCityKeywords = [
  "rio verde",
  "jatai",
  "mineiros",
  "quirinopolis",
  "santa helena",
  "acreuna",
];
const nearStates = new Set(["GO", "DF", "MG", "MT", "MS", "SP", "TO"]);

function normalizeText(value: string | undefined) {
  return (value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

export function sanitizePostalCode(value: string | undefined) {
  return (value ?? "").replace(/\D+/g, "").slice(0, 8);
}

export function normalizeStateCode(value: string | undefined) {
  return (value ?? "")
    .replace(/[^a-z]/gi, "")
    .slice(0, 2)
    .toUpperCase();
}

export function getAvailableDeliveryModes(item: Pick<DbShowcaseItem, "deliveryModes">) {
  return item.deliveryModes?.length ? item.deliveryModes : allowedDeliveryModes;
}

export function getSuggestedCarrier(deliveryMode: ShowcaseDeliveryMode) {
  if (deliveryMode === "PICKUP") {
    return "Retirada GV 3D Studio";
  }

  if (deliveryMode === "LOCAL_DELIVERY") {
    return "Entrega local GV 3D Studio";
  }

  return "Correios / transportadora";
}

export function estimateFreightCost(input: {
  deliveryMode: ShowcaseDeliveryMode;
  quantity: number;
  estimatedMaterialGrams: number;
  estimatedPrintHours: number;
  postalCode?: string;
  city?: string;
  state?: string;
}) {
  const quantity = Math.max(1, Math.round(input.quantity || 1));
  const estimatedMaterialGrams = Math.max(0, input.estimatedMaterialGrams || 0);
  const estimatedPrintHours = Math.max(0, input.estimatedPrintHours || 0);
  const weightKg = Math.max(estimatedMaterialGrams / 1000, 0.12);
  const complexityFactor = Math.max(estimatedPrintHours * 0.65, 0.4);
  const postalCode = sanitizePostalCode(input.postalCode);
  const normalizedCity = normalizeText(input.city);
  const state = normalizeStateCode(input.state);
  const postalRegionDigit = postalCode ? Number(postalCode[0]) : 0;
  const isLocalCity = localCityKeywords.some((entry) => normalizedCity.includes(entry));

  if (input.deliveryMode === "PICKUP") {
    return {
      amount: 0,
      label: "Retirada sem custo",
      carrier: getSuggestedCarrier(input.deliveryMode),
    };
  }

  if (input.deliveryMode === "LOCAL_DELIVERY") {
    const cityFactor = isLocalCity || !normalizedCity ? 0 : 6;
    const postalFactor = postalCode ? Math.min(Number(postalCode.slice(-3)) / 120, 5.5) : 2.5;
    const amount = Number(
      (9 + weightKg * 4.8 + quantity * 1.75 + complexityFactor * 0.9 + cityFactor + postalFactor).toFixed(2),
    );

    return {
      amount,
      label: isLocalCity ? "Entrega local estimada" : "Entrega regional estimada",
      carrier: getSuggestedCarrier(input.deliveryMode),
    };
  }

  const regionalFactor = !state || nearStates.has(state) ? 0 : 8;
  const postalFactor = postalCode ? Math.max(postalRegionDigit - 1, 0) * 1.8 : 3.5;
  const amount = Number(
    (18 + weightKg * 9.8 + quantity * 2.15 + complexityFactor * 1.3 + regionalFactor + postalFactor).toFixed(2),
  );

  return {
    amount,
    label: "Frete estimado para envio",
    carrier: getSuggestedCarrier(input.deliveryMode),
  };
}

export function buildDeliveryAddressSummary(input: {
  deliveryMode?: ShowcaseDeliveryMode;
  address?: string;
  neighborhood?: string;
  city?: string;
  state?: string;
  postalCode?: string;
}) {
  if (!input.deliveryMode) {
    return "Forma de entrega não definida";
  }

  if (input.deliveryMode === "PICKUP") {
    return "Retirada combinada no studio";
  }

  const parts = [
    input.address?.trim(),
    input.neighborhood?.trim(),
    [input.city?.trim(), input.state?.trim()].filter(Boolean).join(" / "),
    sanitizePostalCode(input.postalCode),
  ].filter(Boolean);

  return parts.length ? parts.join(" · ") : "Endereço ainda não informado";
}
