"use client";

import { useActionState } from "react";
import { SubmitButton } from "@/components/submit-button";
import { createShowcaseTestimonialAction, type ActionState } from "@/lib/actions";

const initialState: ActionState = { ok: false };

export function ShowcaseTestimonialForm() {
  const [state, formAction] = useActionState(createShowcaseTestimonialAction, initialState);
  const fields = state.fields ?? {};

  return (
    <form action={formAction} encType="multipart/form-data" className="space-y-4 rounded-[28px] border border-white/10 bg-white/5 p-6">
      <div>
        <p className="text-xs uppercase tracking-[0.24em] text-white/45">Prova social</p>
        <h3 className="mt-2 text-2xl font-semibold">Cadastrar depoimento real</h3>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <label className="block text-sm text-white/70">
          Nome
          <input name="customerName" defaultValue={fields.customerName ?? ""} className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 outline-none focus:border-orange-400/60" />
        </label>
        <label className="block text-sm text-white/70">
          Cidade
          <input name="city" defaultValue={fields.city ?? ""} className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 outline-none focus:border-orange-400/60" />
        </label>
        <label className="block text-sm text-white/70">
          Produto
          <input name="productName" defaultValue={fields.productName ?? ""} className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 outline-none focus:border-orange-400/60" />
        </label>
        <label className="block text-sm text-white/70">
          Ordem
          <input name="sortOrder" type="number" min="0" step="1" defaultValue={fields.sortOrder ?? "0"} className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 outline-none focus:border-orange-400/60" />
        </label>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <label className="block text-sm text-white/70">
          Papel / contexto
          <input name="role" defaultValue={fields.role ?? ""} placeholder="Cliente recorrente, colecionador..." className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 outline-none focus:border-orange-400/60" />
        </label>
        <label className="block text-sm text-white/70">
          Instagram
          <input name="instagramHandle" defaultValue={fields.instagramHandle ?? ""} placeholder="@cliente" className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 outline-none focus:border-orange-400/60" />
        </label>
      </div>

      <label className="block text-sm text-white/70">
        Depoimento
        <textarea name="quote" rows={4} defaultValue={fields.quote ?? ""} className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 outline-none focus:border-orange-400/60" />
      </label>

      <div className="grid gap-4 md:grid-cols-2">
        <label className="block text-sm text-white/70">
          Foto por URL
          <input name="imageUrl" defaultValue={fields.imageUrl ?? ""} placeholder="/uploads/cliente.jpg" className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 outline-none focus:border-orange-400/60" />
        </label>
        <label className="block text-sm text-white/70">
          Foto da galeria
          <input name="testimonialImageFile" type="file" accept="image/png,image/jpeg,image/webp,image/gif" className="mt-2 block w-full rounded-2xl border border-dashed border-white/15 bg-slate-950/70 px-4 py-3 text-white/70 file:mr-4 file:rounded-xl file:border-0 file:bg-orange-500 file:px-4 file:py-2 file:font-semibold file:text-slate-950" />
        </label>
      </div>

      <label className="inline-flex items-center gap-3 rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3 text-sm text-white/75">
        <input type="checkbox" name="featured" defaultChecked={fields.featured !== "false"} className="h-4 w-4 rounded border-white/20" />
        Exibir na home e na página de depoimentos
      </label>

      {state.error ? <p className="text-sm text-rose-300">{state.error}</p> : null}
      {state.message ? <p className="text-sm text-emerald-300">{state.message}</p> : null}

      <SubmitButton label="Salvar depoimento" pendingLabel="Salvando depoimento..." className="w-full bg-orange-500 text-slate-950 hover:bg-orange-400" />
    </form>
  );
}
