"use client";

import { useActionState } from "react";
import {
  deleteShowcaseLibraryAction,
  type ActionState,
  updateShowcaseLibraryAction,
} from "@/lib/actions";
import type { DbShowcaseLibrary } from "@/lib/db-types";
import { SubmitButton } from "@/components/submit-button";

const initialState: ActionState = { ok: false };

type ShowcaseLibraryEditorProps = {
  library: DbShowcaseLibrary;
  linkedItemCount: number;
};

export function ShowcaseLibraryEditor({
  library,
  linkedItemCount,
}: ShowcaseLibraryEditorProps) {
  const [updateState, updateAction] = useActionState(updateShowcaseLibraryAction, initialState);
  const [deleteState, deleteAction] = useActionState(deleteShowcaseLibraryAction, initialState);
  const fields = updateState.fields ?? {};

  return (
    <article className="rounded-[24px] border border-white/10 bg-slate-950/60 p-5">
      <form action={updateAction} encType="multipart/form-data" className="space-y-4">
        <input type="hidden" name="libraryId" value={library.id} />

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <label className="block text-sm text-white/70 xl:col-span-2">
            Nome da biblioteca
            <input
              name="name"
              defaultValue={fields.name ?? library.name}
              className="mt-2 w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 outline-none focus:border-orange-400/60"
            />
          </label>
          <label className="block text-sm text-white/70">
            Ordem
            <input
              name="sortOrder"
              type="number"
              min="0"
              step="1"
              defaultValue={fields.sortOrder ?? String(library.sortOrder)}
              className="mt-2 w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 outline-none focus:border-orange-400/60"
            />
          </label>
          <label className="inline-flex items-center gap-3 rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white/75">
            <input
              type="checkbox"
              name="active"
              defaultChecked={fields.active ? fields.active === "true" : library.active}
              className="h-4 w-4 rounded border-white/20"
            />
            Exibir na vitrine
          </label>
        </div>

        <div className="grid gap-4 md:grid-cols-[220px_minmax(0,1fr)]">
          <div className="overflow-hidden rounded-[22px] border border-white/10 bg-black/20">
            {library.coverImageUrl ? (
              <img src={library.coverImageUrl} alt={library.name} className="h-44 w-full object-cover" />
            ) : (
              <div className="flex h-44 items-center justify-center bg-[radial-gradient(circle_at_top_left,_rgba(255,122,24,0.35),_transparent_30%),radial-gradient(circle_at_bottom_right,_rgba(89,185,255,0.2),_transparent_34%),linear-gradient(145deg,_rgba(8,12,18,0.98),_rgba(10,18,28,0.96))] px-4 text-center text-sm text-white/55">
                Sem capa definida para esta biblioteca.
              </div>
            )}
          </div>

          <div className="space-y-4">
            <div className="rounded-2xl border border-white/10 bg-black/25 px-4 py-3">
              <p className="text-[11px] uppercase tracking-[0.18em] text-white/45">Produtos vinculados</p>
              <p className="mt-2 text-lg font-semibold text-white">{linkedItemCount}</p>
            </div>

            <label className="block text-sm text-white/70">
              Descrição curta
              <textarea
                name="description"
                rows={4}
                defaultValue={fields.description ?? library.description ?? ""}
                className="mt-2 w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 outline-none focus:border-orange-400/60"
              />
            </label>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <label className="block text-sm text-white/70">
            Capa por URL
            <input
              name="coverImageUrl"
              defaultValue={fields.coverImageUrl ?? library.coverImageUrl ?? ""}
              className="mt-2 w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 outline-none focus:border-orange-400/60"
            />
          </label>
          <label className="block text-sm text-white/70">
            Trocar capa
            <input
              name="coverImageFile"
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif"
              className="mt-2 block w-full rounded-2xl border border-dashed border-white/15 bg-black/30 px-4 py-3 text-white/70 file:mr-4 file:rounded-xl file:border-0 file:bg-orange-500 file:px-4 file:py-2 file:font-semibold file:text-slate-950"
            />
          </label>
        </div>

        {updateState.error ? <p className="text-sm text-rose-300">{updateState.error}</p> : null}
        {updateState.message ? <p className="text-sm text-emerald-300">{updateState.message}</p> : null}

        <SubmitButton
          label="Salvar biblioteca"
          pendingLabel="Salvando..."
          className="w-full bg-orange-500 text-slate-950 hover:bg-orange-400"
        />
      </form>

      <form
        action={deleteAction}
        onSubmit={(event) => {
          if (!window.confirm("Excluir esta biblioteca? Os produtos ficarão sem vínculo.")) {
            event.preventDefault();
          }
        }}
        className="mt-4 rounded-2xl border border-rose-400/20 bg-rose-500/5 p-4"
      >
        <input type="hidden" name="libraryId" value={library.id} />
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="font-semibold text-rose-100">Excluir biblioteca</p>
            <p className="mt-1 text-sm text-rose-100/75">
              Os produtos vinculados continuam existindo, mas ficam sem biblioteca definida.
            </p>
          </div>
          <SubmitButton
            label="Excluir biblioteca"
            pendingLabel="Excluindo..."
            className="bg-rose-500/90 text-white hover:bg-rose-400"
          />
        </div>
        {deleteState.error ? <p className="mt-3 text-sm text-rose-200">{deleteState.error}</p> : null}
      </form>
    </article>
  );
}
