"use client";

import { PrintTechnology } from "@prisma/client";
import { useActionState } from "react";
import { SubmitButton } from "@/components/submit-button";
import {
  deleteMachineAction,
  type ActionState,
  updateMachineAction,
} from "@/lib/actions";
import type { DbMachine } from "@/lib/db-types";

type MachineEditorProps = {
  machine: DbMachine;
  activeOrderCount: number;
};

const initialState: ActionState = { ok: false };

export function MachineEditor({ machine, activeOrderCount }: MachineEditorProps) {
  const [updateState, updateAction] = useActionState(updateMachineAction, initialState);
  const [deleteState, deleteAction] = useActionState(deleteMachineAction, initialState);
  const canDelete = activeOrderCount === 0;

  return (
    <div className="mt-5 rounded-[22px] border border-white/10 bg-slate-950/60 p-4">
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-white/45">Configuração da máquina</p>
          <p className="mt-1 text-sm text-white/65">
            Atualize dados técnicos, materiais compatíveis e localização desta impressora.
          </p>
        </div>
        <p className="text-sm text-white/60">Pedidos ativos vinculados: {activeOrderCount}</p>
      </div>

      <form action={updateAction} className="mt-4 space-y-4">
        <input type="hidden" name="machineId" value={machine.id} />

        <div className="grid gap-4 md:grid-cols-3">
          <label className="block text-sm text-white/70">
            Nome
            <input
              name="name"
              defaultValue={machine.name}
              className="mt-2 w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 outline-none focus:border-sky-400/60"
            />
          </label>
          <label className="block text-sm text-white/70">
            Modelo
            <input
              name="model"
              defaultValue={machine.model}
              className="mt-2 w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 outline-none focus:border-sky-400/60"
            />
          </label>
          <label className="block text-sm text-white/70">
            Tecnologia
            <select
              name="technology"
              defaultValue={machine.technology}
              className="mt-2 w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 outline-none focus:border-sky-400/60"
            >
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
            <input
              name="buildVolumeX"
              type="number"
              step="0.1"
              min="0.1"
              defaultValue={machine.buildVolumeX}
              className="mt-2 w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 outline-none focus:border-sky-400/60"
            />
          </label>
          <label className="block text-sm text-white/70">
            Volume Y (cm)
            <input
              name="buildVolumeY"
              type="number"
              step="0.1"
              min="0.1"
              defaultValue={machine.buildVolumeY}
              className="mt-2 w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 outline-none focus:border-sky-400/60"
            />
          </label>
          <label className="block text-sm text-white/70">
            Volume Z (cm)
            <input
              name="buildVolumeZ"
              type="number"
              step="0.1"
              min="0.1"
              defaultValue={machine.buildVolumeZ}
              className="mt-2 w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 outline-none focus:border-sky-400/60"
            />
          </label>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <label className="block text-sm text-white/70">
            Materiais compatíveis
            <input
              name="supportedMaterialNames"
              defaultValue={machine.supportedMaterialNames}
              className="mt-2 w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 outline-none focus:border-sky-400/60"
            />
          </label>
          <label className="block text-sm text-white/70">
            Localização
            <input
              name="location"
              defaultValue={machine.location ?? ""}
              className="mt-2 w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 outline-none focus:border-sky-400/60"
            />
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
              defaultValue={machine.purchasePrice}
              className="mt-2 w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 outline-none focus:border-sky-400/60"
            />
          </label>
          <label className="block text-sm text-white/70">
            Valor já pago (R$)
            <input
              name="amountPaid"
              type="number"
              step="0.01"
              min="0"
              defaultValue={machine.amountPaid}
              className="mt-2 w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 outline-none focus:border-sky-400/60"
            />
          </label>
          <label className="block text-sm text-white/70">
            Data da compra
            <input
              name="purchasedAt"
              type="date"
              defaultValue={machine.purchasedAt ? machine.purchasedAt.slice(0, 10) : ""}
              className="mt-2 w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 outline-none focus:border-sky-400/60"
            />
          </label>
        </div>

        <label className="block text-sm text-white/70">
          Observações
          <textarea
            name="notes"
            rows={3}
            defaultValue={machine.notes ?? ""}
            className="mt-2 w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 outline-none focus:border-sky-400/60"
          />
        </label>

        {updateState.error ? <p className="text-sm text-rose-300">{updateState.error}</p> : null}
        {updateState.message ? <p className="text-sm text-emerald-300">{updateState.message}</p> : null}

        <SubmitButton
          label="Atualizar impressora"
          pendingLabel="Salvando alterações..."
          className="w-full bg-sky-400 text-slate-950 hover:bg-sky-300"
        />
      </form>

      <form action={deleteAction} className="mt-4 rounded-2xl border border-rose-400/20 bg-rose-500/5 p-4">
        <input type="hidden" name="machineId" value={machine.id} />
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="font-semibold text-rose-100">Excluir impressora</p>
            <p className="mt-1 text-sm text-rose-100/75">
              {canDelete
                ? "Nenhum pedido ativo está preso a esta máquina, então a exclusão está liberada."
                : "A exclusão fica bloqueada enquanto existir pedido ativo vinculado a esta impressora."}
            </p>
          </div>
          <SubmitButton
            label="Excluir impressora"
            pendingLabel="Excluindo..."
            disabled={!canDelete}
            className="bg-rose-500/90 text-white hover:bg-rose-400"
          />
        </div>
        {deleteState.error ? <p className="mt-3 text-sm text-rose-200">{deleteState.error}</p> : null}
      </form>
    </div>
  );
}
