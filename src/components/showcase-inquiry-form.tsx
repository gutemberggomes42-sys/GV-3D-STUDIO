"use client";

import { useActionState } from "react";
import { SubmitButton } from "@/components/submit-button";
import { createShowcaseInquiryAction, type ActionState } from "@/lib/actions";
import { showcaseLeadTemperatureMeta } from "@/lib/constants";
import type { DbShowcaseItem } from "@/lib/db-types";

type ShowcaseInquiryFormProps = {
  items: DbShowcaseItem[];
};

const initialState: ActionState = { ok: false };

export function ShowcaseInquiryForm({ items }: ShowcaseInquiryFormProps) {
  const [state, formAction] = useActionState(createShowcaseInquiryAction, initialState);

  return (
    <form action={formAction} className="space-y-4 rounded-[28px] border border-white/10 bg-white/5 p-6">
      <div>
        <p className="text-xs uppercase tracking-[0.24em] text-white/45">Pedido manual</p>
        <h3 className="mt-2 text-2xl font-semibold">Lançar pedido vindo do WhatsApp</h3>
        <p className="mt-2 text-sm leading-6 text-white/65">
          Use este formulário para cadastrar manualmente um pedido ou contato recebido fora da vitrine.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <label className="block text-sm text-white/70">
          Nome do cliente
          <input
            name="customerName"
            placeholder="Nome do cliente"
            className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 outline-none focus:border-orange-400/60"
          />
        </label>
        <label className="block text-sm text-white/70">
          Telefone / WhatsApp
          <input
            name="customerPhone"
            placeholder="(64) 99999-9999"
            className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 outline-none focus:border-orange-400/60"
          />
        </label>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <label className="block text-sm text-white/70 md:col-span-2">
          Item da vitrine
          <select
            name="itemId"
            className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 outline-none focus:border-orange-400/60"
            defaultValue={items[0]?.id ?? ""}
          >
            {items.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name} · {item.fulfillmentType === "STOCK" ? `estoque ${item.stockQuantity}` : "sob encomenda"}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm text-white/70">
          Quantidade
          <input
            name="quantity"
            type="number"
            min="1"
            step="1"
            defaultValue="1"
            className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 outline-none focus:border-orange-400/60"
          />
        </label>
        <label className="block text-sm text-white/70">
          Status
          <select
            name="status"
            defaultValue="PENDING"
            className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 outline-none focus:border-orange-400/60"
          >
            <option value="PENDING">Aguardando retorno</option>
            <option value="CLOSED">Fechado</option>
            <option value="NOT_CLOSED">Não fechado</option>
          </select>
        </label>
      </div>

      <label className="block text-sm text-white/70">
        E-mail do cliente (opcional)
        <input
          name="customerEmail"
          type="email"
          placeholder="cliente@email.com"
          className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 outline-none focus:border-orange-400/60"
        />
      </label>

      <label className="block text-sm text-white/70">
        Observações
        <textarea
          name="notes"
          rows={3}
          placeholder="Detalhes do pedido, cor combinada, prazo, observações..."
          className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 outline-none focus:border-orange-400/60"
        />
      </label>

      <div className="grid gap-4 md:grid-cols-3">
        <label className="block text-sm text-white/70">
          Temperatura do lead
          <select
            name="leadTemperature"
            defaultValue="WARM"
            className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 outline-none focus:border-orange-400/60"
          >
            {(["COLD", "WARM", "HOT"] as const).map((temperature) => (
              <option key={temperature} value={temperature}>
                {showcaseLeadTemperatureMeta[temperature].label}
              </option>
            ))}
          </select>
        </label>

        <label className="block text-sm text-white/70">
          Próximo follow-up
          <input
            name="followUpAt"
            type="datetime-local"
            className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 outline-none focus:border-orange-400/60"
          />
        </label>

        <label className="block text-sm text-white/70">
          Último contato
          <input
            name="lastContactAt"
            type="datetime-local"
            className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 outline-none focus:border-orange-400/60"
          />
        </label>
      </div>

      <label className="block text-sm text-white/70">
        Etiquetas do lead
        <input
          name="tags"
          placeholder="cliente recorrente, quer video, pediu desconto"
          className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 outline-none focus:border-orange-400/60"
        />
      </label>

      {state.error ? <p className="text-sm text-rose-300">{state.error}</p> : null}
      {state.message ? <p className="text-sm text-emerald-300">{state.message}</p> : null}

      <SubmitButton
        label="Lançar pedido manual"
        pendingLabel="Salvando pedido..."
        disabled={!items.length}
        className="w-full bg-orange-500 text-slate-950 hover:bg-orange-400 disabled:bg-slate-700"
      />
    </form>
  );
}
