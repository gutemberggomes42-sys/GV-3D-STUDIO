"use client";

import { PrintTechnology } from "@prisma/client";
import { useActionState } from "react";
import { createMachineAction, type ActionState } from "@/lib/actions";
import { SubmitButton } from "@/components/submit-button";

const initialState: ActionState = { ok: false };

export function MachineForm() {
  const [state, formAction] = useActionState(createMachineAction, initialState);

  return (
    <form action={formAction} className="space-y-4 rounded-[28px] border border-white/10 bg-white/5 p-6">
      <div>
        <p className="text-xs uppercase tracking-[0.24em] text-white/45">Cadastro de impressora</p>
        <h3 className="mt-2 text-2xl font-semibold">Registrar máquina real</h3>
        <p className="mt-2 text-sm leading-6 text-white/65">
          Cadastre suas impressoras para a fila inteligente conseguir sugerir equipamento compatível para cada peça.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <label className="block text-sm text-white/70">
          Nome
          <input name="name" placeholder="Bambu Lab A1" className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 outline-none focus:border-orange-400/60" />
        </label>
        <label className="block text-sm text-white/70">
          Modelo
          <input name="model" placeholder="A1 Combo" className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 outline-none focus:border-orange-400/60" />
        </label>
        <label className="block text-sm text-white/70">
          Tecnologia
          <select name="technology" defaultValue={PrintTechnology.FDM} className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 outline-none focus:border-orange-400/60">
            {Object.values(PrintTechnology).map((technology) => (
              <option key={technology} value={technology}>
                {technology}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <label className="block text-sm text-white/70">
          Volume X (cm)
          <input name="buildVolumeX" type="number" step="0.1" min="0.1" defaultValue="25" className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 outline-none focus:border-orange-400/60" />
        </label>
        <label className="block text-sm text-white/70">
          Volume Y (cm)
          <input name="buildVolumeY" type="number" step="0.1" min="0.1" defaultValue="25" className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 outline-none focus:border-orange-400/60" />
        </label>
        <label className="block text-sm text-white/70">
          Volume Z (cm)
          <input name="buildVolumeZ" type="number" step="0.1" min="0.1" defaultValue="25" className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 outline-none focus:border-orange-400/60" />
        </label>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <label className="block text-sm text-white/70">
          Materiais compatíveis
          <input name="supportedMaterialNames" placeholder="PLA, PETG, ABS" className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 outline-none focus:border-orange-400/60" />
        </label>
        <label className="block text-sm text-white/70">
          Localização
          <input name="location" placeholder="Sala 1 / Bancada A" className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 outline-none focus:border-orange-400/60" />
        </label>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <label className="block text-sm text-white/70">
          Valor da impressora (R$)
          <input
            name="purchasePrice"
            type="number"
            step="0.01"
            min="0"
            defaultValue="0"
            className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 outline-none focus:border-orange-400/60"
          />
        </label>
        <label className="block text-sm text-white/70">
          Valor já pago (R$)
          <input
            name="amountPaid"
            type="number"
            step="0.01"
            min="0"
            defaultValue="0"
            className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 outline-none focus:border-orange-400/60"
          />
        </label>
        <label className="block text-sm text-white/70">
          Data da compra
          <input
            name="purchasedAt"
            type="date"
            className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 outline-none focus:border-orange-400/60"
          />
        </label>
      </div>

      <label className="block text-sm text-white/70">
        Observações
        <textarea name="notes" rows={3} className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 outline-none focus:border-orange-400/60" placeholder="Ex.: impressora dedicada a protótipos rápidos." />
      </label>

      {state.error ? <p className="text-sm text-rose-300">{state.error}</p> : null}
      {state.message ? <p className="text-sm text-emerald-300">{state.message}</p> : null}

      <SubmitButton label="Salvar impressora" pendingLabel="Salvando..." className="w-full bg-sky-400 text-slate-950 hover:bg-sky-300" />
    </form>
  );
}
