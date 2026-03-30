/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowRight, Boxes, Clock3, MessageCircleMore, PackageCheck, Ruler, SwatchBook } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { ShowcaseProductGallery } from "@/components/showcase-product-gallery";
import { getCurrentUser } from "@/lib/auth";
import { formatCurrency, formatHours } from "@/lib/format";
import {
  getShowcaseAvailabilityLabel,
  getShowcaseCategoryLabel,
  getShowcaseColorHex,
  getShowcaseColorSummary,
  getShowcaseGallery,
  getShowcaseLeadTimeLabel,
  getShowcasePrimaryVideo,
} from "@/lib/showcase";
import { getHydratedData } from "@/lib/view-data";

type ShowcaseProductPageProps = {
  params: Promise<{ itemId: string }>;
};

export default async function ShowcaseProductPage({ params }: ShowcaseProductPageProps) {
  const user = await getCurrentUser();
  const { itemId } = await params;
  const { showcaseItems } = await getHydratedData();
  const item = showcaseItems.find((candidate) => candidate.id === itemId && candidate.active);

  if (!item) {
    notFound();
  }

  const gallery = getShowcaseGallery(item);
  const relatedItems = showcaseItems
    .filter(
      (candidate) =>
        candidate.id !== item.id &&
        candidate.active &&
        candidate.category === item.category,
    )
    .slice(0, 3);
  const visibleColors = item.colorOptions.slice(0, 5);
  const extraColors = Math.max(item.colorOptions.length - visibleColors.length, 0);
  const buyLabel =
    item.fulfillmentType === "STOCK" ? "Comprar pelo WhatsApp" : "Encomendar pelo WhatsApp";

  return (
    <AppShell
      user={user}
      pathname="/"
      title={item.name}
      subtitle="Mais contexto visual, informacoes reais e acesso rapido ao WhatsApp para converter melhor."
    >
      <section className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <article className="rounded-[32px] border border-white/10 bg-white/[0.04] p-5 sm:p-6">
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

        <article className="rounded-[32px] border border-white/10 bg-[linear-gradient(160deg,rgba(9,13,20,0.97),rgba(4,8,14,0.99))] p-6 sm:p-8">
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
                Com video
              </span>
            ) : null}
          </div>

          <h3 className="mt-5 text-4xl font-semibold tracking-tight">{item.name}</h3>
          {item.tagline ? (
            <p className="mt-4 text-lg leading-8 text-white/80">{item.tagline}</p>
          ) : null}

          <div className="mt-6 flex items-end justify-between gap-4 rounded-[28px] border border-white/10 bg-white/[0.03] p-5">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-white/45">Valor</p>
              <p className="mt-2 text-4xl font-semibold">{formatCurrency(item.price)}</p>
            </div>
            <div className="text-right">
              <p className="text-xs uppercase tracking-[0.2em] text-white/45">Fluxo</p>
              <p className="mt-2 text-sm font-semibold text-white/82">WhatsApp sem cadastro obrigatorio</p>
            </div>
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            <div className="rounded-[24px] border border-white/10 bg-white/[0.03] p-4">
              <div className="flex items-center gap-3">
                <Boxes className="h-4 w-4 text-orange-200" />
                <p className="text-[11px] uppercase tracking-[0.18em] text-white/45">Disponibilidade</p>
              </div>
              <p className="mt-3 text-base font-semibold text-white/88">{getShowcaseAvailabilityLabel(item)}</p>
            </div>
            <div className="rounded-[24px] border border-white/10 bg-white/[0.03] p-4">
              <div className="flex items-center gap-3">
                <Clock3 className="h-4 w-4 text-cyan-200" />
                <p className="text-[11px] uppercase tracking-[0.18em] text-white/45">Prazo</p>
              </div>
              <p className="mt-3 text-base font-semibold text-white/88">{getShowcaseLeadTimeLabel(item)}</p>
            </div>
            <div className="rounded-[24px] border border-white/10 bg-white/[0.03] p-4">
              <div className="flex items-center gap-3">
                <PackageCheck className="h-4 w-4 text-emerald-200" />
                <p className="text-[11px] uppercase tracking-[0.18em] text-white/45">Material</p>
              </div>
              <p className="mt-3 text-base font-semibold text-white/88">{item.materialLabel ?? "Sob consulta"}</p>
            </div>
            <div className="rounded-[24px] border border-white/10 bg-white/[0.03] p-4">
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
            <div className="rounded-[24px] border border-white/10 bg-white/[0.03] p-4">
              <div className="flex items-center gap-3">
                <Ruler className="h-4 w-4 text-amber-200" />
                <p className="text-[11px] uppercase tracking-[0.18em] text-white/45">Medidas</p>
              </div>
              <p className="mt-3 text-base font-semibold text-white/88">{item.dimensionSummary ?? "Sob consulta"}</p>
            </div>
            <div className="rounded-[24px] border border-white/10 bg-white/[0.03] p-4">
              <div className="flex items-center gap-3">
                <Clock3 className="h-4 w-4 text-orange-200" />
                <p className="text-[11px] uppercase tracking-[0.18em] text-white/45">Impressao</p>
              </div>
              <p className="mt-3 text-base font-semibold text-white/88">{formatHours(item.estimatedPrintHours)}</p>
            </div>
          </div>

          <p className="mt-6 text-sm leading-7 text-white/72">{item.description}</p>

          <div id="buy-panel" className="mt-8 rounded-[28px] border border-emerald-400/15 bg-emerald-500/[0.06] p-5">
            <p className="text-xs uppercase tracking-[0.2em] text-emerald-100/70">Compra sem atrito</p>
            <h4 className="mt-3 text-2xl font-semibold">Escolha a quantidade e va direto para o WhatsApp</h4>
            <p className="mt-3 text-sm leading-6 text-white/68">
              O cliente informa nome e telefone na proxima tela e a conversa ja abre com a mensagem pronta.
            </p>

            <form action={`/comprar/${item.id}`} className="mt-5 grid gap-3 sm:grid-cols-[140px_minmax(0,1fr)]">
              <label className="block text-sm text-white/70">
                Quantidade
                <input
                  name="quantity"
                  type="number"
                  min="1"
                  max={item.fulfillmentType === "STOCK" ? Math.max(item.stockQuantity, 1) : 999}
                  defaultValue="1"
                  className="mt-2 w-full rounded-2xl border border-white/10 bg-black/35 px-4 py-3 text-white outline-none focus:border-orange-400/60"
                />
              </label>
              <button
                type="submit"
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-emerald-400 px-5 py-4 text-sm font-semibold text-slate-950 transition hover:bg-emerald-300"
              >
                <MessageCircleMore className="h-4 w-4" />
                {buyLabel}
              </button>
            </form>

            <div className="mt-4 flex flex-wrap gap-3">
              <Link
                href="/"
                className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-black/25 px-5 py-3 text-sm font-semibold text-white/85 transition hover:bg-white/10"
              >
                <ArrowLeft className="h-4 w-4" />
                Voltar para a vitrine
              </Link>
            </div>
          </div>
        </article>
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-[28px] border border-white/10 bg-white/[0.04] p-5">
          <p className="text-xs uppercase tracking-[0.2em] text-white/45">Passo 1</p>
          <p className="mt-3 text-xl font-semibold">Escolha a quantidade</p>
          <p className="mt-3 text-sm leading-6 text-white/68">
            A peca ja tem valor, prazo e disponibilidade visiveis para a decisao ser mais rapida.
          </p>
        </div>
        <div className="rounded-[28px] border border-white/10 bg-white/[0.04] p-5">
          <p className="text-xs uppercase tracking-[0.2em] text-white/45">Passo 2</p>
          <p className="mt-3 text-xl font-semibold">Informe nome e telefone</p>
          <p className="mt-3 text-sm leading-6 text-white/68">
            A tela seguinte pede so o essencial para abrir a conversa com a mensagem pronta.
          </p>
        </div>
        <div className="rounded-[28px] border border-white/10 bg-white/[0.04] p-5">
          <p className="text-xs uppercase tracking-[0.2em] text-white/45">Passo 3</p>
          <p className="mt-3 text-xl font-semibold">Conversa abre no WhatsApp</p>
          <p className="mt-3 text-sm leading-6 text-white/68">
            O interesse fica registrado no sistema e voce continua o fechamento direto no atendimento.
          </p>
        </div>
      </section>

      {relatedItems.length ? (
        <section className="rounded-[30px] border border-white/10 bg-white/[0.04] p-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.24em] text-white/45">Mesma categoria</p>
              <h3 className="mt-2 text-2xl font-semibold">Outras pecas que combinam com esta vitrine</h3>
            </div>
            <Link href="/" className="inline-flex items-center gap-2 text-sm font-semibold text-orange-200 transition hover:text-orange-100">
              Ver catalogo completo
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {relatedItems.map((relatedItem) => (
              <Link
                key={relatedItem.id}
                href={`/produto/${relatedItem.id}`}
                className="overflow-hidden rounded-[26px] border border-white/10 bg-black/25 transition hover:border-white/20 hover:bg-black/30"
              >
                <div className="h-52 overflow-hidden">
                  {getShowcaseGallery(relatedItem)[0] ? (
                    <img
                      src={getShowcaseGallery(relatedItem)[0]}
                      alt={relatedItem.name}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="h-full bg-[radial-gradient(circle_at_top_left,_rgba(255,122,24,0.35),_transparent_28%),radial-gradient(circle_at_bottom_right,_rgba(89,185,255,0.22),_transparent_32%),linear-gradient(135deg,_rgba(255,255,255,0.08),_rgba(15,23,42,0.95))]" />
                  )}
                </div>
                <div className="p-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-white/45">{relatedItem.category}</p>
                  <h4 className="mt-2 text-xl font-semibold">{relatedItem.name}</h4>
                  <p className="mt-3 text-sm text-white/65">{formatCurrency(relatedItem.price)}</p>
                </div>
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      <div className="fixed inset-x-4 bottom-4 z-20 lg:hidden">
        <div className="rounded-[28px] border border-white/10 bg-slate-950/88 p-4 shadow-[0_24px_60px_rgba(0,0,0,0.35)] backdrop-blur-xl">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.18em] text-white/45">Valor</p>
              <p className="mt-1 text-2xl font-semibold">{formatCurrency(item.price)}</p>
            </div>
            <a
              href="#buy-panel"
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-emerald-400 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-emerald-300"
            >
              <MessageCircleMore className="h-4 w-4" />
              Comprar
            </a>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
