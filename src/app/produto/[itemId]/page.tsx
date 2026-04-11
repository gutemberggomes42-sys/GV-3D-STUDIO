/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import {
  ArrowLeft,
  Boxes,
  Clock3,
  MessageCircleMore,
  PackageCheck,
  Ruler,
  SwatchBook,
} from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { ShowcaseProductGallery } from "@/components/showcase-product-gallery";
import { ShowcaseProductPurchasePanel } from "@/components/showcase-product-purchase-panel";
import { ShowcaseViewTracker } from "@/components/showcase-view-tracker";
import { ShowcaseWishlistButton } from "@/components/showcase-wishlist-button";
import { getCurrentUser } from "@/lib/auth";
import { formatHours } from "@/lib/format";
import {
  getShowcaseAvailabilityLabel,
  getShowcaseCategoryLabel,
  getShowcaseColorHex,
  getShowcaseColorSummary,
  getShowcaseDeliverySummary,
  getShowcaseGallery,
  getShowcaseLeadTimeLabel,
  getShowcasePrimaryVideo,
} from "@/lib/showcase";
import { getHydratedData } from "@/lib/view-data";

type ShowcaseProductPageProps = {
  params: Promise<{ itemId: string }>;
};

export async function generateMetadata({
  params,
}: ShowcaseProductPageProps): Promise<Metadata> {
  const { itemId } = await params;
  const { showcaseItems, storefrontSettings } = await getHydratedData();
  const item = showcaseItems.find((candidate) => candidate.id === itemId && candidate.active);

  if (!item) {
    return {
      title: storefrontSettings.seoTitle,
      description: storefrontSettings.seoDescription,
    };
  }

  return {
    title: item.seoTitle ?? `${item.name} | ${storefrontSettings.brandName}`,
    description: item.seoDescription ?? item.tagline ?? item.description,
    keywords: item.seoKeywords.length ? item.seoKeywords : storefrontSettings.seoKeywords,
    openGraph: {
      title: item.seoTitle ?? `${item.name} | ${storefrontSettings.brandName}`,
      description: item.seoDescription ?? item.description,
      images: item.imageUrl
        ? [item.imageUrl]
        : storefrontSettings.shareImageUrl
          ? [storefrontSettings.shareImageUrl]
          : [],
    },
  };
}

