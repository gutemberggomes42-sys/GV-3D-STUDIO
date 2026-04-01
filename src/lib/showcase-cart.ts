export type ShowcaseCartEntry = {
  key: string;
  itemId: string;
  quantity: number;
  selectedVariantId?: string;
  desiredColor?: string;
  desiredSize?: string;
  desiredFinish?: string;
  couponCode?: string;
};

export type ShowcaseCartEntryInput = Omit<ShowcaseCartEntry, "key">;

export const showcaseCartStorageKey = "printflow-showcase-cart";
export const showcaseCartUpdatedEvent = "printflow-cart-updated";

function sanitizeValue(value?: string) {
  const sanitized = value?.trim();
  return sanitized ? sanitized : undefined;
}

function normalizeQuantity(value: number) {
  if (!Number.isFinite(value)) {
    return 1;
  }

  return Math.max(1, Math.min(999, Math.round(value)));
}

export function getShowcaseCartEntryKey(entry: ShowcaseCartEntryInput) {
  return [
    entry.itemId.trim(),
    sanitizeValue(entry.selectedVariantId) ?? "",
    sanitizeValue(entry.desiredColor) ?? "",
    sanitizeValue(entry.desiredSize) ?? "",
    sanitizeValue(entry.desiredFinish) ?? "",
    sanitizeValue(entry.couponCode) ?? "",
  ].join("::");
}

function normalizeEntry(entry: Partial<ShowcaseCartEntryInput>): ShowcaseCartEntry | null {
  const itemId = entry.itemId?.trim();

  if (!itemId) {
    return null;
  }

  const normalizedInput: ShowcaseCartEntryInput = {
    itemId,
    quantity: normalizeQuantity(Number(entry.quantity ?? 1)),
    selectedVariantId: sanitizeValue(entry.selectedVariantId),
    desiredColor: sanitizeValue(entry.desiredColor),
    desiredSize: sanitizeValue(entry.desiredSize),
    desiredFinish: sanitizeValue(entry.desiredFinish),
    couponCode: sanitizeValue(entry.couponCode),
  };

  return {
    ...normalizedInput,
    key: getShowcaseCartEntryKey(normalizedInput),
  };
}

function emitCartUpdated() {
  if (typeof window === "undefined") {
    return;
  }

  window.dispatchEvent(new CustomEvent(showcaseCartUpdatedEvent));
}

export function readShowcaseCart() {
  if (typeof window === "undefined") {
    return [] as ShowcaseCartEntry[];
  }

  try {
    const parsed = JSON.parse(window.localStorage.getItem(showcaseCartStorageKey) ?? "[]");

    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.flatMap((entry) => {
      if (!entry || typeof entry !== "object") {
        return [];
      }

      const normalized = normalizeEntry(entry as Partial<ShowcaseCartEntryInput>);
      return normalized ? [normalized] : [];
    });
  } catch {
    return [];
  }
}

export function writeShowcaseCart(entries: ShowcaseCartEntry[]) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(showcaseCartStorageKey, JSON.stringify(entries));
  emitCartUpdated();
}

export function addShowcaseCartEntry(entry: ShowcaseCartEntryInput) {
  const normalized = normalizeEntry(entry);

  if (!normalized) {
    return [];
  }

  const currentEntries = readShowcaseCart();
  const existingEntry = currentEntries.find((currentEntry) => currentEntry.key === normalized.key);

  if (existingEntry) {
    const nextEntries = currentEntries.map((currentEntry) =>
      currentEntry.key === normalized.key
        ? {
            ...currentEntry,
            quantity: normalizeQuantity(currentEntry.quantity + normalized.quantity),
          }
        : currentEntry,
    );

    writeShowcaseCart(nextEntries);
    return nextEntries;
  }

  const nextEntries = [...currentEntries, normalized];
  writeShowcaseCart(nextEntries);
  return nextEntries;
}

export function updateShowcaseCartEntryQuantity(entryKey: string, quantity: number) {
  const normalizedQuantity = normalizeQuantity(quantity);
  const nextEntries = readShowcaseCart().map((entry) =>
    entry.key === entryKey
      ? {
          ...entry,
          quantity: normalizedQuantity,
        }
      : entry,
  );

  writeShowcaseCart(nextEntries);
  return nextEntries;
}

export function removeShowcaseCartEntry(entryKey: string) {
  const nextEntries = readShowcaseCart().filter((entry) => entry.key !== entryKey);
  writeShowcaseCart(nextEntries);
  return nextEntries;
}

export function clearShowcaseCart() {
  writeShowcaseCart([]);
}

export function getShowcaseCartCount(entries = readShowcaseCart()) {
  return entries.reduce((total, entry) => total + normalizeQuantity(entry.quantity), 0);
}
