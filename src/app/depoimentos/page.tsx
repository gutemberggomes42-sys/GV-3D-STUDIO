/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import type { Metadata } from "next";
import { ArrowLeft, ArrowRight, Camera, MessageCircleMore, Star } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { getCurrentUser } from "@/lib/auth";
import { ownerWhatsAppNumber } from "@/lib/constants";
import { getHydratedData } from "@/lib/view-data";

export async function generateMetadata(): Promise<Metadata> {
  const { storefrontSettings } = await getHydratedData();

  return {
    title: `Depoimentos | ${storefrontSettings.brandName}`,
    description: `Veja como clientes descrevem a experiencia com ${storefrontSettings.brandName}.`,
    openGraph: {
      title: `Depoimentos | ${storefrontSettings.brandName}`,
      description: storefrontSettings.seoDescription,
      images: storefrontSettings.shareImageUrl ? [storefrontSettings.shareImageUrl] : [],
    },
  };
}

export default async function TestimonialsPage() {
  const user = await getCurrentUser();
  const { storefrontSettings, showcaseTestimonials } = await getHydratedData();
  const testimonials = [...showcaseTestimonials]
    .filter((testimonial) => testimonial.featured)
    .sort((left, right) => left.sortOrder - right.sortOrder);

  return (
    <AppShell
      user={user}
      pathname="/"
      title="Depoimentos reais"
      subtitle="Uma pagina para reunir prova social, mostrar a experiencia da loja e reforcar confianca antes da conversa no WhatsApp."
    >
      <div className="flex flex-wrap items-center gap-3">
        <Link
          href="/"
          className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-white/80 transition hover:bg-white/10 hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar para a vitrine
        </Link>
      </div>

      <section className="rounded-[32px] border border-white/10 bg-[radial-gradient(circle_at_top_left,_rgba(255,122,24,0.18),_transparent_28%),linear-gradient(145deg,_rgba(5,7,12,0.98),_rgba(8,14,22,0.94))] p-6 sm:p-8">
        <p className="text-xs uppercase tracking-[0.26em] text-orange-200/70">Prova social da loja</p>
        <h2 className="mt-3 text-4xl font-semibold">Quem compra volta, indica e fala sobre a experiencia</h2>
        <p className="mt-4 max-w-3xl text-sm leading-7 text-white/72 sm:text-base">
          {storefrontSettings.aboutBody}
        </p>

        <div className="mt-6 flex flex-wrap gap-3">
          <a
            href={`https://wa.me/${ownerWhatsAppNumber}`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 rounded-2xl bg-emerald-400 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-emerald-300"
          >
            <MessageCircleMore className="h-4 w-4" />
            Falar no WhatsApp
          </a>
          {storefrontSettings.instagramUrl ? (
            <a
              href={storefrontSettings.instagramUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/8 px-5 py-3 text-sm font-semibold text-white/92 transition hover:bg-white/12"
            >
              <Camera className="h-4 w-4" />
              {storefrontSettings.instagramHandle || "Instagram"}
            </a>
          ) : null}
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-[28px] border border-white/10 bg-white/[0.04] p-5">
          <p className="text-xs uppercase tracking-[0.22em] text-white/45">Quem somos</p>
          <p className="mt-4 text-sm leading-7 text-white/72">{storefrontSettings.aboutBody}</p>
        </div>
        <div className="rounded-[28px] border border-white/10 bg-white/[0.04] p-5">
          <p className="text-xs uppercase tracking-[0.22em] text-white/45">Encomenda</p>
          <p className="mt-4 text-sm leading-7 text-white/72">{storefrontSettings.customOrderBody}</p>
        </div>
        <div className="rounded-[28px] border border-white/10 bg-white/[0.04] p-5">
          <p className="text-xs uppercase tracking-[0.22em] text-white/45">Entrega</p>
          <p className="mt-4 text-sm leading-7 text-white/72">{storefrontSettings.shippingBody}</p>
        </div>
      </section>

      <section className="grid gap-5 xl:grid-cols-2">
        {testimonials.length ? (
          testimonials.map((testimonial) => (
            <article key={testimonial.id} className="rounded-[30px] border border-white/10 bg-white/[0.04] p-6">
              <div className="flex items-center gap-4">
                {testimonial.imageUrl ? (
                  <img
                    src={testimonial.imageUrl}
                    alt={testimonial.customerName}
                    className="h-16 w-16 rounded-[22px] object-cover"
                  />
                ) : (
                  <div className="flex h-16 w-16 items-center justify-center rounded-[22px] bg-orange-500/20 text-xl font-semibold text-orange-100">
                    {testimonial.customerName.slice(0, 1)}
                  </div>
                )}
                <div>
                  <p className="text-xl font-semibold">{testimonial.customerName}</p>
                  <p className="text-sm text-white/55">
                    {[testimonial.city, testimonial.role, testimonial.instagramHandle]
                      .filter(Boolean)
                      .join(" · ") || "Cliente da loja"}
                  </p>
                </div>
              </div>

              <div className="mt-5 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-white/75">
                <Star className="h-3.5 w-3.5 text-orange-200" />
                Depoimento real
              </div>

              <p className="mt-5 text-base leading-8 text-white/78">&quot;{testimonial.quote}&quot;</p>

              {testimonial.productName ? (
                <p className="mt-4 text-sm font-semibold text-orange-100">
                  Produto citado: {testimonial.productName}
                </p>
              ) : null}
            </article>
          ))
        ) : (
          <div className="rounded-[28px] border border-dashed border-white/15 bg-slate-950/40 p-8 text-sm text-white/60 xl:col-span-2">
            Ainda nao ha depoimentos publicados na loja.
          </div>
        )}
      </section>

      <section className="rounded-[30px] border border-white/10 bg-white/[0.04] p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.24em] text-white/45">Confiança</p>
            <h3 className="mt-2 text-2xl font-semibold">Quer ver as pecas ou tirar uma duvida?</h3>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-white/70">
              Volte para a vitrine, veja os detalhes do produto e continue a compra no WhatsApp com atendimento direto.
            </p>
          </div>
          <Link
            href="/"
            className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/8 px-5 py-3 text-sm font-semibold text-white/92 transition hover:bg-white/12"
          >
            Voltar para a vitrine
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>
    </AppShell>
  );
}
