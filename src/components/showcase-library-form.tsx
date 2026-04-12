"use client";

import { useActionState } from "react";
import { SubmitButton } from "@/components/submit-button";
import { createShowcaseLibraryAction, type ActionState } from "@/lib/actions";

const initialState: ActionState = { ok: false };

export function ShowcaseLibraryForm() {
  const [state, formAction] = useActionState(createShowcaseLibraryAction, initialState);
  const fields = state.fields ?? {};

  return (
    <form
      action={formAction}
      encType="multipart/form-data"
      className="space-y-4 rounded-[28px] border border-white/10 bg-white/5 p-6"
    >
      <div>
        <p className="text-xs uppercase tracking-[0.24em] text-white/45">Bibliotecas</p>
        <h3 className="mt-2 text-2xl font-semibold">Cadastrar nova biblioteca</h3>
        <p className="mt-2 text-sm leading-6 text-white/65">
          Crie as coleções que vão organizar a biblioteca pública da loja.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <label className="block text-sm text-white/70 xl:col-span-2">
          Nome da biblioteca
          <input
            name="name"
            defaultValue={fields.name ?? ""}
            placeholder="Biblioteca premium"
            className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 outline-none focus:border-orange-400/60"
          />
        </label>
        <label className="block text-sm text-white/70">
          Ordem
          <input
            name="sortOrder"
            type="number"
            min="0"
            step="1"
            defaultValue={fields.sortOrder ?? "0"}
            className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 outline-none focus:border-orange-400/60"
          />
        </label>
        <label className="inline-flex items-center gap-3 rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3 text-sm text-white/75">
          <input
            type="checkbox"
            name="active"
            defaultChecked={fields.active !== "false"}
            className="h-4 w-4 rounded border-white/20"
          />
          Exibir na vitrine
        </label>
      </div>

      <label className="block text-sm text-white/70">
        Descrição curta
        <textarea
          name="description"
          rows={3}
          defaultValue={fields.description ?? ""}
          placeholder="Explique rapidamente o estilo dessa coleção."
          className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 outline-none focus:border-orange-400/60"
        />
      </label>

      <div className="grid gap-4 md:grid-cols-2">
        <label className="block text-sm text-white/70">
          Capa por URL
          <input
            name="coverImageUrl"
            defaultValue={fields.coverImageUrl ?? ""}
            placeholder="/uploads/minha-biblioteca.jpg"
            className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 outline-none focus:border-orange-400/60"
          />
        </label>
        <label className="block text-sm text-white/70">
          Capa da galeria
          <input
            name="coverImageFile"
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif"
            className="mt-2 block w-full rounded-2xl border border-dashed border-white/15 bg-slate-950/70 px-4 py-3 text-white/70 file:mr-4 file:rounded-xl file:border-0 file:bg-orange-500 file:px-4 file:py-2 file:font-semibold file:text-slate-950"
          />
        </label>
      </div>

      {state.error ? <p className="text-sm text-rose-300">{state.error}</p> : null}
      {state.message ? <p className="text-sm text-emerald-300">{state.message}</p> : null}

      <SubmitButton
        label="Salvar biblioteca"
        pendingLabel="Salvando biblioteca..."
        className="w-full bg-orange-500 text-slate-950 hover:bg-orange-400"
      />
    </form>
  );
}
