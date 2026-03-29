"use client";

import Link from "next/link";
import { FinishLevel, Priority } from "@prisma/client";
import { useActionState } from "react";
import { createOrderAction, type ActionState } from "@/lib/actions";
import { finishLabels, priorityLabels } from "@/lib/constants";
import type { DbMaterial } from "@/lib/db-types";
import { SubmitButton } from "@/components/submit-button";

const initialState: ActionState = { ok: false };

type OrderIntakeFormProps = {
  materials: DbMaterial[];
};

export function OrderIntakeForm({ materials }: OrderIntakeFormProps) {
  const [state, formAction] = useActionState(createOrderAction, initialState);
  const hasMaterials = materials.length > 0;

  return (
    <form action={formAction} className="space-y-4 rounded-[28px] border border-white/10 bg-white/5 p-6">
      <div>
        <p className="text-xs uppercase tracking-[0.24em] text-white/45">Novo pedido</p>
        <h3 className="mt-2 text-2xl font-semibold">Upload + orçamento automático</h3>
        <p className="mt-2 text-sm leading-6 text-white/65">
          O sistema estima tempo, material, metragem usada, risco e gera o valor automaticamente com base no custo real do insumo cadastrado.
        </p>
      </div>

      {!hasMaterials ? (
        <div className="rounded-[22px] border border-amber-400/20 bg-amber-500/10 p-4 text-sm text-amber-50">
          Cadastre primeiro um material com preço do rolo, peso e metragem em{" "}
          <Link href="/admin" className="font-semibold text-amber-200 underline underline-offset-4">
            Painel administrativo
          </Link>{" "}
          para o sistema calcular quanto cobrar automaticamente.
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2">
        <label className="block text-sm text-white/70">
          Nome do projeto
          <input name="title" disabled={!hasMaterials} className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 outline-none focus:border-orange-400/60 disabled:opacity-50" />
        </label>
        <label className="block text-sm text-white/70">
          Tipo de projeto
          <input name="type" disabled={!hasMaterials} className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 outline-none focus:border-orange-400/60 disabled:opacity-50" placeholder="Protótipo, lote, peça funcional..." />
        </label>
      </div>

      <label className="block text-sm text-white/70">
        Descrição
        <textarea name="description" disabled={!hasMaterials} rows={4} className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 outline-none focus:border-orange-400/60 disabled:opacity-50" />
      </label>

      <div className="grid gap-4 md:grid-cols-2">
        <label className="block text-sm text-white/70">
          Arquivo 3D
          <input name="modelFile" disabled={!hasMaterials} type="file" accept=".stl,.obj,.3mf" className="mt-2 block w-full rounded-2xl border border-dashed border-white/15 bg-slate-950/70 px-4 py-3 text-white/70 file:mr-4 file:rounded-xl file:border-0 file:bg-orange-500 file:px-4 file:py-2 file:font-semibold file:text-slate-950 disabled:opacity-50" />
        </label>
        <label className="block text-sm text-white/70">
          Material
          <select name="materialId" disabled={!hasMaterials} className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 outline-none focus:border-orange-400/60 disabled:opacity-50">
            {materials.map((material) => (
              <option key={material.id} value={material.id}>
                {material.name} · {material.color}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <label className="block text-sm text-white/70">
          Cor
          <input name="color" disabled={!hasMaterials} defaultValue="Preto fosco" className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 outline-none focus:border-orange-400/60 disabled:opacity-50" />
        </label>
        <label className="block text-sm text-white/70">
          Quantidade
          <input name="quantity" disabled={!hasMaterials} type="number" min="1" defaultValue="1" className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 outline-none focus:border-orange-400/60 disabled:opacity-50" />
        </label>
        <label className="block text-sm text-white/70">
          Acabamento
          <select name="finishLevel" disabled={!hasMaterials} defaultValue={FinishLevel.STANDARD} className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 outline-none focus:border-orange-400/60 disabled:opacity-50">
            {Object.values(FinishLevel).map((finish) => (
              <option key={finish} value={finish}>
                {finishLabels[finish]}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm text-white/70">
          Prioridade
          <select name="priority" disabled={!hasMaterials} defaultValue={Priority.MEDIUM} className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 outline-none focus:border-orange-400/60 disabled:opacity-50">
            {Object.values(Priority).map((priority) => (
              <option key={priority} value={priority}>
                {priorityLabels[priority]}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <label className="block text-sm text-white/70">
          Largura (cm)
          <input name="boundingBoxX" disabled={!hasMaterials} type="number" step="0.1" min="0.5" defaultValue="10" className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 outline-none focus:border-orange-400/60 disabled:opacity-50" />
        </label>
        <label className="block text-sm text-white/70">
          Profundidade (cm)
          <input name="boundingBoxY" disabled={!hasMaterials} type="number" step="0.1" min="0.5" defaultValue="8" className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 outline-none focus:border-orange-400/60 disabled:opacity-50" />
        </label>
        <label className="block text-sm text-white/70">
          Altura (cm)
          <input name="boundingBoxZ" disabled={!hasMaterials} type="number" step="0.1" min="0.5" defaultValue="5" className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 outline-none focus:border-orange-400/60 disabled:opacity-50" />
        </label>
      </div>

      {state.error ? <p className="text-sm text-rose-300">{state.error}</p> : null}

      <SubmitButton
        label="Gerar orçamento automático"
        pendingLabel="Analisando arquivo..."
        disabled={!hasMaterials}
        className="w-full bg-orange-500 text-slate-950 hover:bg-orange-400 disabled:bg-slate-700"
      />
    </form>
  );
}
