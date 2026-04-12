/* eslint-disable @next/next/no-img-element */
"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Loader2, MessageCircleMore, Minus, Plus, ShoppingBag, Trash2 } from "lucide-react";
import type { DbShowcaseItem, ShowcaseDeliveryMode } from "@/lib/db-types";
import {
  clearShowcaseCart,
  readShowcaseCart,
  removeShowcaseCartEntry,
  showcaseCartUpdatedEvent,
  type ShowcaseCartEntry,
  updateShowcaseCartEntryQuantity,
} from "@/lib/showcase-cart";
import { getShowcasePrimaryImage, isShowcaseItemVisible } from "@/lib/showcase";
import { deliveryModeLabels, estimateFreightCost, getAvailableDeliveryModes } from "@/lib/shipping";

type ShowcaseCartViewProps = {
  items: DbShowcaseItem[];
};

type CartLine = {
  entry: ShowcaseCartEntry;
  item?: DbShowcaseItem;
  availableQuantity: number;
  statusMessage?: string;
};

function getAvailableQuantity(item: DbShowcaseItem, selectedVariantId?: string) {
  if (item.fulfillmentType !== "STOCK") {
    return 999;
  }

  const selectedVariant = item.variants.find(
    (variant) => variant.id === selectedVariantId && variant.active,
  );
  const variantStock = selectedVariant?.stockQuantity;

  if (variantStock == null) {
    return Math.max(item.stockQuantity, 0);
  }

  return Math.max(Math.min(item.stockQuantity, variantStock), 0);
}

function buildCartLines(entries: ShowcaseCartEntry[], items: DbShowcaseItem[]): CartLine[] {
  return entries.map((entry) => {
    const item = items.find(
      (candidate) => candidate.id === entry.itemId && isShowcaseItemVisible(candidate),
    );

    if (!item) {
      return {
        entry,
        item: undefined,
        availableQuantity: 0,
        statusMessage: "Esse item nao esta mais disponivel na vitrine.",
      };
    }

    const couponDiscount =
      entry.couponCode &&
      item.couponCode &&
      entry.couponCode.toLowerCase() === item.couponCode.toLowerCase()
        ? item.couponDiscountPercent ?? 0
        : 0;
    const availableQuantity = getAvailableQuantity(item, entry.selectedVariantId);

    let statusMessage: string | undefined;
    if (item.fulfillmentType === "STOCK" && availableQuantity <= 0) {
      statusMessage = "Sem estoque no momento.";
    } else if (item.fulfillmentType === "STOCK" && entry.quantity > availableQuantity) {
      statusMessage = `Ajuste a quantidade. Estoque atual: ${availableQuantity}.`;
    }

    return {
      entry,
      item,
      availableQuantity,
      statusMessage:
        statusMessage ??
        (couponDiscount
          ? `Cupom ${entry.couponCode} será considerado no atendimento.`
          : undefined),
    };
  });
}

