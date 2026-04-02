"use client";

import { PrintTechnology } from "@prisma/client";
import { useActionState, useState } from "react";
import { createMaterialAction, type ActionState } from "@/lib/actions";
import { SubmitButton } from "@/components/submit-button";

const initialState: ActionState = { ok: false };

type MaterialFormProps = {
  redirectTo?: string;
};

export function MaterialForm({ redirectTo }: MaterialFormProps) {
  const [state, formAction] = useActionState(createMaterialAction, initialState);
  const fields = state.fields ?? {};
  const [technology, setTechnology] = useState<PrintTechnology>(
    (fields.technology as PrintTechnology) ?? PrintTechnology.FDM,
  );
  const isFdm = technology === PrintTechnology.FDM;
  const isResinLike =
    technology === PrintTechnology.RESIN || technology === PrintTechnology.SLA;

  return (
    <form action={formAction} className="space-y-4 rounded-[28px] border border-white/10 bg-white/5 p-6">
      {redirectTo ? <input type="hidden" name="redirectTo" value={redirectTo} /> : null}
      <div>
        <p className="text-xs uppercase tracking-[0.24em] text-white/45">Cadastro de material</p>
        <h3 className="mt-2 text-2xl font-semibold">Preço real de filamentos e resinas</h3>
        <p className="mt-2 text-sm leading-6 text-white/65">
          Informe quanto você pagou no material, o total comprado e o estoque atual. Para FDM o sistema calcula também custo por metro; para resina, foca no custo por volume.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <label className="block text-sm text-white/70">
          Nome do material
          <input name="name" defaultValue={fields.name ?? ""} placeholder={isResinLike ? "Resina ABS Like" : "PLA Premium"} className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 outline-none focus:border-orange-400/60" />
        </label>
        <label className="block text-sm text-white/70">
          Categoria
          <input name="category" defaultValue={fields.category ?? "Filamento"} placeholder={isResinLike ? "Resina 3D" : "Filamento"} className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 outline-none focus:border-orange-400/60" />
        </label>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <label className="block text-sm text-white/70">
          Tecnologia
          <select name="technology" value={technology} onChange={(event) => setTechnology(event.target.value as PrintTechnology)} className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 outline-none focus:border-orange-400/60">
            {Object.values(PrintTechnology).map((technology) => (
              <option key={technology} value={technology}>
                {technology}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm text-white/70">
          Marca
          <input name="brand" defaultValue={fields.brand ?? ""} placeholder={isResinLike ? "Anycubic" : "Voolt3D"} className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 outline-none focus:border-orange-400/60" />
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
          {isFdm ? "Peso total do rolo (g)" : "Volume total do frasco (g/ml)"}
          <input name="spoolWeightGrams" type="number" step="0.01" min="0.01" defaultValue={fields.spoolWeightGrams ?? "1000"} className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 outline-none focus:border-orange-400/60" />
        </label>
        {isFdm ? (
          <>
            <label className="block text-sm text-white/70">
              Metragem total (m)
              <input name="spoolLengthMeters" type="number" step="0.01" min="0" defaultValue={fields.spoolLengthMeters ?? "330"} className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 outline-none focus:border-orange-400/60" />
            </label>
            <label className="block text-sm text-white/70">
              Diâmetro do filamento (mm)
              <input name="filamentDiameterMm" type="number" step="0.01" min="0.1" defaultValue={fields.filamentDiameterMm ?? "1.75"} className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 outline-none focus:border-orange-400/60" />
            </label>
          </>
        ) : (
          <>
            <input type="hidden" name="spoolLengthMeters" value="0" />
            <div className="rounded-2xl border border-white/10 bg-slate-950/50 px-4 py-3 text-sm text-white/60">
              Para resina o sistema calcula custo por g/ml. A metragem só é usada em materiais FDM.
            </div>
            <input type="hidden" name="filamentDiameterMm" value="1.75" />
          </>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <label className="block text-sm text-white/70">
          Estoque disponível atual ({isResinLike ? "ml" : "g"})
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
