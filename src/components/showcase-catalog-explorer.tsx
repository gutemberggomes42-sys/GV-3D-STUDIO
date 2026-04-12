/* eslint-disable @next/next/no-img-element */
"use client";

import Image from "next/image";
import Link from "next/link";
import { useDeferredValue, useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  ArrowUpDown,
  Camera,
  FolderOpen,
  MessageCircleMore,
  Play,
  Search,
  ShoppingCart,
  Sparkles,
  Star,
} from "lucide-react";
import { ShowcaseCartButton } from "@/components/showcase-cart-button";
import { ShowcaseWishlistButton } from "@/components/showcase-wishlist-button";
import { studioBrandLogoPath } from "@/lib/branding";
import { ownerWhatsAppNumber } from "@/lib/constants";
import type {
  DbShowcaseItem,
  DbShowcaseLibrary,
  DbShowcaseTestimonial,
  DbStorefrontSettings,
} from "@/lib/db-types";
import {
  getActiveStorefrontCampaigns,
  getShowcaseAvailabilityLabel,
  getShowcaseCategoryLabel,
  getShowcaseCategoryOptions,
  getShowcaseDescriptionPreview,
  getShowcaseLeadTimeLabel,
  getShowcasePrimaryImage,
  getShowcasePrimaryVideo,
  getShowcaseTagline,
  normalizeShowcaseSearchText,
} from "@/lib/showcase";

type ShowcaseCatalogExplorerProps = {
  items: DbShowcaseItem[];
  libraries: DbShowcaseLibrary[];
  inquiryCounts: Record<string, number>;
  testimonials: DbShowcaseTestimonial[];
  settings: DbStorefrontSettings;
  canManage: boolean;
};

type AvailabilityFilter = "ALL" | "STOCK" | "MADE_TO_ORDER";
type SortOption = "FEATURED" | "POPULAR" | "READY_FIRST" | "NEWEST";

const wishlistStorageKey = "printflow-showcase-wishlist";

function clampText(lines: number) {
  return {
    display: "-webkit-box",
    WebkitLineClamp: lines,
    WebkitBoxOrient: "vertical" as const,
    overflow: "hidden",
  };
}

function readWishlistIds() {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const parsed = JSON.parse(window.localStorage.getItem(wishlistStorageKey) ?? "[]");
    return Array.isArray(parsed) ? parsed.map((entry) => String(entry)) : [];
  } catch {
    return [];
  }
}

function matchesAvailability(item: DbShowcaseItem, filter: AvailabilityFilter) {
  if (filter === "ALL") {
    return true;
  }

  return item.fulfillmentType === filter;
}

function getItemPopularity(item: DbShowcaseItem, inquiryCounts: Record<string, number>) {
  return inquiryCounts[item.id] ?? 0;
}

function getSearchHaystack(item: DbShowcaseItem) {
  return normalizeShowcaseSearchText(
    [
      item.name,
      item.description,
      item.tagline ?? "",
      item.category,
      item.materialLabel ?? "",
      item.colorOptions.join(" "),
      item.sizeOptions.join(" "),
      item.finishOptions.join(" "),
      item.badges.join(" "),
      item.variants
        .map((variant) =>
          [variant.label, variant.color, variant.size, variant.finish].filter(Boolean).join(" "),
        )
        .join(" "),
    ].join(" "),
  );
}

function getItemCollectionLabel(
  item: DbShowcaseItem,
  libraryMap: Map<string, DbShowcaseLibrary>,
) {
  if (item.libraryId) {
    const library = libraryMap.get(item.libraryId);

    if (library?.name) {
      return library.name;
    }
  }

  return getShowcaseCategoryLabel(item);
}

function sortItems(
  items: DbShowcaseItem[],
  sortBy: SortOption,
  inquiryCounts: Record<string, number>,
) {
  return [...items].sort((left, right) => {
    const leftPopularity = getItemPopularity(left, inquiryCounts);
    const rightPopularity = getItemPopularity(right, inquiryCounts);

    switch (sortBy) {
      case "POPULAR":
        return rightPopularity - leftPopularity || right.whatsappClickCount - left.whatsappClickCount;
      case "READY_FIRST":
        return Number(right.fulfillmentType === "STOCK") - Number(left.fulfillmentType === "STOCK");
      case "NEWEST":
        return right.updatedAt.localeCompare(left.updatedAt);
      case "FEATURED":
      default:
        return Number(right.featured) - Number(left.featured) || rightPopularity - leftPopularity;
    }
  });
}

