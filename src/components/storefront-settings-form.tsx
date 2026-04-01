"use client";

import { useActionState } from "react";
import { SubmitButton } from "@/components/submit-button";
import { type ActionState, updateStorefrontSettingsAction } from "@/lib/actions";
import type { DbStorefrontSettings } from "@/lib/db-types";

const initialState: ActionState = { ok: false };

type StorefrontSettingsFormProps = {
  settings: DbStorefrontSettings;
};

export function StorefrontSettingsForm({ settings }: StorefrontSettingsFormProps) {
  const [state, formAction] = useActionState(updateStorefrontSettingsAction, initialState);
  const fields = state.fields ?? {};

  return (
    <form action={formAction} className="space-y-5 rounded-[28px] border border-white/10 bg-white/5 p-6">
      <div>
        <p className="text-xs uppercase tracking-[0.24em] text-white/45">Loja pública</p>
        <h3 className="mt-2 text-2xl font-semibold">Banner, textos e presença da marca</h3>
        <p className="mt-2 text-sm leading-6 text-white/65">
          Edite a mensagem de boas-vindas, prova de confiança, Instagram, portfólio e SEO da loja.
        </p>
      </div>

      <section className="space-y-4 rounded-[24px] border border-white/10 bg-black/20 p-5">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <label className="block text-sm text-white/70">
            Nome da loja
            <input
              name="brandName"
              defaultValue={fields.brandName ?? settings.brandName}
              className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 outline-none focus:border-orange-400/60"
            />
          </label>
          <label className="block text-sm text-white/70">
            Chamada curta
            <input
              name="heroEyebrow"
              defaultValue={fields.heroEyebrow ?? settings.heroEyebrow}
              className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 outline-none focus:border-orange-400/60"
            />
          </label>
          <label className="block text-sm text-white/70">
            Aviso acima da vitrine
            <input
              name="announcementText"
              defaultValue={fields.announcementText ?? settings.announcementText ?? ""}
              placeholder="Mensagem curta de recepcao"
              className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 outline-none focus:border-orange-400/60"
            />
          </label>
        </div>

        <label className="block text-sm text-white/70">
          Título principal do banner
          <textarea
            name="heroTitle"
            rows={2}
            defaultValue={fields.heroTitle ?? settings.heroTitle}
            className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 outline-none focus:border-orange-400/60"
          />
        </label>

        <label className="block text-sm text-white/70">
          Subtítulo do banner
          <textarea
            name="heroSubtitle"
            rows={3}
            defaultValue={fields.heroSubtitle ?? settings.heroSubtitle}
            className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 outline-none focus:border-orange-400/60"
          />
        </label>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <label className="block text-sm text-white/70">
            Botão principal
            <input
              name="heroPrimaryCtaLabel"
              defaultValue={fields.heroPrimaryCtaLabel ?? settings.heroPrimaryCtaLabel}
              className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 outline-none focus:border-orange-400/60"
            />
          </label>
          <label className="block text-sm text-white/70">
            Botão secundário
            <input
              name="heroSecondaryCtaLabel"
              defaultValue={fields.heroSecondaryCtaLabel ?? settings.heroSecondaryCtaLabel}
              className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 outline-none focus:border-orange-400/60"
            />
          </label>
          <label className="block text-sm text-white/70 md:col-span-2 xl:col-span-1">
            Destaques do topo
            <textarea
              name="heroHighlights"
              rows={3}
              defaultValue={fields.heroHighlights ?? settings.heroHighlights.join("\n")}
              placeholder={"Informacoes reais\nPronta entrega e encomenda\nAtendimento rapido"}
              className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 outline-none focus:border-orange-400/60"
            />
          </label>
        </div>
      </section>

      <section className="grid gap-5 xl:grid-cols-2">
        <div className="space-y-4 rounded-[24px] border border-white/10 bg-black/20 p-5">
          <label className="block text-sm text-white/70">
            Título &quot;Quem somos&quot;
            <input
              name="aboutTitle"
              defaultValue={fields.aboutTitle ?? settings.aboutTitle}
              className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 outline-none focus:border-orange-400/60"
            />
          </label>
          <label className="block text-sm text-white/70">
            Texto &quot;Quem somos&quot;
            <textarea
              name="aboutBody"
              rows={4}
              defaultValue={fields.aboutBody ?? settings.aboutBody}
              className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 outline-none focus:border-orange-400/60"
            />
          </label>
          <label className="block text-sm text-white/70">
            Título &quot;Como funciona a encomenda&quot;
            <input
              name="customOrderTitle"
              defaultValue={fields.customOrderTitle ?? settings.customOrderTitle}
              className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 outline-none focus:border-orange-400/60"
            />
          </label>
          <label className="block text-sm text-white/70">
            Texto &quot;Como funciona a encomenda&quot;
            <textarea
              name="customOrderBody"
              rows={4}
              defaultValue={fields.customOrderBody ?? settings.customOrderBody}
              className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 outline-none focus:border-orange-400/60"
            />
          </label>
        </div>

        <div className="space-y-4 rounded-[24px] border border-white/10 bg-black/20 p-5">
          <label className="block text-sm text-white/70">
            Prazo médio
            <textarea
              name="averageLeadTimeText"
              rows={2}
              defaultValue={fields.averageLeadTimeText ?? settings.averageLeadTimeText}
              className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 outline-none focus:border-orange-400/60"
            />
          </label>
          <label className="block text-sm text-white/70">
            Materiais usados
            <textarea
              name="materialsText"
              rows={3}
              defaultValue={fields.materialsText ?? settings.materialsText}
              className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 outline-none focus:border-orange-400/60"
            />
          </label>
          <label className="block text-sm text-white/70">
            Cuidados com a peça
            <textarea
              name="careText"
              rows={3}
              defaultValue={fields.careText ?? settings.careText}
              className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 outline-none focus:border-orange-400/60"
            />
          </label>
        </div>
      </section>

      <section className="grid gap-5 xl:grid-cols-2">
        <div className="space-y-4 rounded-[24px] border border-white/10 bg-black/20 p-5">
          <label className="block text-sm text-white/70">
            Título da entrega
            <input
              name="shippingTitle"
              defaultValue={fields.shippingTitle ?? settings.shippingTitle}
              className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 outline-none focus:border-orange-400/60"
            />
          </label>
          <label className="block text-sm text-white/70">
            Texto da entrega
            <textarea
              name="shippingBody"
              rows={4}
              defaultValue={fields.shippingBody ?? settings.shippingBody}
              className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 outline-none focus:border-orange-400/60"
            />
          </label>
          <label className="block text-sm text-white/70">
            URL do Instagram
            <input
              name="instagramUrl"
              defaultValue={fields.instagramUrl ?? settings.instagramUrl ?? ""}
              placeholder="https://instagram.com/sua_loja"
              className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 outline-none focus:border-orange-400/60"
            />
          </label>
          <label className="block text-sm text-white/70">
            @ do Instagram
            <input
              name="instagramHandle"
              defaultValue={fields.instagramHandle ?? settings.instagramHandle ?? ""}
              placeholder="@gv3dstudio"
              className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 outline-none focus:border-orange-400/60"
            />
          </label>
        </div>

        <div className="space-y-4 rounded-[24px] border border-white/10 bg-black/20 p-5">
          <label className="block text-sm text-white/70">
            Título do portfólio
            <input
              name="portfolioTitle"
              defaultValue={fields.portfolioTitle ?? settings.portfolioTitle}
              className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 outline-none focus:border-orange-400/60"
            />
          </label>
          <label className="block text-sm text-white/70">
            Texto do portfólio
            <textarea
              name="portfolioBody"
              rows={4}
              defaultValue={fields.portfolioBody ?? settings.portfolioBody}
              className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 outline-none focus:border-orange-400/60"
            />
          </label>
          <label className="block text-sm text-white/70">
            URL da imagem de compartilhamento
            <input
              name="shareImageUrl"
              defaultValue={fields.shareImageUrl ?? settings.shareImageUrl ?? ""}
              placeholder="/uploads/capa-loja.jpg"
              className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 outline-none focus:border-orange-400/60"
            />
          </label>
        </div>
      </section>

      <section className="space-y-4 rounded-[24px] border border-white/10 bg-black/20 p-5">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-white/45">SEO</p>
          <h4 className="mt-2 text-lg font-semibold text-white/92">Google e compartilhamento</h4>
        </div>

        <label className="block text-sm text-white/70">
          Título SEO
          <input
            name="seoTitle"
            defaultValue={fields.seoTitle ?? settings.seoTitle}
            className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 outline-none focus:border-orange-400/60"
          />
        </label>
        <label className="block text-sm text-white/70">
          Descrição SEO
          <textarea
            name="seoDescription"
            rows={3}
            defaultValue={fields.seoDescription ?? settings.seoDescription}
            className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 outline-none focus:border-orange-400/60"
          />
        </label>
        <label className="block text-sm text-white/70">
          Palavras-chave SEO
          <textarea
            name="seoKeywords"
            rows={3}
            defaultValue={fields.seoKeywords ?? settings.seoKeywords.join("\n")}
            placeholder={"impressao 3d\npecas geek\npresentes personalizados"}
            className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 outline-none focus:border-orange-400/60"
          />
        </label>
      </section>

      {state.error ? <p className="text-sm text-rose-300">{state.error}</p> : null}
      {state.message ? <p className="text-sm text-emerald-300">{state.message}</p> : null}

      <SubmitButton
        label="Salvar configuracoes da loja"
        pendingLabel="Salvando configuracoes..."
        className="w-full bg-orange-500 text-slate-950 hover:bg-orange-400"
      />
    </form>
  );
}
