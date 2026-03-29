"use client";

import { useActionState } from "react";
import { SubmitButton } from "@/components/submit-button";
import { createExpenseAction, type ActionState } from "@/lib/actions";
import { expenseCategoryLabels } from "@/lib/constants";

const initialState: ActionState = { ok: false };
const expenseCategoryOptions = Object.entries(expenseCategoryLabels);
const today = new Date().toISOString().slice(0, 10);

export function ExpenseForm() {
  const [state, formAction] = useActionState(createExpenseAction, initialState);

  return (
    <form action={formAction} className="space-y-4 rounded-[28px] border border-white/10 bg-white/5 p-6">
      <div>
        <p className="text-xs uppercase tracking-[0.24em] text-white/45">Saídas e despesas</p>
        <h3 className="mt-2 text-2xl font-semibold">Lançar gasto manual</h3>
        <p className="mt-2 text-sm leading-6 text-white/65">
          Registre energia, aluguel, mão de obra, envio, marketing ou qualquer outro gasto para o financeiro mostrar lucro e prejuízo reais.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <label className="block text-sm text-white/70">
          Nome do gasto
          <input
            name="title"
            placeholder="Conta de energia de março"
            className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 outline-none focus:border-rose-400/60"
          />
        </label>
        <label className="block text-sm text-white/70">
          Categoria
          <select
            name="category"
            defaultValue={expenseCategoryOptions[0]?.[0]}
            className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 outline-none focus:border-rose-400/60"
          >
            {expenseCategoryOptions.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <label className="block text-sm text-white/70">
          Valor pago (R$)
          <input
            name="amount"
            type="number"
            step="0.01"
            min="0.01"
            placeholder="150.00"
            className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 outline-none focus:border-rose-400/60"
          />
        </label>
        <label className="block text-sm text-white/70">
          Data do pagamento
          <input
            name="paidAt"
            type="date"
            defaultValue={today}
            className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 outline-none focus:border-rose-400/60"
          />
        </label>
      </div>

      <label className="block text-sm text-white/70">
        Observações
        <textarea
          name="notes"
          rows={3}
          placeholder="Ex.: gasto fixo mensal da operação."
          className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 outline-none focus:border-rose-400/60"
        />
      </label>

      {state.error ? <p className="text-sm text-rose-300">{state.error}</p> : null}
      {state.message ? <p className="text-sm text-emerald-300">{state.message}</p> : null}

      <SubmitButton
        label="Salvar gasto"
        pendingLabel="Salvando gasto..."
        className="w-full bg-rose-400 text-slate-950 hover:bg-rose-300"
      />
    </form>
  );
}
