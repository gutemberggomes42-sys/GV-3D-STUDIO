"use client";

import { useActionState } from "react";
import { StatusPill } from "@/components/status-pill";
import { SubmitButton } from "@/components/submit-button";
import {
  deleteShowcaseInquiryAction,
  updateShowcaseInquiryAction,
  updateShowcaseInquiryStatusAction,
  type ActionState,
} from "@/lib/actions";
import {
  showcaseInquiryStatusMeta,
  showcaseLeadTemperatureMeta,
} from "@/lib/constants";
import type { DbShowcaseInquiry, DbShowcaseItem } from "@/lib/db-types";
import { formatCurrency, formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";

type ShowcaseInquiryEditorProps = {
  inquiry: DbShowcaseInquiry;
  items: DbShowcaseItem[];
};

const initialState: ActionState = { ok: false };

export function ShowcaseInquiryEditor({
  inquiry,
  items,
}: ShowcaseInquiryEditorProps) {
  const [state, formAction] = useActionState(updateShowcaseInquiryAction, initialState);
  const [deleteState, deleteAction] = useActionState(deleteShowcaseInquiryAction, initialState);
  const contactDetails = [inquiry.customerEmail, inquiry.customerPhone]
    .filter((value) => Boolean(value))
    .join(" · ");
  const sourceLabel = inquiry.source === "MANUAL" ? "Manual" : "Catálogo";
  const followUpLabel = inquiry.followUpAt ? formatDateTime(new Date(inquiry.followUpAt)) : "Sem follow-up";
  const lastContactLabel = inquiry.lastContactAt
    ? formatDateTime(new Date(inquiry.lastContactAt))
    : "Sem contato registrado";

  return (
    <article className="rounded-[24px] border border-white/10 bg-slate-950/60 p-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <p className="text-lg font-semibold">{inquiry.customerName}</p>
            <span className="rounded-full border border-white/10 bg-black/30 px-3 py-1 text-xs text-white/65">
              {sourceLabel}
            </span>
            <StatusPill {...showcaseLeadTemperatureMeta[inquiry.leadTemperature]} />
          </div>
          <p className="mt-1 text-sm text-white/60">
            {contactDetails || "Contato informado no clique da vitrine"}
          </p>
          <p className="mt-3 text-sm leading-6 text-white/70">
            Produto: <span className="font-semibold text-white">{inquiry.itemName}</span>
            {" · "}Quantidade: {inquiry.quantity}
          </p>
          {inquiry.estimatedTotal != null ? (
            <p className="mt-2 text-sm text-white/60">
              Valor estimado: {formatCurrency(inquiry.estimatedTotal)}
            </p>
          ) : null}
          {(inquiry.selectedVariantLabel || inquiry.desiredColor || inquiry.desiredSize || inquiry.desiredFinish) ? (
            <div className="mt-3 flex flex-wrap gap-2 text-xs text-white/55">
              {inquiry.selectedVariantLabel ? (
                <span className="rounded-full border border-white/10 bg-black/30 px-3 py-1">
                  Variacao: {inquiry.selectedVariantLabel}
                </span>
              ) : null}
              {inquiry.desiredColor ? (
                <span className="rounded-full border border-white/10 bg-black/30 px-3 py-1">
                  Cor: {inquiry.desiredColor}
                </span>
              ) : null}
              {inquiry.desiredSize ? (
                <span className="rounded-full border border-white/10 bg-black/30 px-3 py-1">
                  Tamanho: {inquiry.desiredSize}
                </span>
              ) : null}
              {inquiry.desiredFinish ? (
                <span className="rounded-full border border-white/10 bg-black/30 px-3 py-1">
                  Acabamento: {inquiry.desiredFinish}
                </span>
              ) : null}
              {inquiry.couponCode ? (
                <span className="rounded-full border border-emerald-400/20 bg-emerald-500/10 px-3 py-1 text-emerald-100">
                  Cupom: {inquiry.couponCode}
                </span>
              ) : null}
            </div>
          ) : null}
          <div className="mt-3 flex flex-wrap gap-2 text-xs text-white/55">
            <span className="rounded-full border border-white/10 bg-black/30 px-3 py-1">
              Follow-up: {followUpLabel}
            </span>
            <span className="rounded-full border border-white/10 bg-black/30 px-3 py-1">
              Último contato: {lastContactLabel}
            </span>
            {inquiry.tags.length ? (
              inquiry.tags.map((tag) => (
                <span
                  key={tag}
                  className="rounded-full border border-sky-400/20 bg-sky-500/10 px-3 py-1 text-sky-100"
                >
                  {tag}
                </span>
              ))
            ) : (
              <span className="rounded-full border border-white/10 bg-black/30 px-3 py-1">
                Sem etiquetas
              </span>
            )}
          </div>
          <p className="mt-2 text-xs uppercase tracking-[0.18em] text-white/40">
            Clique registrado em {formatDateTime(new Date(inquiry.createdAt))}
          </p>
        </div>

        <div className="flex flex-col gap-3 lg:items-end">
          <StatusPill {...showcaseInquiryStatusMeta[inquiry.status]} />
          <a
            href={inquiry.whatsappUrl}
            target="_blank"
            rel="noreferrer"
            className="rounded-2xl border border-emerald-400/25 bg-emerald-500/15 px-4 py-3 text-sm font-semibold text-emerald-50 transition hover:bg-emerald-500/25"
          >
            Abrir conversa
          </a>
        </div>
      </div>

      <form action={formAction} className="mt-5 space-y-4">
        <input type="hidden" name="inquiryId" value={inquiry.id} />

        <div className="grid gap-4 md:grid-cols-2">
          <label className="block text-sm text-white/70">
            Nome do cliente
            <input
              name="customerName"
              defaultValue={inquiry.customerName}
              className="mt-2 w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 outline-none focus:border-orange-400/60"
            />
          </label>
          <label className="block text-sm text-white/70">
            Telefone / WhatsApp
            <input
              name="customerPhone"
              defaultValue={inquiry.customerPhone ?? ""}
              className="mt-2 w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 outline-none focus:border-orange-400/60"
            />
          </label>
        </div>

        <div className="grid gap-4 md:grid-cols-4">
          <label className="block text-sm text-white/70 md:col-span-2">
            Item da vitrine
            <select
              name="itemId"
            defaultValue={inquiry.itemId}
            className="mt-2 w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 outline-none focus:border-orange-400/60"
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
              defaultValue={inquiry.quantity}
              className="mt-2 w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 outline-none focus:border-orange-400/60"
            />
          </label>
          <label className="block text-sm text-white/70">
            Status
            <select
              name="status"
              defaultValue={inquiry.status}
              className="mt-2 w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 outline-none focus:border-orange-400/60"
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
            defaultValue={inquiry.customerEmail}
            className="mt-2 w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 outline-none focus:border-orange-400/60"
          />
        </label>

        <label className="block text-sm text-white/70">
          Observações
          <textarea
            name="notes"
            rows={3}
            defaultValue={inquiry.notes ?? ""}
            className="mt-2 w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 outline-none focus:border-orange-400/60"
          />
        </label>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <label className="block text-sm text-white/70">
            Temperatura do lead
            <select
              name="leadTemperature"
              defaultValue={inquiry.leadTemperature}
              className="mt-2 w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 outline-none focus:border-orange-400/60"
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
              defaultValue={inquiry.followUpAt?.slice(0, 16) ?? ""}
              className="mt-2 w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 outline-none focus:border-orange-400/60"
            />
          </label>

          <label className="block text-sm text-white/70">
            Último contato
            <input
              name="lastContactAt"
              type="datetime-local"
              defaultValue={inquiry.lastContactAt?.slice(0, 16) ?? ""}
              className="mt-2 w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 outline-none focus:border-orange-400/60"
            />
          </label>

          <label className="block text-sm text-white/70">
            Etiquetas
            <input
              name="tags"
              defaultValue={inquiry.tags.join(", ")}
              className="mt-2 w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 outline-none focus:border-orange-400/60"
            />
          </label>
        </div>

        {state.error ? <p className="text-sm text-rose-300">{state.error}</p> : null}
        {state.message ? <p className="text-sm text-emerald-300">{state.message}</p> : null}

        <SubmitButton
          label="Salvar alterações do pedido"
          pendingLabel="Salvando..."
          className="w-full bg-orange-500 text-slate-950 hover:bg-orange-400"
        />
      </form>

      <div className="mt-5 flex flex-wrap gap-3">
        {(["PENDING", "CLOSED", "NOT_CLOSED"] as const).map((status) => (
          <form key={status} action={updateShowcaseInquiryStatusAction}>
            <input type="hidden" name="inquiryId" value={inquiry.id} />
            <input type="hidden" name="status" value={status} />
            <SubmitButton
              label={showcaseInquiryStatusMeta[status].label}
              pendingLabel="Atualizando..."
              className={cn(
                inquiry.status === status
                  ? "bg-white text-slate-950 hover:bg-white/90"
                  : "bg-white/8 text-white hover:bg-white/14",
              )}
            />
          </form>
        ))}
      </div>

      <form action={deleteAction} className="mt-4 rounded-2xl border border-rose-400/20 bg-rose-500/5 p-4">
        <input type="hidden" name="inquiryId" value={inquiry.id} />
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="font-semibold text-rose-100">Excluir pedido do WhatsApp</p>
            <p className="mt-1 text-sm text-rose-100/75">
              Se este pedido estiver como fechado, o estoque do item volta automaticamente ao excluir.
            </p>
          </div>
          <SubmitButton
            label="Excluir pedido"
            pendingLabel="Excluindo..."
            className="bg-rose-500/90 text-white hover:bg-rose-400"
          />
        </div>
        {deleteState.error ? <p className="mt-3 text-sm text-rose-200">{deleteState.error}</p> : null}
        {deleteState.message ? <p className="mt-3 text-sm text-emerald-300">{deleteState.message}</p> : null}
      </form>
    </article>
  );
}