export function ShowcaseCartView({ items }: ShowcaseCartViewProps) {
  const [cartEntries, setCartEntries] = useState<ShowcaseCartEntry[]>([]);
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [deliveryMode, setDeliveryMode] = useState<ShowcaseDeliveryMode>("PICKUP");
  const [deliveryPostalCode, setDeliveryPostalCode] = useState("");
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [deliveryNeighborhood, setDeliveryNeighborhood] = useState("");
  const [deliveryCity, setDeliveryCity] = useState("");
  const [deliveryState, setDeliveryState] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const syncCart = () => {
      setCartEntries(readShowcaseCart());
    };

    syncCart();
    window.addEventListener("storage", syncCart);
    window.addEventListener(showcaseCartUpdatedEvent, syncCart as EventListener);

    return () => {
      window.removeEventListener("storage", syncCart);
      window.removeEventListener(showcaseCartUpdatedEvent, syncCart as EventListener);
    };
  }, []);

  const cartLines = useMemo(() => buildCartLines(cartEntries, items), [cartEntries, items]);
  const totalMaterialGrams = useMemo(
    () =>
      cartLines.reduce(
        (total, line) => total + ((line.item?.estimatedMaterialGrams ?? 0) * line.entry.quantity),
        0,
      ),
    [cartLines],
  );
  const totalPrintHours = useMemo(
    () =>
      cartLines.reduce(
        (total, line) => total + ((line.item?.estimatedPrintHours ?? 0) * line.entry.quantity),
        0,
      ),
    [cartLines],
  );
  const availableDeliveryModes = useMemo<ShowcaseDeliveryMode[]>(() => {
    const activeItems = cartLines.map((line) => line.item).filter(Boolean) as DbShowcaseItem[];

    if (!activeItems.length) {
      return ["PICKUP"] as ShowcaseDeliveryMode[];
    }

    const sharedModes = (["PICKUP", "LOCAL_DELIVERY", "SHIPPING"] as ShowcaseDeliveryMode[]).filter((mode) =>
      activeItems.every((item) => getAvailableDeliveryModes(item).includes(mode)),
    );

    return sharedModes.length ? sharedModes : ["PICKUP"];
  }, [cartLines]);
  const freight = useMemo(
    () =>
      estimateFreightCost({
        deliveryMode,
        quantity: cartEntries.reduce((total, entry) => total + entry.quantity, 0),
        estimatedMaterialGrams: totalMaterialGrams,
        estimatedPrintHours: totalPrintHours,
        postalCode: deliveryPostalCode,
        city: deliveryCity,
        state: deliveryState,
      }),
    [cartEntries, deliveryCity, deliveryMode, deliveryPostalCode, deliveryState, totalMaterialGrams, totalPrintHours],
  );
  const hasInvalidItems = cartLines.some((line) => line.statusMessage);

  useEffect(() => {
    if (!availableDeliveryModes.includes(deliveryMode)) {
      setDeliveryMode(availableDeliveryModes[0] ?? "PICKUP");
    }
  }, [availableDeliveryModes, deliveryMode]);

  function refreshCart() {
    setCartEntries(readShowcaseCart());
  }

  async function handleCheckout(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setMessage("");

    try {
      const formData = new FormData();
      formData.set("customerName", customerName);
      formData.set("customerPhone", customerPhone);
      formData.set("notes", notes);
      formData.set("deliveryMode", deliveryMode);
      formData.set("deliveryPostalCode", deliveryPostalCode);
      formData.set("deliveryAddress", deliveryAddress);
      formData.set("deliveryNeighborhood", deliveryNeighborhood);
      formData.set("deliveryCity", deliveryCity);
      formData.set("deliveryState", deliveryState);
      formData.set("cartJson", JSON.stringify(cartEntries));

      const response = await fetch("/carrinho/enviar", {
        method: "POST",
        body: formData,
      });
      const payload = (await response.json()) as { ok?: boolean; message?: string; url?: string };

      if (!response.ok || !payload.ok || !payload.url) {
        setMessage(payload.message ?? "Nao foi possivel enviar o carrinho para o WhatsApp.");
        return;
      }

      clearShowcaseCart();
      window.location.href = payload.url;
    } catch {
      setMessage("Nao foi possivel enviar o carrinho para o WhatsApp.");
    } finally {
      setSubmitting(false);
    }
  }

  if (!cartEntries.length) {
    return (
      <section className="rounded-[26px] border border-dashed border-white/15 bg-slate-950/50 p-6 text-center sm:rounded-[30px] sm:p-8">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full border border-white/10 bg-white/5">
          <ShoppingBag className="h-6 w-6 text-white/70" />
        </div>
        <h3 className="mt-5 text-2xl font-semibold">Seu carrinho esta vazio</h3>
        <p className="mt-3 text-sm leading-7 text-white/65">
          Adicione algumas pecas da vitrine para reunir tudo em uma unica mensagem no WhatsApp.
        </p>
        <Link
          href="/"
          className="mt-6 inline-flex items-center justify-center rounded-2xl bg-emerald-400 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-emerald-300"
        >
          Voltar para a vitrine
        </Link>
      </section>
    );
  }

  return (
    <section className="grid gap-5 xl:grid-cols-[1.15fr_0.85fr] xl:gap-6">
      <div className="space-y-4">
        {cartLines.map((line) => (
          <article
            key={line.entry.key}
            className="overflow-hidden rounded-[24px] border border-white/10 bg-white/[0.04] sm:rounded-[28px]"
          >
            <div className="grid gap-0 sm:grid-cols-[160px_minmax(0,1fr)] md:grid-cols-[180px_minmax(0,1fr)]">
              <div className="h-full min-h-[180px] border-b border-white/10 sm:border-b-0 sm:border-r">
                {line.item && getShowcasePrimaryImage(line.item) ? (
                  <img
                    src={getShowcasePrimaryImage(line.item)}
                    alt={line.item.name}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="h-full min-h-[180px] bg-[radial-gradient(circle_at_top_left,_rgba(255,122,24,0.35),_transparent_28%),radial-gradient(circle_at_bottom_right,_rgba(89,185,255,0.22),_transparent_32%),linear-gradient(135deg,_rgba(255,255,255,0.08),_rgba(15,23,42,0.95))]" />
                )}
              </div>

              <div className="space-y-4 p-4 sm:p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-xs uppercase tracking-[0.18em] text-white/45">
                      {line.item?.category ?? "Item indisponivel"}
                    </p>
                    <h3 className="mt-2 text-xl font-semibold sm:text-2xl">
                      {line.item?.name ?? "Produto removido da vitrine"}
                    </h3>
                    <p className="mt-2 text-sm text-white/62">
                      {line.item?.tagline ?? line.item?.description ?? "Esse item nao pode mais ser comprado pela vitrine."}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      removeShowcaseCartEntry(line.entry.key);
                      refreshCart();
                    }}
                    className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-sm font-semibold text-white/70 transition hover:bg-white/10 hover:text-white"
                  >
                    <Trash2 className="h-4 w-4" />
                    Remover
                  </button>
                </div>

                <div className="flex flex-wrap gap-2 text-sm text-white/75">
                  {line.entry.selectedVariantId && line.item?.variants.find((variant) => variant.id === line.entry.selectedVariantId)?.label ? (
                    <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">
                      Variacao: {line.item.variants.find((variant) => variant.id === line.entry.selectedVariantId)?.label}
                    </span>
                  ) : null}
                  {line.entry.desiredColor ? (
                    <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">
                      Cor: {line.entry.desiredColor}
                    </span>
                  ) : null}
                  {line.entry.desiredSize ? (
                    <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">
                      Tamanho: {line.entry.desiredSize}
                    </span>
                  ) : null}
                  {line.entry.desiredFinish ? (
                    <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">
                      Acabamento: {line.entry.desiredFinish}
                    </span>
                  ) : null}
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <p className="text-xs uppercase tracking-[0.18em] text-white/45">Quantidade</p>
                    <div className="mt-2 inline-flex items-center rounded-2xl border border-white/10 bg-black/25">
                      <button
                        type="button"
                        onClick={() => {
                          updateShowcaseCartEntryQuantity(line.entry.key, line.entry.quantity - 1);
                          refreshCart();
                        }}
                        className="px-3 py-3 text-white/75 transition hover:text-white"
                      >
                        <Minus className="h-4 w-4" />
                      </button>
                      <span className="min-w-12 text-center text-sm font-semibold">{line.entry.quantity}</span>
                      <button
                        type="button"
                        onClick={() => {
                          const maxQuantity =
                            line.item?.fulfillmentType === "STOCK"
                              ? Math.max(line.availableQuantity, 1)
                              : 999;
                          updateShowcaseCartEntryQuantity(
                            line.entry.key,
                            Math.min(line.entry.quantity + 1, maxQuantity),
                          );
                          refreshCart();
                        }}
                        className="px-3 py-3 text-white/75 transition hover:text-white"
                      >
                        <Plus className="h-4 w-4" />
                      </button>
                    </div>
                    {line.item?.fulfillmentType === "STOCK" ? (
                      <p className="mt-2 text-xs text-white/45">Estoque atual: {line.availableQuantity}</p>
                    ) : (
                      <p className="mt-2 text-xs text-white/45">Sob encomenda</p>
                    )}
                  </div>

                  <div>
                    <p className="text-xs uppercase tracking-[0.18em] text-white/45">Status da escolha</p>
                    <p className="mt-3 text-base font-semibold text-white/88">
                      {line.item?.fulfillmentType === "STOCK" ? "Biblioteca pronta para pedido" : "Biblioteca sob encomenda"}
                    </p>
                    <p className="mt-2 text-sm text-white/60">
                      Os valores serão confirmados no atendimento.
                    </p>
                  </div>
                </div>

                {line.statusMessage ? (
                  <div className="rounded-2xl border border-amber-400/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-50">
                    {line.statusMessage}
                  </div>
                ) : null}
              </div>
            </div>
          </article>
        ))}
      </div>

      <aside className="rounded-[26px] border border-white/10 bg-white/[0.04] p-5 sm:rounded-[30px] sm:p-6 xl:sticky xl:top-4">
        <p className="text-xs uppercase tracking-[0.24em] text-white/45">Finalizar pelo WhatsApp</p>
        <h3 className="mt-3 text-2xl font-semibold sm:text-3xl">Reunir tudo em uma unica mensagem</h3>
        <p className="mt-3 text-sm leading-7 text-white/68">
          Informe seus dados e o sistema abre o WhatsApp com todos os itens do carrinho de uma vez.
        </p>

        <div className="mt-6 rounded-[22px] border border-white/10 bg-slate-950/50 p-4 sm:rounded-[26px] sm:p-5">
          <p className="text-xs uppercase tracking-[0.18em] text-white/45">Resumo da biblioteca</p>
          <div className="mt-4 space-y-3 text-sm text-white/72">
            <div className="flex items-center justify-between gap-4">
              <span>Itens no carrinho</span>
              <strong className="text-white">{cartEntries.length}</strong>
            </div>
            <div className="flex items-center justify-between gap-4">
              <span>Forma de entrega</span>
              <strong className="text-white">{deliveryModeLabels[deliveryMode]}</strong>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-white/68">
              Valores e frete serão confirmados no atendimento. {freight.label}
            </div>
          </div>
        </div>

        <form onSubmit={handleCheckout} className="mt-6 space-y-4">
          <label className="block text-sm text-white/70">
            Nome
            <input
              value={customerName}
              onChange={(event) => setCustomerName(event.target.value)}
              className="mt-2 w-full rounded-2xl border border-white/10 bg-black/35 px-4 py-3 text-white outline-none focus:border-orange-400/60"
            />
          </label>

          <label className="block text-sm text-white/70">
            Telefone / WhatsApp
            <input
              value={customerPhone}
              onChange={(event) => setCustomerPhone(event.target.value)}
              className="mt-2 w-full rounded-2xl border border-white/10 bg-black/35 px-4 py-3 text-white outline-none focus:border-orange-400/60"
            />
          </label>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-sm text-white/70">
              Forma de entrega
              <select
                value={deliveryMode}
                onChange={(event) => setDeliveryMode(event.target.value as ShowcaseDeliveryMode)}
                className="mt-2 w-full rounded-2xl border border-white/10 bg-black/35 px-4 py-3 text-white outline-none focus:border-orange-400/60"
              >
                {availableDeliveryModes.map((mode) => (
                  <option key={mode} value={mode}>
                    {deliveryModeLabels[mode]}
                  </option>
                ))}
              </select>
            </label>

            <label className="block text-sm text-white/70">
              CEP
              <input
                value={deliveryPostalCode}
                onChange={(event) => setDeliveryPostalCode(event.target.value)}
                placeholder="75900-000"
                className="mt-2 w-full rounded-2xl border border-white/10 bg-black/35 px-4 py-3 text-white outline-none focus:border-orange-400/60"
              />
            </label>
          </div>

          {deliveryMode !== "PICKUP" ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block text-sm text-white/70 sm:col-span-2">
                Endereço
                <input
                  value={deliveryAddress}
                  onChange={(event) => setDeliveryAddress(event.target.value)}
                  placeholder="Rua, número, complemento"
                  className="mt-2 w-full rounded-2xl border border-white/10 bg-black/35 px-4 py-3 text-white outline-none focus:border-orange-400/60"
                />
              </label>

              <label className="block text-sm text-white/70">
                Bairro
                <input
                  value={deliveryNeighborhood}
                  onChange={(event) => setDeliveryNeighborhood(event.target.value)}
                  placeholder="Bairro"
                  className="mt-2 w-full rounded-2xl border border-white/10 bg-black/35 px-4 py-3 text-white outline-none focus:border-orange-400/60"
                />
              </label>

              <label className="block text-sm text-white/70">
                Cidade
                <input
                  value={deliveryCity}
                  onChange={(event) => setDeliveryCity(event.target.value)}
                  placeholder="Cidade"
                  className="mt-2 w-full rounded-2xl border border-white/10 bg-black/35 px-4 py-3 text-white outline-none focus:border-orange-400/60"
                />
              </label>

              <label className="block text-sm text-white/70">
                UF
                <input
                  value={deliveryState}
                  onChange={(event) => setDeliveryState(event.target.value.toUpperCase().slice(0, 2))}
                  placeholder="GO"
                  className="mt-2 w-full rounded-2xl border border-white/10 bg-black/35 px-4 py-3 uppercase text-white outline-none focus:border-orange-400/60"
                />
              </label>
            </div>
          ) : null}

          <label className="block text-sm text-white/70">
            Observacao geral
            <textarea
              rows={4}
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              placeholder="Ex.: preciso para presente, posso retirar em maos, quero outra cor em um dos itens..."
              className="mt-2 w-full rounded-2xl border border-white/10 bg-black/35 px-4 py-3 text-white outline-none focus:border-orange-400/60"
            />
          </label>

          {message ? (
            <div className="rounded-2xl border border-amber-400/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-50">
              {message}
            </div>
          ) : null}

          <div className="grid gap-3">
            <button
              type="submit"
              disabled={submitting || hasInvalidItems || !cartEntries.length}
              className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-400 px-5 py-4 text-sm font-semibold text-slate-950 transition hover:bg-emerald-300 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-white/55"
            >
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <MessageCircleMore className="h-4 w-4" />}
              Enviar carrinho para o WhatsApp
            </button>

            <button
              type="button"
              onClick={() => {
                clearShowcaseCart();
                refreshCart();
              }}
              className="inline-flex w-full items-center justify-center rounded-2xl border border-white/10 bg-white/5 px-5 py-4 text-sm font-semibold text-white/78 transition hover:bg-white/10 hover:text-white"
            >
              Limpar carrinho
            </button>
          </div>
        </form>
      </aside>
    </section>
  );
}
