/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import {
  ArrowLeft,
  ArrowRight,
  Boxes,
  Clock3,
  HeartHandshake,
  MessageCircleMore,
  PackageCheck,
  Ruler,
  ShieldCheck,
  Sparkles,
  SwatchBook,
} from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { ShowcaseProductPurchasePanel } from "@/components/showcase-product-purchase-panel";
import { ShowcaseProductGallery } from "@/components/showcase-product-gallery";
import { ShowcaseViewTracker } from "@/components/showcase-view-tracker";
import { ShowcaseWishlistButton } from "@/components/showcase-wishlist-button";
import { getCurrentUser } from "@/lib/auth";
import type { DbShowcaseItem, DbShowcaseTestimonial } from "@/lib/db-types";
import { formatCurrency, formatHours } from "@/lib/format";
import {
  getShowcaseAvailabilityLabel,
  getShowcaseCategoryLabel,
  getShowcaseColorHex,
  getShowcaseColorSummary,
  getShowcaseDeliverySummary,
  getShowcaseGallery,
  getShowcaseLeadTimeLabel,
  getShowcaseLowestPrice,
  getShowcasePrimaryVideo,
} from "@/lib/showcase";
import { getHydratedData } from "@/lib/view-data";

type ShowcaseProductPageProps = {
  params: Promise<{ itemId: string }>;
};

function uniqueList(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)));
}

function getIdealUseCases(item: DbShowcaseItem) {
  const normalizedCategory = item.category.toLowerCase();
  const normalizedName = item.name.toLowerCase();

  return uniqueList([
    normalizedCategory.includes("decor") || normalizedCategory.includes("casa")
      ? "Dar destaque ao ambiente"
      : "",
    normalizedCategory.includes("geek") || normalizedCategory.includes("games") || normalizedName.includes("dragon")
      ? "Presentear quem ama cultura pop"
      : "",
    normalizedCategory.includes("organiz")
      ? "Organizar com mais estilo"
      : "",
    normalizedCategory.includes("colecion")
      ? "Exibir na colecao"
      : "",
    "Criar um cantinho com personalidade",
    "Ter uma peca diferente do comum",
  ]).slice(0, 4);
}

function getProductPromises(item: DbShowcaseItem) {
  return uniqueList([
    item.fulfillmentType === "STOCK" ? "Estoque real na vitrine" : "Producao por encomenda com prazo claro",
    item.videoUrl ? "Fotos e video para mostrar melhor a peca" : "Galeria visual para entender o acabamento",
    "Atendimento direto no WhatsApp",
    item.materialLabel ? `Material principal: ${item.materialLabel}` : "Material e cores sob consulta",
  ]).slice(0, 4);
}

function getMatchingTestimonials(
  item: DbShowcaseItem,
  testimonials: DbShowcaseTestimonial[],
) {
  return testimonials
    .filter(
      (testimonial) =>
        testimonial.featured &&
        (!testimonial.productName ||
          testimonial.productName.toLowerCase().includes(item.name.toLowerCase()) ||
          item.name.toLowerCase().includes(testimonial.productName.toLowerCase())),
    )
    .slice(0, 2);
}

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
    description:
      item.seoDescription ?? item.tagline ?? getShowcaseCategoryLabel(item),
    keywords: item.seoKeywords.length ? item.seoKeywords : storefrontSettings.seoKeywords,
    openGraph: {
      title: item.seoTitle ?? `${item.name} | ${storefrontSettings.brandName}`,
      description: item.seoDescription ?? item.description,
      images: item.imageUrl ? [item.imageUrl] : storefrontSettings.shareImageUrl ? [storefrontSettings.shareImageUrl] : [],
    },
  };
}

