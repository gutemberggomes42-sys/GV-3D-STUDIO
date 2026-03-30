"use client";

import { useActionState } from "react";
import { SubmitButton } from "@/components/submit-button";
import { createPayableAction, type ActionState } from "@/lib/actions";
import { expenseCategoryLabels } from "@/lib/constants";

const initialState: ActionState = { ok: false };
const payableCategoryOptions = Object.entries(expenseCategoryLabels);
const today = new Date().toISOString().slice(0, 10);

export function PayableForm() {
  const [state, formAction] = useActionState(createPayableAction, initialState);

  return (
    <form action={formAction} className="space-y-4 rounded-[28px] border border-white/10 bg-white/5 p-6">
      <div>
        <p className="text-xs uppercase tracking-[0.24em] text-white/45">Contas a pagar</p>
        <h3 className="mt-2 text-2xl font-semibold">Lançar compromisso futuro</h3>
        <p className="mt-2 text-sm leading-6 text-white/65">
          Registre boletos, fornecedores, aluguel, energia, peças e qualquer saída que ainda vai vencer.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <label className="block text-sm text-white/70">
          Nome da conta
          <input
            name="title"
            placeholder="Parcela da impressora"
            className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 outline-none focus:border-amber-400/60"
          />
        </label>
        <label className="block text-sm text-white/70">
          Categoria
          <select
            name="category"
            defaultValue={payableCategoryOptions[0]?.[0]}
            className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 outline-none focus:border-amber-400/60"
          >
            {payableCategoryOptions.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <label className="block text-sm text-white/70">
          Valor (R$)
          <input
            name="amount"
            type="number"
            min="0.01"
            step="0.01"
            className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 outline-none focus:border-amber-400/60"
          />
        </label>
        <label className="block text-sm text-white/70">
          Vencimento
          <input
            name="dueDate"
            type="date"
            defaultValue={today}
            className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 outline-none focus:border-amber-400/60"
          />
        </label>
        <label className="block text-sm text-white/70">
          Fornecedor / destino
          <input
            name="vendor"
            placeholder="Fornecedor X"
            className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 outline-none focus:border-amber-400/60"
          />
        </label>
      </div>

      <label className="block text-sm text-white/70">
        Observações
        <textarea
          name="notes"
          rows={3}
          placeholder="Ex.: boleto mensal, compra futura, parcela restante."
          className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 outline-none focus:border-amber-400/60"
        />
      </label>

      {state.error ? <p className="text-sm text-rose-300">{state.error}</p> : null}
      {state.message ? <p className="text-sm text-emerald-300">{state.message}</p> : null}

      <SubmitButton
        label="Salvar conta a pagar"
        pendingLabel="Salvando conta..."
        className="w-full bg-amber-400 text-slate-950 hover:bg-amber-300"
      />
    </form>
  );
}
