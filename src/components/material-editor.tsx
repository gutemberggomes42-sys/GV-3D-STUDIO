"use client";

import { PrintTechnology } from "@prisma/client";
import { useActionState } from "react";
import { SubmitButton } from "@/components/submit-button";
import {
  deleteMaterialAction,
  type ActionState,
  updateMaterialAction,
} from "@/lib/actions";
import type { DbMaterial } from "@/lib/db-types";
import { formatCurrency, formatMeters } from "@/lib/format";
import { getMaterialDerivedMetrics } from "@/lib/pricing";

type MaterialEditorProps = {
  material: DbMaterial;
  linkedOrderCount: number;
  redirectTo?: string;
};

const initialState: ActionState = { ok: false };

export function MaterialEditor({ material, linkedOrderCount, redirectTo }: MaterialEditorProps) {
  const [updateState, updateAction] = useActionState(updateMaterialAction, initialState);
  const [deleteState, deleteAction] = useActionState(deleteMaterialAction, initialState);
  const derived = getMaterialDerivedMetrics(material);
  const canDelete = linkedOrderCount === 0;
  const fields = updateState.fields ?? {};

  return (
    <article className="rounded-[22px] border border-white/10 bg-slate-950/60 p-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-lg font-semibold">{material.name}</p>
          <p className="mt-1 text-sm text-white/60">
            {material.brand} · {material.color} · Lote {material.lot}
          </p>
        </div>
        <div className="text-right">
          <p className="text-lg font-semibold">
            {material.stockAmount.toFixed(0)} {material.unit}
          </p>
          <p className="text-sm text-white/60">
            Mínimo: {material.minimumStock.toFixed(0)} {material.unit}
          </p>
        </div>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-4">
        <div className="rounded-2xl border border-white/10 bg-black/30 p-3">
          <p className="text-xs uppercase tracking-[0.18em] text-white/45">Valor pago</p>
          <p className="mt-2 text-lg font-semibold">{formatCurrency(material.purchasePrice)}</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-black/30 p-3">
          <p className="text-xs uppercase tracking-[0.18em] text-white/45">Custo por grama</p>
          <p className="mt-2 text-lg font-semibold">{formatCurrency(derived.costPerGram)}</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-black/30 p-3">
          <p className="text-xs uppercase tracking-[0.18em] text-white/45">Custo por metro</p>
          <p className="mt-2 text-lg font-semibold">
            {material.technology === PrintTechnology.FDM ? formatCurrency(derived.costPerMeter) : "n/a"}
          </p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-black/30 p-3">
          <p className="text-xs uppercase tracking-[0.18em] text-white/45">Vinculações</p>
          <p className="mt-2 text-lg font-semibold">{linkedOrderCount}</p>
        </div>
      </div>

      {material.technology === PrintTechnology.FDM ? (
        <p className="mt-4 text-sm text-white/60">
          Metragem restante estimada: {formatMeters(derived.stockMetersRemaining)}
        </p>
      ) : null}

      <div className="mt-4 h-3 rounded-full bg-white/6">
        <div
          className="h-3 rounded-full bg-gradient-to-r from-emerald-400 via-sky-400 to-orange-400"
          style={{
            width: `${Math.max(
              6,
              Math.min(100, (material.stockAmount / Math.max(material.minimumStock * 4, 1)) * 100),
            )}%`,
          }}
        />
      </div>

      <form action={updateAction} className="mt-5 space-y-4">
        <input type="hidden" name="materialId" value={material.id} />
        {redirectTo ? <input type="hidden" name="redirectTo" value={redirectTo} /> : null}

        <div className="grid gap-4 md:grid-cols-2">
          <label className="block text-sm text-white/70">
            Nome do material
            <input
              name="name"
              defaultValue={fields.name ?? material.name}
              className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 outline-none focus:border-orange-400/60"
            />
          </label>
          <label className="block text-sm text-white/70">
            Categoria
            <input
              name="category"
              defaultValue={fields.category ?? material.category}
              className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 outline-none focus:border-orange-400/60"
            />
          </label>
        </div>

        <div className="grid gap-4 md:grid-cols-4">
          <label className="block text-sm text-white/70">
            Tecnologia
            <select
              name="technology"
              defaultValue={fields.technology ?? material.technology}
              className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 outline-none focus:border-orange-400/60"
            >
              {Object.values(PrintTechnology).map((technology) => (
                <option key={technology} value={technology}>
                  {technology}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm text-white/70">
            Marca
            <input
              name="brand"
              defaultValue={fields.brand ?? material.brand}
              className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 outline-none focus:border-orange-400/60"
            />
          </label>
          <label className="block text-sm text-white/70">
            Cor
            <input
              name="color"
              defaultValue={fields.color ?? material.color}
              className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 outline-none focus:border-orange-400/60"
            />
          </label>
          <label className="block text-sm text-white/70">
            Lote
            <input
              name="lot"
              defaultValue={fields.lot ?? material.lot}
              className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 outline-none focus:border-orange-400/60"
            />
          </label>
        </div>

        <div className="grid gap-4 md:grid-cols-4">
          <label className="block text-sm text-white/70">
            Valor pago no material (R$)
            <input
              name="purchasePrice"
              type="number"
              step="0.01"
              min="0.01"
              defaultValue={fields.purchasePrice ?? String(material.purchasePrice)}
              className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 outline-none focus:border-orange-400/60"
            />
          </label>
          <label className="block text-sm text-white/70">
            Peso total do rolo (g)
            <input
              name="spoolWeightGrams"
              type="number"
              step="0.01"
              min="0.01"
              defaultValue={fields.spoolWeightGrams ?? String(material.spoolWeightGrams)}
              className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 outline-none focus:border-orange-400/60"
            />
          </label>
          <label className="block text-sm text-white/70">
            Metragem total (m)
            <input
              name="spoolLengthMeters"
              type="number"
              step="0.01"
              min="0"
              defaultValue={fields.spoolLengthMeters ?? String(material.spoolLengthMeters ?? 0)}
              className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 outline-none focus:border-orange-400/60"
            />
          </label>
          <label className="block text-sm text-white/70">
            Diâmetro do filamento (mm)
            <input
              name="filamentDiameterMm"
              type="number"
              step="0.01"
              min="0.1"
              defaultValue={fields.filamentDiameterMm ?? String(material.filamentDiameterMm ?? 1.75)}
              className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 outline-none focus:border-orange-400/60"
            />
          </label>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <label className="block text-sm text-white/70">
            Estoque disponível atual (g/ml)
            <input
              name="stockAmount"
              type="number"
              step="0.01"
              min="0.01"
              defaultValue={fields.stockAmount ?? String(material.stockAmount)}
              className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 outline-none focus:border-orange-400/60"
            />
          </label>
          <label className="block text-sm text-white/70">
            Estoque mínimo
            <input
              name="minimumStock"
              type="number"
              step="0.01"
              min="0"
              defaultValue={fields.minimumStock ?? String(material.minimumStock)}
              className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 outline-none focus:border-orange-400/60"
            />
          </label>
          <label className="block text-sm text-white/70">
            Fornecedor
            <input
              name="supplier"
              defaultValue={fields.supplier ?? material.supplier ?? ""}
              className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 outline-none focus:border-orange-400/60"
            />
          </label>
        </div>

        {updateState.error ? <p className="text-sm text-rose-300">{updateState.error}</p> : null}
        {updateState.message ? <p className="text-sm text-emerald-300">{updateState.message}</p> : null}

        <SubmitButton
          label="Atualizar material"
          pendingLabel="Salvando alterações..."
          className="w-full bg-orange-500 text-slate-950 hover:bg-orange-400"
        />
      </form>

      <form action={deleteAction} className="mt-4 rounded-2xl border border-rose-400/20 bg-rose-500/5 p-4">
        <input type="hidden" name="materialId" value={material.id} />
        {redirectTo ? <input type="hidden" name="redirectTo" value={redirectTo} /> : null}
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="font-semibold text-rose-100">Excluir material</p>
            <p className="mt-1 text-sm text-rose-100/75">
              {canDelete
                ? "Este material ainda não foi usado em pedidos ou produtos da vitrine e pode ser removido."
                : "A exclusão fica bloqueada enquanto existir pedido ou produto da vitrine vinculado a este material."}
            </p>
          </div>
          <SubmitButton
            label="Excluir material"
            pendingLabel="Excluindo..."
            disabled={!canDelete}
            className="bg-rose-500/90 text-white hover:bg-rose-400"
          />
        </div>
        {deleteState.error ? <p className="mt-3 text-sm text-rose-200">{deleteState.error}</p> : null}
      </form>
    </article>
  );
}
