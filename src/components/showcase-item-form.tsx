"use client";

import { useActionState, useState } from "react";
import { SubmitButton } from "@/components/submit-button";
import { createShowcaseItemAction, type ActionState } from "@/lib/actions";
import { ShowcasePriceCalculator } from "@/components/showcase-price-calculator";
import type { DbMaterial } from "@/lib/db-types";

const initialState: ActionState = { ok: false };

type ShowcaseItemFormProps = {
  materials: DbMaterial[];
};

export function ShowcaseItemForm({ materials }: ShowcaseItemFormProps) {
  const [state, formAction] = useActionState(createShowcaseItemAction, initialState);
  const [price, setPrice] = useState("");
  const [fulfillmentType, setFulfillmentType] = useState<"STOCK" | "MADE_TO_ORDER">("STOCK");
  const managesStock = fulfillmentType === "STOCK";

  return (
    <form action={formAction} encType="multipart/form-data" className="space-y-4 rounded-[28px] border border-white/10 bg-white/5 p-6">
      <div>
        <p className="text-xs uppercase tracking-[0.24em] text-white/45">Itens de exposição</p>
        <h3 className="mt-2 text-2xl font-semibold">Cadastrar produto da vitrine</h3>
        <p className="mt-2 text-sm leading-6 text-white/65">
          Esses itens aparecem para o cliente no login. Ao clicar em comprar, o sistema registra o interesse e abre o WhatsApp com item e quantidade.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <label className="block text-sm text-white/70">
          Nome do item
          <input
            name="name"
            placeholder="Suporte para controle"
            className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 outline-none focus:border-orange-400/60"
          />
        </label>
        <label className="block text-sm text-white/70">
          Valor (R$)
          <input
            name="price"
            value={price}
            onChange={(event) => setPrice(event.target.value)}
            type="number"
            step="0.01"
            min="0.01"
            placeholder="39.90"
            className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 outline-none focus:border-orange-400/60"
          />
        </label>
        <label className="block text-sm text-white/70">
          Tempo de impressão (h)
          <input
            name="estimatedPrintHours"
            type="number"
            step="0.1"
            min="0.1"
            defaultValue="1"
            className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 outline-none focus:border-orange-400/60"
          />
        </label>
        <label className="block text-sm text-white/70">
          Modalidade
          <select
            name="fulfillmentType"
            value={fulfillmentType}
            onChange={(event) => setFulfillmentType(event.target.value as "STOCK" | "MADE_TO_ORDER")}
            className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 outline-none focus:border-orange-400/60"
          >
            <option value="STOCK">Pronta entrega</option>
            <option value="MADE_TO_ORDER">Sob encomenda</option>
          </select>
        </label>
      </div>

      {managesStock ? (
        <label className="block text-sm text-white/70">
          Estoque disponível
          <input
            name="stockQuantity"
            type="number"
            min="0"
            step="1"
            defaultValue="0"
            className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 outline-none focus:border-orange-400/60"
          />
        </label>
      ) : (
        <>
          <input type="hidden" name="stockQuantity" value="0" />
          <div className="rounded-2xl border border-dashed border-white/15 bg-slate-950/50 px-4 py-3 text-sm text-white/65">
            Este item ficará disponível como sob encomenda, sem depender de estoque pronto.
          </div>
        </>
      )}

      <label className="block text-sm text-white/70">
        Descrição
        <textarea
          name="description"
          rows={4}
          placeholder="Explique o item, o material, as cores ou a aplicação."
          className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 outline-none focus:border-orange-400/60"
        />
      </label>

      <div className="grid gap-4 md:grid-cols-2">
        <label className="block text-sm text-white/70">
          Imagem por URL (opcional)
          <input
            name="imageUrl"
            placeholder="/uploads/minha-peca.jpg"
            className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 outline-none focus:border-orange-400/60"
          />
        </label>
        <label className="block text-sm text-white/70">
          Foto da galeria (opcional)
          <input
            name="imageFile"
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif"
            className="mt-2 block w-full rounded-2xl border border-dashed border-white/15 bg-slate-950/70 px-4 py-3 text-white/70 file:mr-4 file:rounded-xl file:border-0 file:bg-orange-500 file:px-4 file:py-2 file:font-semibold file:text-slate-950"
          />
        </label>
      </div>

      <label className="inline-flex items-center gap-3 rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3 text-sm text-white/75">
        <input type="checkbox" name="active" defaultChecked className="h-4 w-4 rounded border-white/20" />
        Exibir na vitrine
      </label>

      <p className="text-sm text-white/50">
        Se você enviar uma foto da galeria, ela tem prioridade sobre a URL.
      </p>

      {state.error ? <p className="text-sm text-rose-300">{state.error}</p> : null}
      {state.message ? <p className="text-sm text-emerald-300">{state.message}</p> : null}

      <ShowcasePriceCalculator onApplyPrice={setPrice} materials={materials} />

      <SubmitButton
        label="Salvar item da vitrine"
        pendingLabel="Salvando item..."
        className="w-full bg-orange-500 text-slate-950 hover:bg-orange-400"
      />
    </form>
  );
}
