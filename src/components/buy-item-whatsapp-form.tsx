"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { ShowcaseDeliveryMode } from "@/lib/db-types";
import { deliveryModeLabels, estimateFreightCost } from "@/lib/shipping";

type BuyItemWhatsAppFormProps = {
  itemId: string;
  itemName: string;
  quantity: number;
  estimatedMaterialGrams: number;
  estimatedPrintHours: number;
  message?: string | null;
  requestedNotes?: string;
  selectedVariantId?: string;
  desiredColor?: string;
  desiredSize?: string;
  desiredFinish?: string;
  couponCode?: string;
  availableDeliveryModes: ShowcaseDeliveryMode[];
  initialDeliveryMode?: ShowcaseDeliveryMode;
  initialDeliveryPostalCode?: string;
  initialDeliveryAddress?: string;
  initialDeliveryNeighborhood?: string;
  initialDeliveryCity?: string;
  initialDeliveryState?: string;
};

export function BuyItemWhatsAppForm({
  itemId,
  itemName,
  quantity,
  estimatedMaterialGrams,
  estimatedPrintHours,
  message,
  requestedNotes = "",
  selectedVariantId = "",
  desiredColor = "",
  desiredSize = "",
  desiredFinish = "",
  couponCode = "",
  availableDeliveryModes,
  initialDeliveryMode,
  initialDeliveryPostalCode = "",
  initialDeliveryAddress = "",
  initialDeliveryNeighborhood = "",
  initialDeliveryCity = "",
  initialDeliveryState = "",
}: BuyItemWhatsAppFormProps) {
  const [deliveryMode, setDeliveryMode] = useState<ShowcaseDeliveryMode>(
    initialDeliveryMode ?? availableDeliveryModes[0] ?? "PICKUP",
  );
  const [deliveryPostalCode, setDeliveryPostalCode] = useState(initialDeliveryPostalCode);
  const [deliveryAddress, setDeliveryAddress] = useState(initialDeliveryAddress);
  const [deliveryNeighborhood, setDeliveryNeighborhood] = useState(initialDeliveryNeighborhood);
  const [deliveryCity, setDeliveryCity] = useState(initialDeliveryCity);
  const [deliveryState, setDeliveryState] = useState(initialDeliveryState);

  const freight = useMemo(
    () =>
      estimateFreightCost({
        deliveryMode,
        quantity,
        estimatedMaterialGrams,
        estimatedPrintHours,
        postalCode: deliveryPostalCode,
        city: deliveryCity,
        state: deliveryState,
      }),
    [deliveryCity, deliveryMode, deliveryPostalCode, deliveryState, estimatedMaterialGrams, estimatedPrintHours, quantity],
  );
  return (
    <form
      action={`/comprar/${itemId}/enviar`}
      method="post"
      className="space-y-4 rounded-[28px] border border-white/10 bg-white/5 p-6"
    >
      <input type="hidden" name="quantity" value={String(quantity)} />
      <input type="hidden" name="selectedVariantId" value={selectedVariantId} />
      <input type="hidden" name="desiredColor" value={desiredColor} />
      <input type="hidden" name="desiredSize" value={desiredSize} />
      <input type="hidden" name="desiredFinish" value={desiredFinish} />
      <input type="hidden" name="couponCode" value={couponCode} />

      <div>
        <p className="text-xs uppercase tracking-[0.24em] text-white/45">Dados para contato</p>
        <h3 className="mt-2 text-2xl font-semibold">Preencha e envie para o WhatsApp</h3>
        <p className="mt-2 text-sm leading-6 text-white/65">
          O sistema salva sua escolha no admin e abre a conversa pronta para você confirmar os detalhes com a loja.
        </p>
      </div>

      <div className="rounded-[24px] border border-white/10 bg-black/25 p-4">
        <p className="text-xs uppercase tracking-[0.18em] text-white/45">Resumo da escolha</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div className="rounded-[20px] border border-white/10 bg-white/[0.03] px-4 py-3">
            <p className="text-[11px] uppercase tracking-[0.18em] text-white/45">Peça</p>
            <p className="mt-2 text-sm font-semibold text-white/86">{itemName}</p>
          </div>
          <div className="rounded-[20px] border border-white/10 bg-white/[0.03] px-4 py-3">
            <p className="text-[11px] uppercase tracking-[0.18em] text-white/45">Quantidade</p>
            <p className="mt-2 text-sm font-semibold text-white/86">{quantity}</p>
          </div>
          <div className="rounded-[20px] border border-white/10 bg-white/[0.03] px-4 py-3 sm:col-span-2">
            <p className="text-[11px] uppercase tracking-[0.18em] text-white/45">Forma de entrega</p>
            <p className="mt-2 text-sm font-semibold text-white/86">{deliveryModeLabels[deliveryMode]}</p>
            <p className="mt-2 text-xs uppercase tracking-[0.18em] text-white/45">{freight.label}</p>
          </div>
        </div>
      </div>

      <label className="block text-sm text-white/70">
        Nome
        <input
          name="customerName"
          defaultValue=""
          className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 outline-none focus:border-emerald-400/60"
          placeholder="Seu nome"
        />
      </label>

      <label className="block text-sm text-white/70">
        Telefone / WhatsApp
        <input
          name="customerPhone"
          defaultValue=""
          className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 outline-none focus:border-emerald-400/60"
          placeholder="(64) 99999-9999"
        />
      </label>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-sm text-white/70">
          Forma de entrega
          <select
            name="deliveryMode"
            value={deliveryMode}
            onChange={(event) => setDeliveryMode(event.target.value as ShowcaseDeliveryMode)}
            className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 outline-none focus:border-emerald-400/60"
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
            name="deliveryPostalCode"
            value={deliveryPostalCode}
            onChange={(event) => setDeliveryPostalCode(event.target.value)}
            className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 outline-none focus:border-emerald-400/60"
            placeholder="75900-000"
          />
        </label>
      </div>

      {deliveryMode !== "PICKUP" ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-sm text-white/70 sm:col-span-2">
            Endereço
            <input
              name="deliveryAddress"
              value={deliveryAddress}
              onChange={(event) => setDeliveryAddress(event.target.value)}
              className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 outline-none focus:border-emerald-400/60"
              placeholder="Rua, número, complemento"
            />
          </label>

          <label className="block text-sm text-white/70">
            Bairro
            <input
              name="deliveryNeighborhood"
              value={deliveryNeighborhood}
              onChange={(event) => setDeliveryNeighborhood(event.target.value)}
              className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 outline-none focus:border-emerald-400/60"
              placeholder="Bairro"
            />
          </label>

          <label className="block text-sm text-white/70">
            Cidade
            <input
              name="deliveryCity"
              value={deliveryCity}
              onChange={(event) => setDeliveryCity(event.target.value)}
              className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 outline-none focus:border-emerald-400/60"
              placeholder="Cidade"
            />
          </label>

          <label className="block text-sm text-white/70">
            UF
            <input
              name="deliveryState"
              value={deliveryState}
              onChange={(event) => setDeliveryState(event.target.value.toUpperCase().slice(0, 2))}
              className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 uppercase outline-none focus:border-emerald-400/60"
              placeholder="GO"
            />
          </label>
        </div>
      ) : null}

      <label className="block text-sm text-white/70">
        Observação opcional
        <textarea
          name="notes"
          rows={4}
          defaultValue={requestedNotes}
          className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 outline-none focus:border-emerald-400/60"
          placeholder="Ex.: Quero outra cor, preciso para presente, retirar pessoalmente..."
        />
      </label>

      {message ? (
        <div className="rounded-[24px] border border-amber-400/20 bg-amber-500/10 px-5 py-4 text-sm text-amber-50">
          {message}
        </div>
      ) : null}

      <button
        type="submit"
        className="inline-flex w-full items-center justify-center rounded-2xl bg-emerald-400 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-emerald-300"
      >
        Enviar para meu WhatsApp
      </button>

      <Link
        href={`/produto/${itemId}`}
        className="inline-flex w-full items-center justify-center rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm font-semibold text-white/80 transition hover:bg-white/10 hover:text-white"
      >
        Voltar para a página do produto
      </Link>
    </form>
  );
}
