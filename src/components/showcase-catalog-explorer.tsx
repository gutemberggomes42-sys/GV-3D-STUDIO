/* eslint-disable @next/next/no-img-element */
"use client";

import Link from "next/link";
import { useDeferredValue, useState } from "react";
import { ArrowRight, Boxes, Clock3, MessageCircleMore, PackageCheck, Search, ShieldCheck, Sparkles, SwatchBook } from "lucide-react";
import type { DbShowcaseItem } from "@/lib/db-types";
import { formatCurrency } from "@/lib/format";
import {
  getShowcaseAvailabilityLabel,
  getShowcaseCategoryLabel,
  getShowcaseCategoryOptions,
  getShowcaseColorSummary,
  getShowcaseLeadTimeLabel,
  getShowcasePrimaryImage,
  getShowcasePrimaryVideo,
  getShowcaseTagline,
} from "@/lib/showcase";

type ShowcaseCatalogExplorerProps = {
  items: DbShowcaseItem[];
  canManage: boolean;
};

type AvailabilityFilter = "ALL" | "STOCK" | "MADE_TO_ORDER";

function matchesAvailability(item: DbShowcaseItem, filter: AvailabilityFilter) {
  if (filter === "ALL") {
    return true;
  }

  return item.fulfillmentType === filter;
}

