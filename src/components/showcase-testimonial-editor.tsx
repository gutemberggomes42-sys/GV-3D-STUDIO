"use client";

import { useActionState } from "react";
import {
  deleteShowcaseTestimonialAction,
  type ActionState,
  updateShowcaseTestimonialAction,
} from "@/lib/actions";
import type { DbShowcaseTestimonial } from "@/lib/db-types";
import { SubmitButton } from "@/components/submit-button";

const initialState: ActionState = { ok: false };

type ShowcaseTestimonialEditorProps = {
  testimonial: DbShowcaseTestimonial;
};

export function ShowcaseTestimonialEditor({ testimonial }: ShowcaseTestimonialEditorProps) {
  const [updateState, updateAction] = useActionState(updateShowcaseTestimonialAction, initialState);
  const [deleteState, deleteAction] = useActionState(deleteShowcaseTestimonialAction, initialState);
  const fields = updateState.fields ?? {};

  return (
    <article className="rounded-[24px] border border-white/10 bg-slate-950/60 p-5">
      <form action={updateAction} encType="multipart/form-data" className="space-y-4">
        <input type="hidden" name="testimonialId" value={testimonial.id} />

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <label className="block text-sm text-white/70">
            Nome
            <input name="customerName" defaultValue={fields.customerName ?? testimonial.customerName} className="mt-2 w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 outline-none focus:border-orange-400/60" />
          </label>
          <label className="block text-sm text-white/70">
            Cidade
            <input name="city" defaultValue={fields.city ?? testimonial.city ?? ""} className="mt-2 w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 outline-none focus:border-orange-400/60" />
          </label>
          <label className="block text-sm text-white/70">
            Produto
            <input name="productName" defaultValue={fields.productName ?? testimonial.productName ?? ""} className="mt-2 w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 outline-none focus:border-orange-400/60" />
          </label>
          <label className="block text-sm text-white/70">
            Ordem
            <input name="sortOrder" type="number" min="0" step="1" defaultValue={fields.sortOrder ?? String(testimonial.sortOrder)} className="mt-2 w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 outline-none focus:border-orange-400/60" />
          </label>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <label className="block text-sm text-white/70">
            Papel / contexto
            <input name="role" defaultValue={fields.role ?? testimonial.role ?? ""} className="mt-2 w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 outline-none focus:border-orange-400/60" />
          </label>
          <label className="block text-sm text-white/70">
            Instagram
            <input name="instagramHandle" defaultValue={fields.instagramHandle ?? testimonial.instagramHandle ?? ""} className="mt-2 w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 outline-none focus:border-orange-400/60" />
          </label>
        </div>

        <label className="block text-sm text-white/70">
          Depoimento
          <textarea name="quote" rows={4} defaultValue={fields.quote ?? testimonial.quote} className="mt-2 w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 outline-none focus:border-orange-400/60" />
        </label>

        <div className="grid gap-4 md:grid-cols-2">
          <label className="block text-sm text-white/70">
            Foto por URL
            <input name="imageUrl" defaultValue={fields.imageUrl ?? testimonial.imageUrl ?? ""} className="mt-2 w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 outline-none focus:border-orange-400/60" />
          </label>
          <label className="block text-sm text-white/70">
            Trocar foto
            <input name="testimonialImageFile" type="file" accept="image/png,image/jpeg,image/webp,image/gif" className="mt-2 block w-full rounded-2xl border border-dashed border-white/15 bg-black/30 px-4 py-3 text-white/70 file:mr-4 file:rounded-xl file:border-0 file:bg-orange-500 file:px-4 file:py-2 file:font-semibold file:text-slate-950" />
          </label>
        </div>

        <label className="inline-flex items-center gap-3 rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white/75">
          <input type="checkbox" name="featured" defaultChecked={fields.featured ? fields.featured === "true" : testimonial.featured} className="h-4 w-4 rounded border-white/20" />
          Exibir na loja
        </label>

        {updateState.error ? <p className="text-sm text-rose-300">{updateState.error}</p> : null}
        {updateState.message ? <p className="text-sm text-emerald-300">{updateState.message}</p> : null}

        <SubmitButton label="Salvar depoimento" pendingLabel="Salvando..." className="w-full bg-orange-500 text-slate-950 hover:bg-orange-400" />
      </form>

      <form action={deleteAction} onSubmit={(event) => {
        if (!window.confirm("Excluir este depoimento da loja?")) {
          event.preventDefault();
        }
      }} className="mt-4 rounded-2xl border border-rose-400/20 bg-rose-500/5 p-4">
        <input type="hidden" name="testimonialId" value={testimonial.id} />
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="font-semibold text-rose-100">Excluir depoimento</p>
            <p className="mt-1 text-sm text-rose-100/75">Use apenas quando esse depoimento não deve mais aparecer publicamente.</p>
          </div>
          <SubmitButton label="Excluir depoimento" pendingLabel="Excluindo..." className="bg-rose-500/90 text-white hover:bg-rose-400" />
        </div>
        {deleteState.error ? <p className="mt-3 text-sm text-rose-200">{deleteState.error}</p> : null}
      </form>
    </article>
  );
}
