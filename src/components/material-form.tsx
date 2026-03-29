"use client";

import { PrintTechnology } from "@prisma/client";
import { useActionState } from "react";
import { createMaterialAction, type ActionState } from "@/lib/actions";
import { SubmitButton } from "@/components/submit-button";

const initialState: ActionState = { ok: false };

type MaterialFormProps = {
  redirectTo?: string;
};

export function MaterialForm({ redirectTo }: MaterialFormProps) {
  const [state, formAction] = useActionState(createMaterialAction, initialState);
  const fields = state.fields ?? {};

  return (
    <form action={formAction} className="space-y-4 rounded-[28px] border border-white/10 bg-white/5 p-6">
      {redirectTo ? <input type="hidden" name="redirectTo" value={redirectTo} /> : null}
      <div>
        <p className="text-xs uppercase tracking-[0.24em] text-white/45">Cadastro de material</p>
        <h3 className="mt-2 text-2xl font-semibold">Preço real do filamento ou resina</h3>
        <p className="mt-2 text-sm leading-6 text-white/65">
          Informe quanto você pagou no rolo, o peso total e a metragem. O sistema calcula automaticamente custo por grama e custo por metro.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <label className="block text-sm text-white/70">
          Nome do material
          <input name="name" defaultValue={fields.name ?? ""} placeholder="PLA Premium" className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 outline-none focus:border-orange-400/60" />
        </label>
        <label className="block text-sm text-white/70">
          Categoria
          <input name="category" defaultValue={fields.category ?? "Filamento"} className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 outline-none focus:border-orange-400/60" />
        </label>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <label className="block text-sm text-white/70">
          Tecnologia
          <select name="technology" defaultValue={fields.technology ?? PrintTechnology.FDM} className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 outline-none focus:border-orange-400/60">
            {Object.values(PrintTechnology).map((technology) => (
              <option key={technology} value={technology}>
                {technology}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm text-white/70">
          Marca
          <input name="brand" defaultValue={fields.brand ?? ""} placeholder="Voolt3D" className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 outline-none focus:border-orange-400/60" />
        </label>
        <label className="block text-sm text-white/70">
          Cor
          <input name="color" defaultValue={fields.color ?? ""} placeholder="Preto" className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 outline-none focus:border-orange-400/60" />
        </label>
        <label className="block text-sm text-white/70">
          Lote
          <input name="lot" defaultValue={fields.lot ?? ""} placeholder="LOTE-001" className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 outline-none focus:border-orange-400/60" />
        </label>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <label className="block text-sm text-white/70">
          Valor pago no material (R$)
          <input name="purchasePrice" type="number" step="0.01" min="0.01" defaultValue={fields.purchasePrice ?? ""} placeholder="95.00" className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 outline-none focus:border-orange-400/60" />
        </label>
        <label className="block text-sm text-white/70">
          Peso total do rolo (g)
          <input name="spoolWeightGrams" type="number" step="0.01" min="0.01" defaultValue={fields.spoolWeightGrams ?? "1000"} className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 outline-none focus:border-orange-400/60" />
        </label>
        <label className="block text-sm text-white/70">
          Metragem total (m)
          <input name="spoolLengthMeters" type="number" step="0.01" min="0" defaultValue={fields.spoolLengthMeters ?? "330"} className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 outline-none focus:border-orange-400/60" />
        </label>
        <label className="block text-sm text-white/70">
          Diâmetro do filamento (mm)
          <input name="filamentDiameterMm" type="number" step="0.01" min="0.1" defaultValue={fields.filamentDiameterMm ?? "1.75"} className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 outline-none focus:border-orange-400/60" />
        </label>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <label className="block text-sm text-white/70">
          Estoque disponível atual (g/ml)
          <input name="stockAmount" type="number" step="0.01" min="0.01" defaultValue={fields.stockAmount ?? "1000"} className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 outline-none focus:border-orange-400/60" />
        </label>
        <label className="block text-sm text-white/70">
          Estoque mínimo
          <input name="minimumStock" type="number" step="0.01" min="0" defaultValue={fields.minimumStock ?? "200"} className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 outline-none focus:border-orange-400/60" />
        </label>
        <label className="block text-sm text-white/70">
          Fornecedor
          <input name="supplier" defaultValue={fields.supplier ?? ""} placeholder="Seu fornecedor" className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 outline-none focus:border-orange-400/60" />
        </label>
      </div>

      {state.error ? <p className="text-sm text-rose-300">{state.error}</p> : null}
      {state.message ? <p className="text-sm text-emerald-300">{state.message}</p> : null}

      <SubmitButton label="Salvar material" pendingLabel="Calculando e salvando..." className="w-full bg-orange-500 text-slate-950 hover:bg-orange-400" />
    </form>
  );
}