export function ShowcaseCatalogExplorer({ items, canManage }: ShowcaseCatalogExplorerProps) {
  const [query, setQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("Todos");
  const [availabilityFilter, setAvailabilityFilter] = useState<AvailabilityFilter>("ALL");
  const deferredQuery = useDeferredValue(query.trim().toLowerCase());
  const featuredItem = items.find((item) => item.featured) ?? items[0];
  const categories = getShowcaseCategoryOptions(items);
  const readyItems = items.filter((item) => item.fulfillmentType === "STOCK");
  const customItems = items.filter((item) => item.fulfillmentType === "MADE_TO_ORDER");
  const filteredItems = items.filter((item) => {
    const normalizedCategory = getShowcaseCategoryLabel(item);
    const searchHaystack = [
      item.name,
      item.description,
      item.tagline ?? "",
      normalizedCategory,
      item.materialLabel ?? "",
      item.colorOptions.join(" "),
    ]
      .join(" ")
      .toLowerCase();

    return (
      (selectedCategory === "Todos" || normalizedCategory === selectedCategory) &&
      matchesAvailability(item, availabilityFilter) &&
      (!deferredQuery || searchHaystack.includes(deferredQuery))
    );
  });

  return (
    <section className="space-y-6">
      <section className="overflow-hidden rounded-[32px] border border-white/10 bg-[radial-gradient(circle_at_top_left,_rgba(255,122,24,0.28),_transparent_30%),radial-gradient(circle_at_center_right,_rgba(89,185,255,0.18),_transparent_26%),linear-gradient(140deg,_rgba(5,7,12,0.98),_rgba(8,14,22,0.94))]">
        <div className="grid gap-0 xl:grid-cols-[1.08fr_0.92fr]">
          <div className="p-6 sm:p-8 lg:p-10">
            <p className="text-xs uppercase tracking-[0.28em] text-orange-200/70">Colecao PrintFlow 3D</p>
            <h3 className="mt-4 max-w-3xl text-4xl font-semibold tracking-tight sm:text-5xl">
              Pecas 3D pensadas para impressionar logo no primeiro olhar
            </h3>
            <p className="mt-5 max-w-3xl text-sm leading-7 text-white/72 sm:text-base">
              Uma vitrine mais elegante, com fotos reais, informacoes objetivas e compra direta pelo WhatsApp sem cadastro obrigatorio.
            </p>

            <div className="mt-6 flex flex-wrap gap-3">
              <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/8 px-4 py-2 text-sm text-white/80">
                <ShieldCheck className="h-4 w-4 text-emerald-300" />
                Fotos reais e informacoes reais
              </span>
              <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/8 px-4 py-2 text-sm text-white/80">
                <MessageCircleMore className="h-4 w-4 text-cyan-300" />
                Compra direta no WhatsApp
              </span>
              <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/8 px-4 py-2 text-sm text-white/80">
                <Clock3 className="h-4 w-4 text-orange-300" />
                Prazo e disponibilidade visiveis
              </span>
            </div>

            <div className="mt-8 grid gap-3 sm:grid-cols-3">
              <div className="rounded-[24px] border border-white/10 bg-black/25 p-4 backdrop-blur">
                <p className="text-xs uppercase tracking-[0.22em] text-white/45">Itens ativos</p>
                <p className="mt-3 text-3xl font-semibold">{items.length}</p>
              </div>
              <div className="rounded-[24px] border border-white/10 bg-black/25 p-4 backdrop-blur">
                <p className="text-xs uppercase tracking-[0.22em] text-white/45">Pronta entrega</p>
                <p className="mt-3 text-3xl font-semibold">{readyItems.length}</p>
              </div>
              <div className="rounded-[24px] border border-white/10 bg-black/25 p-4 backdrop-blur">
                <p className="text-xs uppercase tracking-[0.22em] text-white/45">Sob encomenda</p>
                <p className="mt-3 text-3xl font-semibold">{customItems.length}</p>
              </div>
            </div>

            <div className="mt-8 flex flex-wrap gap-3">
              <a
                href="#catalogo-grid"
                className="inline-flex items-center gap-2 rounded-2xl bg-orange-500 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-orange-400"
              >
                Explorar catalogo
                <ArrowRight className="h-4 w-4" />
              </a>
              {featuredItem ? (
                <Link
                  href={`/produto/${featuredItem.id}`}
                  className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/8 px-5 py-3 text-sm font-semibold text-white/90 transition hover:bg-white/12"
                >
                  Ver produto em destaque
                  <Sparkles className="h-4 w-4" />
                </Link>
              ) : null}
              {canManage ? (
                <Link
                  href="/admin?section=vitrine"
                  className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-black/25 px-5 py-3 text-sm font-semibold text-white/85 transition hover:bg-white/10"
                >
                  Gerenciar vitrine
                </Link>
              ) : null}
            </div>
          </div>

          {featuredItem ? (
            <div className="border-t border-white/10 p-4 sm:p-6 xl:border-l xl:border-t-0">
              <article className="overflow-hidden rounded-[30px] border border-white/10 bg-black/25 shadow-[0_24px_80px_rgba(0,0,0,0.32)]">
                <div className="relative h-[320px] overflow-hidden sm:h-[380px]">
                  {getShowcasePrimaryVideo(featuredItem) ? (
                    <video
                      src={getShowcasePrimaryVideo(featuredItem)}
                      className="h-full w-full object-cover"
                      autoPlay
                      muted
                      loop
                      playsInline
                      preload="metadata"
                      poster={getShowcasePrimaryImage(featuredItem)}
                    />
                  ) : getShowcasePrimaryImage(featuredItem) ? (
                    <img
                      src={getShowcasePrimaryImage(featuredItem)}
                      alt={featuredItem.name}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="h-full bg-[radial-gradient(circle_at_top_left,_rgba(255,122,24,0.35),_transparent_28%),radial-gradient(circle_at_bottom_right,_rgba(89,185,255,0.22),_transparent_32%),linear-gradient(135deg,_rgba(255,255,255,0.08),_rgba(15,23,42,0.95))]" />
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/20 to-transparent" />

                  <div className="absolute left-4 top-4 flex flex-wrap gap-2">
                    <span className="rounded-full border border-orange-300/30 bg-orange-500/15 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-orange-100">
                      Produto destaque
                    </span>
                    {getShowcasePrimaryVideo(featuredItem) ? (
                      <span className="rounded-full border border-cyan-300/30 bg-cyan-500/15 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan-100">
                        Com video
                      </span>
                    ) : null}
                    <span className="rounded-full border border-white/15 bg-black/35 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-white/80">
                      {getShowcaseCategoryLabel(featuredItem)}
                    </span>
                  </div>

                  <div className="absolute inset-x-0 bottom-0 p-5 sm:p-6">
                    <div className="flex items-end justify-between gap-4">
                      <div className="max-w-[70%]">
                        <p className="text-[11px] uppercase tracking-[0.22em] text-white/55">
                          {featuredItem.fulfillmentType === "STOCK" ? "Pronta entrega" : "Sob encomenda"}
                        </p>
                        <h4 className="mt-2 text-3xl font-semibold leading-tight">{featuredItem.name}</h4>
                        <p className="mt-3 text-sm leading-6 text-white/75">{getShowcaseTagline(featuredItem)}</p>
                      </div>
                      <div className="rounded-[24px] border border-white/12 bg-slate-950/75 px-4 py-3 text-right backdrop-blur">
                        <p className="text-[11px] uppercase tracking-[0.18em] text-white/45">Valor</p>
                        <p className="mt-2 text-3xl font-semibold">{formatCurrency(featuredItem.price)}</p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="grid gap-3 border-t border-white/10 p-5 sm:grid-cols-3">
                  <div className="rounded-[22px] border border-white/10 bg-white/[0.03] p-4">
                    <p className="text-[11px] uppercase tracking-[0.18em] text-white/45">Disponibilidade</p>
                    <p className="mt-2 text-sm font-semibold text-white/88">{getShowcaseAvailabilityLabel(featuredItem)}</p>
                  </div>
                  <div className="rounded-[22px] border border-white/10 bg-white/[0.03] p-4">
                    <p className="text-[11px] uppercase tracking-[0.18em] text-white/45">Material</p>
                    <p className="mt-2 text-sm font-semibold text-white/88">{featuredItem.materialLabel ?? "Sob consulta"}</p>
                  </div>
                  <div className="rounded-[22px] border border-white/10 bg-white/[0.03] p-4">
                    <p className="text-[11px] uppercase tracking-[0.18em] text-white/45">Prazo</p>
                    <p className="mt-2 text-sm font-semibold text-white/88">{getShowcaseLeadTimeLabel(featuredItem)}</p>
                  </div>
                </div>
              </article>
            </div>
          ) : null}
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-[28px] border border-white/10 bg-white/[0.04] p-5">
          <div className="flex items-center gap-3">
            <div className="rounded-2xl bg-emerald-400/12 p-3 text-emerald-200">
              <PackageCheck className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-white/45">Compra simples</p>
              <p className="mt-1 text-lg font-semibold">Sem cadastro obrigatorio</p>
            </div>
          </div>
          <p className="mt-4 text-sm leading-6 text-white/68">
            O cliente escolhe a peca, informa nome e telefone e vai direto para o WhatsApp.
          </p>
        </div>

        <div className="rounded-[28px] border border-white/10 bg-white/[0.04] p-5">
          <div className="flex items-center gap-3">
            <div className="rounded-2xl bg-orange-400/12 p-3 text-orange-200">
              <Boxes className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-white/45">Informacao visual</p>
              <p className="mt-1 text-lg font-semibold">Mais foco nas pecas</p>
            </div>
          </div>
          <p className="mt-4 text-sm leading-6 text-white/68">
            Cards com menos poluicao, destaque maior para foto, preco, material e disponibilidade.
          </p>
        </div>

        <div className="rounded-[28px] border border-white/10 bg-white/[0.04] p-5">
          <div className="flex items-center gap-3">
            <div className="rounded-2xl bg-cyan-400/12 p-3 text-cyan-200">
              <SwatchBook className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-white/45">Detalhe que vende</p>
              <p className="mt-1 text-lg font-semibold">Pagina completa por produto</p>
            </div>
          </div>
          <p className="mt-4 text-sm leading-6 text-white/68">
            Cada item agora pode abrir uma pagina propria com galeria, especificacoes e CTA mais forte.
          </p>
        </div>
      </section>

      <section className="rounded-[30px] border border-white/10 bg-white/[0.04] p-5 sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.24em] text-white/45">Filtro rapido</p>
            <h3 className="mt-2 text-2xl font-semibold">Encontre a peca ideal</h3>
          </div>

          <div className="relative w-full lg:max-w-sm">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-white/35" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Buscar por nome, material ou categoria"
              className="w-full rounded-2xl border border-white/10 bg-slate-950/70 py-3 pl-11 pr-4 text-sm text-white outline-none transition focus:border-orange-400/60"
            />
          </div>
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setSelectedCategory("Todos")}
            className={`rounded-full border px-4 py-2 text-sm font-medium transition ${
              selectedCategory === "Todos"
                ? "border-orange-400/40 bg-orange-500/15 text-orange-100"
                : "border-white/10 bg-white/5 text-white/70 hover:bg-white/10"
            }`}
          >
            Todas
          </button>
          {categories.map((category) => (
            <button
              key={category}
              type="button"
              onClick={() => setSelectedCategory(category)}
              className={`rounded-full border px-4 py-2 text-sm font-medium transition ${
                selectedCategory === category
                  ? "border-orange-400/40 bg-orange-500/15 text-orange-100"
                  : "border-white/10 bg-white/5 text-white/70 hover:bg-white/10"
              }`}
            >
              {category}
            </button>
          ))}
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {[
            { id: "ALL", label: "Tudo" },
            { id: "STOCK", label: "Pronta entrega" },
            { id: "MADE_TO_ORDER", label: "Sob encomenda" },
          ].map((option) => (
            <button
              key={option.id}
              type="button"
              onClick={() => setAvailabilityFilter(option.id as AvailabilityFilter)}
              className={`rounded-full border px-4 py-2 text-sm font-medium transition ${
                availabilityFilter === option.id
                  ? "border-cyan-400/40 bg-cyan-500/15 text-cyan-100"
                  : "border-white/10 bg-white/5 text-white/70 hover:bg-white/10"
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </section>

      <section id="catalogo-grid" className="grid gap-5 md:grid-cols-2 2xl:grid-cols-3">
        {filteredItems.length ? (
          filteredItems.map((item) => {
            const primaryImage = getShowcasePrimaryImage(item);
            const primaryVideo = getShowcasePrimaryVideo(item);
            const availabilityLabel = getShowcaseAvailabilityLabel(item);
            const leadTimeLabel = getShowcaseLeadTimeLabel(item);
            const actionLabel = item.fulfillmentType === "STOCK" && item.stockQuantity <= 0
              ? "Indisponivel"
              : item.fulfillmentType === "STOCK"
                ? "Comprar agora"
                : "Encomendar";
            const isDisabled = item.fulfillmentType === "STOCK" && item.stockQuantity <= 0;

            return (
              <article
                key={item.id}
                className="group flex h-full flex-col overflow-hidden rounded-[30px] border border-white/10 bg-[linear-gradient(180deg,rgba(8,12,18,0.96),rgba(5,8,14,0.98))] shadow-[0_22px_90px_rgba(0,0,0,0.26)]"
              >
                <Link href={`/produto/${item.id}`} className="relative block h-72 overflow-hidden border-b border-white/10">
                  {primaryVideo ? (
                    <video
                      src={primaryVideo}
                      className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.04]"
                      autoPlay
                      muted
                      loop
                      playsInline
                      preload="metadata"
                      poster={primaryImage}
                    />
                  ) : primaryImage ? (
                    <img
                      src={primaryImage}
                      alt={item.name}
                      className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.04]"
                    />
                  ) : (
                    <div className="h-full bg-[radial-gradient(circle_at_top_left,_rgba(255,122,24,0.35),_transparent_28%),radial-gradient(circle_at_bottom_right,_rgba(89,185,255,0.22),_transparent_32%),linear-gradient(135deg,_rgba(255,255,255,0.08),_rgba(15,23,42,0.95))]" />
                  )}

                  <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/25 to-transparent" />

                  <div className="absolute left-4 top-4 flex flex-wrap gap-2">
                    <span className="rounded-full border border-white/15 bg-black/35 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-white/80 backdrop-blur">
                      {getShowcaseCategoryLabel(item)}
                    </span>
                    {primaryVideo ? (
                      <span className="rounded-full border border-cyan-400/25 bg-cyan-400/15 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan-100 backdrop-blur">
                        Video
                      </span>
                    ) : null}
                    <span className="rounded-full border border-emerald-400/25 bg-emerald-400/15 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-100 backdrop-blur">
                      {availabilityLabel}
                    </span>
                  </div>

                  <div className="absolute inset-x-0 bottom-0 p-5">
                    <div className="flex items-end justify-between gap-4">
                      <div className="max-w-[68%]">
                        <p className="text-[11px] uppercase tracking-[0.22em] text-white/55">
                          {item.fulfillmentType === "STOCK" ? "Pronta entrega" : "Sob encomenda"}
                        </p>
                        <h4 className="mt-2 text-2xl font-semibold leading-tight text-white">
                          {item.name}
                        </h4>
                      </div>

                      <div className="rounded-[22px] border border-white/12 bg-slate-950/72 px-4 py-3 text-right backdrop-blur">
                        <p className="text-[11px] uppercase tracking-[0.18em] text-white/45">Valor</p>
                        <p className="mt-2 text-2xl font-semibold">{formatCurrency(item.price)}</p>
                      </div>
                    </div>
                  </div>
                </Link>

                <div className="flex flex-1 flex-col p-5">
                  <p className="text-sm leading-7 text-white/76">{getShowcaseTagline(item)}</p>

                  <div className="mt-5 grid gap-3 rounded-[24px] border border-white/10 bg-white/[0.03] p-4 sm:grid-cols-2">
                    <div>
                      <p className="text-[11px] uppercase tracking-[0.2em] text-white/40">Material</p>
                      <p className="mt-2 text-sm font-semibold text-white/88">{item.materialLabel ?? "Sob consulta"}</p>
                    </div>
                    <div>
                      <p className="text-[11px] uppercase tracking-[0.2em] text-white/40">Prazo</p>
                      <p className="mt-2 text-sm font-semibold text-white/88">{leadTimeLabel}</p>
                    </div>
                    <div>
                      <p className="text-[11px] uppercase tracking-[0.2em] text-white/40">Cores</p>
                      <p className="mt-2 text-sm font-semibold text-white/88">{getShowcaseColorSummary(item)}</p>
                    </div>
                    <div>
                      <p className="text-[11px] uppercase tracking-[0.2em] text-white/40">Medidas</p>
                      <p className="mt-2 text-sm font-semibold text-white/88">{item.dimensionSummary ?? "Sob consulta"}</p>
                    </div>
                  </div>

                  <div className="mt-auto pt-5">
                    <Link
                      href={`/produto/${item.id}`}
                      className="inline-flex items-center gap-2 text-sm font-semibold text-orange-200 transition hover:text-orange-100"
                    >
                      Ver detalhes completos
                      <ArrowRight className="h-4 w-4" />
                    </Link>

                    <form action={`/comprar/${item.id}`} className="mt-4 grid gap-3 sm:grid-cols-[110px_minmax(0,1fr)]">
                      <label className="block text-sm text-white/70">
                        Quantidade
                        <input
                          name="quantity"
                          type="number"
                          min="1"
                          max={item.fulfillmentType === "STOCK" ? Math.max(item.stockQuantity, 1) : 999}
                          defaultValue="1"
                          disabled={isDisabled}
                          className="mt-2 w-full rounded-2xl border border-white/10 bg-black/35 px-4 py-3 text-white outline-none focus:border-orange-400/60"
                        />
                      </label>
                      <button
                        type="submit"
                        disabled={isDisabled}
                        className="inline-flex items-center justify-center gap-2 rounded-2xl bg-emerald-400 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-emerald-300 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-white/55"
                      >
                        <MessageCircleMore className="h-4 w-4" />
                        {actionLabel}
                      </button>
                    </form>
                  </div>
                </div>
              </article>
            );
          })
        ) : (
          <div className="md:col-span-2 2xl:col-span-3 rounded-[28px] border border-dashed border-white/15 bg-slate-950/50 p-8 text-sm text-white/60">
            Nenhum item encontrado para esse filtro. Tente outra categoria ou limpe a busca.
          </div>
        )}
      </section>

      {featuredItem ? (
        <section className="rounded-[30px] border border-white/10 bg-[linear-gradient(135deg,rgba(10,18,28,0.94),rgba(4,7,12,0.98))] p-6 sm:p-8">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="max-w-3xl">
              <p className="text-xs uppercase tracking-[0.24em] text-white/45">Destaque da vitrine</p>
              <h3 className="mt-3 text-3xl font-semibold">Quer mostrar mais valor antes do WhatsApp?</h3>
              <p className="mt-4 text-sm leading-7 text-white/68">
                Agora cada produto tem mais contexto visual e pode abrir uma pagina propria com galeria, prazo, material e CTA mais forte.
              </p>
            </div>

            <Link
              href={`/produto/${featuredItem.id}`}
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-white px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-white/90"
            >
              Abrir pagina do produto destaque
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </section>
      ) : null}
    </section>
  );
}
