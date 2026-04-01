"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { MessageCircleMore, ShoppingCart } from "lucide-react";
import type { DbShowcaseItem } from "@/lib/db-types";
import { addShowcaseCartEntry } from "@/lib/showcase-cart";

type ShowcaseProductPurchasePanelProps = {
  item: DbShowcaseItem;
  buyLabel: string;
};

function sanitizeQueryValue(value?: string) {
  const sanitized = value?.trim();
  return sanitized ? sanitized : undefined;
}

function clampQuantity(value: string, maxQuantity: number) {
  const parsed = Number(value);

  if (!Number.isFinite(parsed)) {
    return 1;
  }

  return Math.max(1, Math.min(maxQuantity, Math.round(parsed)));
}

export function ShowcaseProductPurchasePanel({
  item,
  buyLabel,
}: ShowcaseProductPurchasePanelProps) {
  const router = useRouter();
  const variantOptions = item.variants.filter((variant) => variant.active);
  const [quantity, setQuantity] = useState("1");
  const [notes, setNotes] = useState("");
  const [selectedVariantId, setSelectedVariantId] = useState(variantOptions[0]?.id ?? "");
  const [desiredColor, setDesiredColor] = useState(item.colorOptions[0] ?? "");
  const [desiredSize, setDesiredSize] = useState(item.sizeOptions[0] ?? "");
  const [desiredFinish, setDesiredFinish] = useState(item.finishOptions[0] ?? "");
  const [feedbackMessage, setFeedbackMessage] = useState("");

  const selectedVariant = useMemo(
    () => variantOptions.find((variant) => variant.id === selectedVariantId),
    [selectedVariantId, variantOptions],
  );

  const availableQuantity = useMemo(() => {
    if (item.fulfillmentType !== "STOCK") {
      return 999;
    }

    const variantStock = selectedVariant?.stockQuantity;

    if (variantStock == null) {
      return Math.max(item.stockQuantity, 0);
    }

    return Math.max(Math.min(item.stockQuantity, variantStock), 0);
  }, [item.fulfillmentType, item.stockQuantity, selectedVariant]);

  const isDisabled = item.fulfillmentType === "STOCK" && availableQuantity <= 0;
  const safeQuantity = String(clampQuantity(quantity, Math.max(availableQuantity, 1)));

  function buildBuyUrl() {
    const params = new URLSearchParams();
    params.set("quantity", String(clampQuantity(quantity, Math.max(availableQuantity, 1))));

    const sanitizedNotes = sanitizeQueryValue(notes);
    const sanitizedVariantId = sanitizeQueryValue(selectedVariantId);
    const sanitizedColor = sanitizeQueryValue(desiredColor);
    const sanitizedSize = sanitizeQueryValue(desiredSize);
    const sanitizedFinish = sanitizeQueryValue(desiredFinish);

    if (sanitizedNotes) {
      params.set("notes", sanitizedNotes);
    }
    if (sanitizedVariantId) {
      params.set("selectedVariantId", sanitizedVariantId);
    }
    if (sanitizedColor) {
      params.set("desiredColor", sanitizedColor);
    }
    if (sanitizedSize) {
      params.set("desiredSize", sanitizedSize);
    }
    if (sanitizedFinish) {
      params.set("desiredFinish", sanitizedFinish);
    }
    if (item.couponCode) {
      params.set("couponCode", item.couponCode);
    }

    return `/comprar/${item.id}?${params.toString()}`;
  }

  function handleAddToCart() {
    if (isDisabled) {
      return;
    }

    addShowcaseCartEntry({
      itemId: item.id,
      quantity: clampQuantity(quantity, Math.max(availableQuantity, 1)),
      selectedVariantId: sanitizeQueryValue(selectedVariantId),
      desiredColor: sanitizeQueryValue(desiredColor),
      desiredSize: sanitizeQueryValue(desiredSize),
      desiredFinish: sanitizeQueryValue(desiredFinish),
      couponCode: item.couponCode ? item.couponCode : undefined,
    });

    setFeedbackMessage("Produto adicionado ao carrinho.");
    window.setTimeout(() => setFeedbackMessage(""), 2400);
  }

  function handleBuyNow() {
    if (isDisabled) {
      return;
    }

    router.push(buildBuyUrl());
  }

  return (
    <div className="mt-5 space-y-4">
      <div className="grid gap-3 sm:grid-cols-[140px_minmax(0,1fr)]">
        <label className="block text-sm text-white/70">
          Quantidade
          <input
            name="quantity"
            type="number"
            min="1"
            max={Math.max(availableQuantity, 1)}
            value={safeQuantity}
            onChange={(event) => setQuantity(event.target.value)}
            className="mt-2 w-full rounded-2xl border border-white/10 bg-black/35 px-4 py-3 text-white outline-none focus:border-orange-400/60"
          />
        </label>
        <label className="block text-sm text-white/70">
          Observacao opcional
          <textarea
            name="notes"
            rows={3}
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            placeholder="Ex.: Quero em outra cor, preciso para presente, retirar pessoalmente..."
            className="mt-2 w-full rounded-2xl border border-white/10 bg-black/35 px-4 py-3 text-white outline-none focus:border-orange-400/60"
          />
        </label>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {variantOptions.length ? (
          <label className="block text-sm text-white/70">
            Variacao
            <select
              value={selectedVariantId}
              onChange={(event) => setSelectedVariantId(event.target.value)}
              className="mt-2 w-full rounded-2xl border border-white/10 bg-black/35 px-4 py-3 text-white outline-none focus:border-orange-400/60"
            >
              {variantOptions.map((variant) => (
                <option key={variant.id} value={variant.id}>
                  {variant.label}
                </option>
              ))}
            </select>
          </label>
        ) : null}

        {item.colorOptions.length ? (
          <label className="block text-sm text-white/70">
            Cor desejada
            <select
              value={desiredColor}
              onChange={(event) => setDesiredColor(event.target.value)}
              className="mt-2 w-full rounded-2xl border border-white/10 bg-black/35 px-4 py-3 text-white outline-none focus:border-orange-400/60"
            >
              {item.colorOptions.map((color) => (
                <option key={color} value={color}>
                  {color}
                </option>
              ))}
            </select>
          </label>
        ) : null}

        {item.sizeOptions.length ? (
          <label className="block text-sm text-white/70">
            Tamanho
            <select
              value={desiredSize}
              onChange={(event) => setDesiredSize(event.target.value)}
              className="mt-2 w-full rounded-2xl border border-white/10 bg-black/35 px-4 py-3 text-white outline-none focus:border-orange-400/60"
            >
              {item.sizeOptions.map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
          </label>
        ) : null}

        {item.finishOptions.length ? (
          <label className="block text-sm text-white/70">
            Acabamento
            <select
              value={desiredFinish}
              onChange={(event) => setDesiredFinish(event.target.value)}
              className="mt-2 w-full rounded-2xl border border-white/10 bg-black/35 px-4 py-3 text-white outline-none focus:border-orange-400/60"
            >
              {item.finishOptions.map((finish) => (
                <option key={finish} value={finish}>
                  {finish}
                </option>
              ))}
            </select>
          </label>
        ) : null}
      </div>

      {feedbackMessage ? (
        <div className="rounded-2xl border border-cyan-400/20 bg-cyan-500/10 px-4 py-3 text-sm text-cyan-50">
          {feedbackMessage}
        </div>
      ) : null}

      <div className="rounded-[24px] border border-white/10 bg-black/20 p-3 sm:border-0 sm:bg-transparent sm:p-0">
        <div className="mb-3 flex items-center justify-between gap-3 text-xs uppercase tracking-[0.18em] text-white/45 sm:hidden">
          <span>Finalizar compra</span>
          <span>{safeQuantity} item(s)</span>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
        <button
          type="button"
          onClick={handleAddToCart}
          disabled={isDisabled}
          className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-5 py-4 text-sm font-semibold text-white transition hover:bg-white/10 disabled:cursor-not-allowed disabled:bg-slate-800/60 disabled:text-white/45"
        >
          <ShoppingCart className="h-4 w-4" />
          Adicionar ao carrinho
        </button>
        <button
          type="button"
          onClick={handleBuyNow}
          disabled={isDisabled}
          className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-400 px-5 py-4 text-sm font-semibold text-slate-950 transition hover:bg-emerald-300 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-white/55"
        >
          <MessageCircleMore className="h-4 w-4" />
          {buyLabel}
        </button>
        </div>
      </div>
    </div>
  );
}