export default async function ShowcaseProductPage({ params }: ShowcaseProductPageProps) {
  const user = await getCurrentUser();
  const { itemId } = await params;
  const { showcaseItems, showcaseTestimonials, storefrontSettings } = await getHydratedData();
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
  const idealUseCases = getIdealUseCases(item);
  const productPromises = getProductPromises(item);
  const matchingTestimonials = getMatchingTestimonials(item, showcaseTestimonials);
  const variantOptions = item.variants.filter((variant) => variant.active);
  const lowestPrice = getShowcaseLowestPrice(item);

  return (
    <AppShell
      user={user}
      pathname="/"
      title={item.name}
      subtitle="Fotos, video, detalhes reais e um caminho de compra simples para o cliente gostar e seguir rapido para o WhatsApp."
    >
      <ShowcaseViewTracker itemId={item.id} />

      <div className="flex flex-wrap items-center gap-3">
        <Link
          href="/"
          className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-white/80 transition hover:bg-white/10 hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar para a vitrine
        </Link>
        <span className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-white/65">
          {getShowcaseCategoryLabel(item)}
        </span>
        <ShowcaseWishlistButton itemId={item.id} className="px-4 py-2" />
      </div>

      <section className="grid gap-6 xl:grid-cols-[1.02fr_0.98fr]">
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
            {(item.badges ?? []).map((badge) => (
              <span key={badge} className="rounded-full border border-white/10 bg-white/6 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-white/78">
                {badge}
              </span>
            ))}
          </div>

          <h3 className="mt-5 text-4xl font-semibold tracking-tight">{item.name}</h3>
          {item.tagline ? (
            <p className="mt-4 text-lg leading-8 text-white/80">{item.tagline}</p>
          ) : null}

          <div className="mt-6 flex items-end justify-between gap-4 rounded-[28px] border border-white/10 bg-white/[0.03] p-5">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-white/45">Valor da peca</p>
              {item.compareAtPrice ? (
                <p className="mt-2 text-sm text-white/45 line-through">
                  {formatCurrency(item.compareAtPrice)}
                </p>
              ) : null}
              <p className="mt-1 text-4xl font-semibold">{formatCurrency(item.price)}</p>
              {lowestPrice !== item.price ? (
                <p className="mt-2 text-sm text-white/60">
                  Variacoes a partir de {formatCurrency(lowestPrice)}
                </p>
              ) : null}
            </div>
            <div className="text-right">
              <p className="text-xs uppercase tracking-[0.2em] text-white/45">Compra</p>
              <p className="mt-2 text-sm font-semibold text-white/82">Fluxo simples pelo WhatsApp</p>
              {item.promotionLabel ? (
                <p className="mt-2 text-sm text-orange-100">{item.promotionLabel}</p>
              ) : null}
            </div>
          </div>

          <div className="mt-5 rounded-[28px] border border-white/10 bg-black/20 p-5">
            <p className="text-xs uppercase tracking-[0.2em] text-white/45">Ideal para</p>
            <div className="mt-4 flex flex-wrap gap-2">
              {idealUseCases.map((useCase) => (
                <span
                  key={useCase}
                  className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-white/82"
                >
                  {useCase}
                </span>
              ))}
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

          <div className="mt-6 grid gap-4 xl:grid-cols-2">
            <div className="rounded-[28px] border border-white/10 bg-white/[0.03] p-5">
              <p className="text-xs uppercase tracking-[0.2em] text-white/45">Entrega e retirada</p>
              <p className="mt-3 text-sm leading-7 text-white/74">
                {getShowcaseDeliverySummary(item)}
              </p>
            </div>
            <div className="rounded-[28px] border border-white/10 bg-white/[0.03] p-5">
              <p className="text-xs uppercase tracking-[0.2em] text-white/45">Variacoes disponiveis</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {variantOptions.length ? (
                  variantOptions.map((variant) => (
                    <span key={variant.id} className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/82">
                      {variant.label}
                    </span>
                  ))
                ) : (
                  <span className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/82">
                    Produto sem variacao cadastrada
                  </span>
                )}
              </div>
            </div>
          </div>

          {item.couponCode || item.shippingSummary ? (
            <div className="mt-6 grid gap-4 xl:grid-cols-2">
              {item.couponCode ? (
                <div className="rounded-[28px] border border-emerald-400/15 bg-emerald-500/[0.06] p-5">
                  <p className="text-xs uppercase tracking-[0.2em] text-emerald-100/70">Cupom disponivel</p>
                  <p className="mt-3 text-2xl font-semibold text-emerald-50">{item.couponCode}</p>
                  <p className="mt-2 text-sm text-emerald-100/75">
                    {item.couponDiscountPercent
                      ? `${item.couponDiscountPercent}% de desconto na conversa pelo WhatsApp.`
                      : "Mencione esse cupom ao falar com a loja."}
                  </p>
                </div>
              ) : null}
              {item.shippingSummary ? (
                <div className="rounded-[28px] border border-white/10 bg-black/20 p-5">
                  <p className="text-xs uppercase tracking-[0.2em] text-white/45">Resumo de envio</p>
                  <p className="mt-3 text-sm leading-7 text-white/74">{item.shippingSummary}</p>
                </div>
              ) : null}
            </div>
          ) : null}

          <div className="mt-6 rounded-[28px] border border-white/10 bg-white/[0.03] p-5">
            <p className="text-xs uppercase tracking-[0.2em] text-white/45">Descricao</p>
            <p className="mt-3 text-sm leading-7 text-white/74">{item.description}</p>
          </div>

          <div className="mt-6 rounded-[28px] border border-white/10 bg-black/20 p-5">
            <p className="text-xs uppercase tracking-[0.2em] text-white/45">O que voce encontra aqui</p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {productPromises.map((promise) => (
                <div
                  key={promise}
                  className="rounded-[22px] border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-white/78"
                >
                  {promise}
                </div>
              ))}
            </div>
          </div>

          <div id="buy-panel" className="mt-8 rounded-[28px] border border-emerald-400/15 bg-emerald-500/[0.06] p-5">
            <p className="text-xs uppercase tracking-[0.2em] text-emerald-100/70">Compra sem atrito</p>
            <h4 className="mt-3 text-2xl font-semibold">Escolha a quantidade, adicione ao carrinho ou siga para o WhatsApp</h4>
            <p className="mt-3 text-sm leading-6 text-white/68">
              Voce pode reunir varios itens no carrinho ou seguir direto para a tela de contato com nome, telefone e observacao opcional.
            </p>
            <ShowcaseProductPurchasePanel item={item} buyLabel={buyLabel} />
          </div>
        </article>
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-[28px] border border-white/10 bg-white/[0.04] p-5">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-white/75">
            <HeartHandshake className="h-3.5 w-3.5 text-cyan-200" />
            Atendimento
          </div>
          <p className="mt-4 text-xl font-semibold">Conversa humana e direta</p>
          <p className="mt-3 text-sm leading-6 text-white/68">
            O cliente nao precisa criar conta para comprar. Ele ve a peca, escolhe a quantidade e chama no WhatsApp.
          </p>
        </div>
        <div className="rounded-[28px] border border-white/10 bg-white/[0.04] p-5">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-white/75">
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-200" />
            Confianca
          </div>
          <p className="mt-4 text-xl font-semibold">Prazo, estoque e material visiveis</p>
          <p className="mt-3 text-sm leading-6 text-white/68">
            Isso ajuda o cliente a confiar mais rapido, porque a decisao nao depende de informacoes escondidas.
          </p>
        </div>
        <div className="rounded-[28px] border border-white/10 bg-white/[0.04] p-5">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-white/75">
            <Sparkles className="h-3.5 w-3.5 text-fuchsia-200" />
            Visual
          </div>
          <p className="mt-4 text-xl font-semibold">Fotos, video e mais contexto</p>
          <p className="mt-3 text-sm leading-6 text-white/68">
            Uma pagina completa valoriza melhor a peca e deixa a loja com cara mais premium e profissional.
          </p>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-[28px] border border-white/10 bg-white/[0.04] p-5">
          <p className="text-xs uppercase tracking-[0.2em] text-white/45">Passo 1</p>
          <p className="mt-3 text-xl font-semibold">Escolha a quantidade</p>
          <p className="mt-3 text-sm leading-6 text-white/68">
            A peca ja mostra valor, prazo e disponibilidade para facilitar a decisao desde o primeiro clique.
          </p>
        </div>
        <div className="rounded-[28px] border border-white/10 bg-white/[0.04] p-5">
          <p className="text-xs uppercase tracking-[0.2em] text-white/45">Passo 2</p>
          <p className="mt-3 text-xl font-semibold">Informe nome, telefone e observacao</p>
          <p className="mt-3 text-sm leading-6 text-white/68">
            Na tela seguinte o cliente preenche so o essencial e, se quiser, deixa um detalhe importante sobre o pedido.
          </p>
        </div>
        <div className="rounded-[28px] border border-white/10 bg-white/[0.04] p-5">
          <p className="text-xs uppercase tracking-[0.2em] text-white/45">Passo 3</p>
          <p className="mt-3 text-xl font-semibold">A conversa ja abre no WhatsApp</p>
          <p className="mt-3 text-sm leading-6 text-white/68">
            O interesse fica registrado no sistema e o atendimento continua sem atrito direto na conversa.
          </p>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <div className="rounded-[30px] border border-white/10 bg-white/[0.04] p-6">
          <p className="text-xs uppercase tracking-[0.24em] text-white/45">{storefrontSettings.aboutTitle}</p>
          <h3 className="mt-2 text-2xl font-semibold">Uma compra com contexto real</h3>
          <p className="mt-4 text-sm leading-7 text-white/72">{storefrontSettings.aboutBody}</p>
          <p className="mt-4 text-sm leading-7 text-white/72">{storefrontSettings.materialsText}</p>
          <p className="mt-4 text-sm leading-7 text-white/72">{storefrontSettings.careText}</p>
        </div>

        <div className="rounded-[30px] border border-white/10 bg-white/[0.04] p-6">
          <p className="text-xs uppercase tracking-[0.24em] text-white/45">Entrega e atendimento</p>
          <h3 className="mt-2 text-2xl font-semibold">Tudo pensado para o cliente confiar mais rapido</h3>
          <p className="mt-4 text-sm leading-7 text-white/72">{storefrontSettings.shippingBody}</p>
          <p className="mt-4 text-sm leading-7 text-white/72">{storefrontSettings.customOrderBody}</p>
        </div>
      </section>

      {matchingTestimonials.length ? (
        <section className="rounded-[30px] border border-white/10 bg-white/[0.04] p-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.24em] text-white/45">Quem ja comprou</p>
              <h3 className="mt-2 text-2xl font-semibold">Depoimentos que combinam com esta peca</h3>
            </div>
            <Link href="/depoimentos" className="inline-flex items-center gap-2 text-sm font-semibold text-orange-200 transition hover:text-orange-100">
              Ver mais depoimentos
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>

          <div className="mt-6 grid gap-4 lg:grid-cols-2">
            {matchingTestimonials.map((testimonial) => (
              <article key={testimonial.id} className="rounded-[26px] border border-white/10 bg-slate-950/60 p-5">
                <div className="flex items-center gap-4">
                  {testimonial.imageUrl ? (
                    <img src={testimonial.imageUrl} alt={testimonial.customerName} className="h-14 w-14 rounded-2xl object-cover" />
                  ) : (
                    <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-orange-500/20 text-lg font-semibold text-orange-100">
                      {testimonial.customerName.slice(0, 1)}
                    </div>
                  )}
                  <div>
                    <p className="text-lg font-semibold">{testimonial.customerName}</p>
                    <p className="text-sm text-white/55">{[testimonial.city, testimonial.role].filter(Boolean).join(" · ") || "Cliente da loja"}</p>
                  </div>
                </div>
                <p className="mt-4 text-sm leading-7 text-white/74">&quot;{testimonial.quote}&quot;</p>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      {relatedItems.length ? (
        <section className="rounded-[30px] border border-white/10 bg-white/[0.04] p-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.24em] text-white/45">Mesma categoria</p>
              <h3 className="mt-2 text-2xl font-semibold">Outras pecas que combinam com este estilo</h3>
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
                <div className="relative h-56 overflow-hidden">
                  {getShowcaseGallery(relatedItem)[0] ? (
                    <img
                      src={getShowcaseGallery(relatedItem)[0]}
                      alt={relatedItem.name}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="h-full bg-[radial-gradient(circle_at_top_left,_rgba(255,122,24,0.35),_transparent_28%),radial-gradient(circle_at_bottom_right,_rgba(89,185,255,0.22),_transparent_32%),linear-gradient(135deg,_rgba(255,255,255,0.08),_rgba(15,23,42,0.95))]" />
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/15 to-transparent" />
                  <div className="absolute bottom-4 left-4 right-4">
                    <p className="text-[11px] uppercase tracking-[0.2em] text-white/55">{relatedItem.category}</p>
                    <h4 className="mt-2 text-2xl font-semibold text-white">{relatedItem.name}</h4>
                  </div>
                </div>
                <div className="space-y-3 p-4">
                  <p className="text-sm leading-6 text-white/65">{relatedItem.tagline ?? relatedItem.description}</p>
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-lg font-semibold text-white">{formatCurrency(relatedItem.price)}</p>
                    <span className="inline-flex items-center gap-2 font-semibold text-orange-200">
                      Ver detalhes
                      <ArrowRight className="h-4 w-4" />
                    </span>
                  </div>
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