function LibraryWatermark() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      <div className="absolute left-1/2 top-1/2 h-[22rem] w-[22rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-cyan-400/12 blur-3xl sm:h-[34rem] sm:w-[34rem]" />
      <div className="absolute bottom-[-10%] right-[10%] h-[18rem] w-[18rem] rounded-full bg-fuchsia-500/10 blur-3xl sm:h-[28rem] sm:w-[28rem]" />
      <div className="absolute left-1/2 top-1/2 h-[24rem] w-[24rem] -translate-x-1/2 -translate-y-1/2 opacity-[0.14] sm:h-[36rem] sm:w-[36rem]">
        <Image
          src={studioBrandLogoPath}
          alt=""
          fill
          sizes="50vw"
          className="object-contain saturate-[1.55] brightness-[1.08] drop-shadow-[0_0_80px_rgba(110,193,255,0.2)]"
        />
      </div>
      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(3,7,11,0.08)_0%,rgba(3,7,11,0.12)_100%)]" />
    </div>
  );
}

function PreviewCard({
  item,
  inquiryCount,
  collectionLabel,
}: {
  item: DbShowcaseItem;
  inquiryCount: number;
  collectionLabel: string;
}) {
  const primaryImage = getShowcasePrimaryImage(item);
  const primaryVideo = getShowcasePrimaryVideo(item);

  return (
    <Link
      href={`/produto/${item.id}`}
      className="group block overflow-hidden rounded-[26px] border border-white/10 bg-[linear-gradient(180deg,rgba(8,12,18,0.98),rgba(5,8,14,0.98))] shadow-[0_22px_80px_rgba(0,0,0,0.24)] transition hover:-translate-y-1 hover:border-white/15"
    >
      <div className="relative aspect-[0.84] overflow-hidden">
        {primaryImage ? (
          <img
            src={primaryImage}
            alt={item.name}
            className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]"
          />
        ) : (
          <div className="h-full bg-[radial-gradient(circle_at_top_left,_rgba(255,122,24,0.38),_transparent_30%),radial-gradient(circle_at_bottom_right,_rgba(89,185,255,0.25),_transparent_34%),linear-gradient(145deg,_rgba(8,12,18,0.98),_rgba(10,18,28,0.96))]" />
        )}

        <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/20 to-transparent" />

        <div className="absolute left-3 right-3 top-3 flex items-start justify-between gap-2">
          <span className="rounded-full border border-white/15 bg-black/40 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-white/82">
            {collectionLabel}
          </span>
          <ShowcaseWishlistButton itemId={item.id} />
        </div>

        <div className="absolute bottom-4 left-4 right-4">
          <div className="flex flex-wrap gap-2">
            <span className="rounded-full border border-emerald-400/25 bg-emerald-400/15 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-emerald-100">
              {getShowcaseAvailabilityLabel(item)}
            </span>
            {primaryVideo ? (
              <span className="inline-flex items-center gap-2 rounded-full border border-cyan-400/25 bg-cyan-400/15 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-cyan-100">
                <Play className="h-3.5 w-3.5 fill-current" />
                Preview com video
              </span>
            ) : null}
          </div>

          <h4 className="mt-3 text-2xl font-semibold leading-tight text-white" style={clampText(2)}>
            {item.name}
          </h4>
          <p className="mt-2 text-sm leading-6 text-white/72" style={clampText(2)}>
            {getShowcaseDescriptionPreview(getShowcaseTagline(item), 92)}
          </p>
        </div>
      </div>

      <div className="flex items-center justify-between gap-3 px-4 py-4 sm:px-5">
        <div className="min-w-0">
          <p className="text-[11px] uppercase tracking-[0.18em] text-white/42">Preview da biblioteca</p>
          <p className="mt-2 text-sm text-white/68">
            {inquiryCount > 0 ? `${inquiryCount} pessoas já abriram este preview` : getShowcaseLeadTimeLabel(item)}
          </p>
        </div>
        <span className="inline-flex shrink-0 items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-orange-100 transition group-hover:bg-white/10">
          Abrir preview
          <ArrowRight className="h-4 w-4" />
        </span>
      </div>
    </Link>
  );
}

