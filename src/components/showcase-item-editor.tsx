"use client";

import { useActionState, useState } from "react";
import { SubmitButton } from "@/components/submit-button";
import {
  deleteShowcaseItemAction,
  type ActionState,
  updateShowcaseItemAction,
} from "@/lib/actions";
import { ShowcasePriceCalculator } from "@/components/showcase-price-calculator";
import type { DbMaterial, DbShowcaseItem } from "@/lib/db-types";
import { formatCurrency } from "@/lib/format";

type ShowcaseItemEditorProps = {
  item: DbShowcaseItem;
  interestCount: number;
  materials: DbMaterial[];
};

const initialState: ActionState = { ok: false };

export function ShowcaseItemEditor({ item, interestCount, materials }: ShowcaseItemEditorProps) {
  const [updateState, updateAction] = useActionState(updateShowcaseItemAction, initialState);
  const [deleteState, deleteAction] = useActionState(deleteShowcaseItemAction, initialState);
  const [price, setPrice] = useState(item.price.toFixed(2));
  const [fulfillmentType, setFulfillmentType] = useState<"STOCK" | "MADE_TO_ORDER">(item.fulfillmentType);
  const managesStock = fulfillmentType === "STOCK";

  return (
    <article className="rounded-[22px] border border-white/10 bg-slate-950/60 p-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <p className="text-lg font-semibold">{item.name}</p>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-white/65">{item.description}</p>
          <p className="mt-2 text-sm text-white/55">
            {fulfillmentType === "STOCK" ? `Estoque atual: ${item.stockQuantity}` : "Produto sob encomenda"}
          </p>
          <p className="mt-1 text-sm text-white/50">
            Tempo cadastrado: {item.estimatedPrintHours.toFixed(1)} h
          </p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-right">
          <p className="text-[11px] uppercase tracking-[0.18em] text-white/45">
            {fulfillmentType === "STOCK" ? "Pronta entrega" : "Sob encomenda"}
          </p>
          <p className="text-xs uppercase tracking-[0.18em] text-white/45">Valor</p>
          <p className="mt-2 text-2xl font-semibold">{formatCurrency(item.price)}</p>
          <p className="mt-1 text-sm text-white/60">{interestCount} contatos</p>
        </div>
      </div>

      <form action={updateAction} encType="multipart/form-data" className="mt-5 space-y-4">
        <input type="hidden" name="itemId" value={item.id} />

        <div className="grid gap-4 md:grid-cols-4">
          <label className="block text-sm text-white/70">
            Nome do item
            <input
              name="name"
              defaultValue={item.name}
              className="mt-2 w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 outline-none focus:border-orange-400/60"
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
              className="mt-2 w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 outline-none focus:border-orange-400/60"
            />
          </label>
          <label className="block text-sm text-white/70">
            Tempo de impressão (h)
            <input
              name="estimatedPrintHours"
              type="number"
              step="0.1"
              min="0.1"
              defaultValue={item.estimatedPrintHours}
              className="mt-2 w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 outline-none focus:border-orange-400/60"
            />
          </label>
          <label className="block text-sm text-white/70">
            Modalidade
            <select
              name="fulfillmentType"
              value={fulfillmentType}
              onChange={(event) => setFulfillmentType(event.target.value as "STOCK" | "MADE_TO_ORDER")}
              className="mt-2 w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 outline-none focus:border-orange-400/60"
            >
              <option value="STOCK">Pronta entrega</option>
              <option value="MADE_TO_ORDER">Sob encomenda</option>
            </select>
          </label>
        </div>

        {managesStock ? (
          <>
            <div className="grid gap-4 md:grid-cols-2">
              <label className="block text-sm text-white/70">
                Estoque disponível
                <input
                  name="stockQuantity"
                  type="number"
                  min="0"
                  step="1"
                  defaultValue={item.stockQuantity}
                  className="mt-2 w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 outline-none focus:border-orange-400/60"
                />
              </label>
              <label className="block text-sm text-white/70">
                Adicionar ao estoque
                <input
                  name="restockQuantity"
                  type="number"
                  min="0"
                  step="1"
                  defaultValue={0}
                  className="mt-2 w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 outline-none focus:border-orange-400/60"
                />
              </label>
            </div>

            <p className="text-sm text-white/50">
              Use `Estoque disponível` para ajustar o total atual e `Adicionar ao estoque` para somar novas unidades sem perder a contagem anterior.
            </p>
          </>
        ) : (
          <>
            <input type="hidden" name="stockQuantity" value="0" />
            <input type="hidden" name="restockQuantity" value="0" />
            <div className="rounded-2xl border border-dashed border-white/15 bg-black/20 px-4 py-3 text-sm text-white/65">
              Este item será vendido sob encomenda e não baixa quantidade do estoque.
            </div>
          </>
        )}

        <label className="block text-sm text-white/70">
          Descrição
          <textarea
            name="description"
            rows={4}
            defaultValue={item.description}
            className="mt-2 w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 outline-none focus:border-orange-400/60"
          />
        </label>

        <div className="grid gap-4 md:grid-cols-2">
          <label className="block text-sm text-white/70">
            Imagem por URL (opcional)
            <input
              name="imageUrl"
              defaultValue={item.imageUrl ?? ""}
              className="mt-2 w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 outline-none focus:border-orange-400/60"
            />
          </label>
          <label className="block text-sm text-white/70">
            Trocar por foto da galeria
            <input
              name="imageFile"
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif"
              className="mt-2 block w-full rounded-2xl border border-dashed border-white/15 bg-black/30 px-4 py-3 text-white/70 file:mr-4 file:rounded-xl file:border-0 file:bg-orange-500 file:px-4 file:py-2 file:font-semibold file:text-slate-950"
            />
          </label>
        </div>

        <label className="inline-flex items-center gap-3 rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white/75">
          <input type="checkbox" name="active" defaultChecked={item.active} className="h-4 w-4 rounded border-white/20" />
          Exibir na vitrine
        </label>

        <p className="text-sm text-white/50">
          Se você selecionar uma nova foto da galeria, ela substitui a URL informada.
        </p>

        {updateState.error ? <p className="text-sm text-rose-300">{updateState.error}</p> : null}
        {updateState.message ? <p className="text-sm text-emerald-300">{updateState.message}</p> : null}

        <ShowcasePriceCalculator onApplyPrice={setPrice} materials={materials} />

        <SubmitButton
          label="Atualizar item"
          pendingLabel="Salvando alterações..."
          className="w-full bg-orange-500 text-slate-950 hover:bg-orange-400"
        />
      </form>

      <form action={deleteAction} className="mt-4 rounded-2xl border border-rose-400/20 bg-rose-500/5 p-4">
        <input type="hidden" name="itemId" value={item.id} />
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <p className="text-sm text-rose-100/80">Excluir remove o item da vitrine, mas preserva o histórico de contatos já registrados.</p>
          <SubmitButton
            label="Excluir item"
            pendingLabel="Excluindo..."
            className="bg-rose-500/90 text-white hover:bg-rose-400"
          />
        </div>
        {deleteState.error ? <p className="mt-3 text-sm text-rose-200">{deleteState.error}</p> : null}
      </form>
    </article>
  );
}