export default async function ShowcaseProductPage({ params }: ShowcaseProductPageProps) {
  const user = await getCurrentUser();
  const { itemId } = await params;
  const { showcaseItems } = await getHydratedData();
  const item = showcaseItems.find((candidate) => candidate.id === itemId && candidate.active);

  if (!item) {
    notFound();
  }

  const gallery = getShowcaseGallery(item);
  const visibleColors = item.colorOptions.slice(0, 6);
  const extraColors = Math.max(item.colorOptions.length - visibleColors.length, 0);
  const variantOptions = item.variants.filter((variant) => variant.active);

  return (
    <AppShell
      user={user}
      pathname="/"
      title={item.name}
      subtitle="Este é o preview da peça. Se ela for a certa para você, escolha os detalhes e siga para o WhatsApp ou para o carrinho."
    >
      <ShowcaseViewTracker itemId={item.id} />

      <div className="flex flex-wrap items-center gap-3">
        <Link
          href="/"
          className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-white/80 transition hover:bg-white/10 hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar para a biblioteca
        </Link>
        <span className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-white/65">
          {getShowcaseCategoryLabel(item)}
        </span>
        <ShowcaseWishlistButton itemId={item.id} className="px-4 py-2" />
      </div>

      <section className="grid gap-5 xl:grid-cols-[1.02fr_0.98fr] xl:gap-6">
        <article className="rounded-[28px] border border-white/10 bg-white/[0.04] p-4 sm:rounded-[32px] sm:p-6">
          {gallery.length || item.videoUrl ? (
            <ShowcaseProductGallery
              images={gallery}
              videoUrl={getShowcasePrimaryVideo(item)}
              productName={item.name}
            />
          ) : (
            <div className="h-[360px] rounded-[30px] bg-[radial-gradient(circle_at_top_left,_rgba(255,122,24,0.35),_transparent_28%),radial-gradient(circle_at_bottom_right,_rgba(89,185,255,0.22),_transparent_32%),linear-gradient(135deg,_rgba(255,255,255,0.08),_rgba(15,23,42,0.95))] sm:h-[460px]" />
          )}
        </article>

        <article className="rounded-[28px] border border-white/10 bg-[linear-gradient(160deg,rgba(9,13,20,0.97),rgba(4,8,14,0.99))] p-5 sm:rounded-[32px] sm:p-8">
          <div className="flex flex-wrap gap-2">
            <span className="rounded-full border border-white/10 bg-white/6 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-white/80">
              {getShowcaseCategoryLabel(item)}
            </span>
            <span className="rounded-full border border-emerald-400/25 bg-emerald-400/15 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-100">
              {getShowcaseAvailabilityLabel(item)}
            </span>
            <span className="rounded-full border border-cyan-400/25 bg-cyan-400/15 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan-100">
              {getShowcaseLeadTimeLabel(item)}
            </span>
            {item.videoUrl ? (
              <span className="rounded-full border border-fuchsia-400/25 bg-fuchsia-400/15 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-fuchsia-100">
                Preview com video
              </span>
            ) : null}
          </div>

          <h3 className="mt-5 text-3xl font-semibold tracking-tight sm:text-4xl">{item.name}</h3>
          {item.tagline ? (
            <p className="mt-4 text-base leading-7 text-white/80 sm:text-lg sm:leading-8">{item.tagline}</p>
          ) : null}

          <div className="mt-6 rounded-[24px] border border-white/10 bg-white/[0.03] p-4 sm:rounded-[28px] sm:p-5">
            <p className="text-xs uppercase tracking-[0.2em] text-white/45">Preview da peça</p>
            <p className="mt-3 text-sm leading-7 text-white/74">{item.description}</p>
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            <div className="rounded-[22px] border border-white/10 bg-white/[0.03] p-4 sm:rounded-[24px]">
              <div className="flex items-center gap-3">
                <Boxes className="h-4 w-4 text-orange-200" />
                <p className="text-[11px] uppercase tracking-[0.18em] text-white/45">Disponibilidade</p>
              </div>
              <p className="mt-3 text-base font-semibold text-white/88">{getShowcaseAvailabilityLabel(item)}</p>
            </div>
            <div className="rounded-[22px] border border-white/10 bg-white/[0.03] p-4 sm:rounded-[24px]">
              <div className="flex items-center gap-3">
                <Clock3 className="h-4 w-4 text-cyan-200" />
                <p className="text-[11px] uppercase tracking-[0.18em] text-white/45">Prazo</p>
              </div>
              <p className="mt-3 text-base font-semibold text-white/88">{getShowcaseLeadTimeLabel(item)}</p>
            </div>
            <div className="rounded-[22px] border border-white/10 bg-white/[0.03] p-4 sm:rounded-[24px]">
              <div className="flex items-center gap-3">
                <PackageCheck className="h-4 w-4 text-emerald-200" />
                <p className="text-[11px] uppercase tracking-[0.18em] text-white/45">Material</p>
              </div>
              <p className="mt-3 text-base font-semibold text-white/88">{item.materialLabel ?? "Sob consulta"}</p>
            </div>
            <div className="rounded-[22px] border border-white/10 bg-white/[0.03] p-4 sm:rounded-[24px]">
              <div className="flex items-center gap-3">
                <SwatchBook className="h-4 w-4 text-fuchsia-200" />
                <p className="text-[11px] uppercase tracking-[0.18em] text-white/45">Cores</p>
              </div>
              {visibleColors.length ? (
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  {visibleColors.map((color) => (
                    <span
                      key={color}
                      title={color}
                      className="h-6 w-6 rounded-full ring-2 ring-white/10"
                      style={{ backgroundColor: getShowcaseColorHex(color) }}
                    />
                  ))}
                  {extraColors ? (
                    <span className="rounded-full border border-white/10 bg-white/5 px-2 py-1 text-[11px] font-semibold text-white/70">
                      +{extraColors}
                    </span>
                  ) : null}
                </div>
              ) : (
                <p className="mt-3 text-base font-semibold text-white/88">{getShowcaseColorSummary(item)}</p>
              )}
            </div>
            <div className="rounded-[22px] border border-white/10 bg-white/[0.03] p-4 sm:rounded-[24px]">
              <div className="flex items-center gap-3">
                <Ruler className="h-4 w-4 text-amber-200" />
                <p className="text-[11px] uppercase tracking-[0.18em] text-white/45">Medidas</p>
              </div>
              <p className="mt-3 text-base font-semibold text-white/88">{item.dimensionSummary ?? "Sob consulta"}</p>
            </div>
            <div className="rounded-[22px] border border-white/10 bg-white/[0.03] p-4 sm:rounded-[24px]">
              <div className="flex items-center gap-3">
                <Clock3 className="h-4 w-4 text-orange-200" />
                <p className="text-[11px] uppercase tracking-[0.18em] text-white/45">Impressao</p>
              </div>
              <p className="mt-3 text-base font-semibold text-white/88">{formatHours(item.estimatedPrintHours)}</p>
            </div>
          </div>

          <div className="mt-6 rounded-[24px] border border-white/10 bg-white/[0.03] p-4 sm:rounded-[28px] sm:p-5">
            <p className="text-xs uppercase tracking-[0.2em] text-white/45">Entrega e acabamento</p>
            <p className="mt-3 text-sm leading-7 text-white/74">{getShowcaseDeliverySummary(item)}</p>

            {variantOptions.length || item.sizeOptions.length || item.finishOptions.length ? (
              <div className="mt-4 flex flex-wrap gap-2">
                {variantOptions.slice(0, 4).map((variant) => (
                  <span
                    key={variant.id}
                    className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/82"
                  >
                    {variant.label}
                  </span>
                ))}
                {item.sizeOptions.slice(0, 2).map((size) => (
                  <span
                    key={size}
                    className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/82"
                  >
                    {size}
                  </span>
                ))}
                {item.finishOptions.slice(0, 2).map((finish) => (
                  <span
                    key={finish}
                    className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/82"
                  >
                    {finish}
                  </span>
                ))}
              </div>
            ) : null}
          </div>

          <div
            id="buy-panel"
            className="mt-8 scroll-mt-24 rounded-[24px] border border-emerald-400/15 bg-emerald-500/[0.06] p-4 sm:rounded-[28px] sm:p-5"
          >
            <p className="text-xs uppercase tracking-[0.2em] text-emerald-100/70">Escolher esta peça</p>
            <h4 className="mt-3 text-xl font-semibold sm:text-2xl">
              Se este preview for o certo, escolha os detalhes e continue
            </h4>
            <p className="mt-3 text-sm leading-6 text-white/68">
              Aqui você só define a peça e a forma de continuar. O envio para o WhatsApp e o carrinho ficam disponíveis logo abaixo.
            </p>
            <ShowcaseProductPurchasePanel item={item} />
          </div>
        </article>
      </section>

      <div className="fixed inset-x-4 bottom-4 z-20 lg:hidden">
        <div className="rounded-[28px] border border-white/10 bg-slate-950/88 p-4 shadow-[0_24px_60px_rgba(0,0,0,0.35)] backdrop-blur-xl">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.18em] text-white/45">Preview pronto</p>
              <p className="mt-1 text-base font-semibold text-white/88">{getShowcaseLeadTimeLabel(item)}</p>
            </div>
            <a
              href="#buy-panel"
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-emerald-400 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-emerald-300"
            >
              <MessageCircleMore className="h-4 w-4" />
              Escolher peça
            </a>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