function CategoryCard({
  imageUrl,
  title,
  description,
  count,
  item,
  active,
  onClick,
}: {
  imageUrl?: string;
  title: string;
  description?: string;
  count: number;
  item?: DbShowcaseItem;
  active: boolean;
  onClick: () => void;
}) {
  const coverImageUrl = imageUrl || (item ? getShowcasePrimaryImage(item) : undefined);

  return (
    <button
      type="button"
      onClick={onClick}
      className={`group relative overflow-hidden rounded-[24px] border text-left transition ${
        active
          ? "border-orange-300/35 bg-orange-500/10 shadow-[0_18px_45px_rgba(255,122,24,0.15)]"
          : "border-white/10 bg-white/[0.04] hover:border-white/20 hover:bg-white/[0.06]"
      }`}
    >
      <div className="relative h-40 sm:h-48">
        {coverImageUrl ? (
          <img
            src={coverImageUrl}
            alt={title}
            className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]"
          />
        ) : (
          <div className="h-full bg-[radial-gradient(circle_at_top_left,_rgba(255,122,24,0.36),_transparent_30%),radial-gradient(circle_at_bottom_right,_rgba(89,185,255,0.22),_transparent_34%),linear-gradient(145deg,_rgba(8,12,18,0.98),_rgba(10,18,28,0.96))]" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/25 to-transparent" />
        <div className="absolute bottom-4 left-4 right-4">
          <p className="text-[11px] uppercase tracking-[0.18em] text-white/52">Biblioteca</p>
          <h4 className="mt-2 text-xl font-semibold text-white">{title}</h4>
          {description ? (
            <p className="mt-2 text-sm leading-6 text-white/68" style={clampText(2)}>
              {description}
            </p>
          ) : null}
          <p className="mt-2 text-sm text-white/68">
            {count} {count === 1 ? "modelo" : "modelos"}
          </p>
        </div>
      </div>
    </button>
  );
}

export function ShowcaseCatalogExplorer({
  items,
  libraries,
  inquiryCounts,
  testimonials: _testimonials,
  settings,
  canManage,
}: ShowcaseCatalogExplorerProps) {
  const [query, setQuery] = useState("");
  const [selectedCollectionKey, setSelectedCollectionKey] = useState("all");
  const [availabilityFilter, setAvailabilityFilter] = useState<AvailabilityFilter>("ALL");
  const [sortBy, setSortBy] = useState<SortOption>("FEATURED");
  const [wishlistIds, setWishlistIds] = useState<string[]>([]);
  const deferredQuery = useDeferredValue(normalizeShowcaseSearchText(query));

  useEffect(() => {
    const syncWishlist = () => {
      setWishlistIds(readWishlistIds());
    };

    syncWishlist();
    window.addEventListener("storage", syncWishlist);
    window.addEventListener("printflow-wishlist-updated", syncWishlist as EventListener);

    return () => {
      window.removeEventListener("storage", syncWishlist);
      window.removeEventListener("printflow-wishlist-updated", syncWishlist as EventListener);
    };
  }, []);

  const sortedFeaturedItems = useMemo(
    () => sortItems(items, "FEATURED", inquiryCounts),
    [inquiryCounts, items],
  );
  const featuredItem = sortedFeaturedItems[0];
  const libraryMap = useMemo(
    () => new Map(libraries.map((library) => [library.id, library])),
    [libraries],
  );
  const activeLibraries = useMemo(
    () => libraries.filter((library) => library.active),
    [libraries],
  );
  const categories = getShowcaseCategoryOptions(items);
  const hasManagedLibraries = activeLibraries.length > 0;
  const collectionCards = useMemo(() => {
    if (hasManagedLibraries) {
      return activeLibraries.map((library) => {
        const libraryItems = items.filter((item) => item.libraryId === library.id);

        return {
          key: library.id,
          title: library.name,
          description: library.description,
          count: libraryItems.length,
          item: sortItems(libraryItems, "FEATURED", inquiryCounts)[0] ?? libraryItems[0],
          imageUrl: library.coverImageUrl,
        };
      });
    }

    return categories.map((category) => {
      const categoryItems = items.filter((item) => getShowcaseCategoryLabel(item) === category);

      return {
        key: category,
        title: category,
        description: undefined,
        count: categoryItems.length,
        item: sortItems(categoryItems, "FEATURED", inquiryCounts)[0] ?? categoryItems[0],
        imageUrl: undefined,
      };
    });
  }, [activeLibraries, categories, hasManagedLibraries, inquiryCounts, items]);
  const activeCampaign = useMemo(
    () => getActiveStorefrontCampaigns(settings.campaignBanners)[0],
    [settings.campaignBanners],
  );
  const featuredWishlist = useMemo(
    () => items.filter((item) => wishlistIds.includes(item.id)).length,
    [items, wishlistIds],
  );
  const filteredItems = useMemo(
    () =>
      sortItems(
        items.filter((item) => {
          const collectionMatch =
            selectedCollectionKey === "all" ||
            (hasManagedLibraries
              ? item.libraryId === selectedCollectionKey
              : getShowcaseCategoryLabel(item) === selectedCollectionKey);
          const availabilityMatch = matchesAvailability(item, availabilityFilter);
          const searchMatch =
            !deferredQuery ||
            normalizeShowcaseSearchText(
              `${getSearchHaystack(item)} ${getItemCollectionLabel(item, libraryMap)}`,
            ).includes(deferredQuery);

          return collectionMatch && availabilityMatch && searchMatch;
        }),
        sortBy,
        inquiryCounts,
      ),
    [availabilityFilter, deferredQuery, hasManagedLibraries, inquiryCounts, items, libraryMap, selectedCollectionKey, sortBy],
  );

  const heroImage =
    (featuredItem && getShowcasePrimaryImage(featuredItem)) || settings.shareImageUrl || studioBrandLogoPath;
  const instagramGallery = settings.instagramGallery.slice(0, 4);
  const resultsLabel =
    filteredItems.length === 1 ? "1 preview encontrado" : `${filteredItems.length} previews encontrados`;

  return (
    <section className="space-y-6">
      {settings.announcementText ? (
        <section className="rounded-[22px] border border-amber-400/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-50 sm:rounded-[24px] sm:px-5 sm:py-4">
          {settings.announcementText}
        </section>
      ) : null}

      <section className="relative overflow-hidden rounded-[30px] border border-white/10 bg-[linear-gradient(145deg,rgba(8,12,18,0.98),rgba(10,18,28,0.96))]">
        <LibraryWatermark />

        <div className="relative z-10 grid gap-0 xl:grid-cols-[1.05fr_0.95fr]">
          <div className="p-5 sm:p-8 lg:p-10">
            <div className="flex flex-wrap items-center gap-3">
              <span className="rounded-full border border-orange-300/18 bg-orange-400/10 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-orange-100/78">
                {activeCampaign?.badge || "Biblioteca principal"}
              </span>
              {canManage ? (
                <Link
                  href="/admin?section=bibliotecas"
                  className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-white/75 transition hover:bg-white/10"
                >
                  Gerenciar biblioteca
                </Link>
              ) : null}
            </div>

            <h3 className="mt-5 max-w-3xl text-[2.3rem] font-semibold leading-[0.98] tracking-tight sm:text-5xl">
              {activeCampaign?.title || "Biblioteca digital com previews das peças da GV 3D Studio"}
            </h3>
            <p className="mt-4 max-w-2xl text-sm leading-7 text-white/72 sm:text-base">
              {activeCampaign?.subtitle ||
                "Navegue pela biblioteca, abra o preview do modelo e, só depois de escolher a peça certa, envie para o WhatsApp ou guarde no carrinho."}
            </p>

            <div className="mt-6 flex flex-wrap gap-2">
              {(settings.heroHighlights.length ? settings.heroHighlights : [
                "Preview limpo dos modelos",
                "Escolha pelo WhatsApp ou carrinho",
                "Bibliotecas organizadas pelo admin",
              ]).slice(0, 3).map((highlight) => (
                <span
                  key={highlight}
                  className="rounded-full border border-white/10 bg-white/6 px-4 py-2 text-sm font-medium text-white/82"
                >
                  {highlight}
                </span>
              ))}
            </div>

            <div className="mt-8 grid gap-3 sm:grid-cols-3">
              <div className="rounded-[22px] border border-white/10 bg-black/20 px-4 py-4">
                <p className="text-[11px] uppercase tracking-[0.18em] text-white/45">Biblioteca</p>
                <p className="mt-2 text-2xl font-semibold">{items.length}</p>
                <p className="mt-2 text-sm text-white/62">Modelos visiveis para preview</p>
              </div>
              <div className="rounded-[22px] border border-white/10 bg-black/20 px-4 py-4">
                <p className="text-[11px] uppercase tracking-[0.18em] text-white/45">Bibliotecas</p>
                <p className="mt-2 text-2xl font-semibold">{collectionCards.length}</p>
                <p className="mt-2 text-sm text-white/62">Colecoes organizadas</p>
              </div>
              <div className="rounded-[22px] border border-white/10 bg-black/20 px-4 py-4">
                <p className="text-[11px] uppercase tracking-[0.18em] text-white/45">Favoritos</p>
                <p className="mt-2 text-2xl font-semibold">{featuredWishlist}</p>
                <p className="mt-2 text-sm text-white/62">Itens guardados por voce</p>
              </div>
            </div>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <a
                href="#biblioteca-grid"
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-emerald-400 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-emerald-300"
              >
                <FolderOpen className="h-4 w-4" />
                Explorar biblioteca
              </a>
              <a
                href={`https://wa.me/${ownerWhatsAppNumber}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-semibold text-white/84 transition hover:bg-white/10"
              >
                <MessageCircleMore className="h-4 w-4" />
                Falar no WhatsApp
              </a>
            </div>
          </div>

          <div className="relative min-h-[320px] border-t border-white/10 xl:min-h-full xl:border-l xl:border-t-0">
            {heroImage ? (
              <img src={heroImage} alt={featuredItem?.name ?? settings.brandName} className="h-full w-full object-cover" />
            ) : null}
            <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(5,7,11,0.1),rgba(5,7,11,0.18)),linear-gradient(0deg,rgba(5,7,11,0.82),rgba(5,7,11,0.06))]" />
            <div className="absolute inset-x-0 bottom-0 p-5 sm:p-8">
              <div className="max-w-xl rounded-[26px] border border-white/10 bg-black/35 p-5 backdrop-blur-xl">
                <p className="text-[11px] uppercase tracking-[0.18em] text-white/45">Preview em destaque</p>
                <h4 className="mt-3 text-2xl font-semibold text-white">
                  {featuredItem?.name ?? "Sua biblioteca pronta para mostrar as peças"}
                </h4>
                <p className="mt-3 text-sm leading-6 text-white/72">
                  {featuredItem
                    ? getShowcaseDescriptionPreview(getShowcaseTagline(featuredItem), 140)
                    : "Escolha uma peça da biblioteca e siga para o preview antes de continuar com o pedido."}
                </p>
                {featuredItem ? (
                  <Link
                    href={`/produto/${featuredItem.id}`}
                    className="mt-5 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/8 px-4 py-2 text-sm font-semibold text-orange-100 transition hover:bg-white/12"
                  >
                    Abrir preview desta peça
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-[28px] border border-white/10 bg-white/[0.04] p-4 sm:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.24em] text-white/45">Biblioteca principal</p>
            <h3 className="mt-2 text-2xl font-semibold">Escolha primeiro a biblioteca que voce quer abrir</h3>
          </div>
          <div className="inline-flex items-center gap-2 text-sm text-white/60">
            <Sparkles className="h-4 w-4 text-orange-200" />
            Clique na biblioteca e veja os previews das pecas
          </div>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <CategoryCard
            title="Todas as colecoes"
            count={items.length}
            item={featuredItem}
            active={selectedCollectionKey === "all"}
            onClick={() => setSelectedCollectionKey("all")}
          />
          {collectionCards.map((entry) => (
            <CategoryCard
              key={entry.key}
              imageUrl={entry.imageUrl}
              title={entry.title}
              description={entry.description}
              count={entry.count}
              item={entry.item}
              active={selectedCollectionKey === entry.key}
              onClick={() => setSelectedCollectionKey(entry.key)}
            />
          ))}
        </div>
      </section>

      <section
        id="biblioteca-grid"
        className="relative overflow-hidden rounded-[28px] border border-white/10 bg-white/[0.04] p-4 sm:p-6"
      >
        <LibraryWatermark />

        <div className="relative z-10 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.24em] text-white/45">Previews da biblioteca</p>
            <h3 className="mt-2 text-2xl font-semibold">Abra o modelo, veja o preview e escolha depois</h3>
            <p className="mt-3 text-sm text-white/62">{resultsLabel}</p>
          </div>

          <div className="grid w-full gap-3 lg:max-w-2xl lg:grid-cols-[minmax(0,1fr)_220px]">
            <label className="relative block">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-white/35" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Buscar por nome, material, biblioteca ou acabamento"
                className="w-full rounded-2xl border border-white/10 bg-slate-950/70 py-3 pl-11 pr-4 text-sm text-white outline-none transition focus:border-orange-400/60"
              />
            </label>

            <label className="relative block">
              <ArrowUpDown className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-white/35" />
              <select
                value={sortBy}
                onChange={(event) => setSortBy(event.target.value as SortOption)}
                className="w-full appearance-none rounded-2xl border border-white/10 bg-slate-950/70 py-3 pl-11 pr-4 text-sm text-white outline-none transition focus:border-orange-400/60"
              >
                <option value="FEATURED">Ordenar por destaque</option>
                <option value="POPULAR">Mais abertos</option>
                <option value="READY_FIRST">Pronta entrega primeiro</option>
                <option value="NEWEST">Mais recentes</option>
              </select>
            </label>
          </div>
        </div>

        <div className="relative z-10 mt-5 -mx-1 flex gap-2 overflow-x-auto px-1 pb-2 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0 sm:pb-0">
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

        <div className="relative z-10 mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filteredItems.length ? (
            filteredItems.map((item) => (
              <PreviewCard
                key={item.id}
                item={item}
                inquiryCount={getItemPopularity(item, inquiryCounts)}
                collectionLabel={getItemCollectionLabel(item, libraryMap)}
              />
            ))
          ) : (
            <div className="md:col-span-2 xl:col-span-3 rounded-[26px] border border-dashed border-white/15 bg-slate-950/50 p-8 text-sm text-white/60">
              Nenhum preview encontrado para esse filtro. Tente outra biblioteca ou ajuste a busca.
            </div>
          )}
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-[28px] border border-white/10 bg-white/[0.04] p-5 sm:p-6">
          <p className="text-xs uppercase tracking-[0.24em] text-white/45">Como funciona</p>
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            {[
              "Abra a biblioteca e escolha a colecao que quer ver.",
              "Entre no preview da peça para confirmar fotos, vídeo e detalhes.",
              "Se gostar, siga para o WhatsApp ou guarde a peça no carrinho.",
            ].map((step, index) => (
              <div key={step} className="rounded-[22px] border border-white/10 bg-black/20 p-4">
                <p className="text-[11px] uppercase tracking-[0.18em] text-white/45">Passo {index + 1}</p>
                <p className="mt-3 text-sm leading-6 text-white/74">{step}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-[28px] border border-white/10 bg-[linear-gradient(145deg,rgba(8,12,18,0.98),rgba(7,16,26,0.98))] p-5 sm:p-6">
          <p className="text-xs uppercase tracking-[0.24em] text-white/45">Instagram e bastidores</p>
          <h3 className="mt-2 text-2xl font-semibold">{settings.instagramSectionTitle || "Acompanhe a loja"}</h3>
          <p className="mt-3 text-sm leading-7 text-white/68">
            {settings.instagramSectionBody ||
              "Veja peças prontas, vídeos curtos e bastidores da produção para conhecer melhor o trabalho da GV 3D Studio."}
          </p>

          <div className="mt-5 flex flex-col gap-3 sm:flex-row">
            {settings.instagramUrl ? (
              <a
                href={settings.instagramUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[linear-gradient(135deg,rgba(56,189,248,0.9),rgba(168,85,247,0.95))] px-5 py-3 text-sm font-semibold text-white transition hover:brightness-110"
              >
                <Camera className="h-4 w-4" />
                {settings.instagramButtonLabel}
              </a>
            ) : null}
            <a
              href={`https://wa.me/${ownerWhatsAppNumber}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-semibold text-white/84 transition hover:bg-white/10"
            >
              <MessageCircleMore className="h-4 w-4" />
              Atendimento direto
            </a>
            <Link
              href="/carrinho"
              className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-semibold text-white/84 transition hover:bg-white/10"
            >
              <ShoppingCart className="h-4 w-4" />
              Abrir carrinho
            </Link>
          </div>

          {instagramGallery.length ? (
            <div className="mt-5 grid grid-cols-2 gap-3">
              {instagramGallery.map((entry) => (
                <a
                  key={entry.id}
                  href={entry.linkUrl || settings.instagramUrl || "#"}
                  target={entry.linkUrl || settings.instagramUrl ? "_blank" : undefined}
                  rel={entry.linkUrl || settings.instagramUrl ? "noreferrer" : undefined}
                  className="group overflow-hidden rounded-[20px] border border-white/10 bg-black/20"
                >
                  <div className="relative h-32">
                    <img
                      src={entry.imageUrl}
                      alt={entry.title}
                      className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/8 to-transparent" />
                    <div className="absolute bottom-0 left-0 right-0 p-3">
                      <p className="text-sm font-semibold text-white" style={clampText(2)}>
                        {entry.title}
                      </p>
                    </div>
                  </div>
                </a>
              ))}
            </div>
          ) : null}
        </div>
      </section>
    </section>
  );
}
