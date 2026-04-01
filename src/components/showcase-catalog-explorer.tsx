/* eslint-disable @next/next/no-img-element */
"use client";

import Image from "next/image";
import Link from "next/link";
import { useDeferredValue, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  ArrowRight,
  ArrowUpDown,
  Camera,
  Heart,
  HeartHandshake,
  MessageCircleMore,
  PackageCheck,
  Play,
  Search,
  ShieldCheck,
  ShoppingCart,
  Sparkles,
  Star,
  Truck,
} from "lucide-react";
import { ShowcaseCartButton } from "@/components/showcase-cart-button";
import { ShowcaseWishlistButton } from "@/components/showcase-wishlist-button";
import { studioBrandLogoPath } from "@/lib/branding";
import { ownerWhatsAppNumber } from "@/lib/constants";
import type {
  DbShowcaseItem,
  DbShowcaseTestimonial,
  DbStorefrontSettings,
} from "@/lib/db-types";
import { formatCurrency } from "@/lib/format";
import { addShowcaseCartEntry } from "@/lib/showcase-cart";
import {
  getShowcaseAvailabilityLabel,
  getShowcaseCategoryLabel,
  getShowcaseCategoryOptions,
  getShowcaseColorHex,
  getShowcaseColorSummary,
  getShowcaseDeliverySummary,
  getShowcaseDescriptionPreview,
  getShowcaseLeadTimeLabel,
  getShowcaseLowestPrice,
  getShowcasePrimaryImage,
  getShowcasePrimaryVideo,
  getShowcaseTagline,
  getShowcaseHighestPrice,
  normalizeShowcaseSearchText,
} from "@/lib/showcase";

type ShowcaseCatalogExplorerProps = {
  items: DbShowcaseItem[];
  inquiryCounts: Record<string, number>;
  testimonials: DbShowcaseTestimonial[];
  settings: DbStorefrontSettings;
  canManage: boolean;
};

type AvailabilityFilter = "ALL" | "STOCK" | "MADE_TO_ORDER";
type PriceFilter = "ALL" | "UNDER_50" | "BETWEEN_50_100" | "BETWEEN_100_200" | "OVER_200";
type SortOption =
  | "FEATURED"
  | "POPULAR"
  | "MOST_CLICKED"
  | "LOWEST_PRICE"
  | "HIGHEST_PRICE"
  | "FASTEST"
  | "READY_FIRST"
  | "NEWEST";

const wishlistStorageKey = "printflow-showcase-wishlist";

const priceFilterOptions: Array<{ id: PriceFilter; label: string }> = [
  { id: "ALL", label: "Todos os valores" },
  { id: "UNDER_50", label: "Ate R$ 50" },
  { id: "BETWEEN_50_100", label: "R$ 50 a R$ 100" },
  { id: "BETWEEN_100_200", label: "R$ 100 a R$ 200" },
  { id: "OVER_200", label: "Acima de R$ 200" },
];

function clampText(lines: number) {
  return {
    display: "-webkit-box",
    WebkitLineClamp: lines,
    WebkitBoxOrient: "vertical" as const,
    overflow: "hidden",
  };
}

function ShowcaseSectionWatermark({
  align = "right",
  intensity = "normal",
}: {
  align?: "center" | "right";
  intensity?: "normal" | "strong";
}) {
  const isCentered = align === "center";
  const isStrong = intensity === "strong";

  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      <div
        className={
          isCentered
            ? isStrong
              ? "absolute left-1/2 top-1/2 h-[28rem] w-[28rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-cyan-400/16 blur-3xl sm:h-[40rem] sm:w-[40rem]"
              : "absolute left-1/2 top-1/2 h-[22rem] w-[22rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-cyan-400/10 blur-3xl sm:h-[32rem] sm:w-[32rem]"
            : isStrong
              ? "absolute right-[-8%] top-1/2 h-[30rem] w-[30rem] -translate-y-1/2 rounded-full bg-cyan-400/16 blur-3xl sm:h-[42rem] sm:w-[42rem]"
              : "absolute right-[-10%] top-1/2 h-[24rem] w-[24rem] -translate-y-1/2 rounded-full bg-cyan-400/10 blur-3xl sm:h-[34rem] sm:w-[34rem]"
        }
      />
      <div
        className={
          isCentered
            ? isStrong
              ? "absolute left-1/2 top-1/2 h-[22rem] w-[22rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-fuchsia-500/14 blur-3xl sm:h-[34rem] sm:w-[34rem]"
              : "absolute left-1/2 top-1/2 h-[18rem] w-[18rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-fuchsia-500/10 blur-3xl sm:h-[26rem] sm:w-[26rem]"
            : isStrong
              ? "absolute bottom-[-18%] right-[12%] h-[24rem] w-[24rem] rounded-full bg-fuchsia-500/12 blur-3xl sm:h-[34rem] sm:w-[34rem]"
              : "absolute bottom-[-20%] right-[18%] h-[18rem] w-[18rem] rounded-full bg-fuchsia-500/8 blur-3xl sm:h-[26rem] sm:w-[26rem]"
        }
      />
      <div
        className={
          isCentered
            ? isStrong
              ? "absolute left-1/2 top-1/2 h-[28rem] w-[28rem] -translate-x-1/2 -translate-y-1/2 opacity-[0.18] sm:h-[42rem] sm:w-[42rem]"
              : "absolute left-1/2 top-1/2 h-[22rem] w-[22rem] -translate-x-1/2 -translate-y-1/2 opacity-[0.12] sm:h-[32rem] sm:w-[32rem]"
            : isStrong
              ? "absolute right-[-2%] top-1/2 h-[34rem] w-[34rem] -translate-y-1/2 opacity-[0.2] sm:h-[48rem] sm:w-[48rem]"
              : "absolute right-[0%] top-1/2 h-[26rem] w-[26rem] -translate-y-1/2 opacity-[0.14] sm:h-[36rem] sm:w-[36rem]"
        }
      >
        <Image
          src={studioBrandLogoPath}
          alt=""
          fill
          sizes={isCentered ? "56vw" : "42vw"}
          className="object-contain saturate-[1.65] brightness-[1.15] contrast-[1.08] drop-shadow-[0_0_90px_rgba(98,198,255,0.24)]"
        />
      </div>
      <div
        className={
          isCentered
            ? "absolute inset-0 bg-[linear-gradient(180deg,rgba(3,7,11,0.12)_0%,rgba(3,7,11,0.04)_28%,rgba(3,7,11,0.12)_100%)]"
            : "absolute inset-0 bg-[linear-gradient(90deg,rgba(3,7,11,0.18)_0%,rgba(3,7,11,0.08)_35%,rgba(3,7,11,0.03)_60%,rgba(3,7,11,0.12)_100%)]"
        }
      />
    </div>
  );
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

function matchesPrice(item: DbShowcaseItem, filter: PriceFilter) {
  const lowestPrice = getShowcaseLowestPrice(item);

  switch (filter) {
    case "UNDER_50":
      return lowestPrice <= 50;
    case "BETWEEN_50_100":
      return lowestPrice > 50 && lowestPrice <= 100;
    case "BETWEEN_100_200":
      return lowestPrice > 100 && lowestPrice <= 200;
    case "OVER_200":
      return lowestPrice > 200;
    case "ALL":
    default:
      return true;
  }
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
      item.shippingSummary ?? "",
      item.variants.map((variant) =>
        [variant.label, variant.color, variant.size, variant.finish].filter(Boolean).join(" "),
      ),
    ]
      .flat()
      .join(" "),
  );
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
      case "MOST_CLICKED":
        return right.whatsappClickCount - left.whatsappClickCount || right.viewCount - left.viewCount;
      case "LOWEST_PRICE":
        return getShowcaseLowestPrice(left) - getShowcaseLowestPrice(right);
      case "HIGHEST_PRICE":
        return getShowcaseHighestPrice(right) - getShowcaseHighestPrice(left);
      case "FASTEST":
        return left.leadTimeDays - right.leadTimeDays || left.price - right.price;
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

function getItemRangeLabel(item: DbShowcaseItem) {
  const lowestPrice = getShowcaseLowestPrice(item);
  const highestPrice = getShowcaseHighestPrice(item);
  return lowestPrice === highestPrice ? formatCurrency(item.price) : `${formatCurrency(lowestPrice)} - ${formatCurrency(highestPrice)}`;
}

function getVariantSummary(item: DbShowcaseItem) {
  const activeVariants = item.variants.filter((variant) => variant.active);
  return activeVariants.length ? `${activeVariants.length} variacoes` : null;
}

type ShelfProps = {
  title: string;
  subtitle: string;
  icon: ReactNode;
  items: DbShowcaseItem[];
  inquiryCounts: Record<string, number>;
  anchorId?: string;
};

function ShowcaseCard({ item, inquiryCount }: { item: DbShowcaseItem; inquiryCount: number }) {
  const [quantity, setQuantity] = useState("1");
  const [cartFeedback, setCartFeedback] = useState("");
  const primaryImage = getShowcasePrimaryImage(item);
  const primaryVideo = getShowcasePrimaryVideo(item);
  const isDisabled = item.fulfillmentType === "STOCK" && item.stockQuantity <= 0;
  const visibleColors = item.colorOptions.slice(0, 4);
  const extraColors = Math.max(item.colorOptions.length - visibleColors.length, 0);
  const variantSummary = getVariantSummary(item);
  const buyLabel =
    item.fulfillmentType === "STOCK" && item.stockQuantity > 0
      ? "Comprar no WhatsApp"
      : item.fulfillmentType === "STOCK"
        ? "Indisponivel"
        : "Encomendar no WhatsApp";

  return (
    <article className="group flex h-full flex-col overflow-hidden rounded-[26px] border border-white/10 bg-[linear-gradient(180deg,rgba(8,12,18,0.96),rgba(5,8,14,0.98))] shadow-[0_22px_90px_rgba(0,0,0,0.26)] transition hover:-translate-y-1 hover:border-white/15 sm:rounded-[30px]">
      <Link href={`/produto/${item.id}`} className="relative block h-52 overflow-hidden border-b border-white/10 sm:h-72">
        {primaryImage ? (
          <img src={primaryImage} alt={item.name} className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.04]" />
        ) : (
          <div className="h-full bg-[radial-gradient(circle_at_top_left,_rgba(255,122,24,0.35),_transparent_28%),radial-gradient(circle_at_bottom_right,_rgba(89,185,255,0.22),_transparent_32%),linear-gradient(135deg,_rgba(255,255,255,0.08),_rgba(15,23,42,0.95))]" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/25 to-transparent" />

        <div className="absolute left-3 right-3 top-3 flex items-start justify-between gap-3 sm:left-4 sm:right-4 sm:top-4">
          <div className="flex flex-wrap gap-2">
            <span className="rounded-full border border-white/15 bg-black/35 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-white/80">
              {getShowcaseCategoryLabel(item)}
            </span>
            {item.promotionLabel ? (
              <span className="rounded-full border border-orange-300/35 bg-orange-500/15 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-orange-100">
                {item.promotionLabel}
              </span>
            ) : null}
            {primaryVideo ? (
              <span className="inline-flex items-center gap-2 rounded-full border border-cyan-400/25 bg-cyan-400/15 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan-100">
                <Play className="h-3.5 w-3.5 fill-current" />
                Assista ao video
              </span>
            ) : null}
          </div>
          <ShowcaseWishlistButton itemId={item.id} />
        </div>

        <div className="absolute bottom-0 left-0 right-0 p-4 sm:p-5">
          <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-end sm:justify-between sm:gap-4">
            <div className="max-w-full sm:max-w-[70%]">
              <h4 className="text-xl font-semibold leading-tight text-white sm:text-2xl" style={clampText(2)}>
                {item.name}
              </h4>
              <p className="mt-2 text-sm text-white/72" style={clampText(2)}>
                {getShowcaseDescriptionPreview(getShowcaseTagline(item), 84)}
              </p>
            </div>
            <div className="rounded-[20px] border border-white/12 bg-slate-950/78 px-4 py-3 text-left backdrop-blur sm:rounded-[22px] sm:text-right">
              <p className="text-[11px] uppercase tracking-[0.18em] text-white/45">Valor</p>
              {item.compareAtPrice ? (
                <p className="mt-1 text-xs text-white/45 line-through">{formatCurrency(item.compareAtPrice)}</p>
              ) : null}
              <p className="mt-1 text-xl font-semibold sm:text-2xl">{getItemRangeLabel(item)}</p>
            </div>
          </div>
        </div>
      </Link>

      <div className="flex flex-1 flex-col gap-4 p-4 sm:p-5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full border border-emerald-400/20 bg-emerald-400/12 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-emerald-100">
            {getShowcaseAvailabilityLabel(item)}
          </span>
          <span className="rounded-full border border-cyan-400/20 bg-cyan-400/12 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-cyan-100">
            {getShowcaseLeadTimeLabel(item)}
          </span>
          {variantSummary ? (
            <span className="rounded-full border border-fuchsia-400/20 bg-fuchsia-400/12 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-fuchsia-100">
              {variantSummary}
            </span>
          ) : null}
          {(item.badges ?? []).slice(0, 2).map((badge) => (
            <span key={badge} className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-white/75">
              {badge}
            </span>
          ))}
        </div>

        <div className="grid gap-3 rounded-[24px] border border-white/10 bg-white/[0.03] p-4 sm:grid-cols-2">
          <div>
            <p className="text-[11px] uppercase tracking-[0.2em] text-white/40">Material</p>
            <p className="mt-2 text-sm font-semibold text-white/88" style={clampText(2)}>
              {item.materialLabel ?? "Sob consulta"}
            </p>
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-[0.2em] text-white/40">Entrega</p>
            <p className="mt-2 text-sm font-semibold text-white/88" style={clampText(2)}>
              {getShowcaseDeliverySummary(item)}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {visibleColors.length ? (
            <>
              {visibleColors.map((color) => (
                <span key={color} title={color} className="h-5 w-5 rounded-full ring-2 ring-white/10" style={{ backgroundColor: getShowcaseColorHex(color) }} />
              ))}
              {extraColors ? (
                <span className="rounded-full border border-white/10 bg-white/5 px-2 py-1 text-[11px] font-semibold text-white/70">
                  +{extraColors}
                </span>
              ) : null}
            </>
          ) : (
            <p className="text-sm text-white/65">{getShowcaseColorSummary(item)}</p>
          )}
        </div>

        {item.couponCode ? (
          <div className="rounded-[24px] border border-emerald-400/15 bg-emerald-500/[0.07] px-4 py-3 text-sm text-emerald-100">
            Cupom disponivel: <span className="font-semibold">{item.couponCode}</span>
            {item.couponDiscountPercent ? ` · ${item.couponDiscountPercent}% off` : ""}
          </div>
        ) : null}

        <div className="mt-auto space-y-3 pt-1">
          <div className="flex items-center justify-between gap-3 text-sm text-white/55">
            <span>{inquiryCount > 0 ? `${inquiryCount} pedidos iniciados` : "Novo na vitrine"}</span>
            <Link href={`/produto/${item.id}`} className="inline-flex items-center gap-2 font-semibold text-orange-200 transition hover:text-orange-100">
              Ver detalhes
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>

          <form action={`/comprar/${item.id}`} className="grid gap-3 sm:grid-cols-[116px_minmax(0,1fr)]">
            <label className="block text-sm text-white/70">
              Qtd
              <input name="quantity" type="number" min="1" max={item.fulfillmentType === "STOCK" ? Math.max(item.stockQuantity, 1) : 999} value={quantity} onChange={(event) => setQuantity(event.target.value)} disabled={isDisabled} className="mt-2 w-full rounded-2xl border border-white/10 bg-black/35 px-4 py-3 text-white outline-none focus:border-orange-400/60" />
              {item.couponCode ? <input type="hidden" name="couponCode" value={item.couponCode} /> : null}
            </label>
            <button type="submit" disabled={isDisabled} className="inline-flex items-center justify-center gap-2 rounded-2xl bg-emerald-400 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-emerald-300 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-white/55">
              <MessageCircleMore className="h-4 w-4" />
              {buyLabel}
            </button>
          </form>

          <button
            type="button"
            disabled={isDisabled}
            onClick={() => {
              const parsedQuantity = Number(quantity);
              addShowcaseCartEntry({
                itemId: item.id,
                quantity: Number.isFinite(parsedQuantity)
                  ? Math.max(
                      1,
                      Math.min(
                        item.fulfillmentType === "STOCK" ? Math.max(item.stockQuantity, 1) : 999,
                        Math.round(parsedQuantity),
                      ),
                    )
                  : 1,
                couponCode: item.couponCode || undefined,
              });
              setCartFeedback("Adicionado ao carrinho.");
              window.setTimeout(() => setCartFeedback(""), 2200);
            }}
            className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-white transition hover:bg-white/10 disabled:cursor-not-allowed disabled:bg-slate-800/60 disabled:text-white/45"
          >
            <ShoppingCart className="h-4 w-4" />
            Adicionar ao carrinho
          </button>

          {cartFeedback ? <p className="text-sm text-cyan-100">{cartFeedback}</p> : null}
        </div>
      </div>
    </article>
  );
}

function ShowcaseShelf({ title, subtitle, icon, items, inquiryCounts, anchorId }: ShelfProps) {
  if (!items.length) {
    return null;
  }

  return (
    <section id={anchorId} className="relative overflow-hidden rounded-[30px] border border-white/10 bg-white/[0.04] p-5 sm:p-6">
      <ShowcaseSectionWatermark align="right" />
      <div className="relative z-10 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-white/75">
        {icon}
        Curadoria
      </div>
      <h3 className="relative z-10 mt-3 text-2xl font-semibold">{title}</h3>
      <p className="relative z-10 mt-2 max-w-2xl text-sm leading-6 text-white/62">{subtitle}</p>

      <div className="relative z-10 mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {items.map((item) => (
          <ShowcaseCard key={item.id} item={item} inquiryCount={getItemPopularity(item, inquiryCounts)} />
        ))}
      </div>
    </section>
  );
}

export function ShowcaseCatalogExplorer({
  items,
  inquiryCounts,
  testimonials,
  settings,
  canManage,
}: ShowcaseCatalogExplorerProps) {
  const [query, setQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("Todos");
  const [availabilityFilter, setAvailabilityFilter] = useState<AvailabilityFilter>("ALL");
  const [priceFilter, setPriceFilter] = useState<PriceFilter>("ALL");
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

  const categories = getShowcaseCategoryOptions(items);
  const featuredItem =
    sortItems(items.filter((item) => item.featured), "FEATURED", inquiryCounts)[0] ?? items[0];
  const readyItems = sortItems(
    items.filter((item) => item.fulfillmentType === "STOCK" && item.stockQuantity > 0),
    "READY_FIRST",
    inquiryCounts,
  ).slice(0, 4);
  const customItems = sortItems(
    items.filter((item) => item.fulfillmentType === "MADE_TO_ORDER"),
    "FEATURED",
    inquiryCounts,
  ).slice(0, 4);
  const bestSellerItems = sortItems(items, "POPULAR", inquiryCounts).slice(0, 4);
  const mostClickedItems = sortItems(items, "MOST_CLICKED", inquiryCounts).slice(0, 4);
  const newestItems = sortItems(items, "NEWEST", inquiryCounts).slice(0, 4);
  const wishlistItems = sortItems(
    items.filter((item) => wishlistIds.includes(item.id)),
    "FEATURED",
    inquiryCounts,
  ).slice(0, 4);

  const filteredItems = useMemo(
    () =>
      sortItems(
        items.filter((item) => {
          const categoryMatch =
            selectedCategory === "Todos" || getShowcaseCategoryLabel(item) === selectedCategory;
          const searchMatch = !deferredQuery || getSearchHaystack(item).includes(deferredQuery);

          return (
            categoryMatch &&
            searchMatch &&
            matchesAvailability(item, availabilityFilter) &&
            matchesPrice(item, priceFilter)
          );
        }),
        sortBy,
        inquiryCounts,
      ),
    [availabilityFilter, deferredQuery, inquiryCounts, items, priceFilter, selectedCategory, sortBy],
  );

  const featuredTestimonials = [...testimonials]
    .filter((testimonial) => testimonial.featured)
    .sort((left, right) => left.sortOrder - right.sortOrder)
    .slice(0, 3);
  const totalViews = items.reduce((sum, item) => sum + item.viewCount, 0);
  const totalClicks = items.reduce((sum, item) => sum + item.whatsappClickCount, 0);
  const whatsappCatalogUrl = `https://wa.me/${ownerWhatsAppNumber}`;
  const resultsLabel =
    filteredItems.length === 1 ? "1 produto encontrado" : `${filteredItems.length} produtos encontrados`;

  return (
    <section className="space-y-6">
      {settings.announcementText ? (
        <section className="rounded-[22px] border border-amber-400/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-50 sm:rounded-[24px] sm:px-5 sm:py-4">
          {settings.announcementText}
        </section>
      ) : null}

      <section className="relative overflow-hidden rounded-[28px] border border-white/10 bg-[radial-gradient(circle_at_top_left,_rgba(255,122,24,0.24),_transparent_30%),radial-gradient(circle_at_center_right,_rgba(89,185,255,0.18),_transparent_28%),linear-gradient(145deg,_rgba(5,7,12,0.98),_rgba(8,14,22,0.94))] sm:rounded-[32px]">
        <ShowcaseSectionWatermark align={featuredItem ? "right" : "center"} intensity="strong" />
        <div className="relative z-10 grid gap-0 xl:grid-cols-[0.95fr_1.05fr]">
          <div className="p-5 sm:p-8 lg:p-9">
            <p className="text-xs uppercase tracking-[0.28em] text-orange-200/70">{settings.heroEyebrow}</p>
            <h3 className="mt-4 max-w-2xl text-[2.05rem] font-semibold leading-[1.02] tracking-tight sm:text-5xl">
              {settings.heroTitle}
            </h3>
            <p className="mt-4 max-w-2xl text-sm leading-6 text-white/72 sm:text-base sm:leading-7">
              {settings.heroSubtitle}
            </p>

            <div className="mt-5 grid gap-2 sm:mt-6 sm:flex sm:flex-wrap sm:gap-3">
              {settings.heroHighlights.map((highlight) => (
                <span key={highlight} className="inline-flex w-fit items-center gap-2 rounded-full border border-white/10 bg-white/8 px-4 py-2 text-sm text-white/80">
                  <ShieldCheck className="h-4 w-4 text-emerald-300" />
                  {highlight}
                </span>
              ))}
            </div>

            <div className="mt-6 grid grid-cols-2 gap-3 sm:mt-7 sm:grid-cols-4">
              <div className="rounded-[20px] border border-white/10 bg-black/25 p-4 backdrop-blur sm:rounded-[24px]">
                <p className="text-xs uppercase tracking-[0.22em] text-white/45">Ativos</p>
                <p className="mt-2 text-2xl font-semibold">{items.length}</p>
              </div>
              <div className="rounded-[20px] border border-white/10 bg-black/25 p-4 backdrop-blur sm:rounded-[24px]">
                <p className="text-xs uppercase tracking-[0.22em] text-white/45">Entrega</p>
                <p className="mt-2 text-2xl font-semibold">{readyItems.length}</p>
              </div>
              <div className="rounded-[20px] border border-white/10 bg-black/25 p-4 backdrop-blur sm:rounded-[24px]">
                <p className="text-xs uppercase tracking-[0.22em] text-white/45">Encomenda</p>
                <p className="mt-2 text-2xl font-semibold">{customItems.length}</p>
              </div>
              <div className="rounded-[20px] border border-white/10 bg-black/25 p-4 backdrop-blur sm:rounded-[24px]">
                <p className="text-xs uppercase tracking-[0.22em] text-white/45">Favoritos</p>
                <p className="mt-2 text-2xl font-semibold">{wishlistItems.length}</p>
              </div>
            </div>

            <div className="mt-6 grid gap-3 sm:mt-7 sm:flex sm:flex-wrap">
              <a href="#catalogo-grid" className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-orange-500 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-orange-400 sm:w-auto">
                {settings.heroPrimaryCtaLabel}
                <ArrowRight className="h-4 w-4" />
              </a>
              {featuredItem ? (
                <Link href={`/produto/${featuredItem.id}`} className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/8 px-5 py-3 text-sm font-semibold text-white/90 transition hover:bg-white/12 sm:w-auto">
                  {settings.heroSecondaryCtaLabel}
                  <Sparkles className="h-4 w-4" />
                </Link>
              ) : null}
              {canManage ? (
                <Link href="/admin?section=vitrine" className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-white/10 bg-black/25 px-5 py-3 text-sm font-semibold text-white/85 transition hover:bg-white/10 sm:w-auto">
                  Gerenciar vitrine
                </Link>
              ) : null}
              <ShowcaseCartButton className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/7 px-5 py-3 text-sm font-semibold text-white/85 transition hover:bg-white/12 sm:w-auto" />
            </div>
          </div>

          <div className="border-t border-white/10 p-3 sm:p-6 xl:border-l xl:border-t-0">
            {featuredItem ? (
              <Link href={`/produto/${featuredItem.id}`} className="group block overflow-hidden rounded-[24px] border border-white/10 bg-black/25 shadow-[0_24px_80px_rgba(0,0,0,0.32)] sm:rounded-[30px]">
                <div className="relative h-[250px] overflow-hidden sm:h-[360px]">
                  {getShowcasePrimaryVideo(featuredItem) ? (
                    <video src={getShowcasePrimaryVideo(featuredItem)} className="h-full w-full object-cover" muted loop autoPlay playsInline preload="metadata" poster={getShowcasePrimaryImage(featuredItem)} />
                  ) : getShowcasePrimaryImage(featuredItem) ? (
                    <img src={getShowcasePrimaryImage(featuredItem)} alt={featuredItem.name} className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.04]" />
                  ) : (
                    <div className="h-full bg-[radial-gradient(circle_at_top_left,_rgba(255,122,24,0.35),_transparent_28%),radial-gradient(circle_at_bottom_right,_rgba(89,185,255,0.22),_transparent_32%),linear-gradient(135deg,_rgba(255,255,255,0.08),_rgba(15,23,42,0.95))]" />
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/20 to-transparent" />
                  <div className="absolute left-3 top-3 flex flex-wrap gap-2 sm:left-4 sm:top-4">
                    <span className="rounded-full border border-orange-300/30 bg-orange-500/15 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-orange-100">
                      Produto destaque
                    </span>
                    {(featuredItem.badges ?? []).slice(0, 2).map((badge) => (
                      <span key={badge} className="rounded-full border border-white/15 bg-black/35 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-white/80">
                        {badge}
                      </span>
                    ))}
                  </div>
                  <div className="absolute bottom-0 left-0 right-0 p-4 sm:p-5">
                    <p className="text-[11px] uppercase tracking-[0.2em] text-white/50">{getShowcaseCategoryLabel(featuredItem)}</p>
                    <h4 className="mt-3 text-2xl font-semibold sm:text-3xl">{featuredItem.name}</h4>
                    <p className="mt-3 max-w-xl text-sm leading-6 text-white/72 sm:leading-7">
                      {getShowcaseDescriptionPreview(featuredItem.description, 150)}
                    </p>
                  </div>
                </div>
              </Link>
            ) : (
              <div className="relative flex h-full min-h-[250px] items-center justify-center overflow-hidden rounded-[24px] border border-dashed border-white/10 bg-black/20 p-6 text-sm text-white/55 sm:min-h-[320px] sm:rounded-[30px] sm:p-8">
                <ShowcaseSectionWatermark align="center" intensity="strong" />
                <div className="relative z-10 max-w-xs text-center">
                  Assim que voce cadastrar produtos, o destaque principal da loja aparece aqui.
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="grid gap-3 sm:gap-4 lg:grid-cols-3">
        <div className="rounded-[24px] border border-white/10 bg-white/[0.04] p-4 sm:rounded-[28px] sm:p-5">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-white/75">
            <HeartHandshake className="h-3.5 w-3.5 text-cyan-200" />
            {settings.aboutTitle}
          </div>
          <p className="mt-4 text-base leading-7 text-white/72">{settings.aboutBody}</p>
        </div>
        <div className="rounded-[24px] border border-white/10 bg-white/[0.04] p-4 sm:rounded-[28px] sm:p-5">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-white/75">
            <PackageCheck className="h-3.5 w-3.5 text-emerald-200" />
            {settings.customOrderTitle}
          </div>
          <p className="mt-4 text-base leading-7 text-white/72">{settings.customOrderBody}</p>
        </div>
        <div className="rounded-[24px] border border-white/10 bg-white/[0.04] p-4 sm:rounded-[28px] sm:p-5">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-white/75">
            <Truck className="h-3.5 w-3.5 text-orange-200" />
            {settings.shippingTitle}
          </div>
          <p className="mt-4 text-base leading-7 text-white/72">{settings.shippingBody}</p>
        </div>
      </section>

      {wishlistItems.length ? (
        <ShowcaseShelf anchorId="favoritos" title="Seus favoritos" subtitle="Os itens que voce marcou para olhar com calma depois." icon={<Heart className="h-3.5 w-3.5 text-rose-200" />} items={wishlistItems} inquiryCounts={inquiryCounts} />
      ) : null}

      <ShowcaseShelf anchorId="shelf-destaques" title="Destaques da loja" subtitle="Pecas escolhidas para causar uma primeira impressao mais forte logo de cara." icon={<Star className="h-3.5 w-3.5 text-orange-200" />} items={sortItems(items, "FEATURED", inquiryCounts).slice(0, 4)} inquiryCounts={inquiryCounts} />

      <ShowcaseShelf anchorId="shelf-populares" title="Mais pedidos" subtitle="Os produtos que mais despertaram interesse e provaram que convertem melhor." icon={<Sparkles className="h-3.5 w-3.5 text-fuchsia-200" />} items={bestSellerItems} inquiryCounts={inquiryCounts} />

      <ShowcaseShelf anchorId="shelf-whatsapp" title="Mais clicados no WhatsApp" subtitle="Os itens que mais chamaram atencao e levaram o cliente para a conversa." icon={<MessageCircleMore className="h-3.5 w-3.5 text-emerald-200" />} items={mostClickedItems} inquiryCounts={inquiryCounts} />

      <ShowcaseShelf anchorId="shelf-pronta-entrega" title="Pronta entrega" subtitle="Ideal para quem quer decidir rapido e receber orientacao com estoque real." icon={<PackageCheck className="h-3.5 w-3.5 text-emerald-200" />} items={readyItems} inquiryCounts={inquiryCounts} />

      <ShowcaseShelf anchorId="shelf-encomenda" title="Sob encomenda" subtitle="Pecas com mais liberdade para cor, tamanho e acabamento conforme a sua ideia." icon={<Truck className="h-3.5 w-3.5 text-cyan-200" />} items={customItems} inquiryCounts={inquiryCounts} />

      <ShowcaseShelf title="Novidades" subtitle="Itens novos para manter a vitrine viva e dar sempre um motivo para voltar." icon={<Sparkles className="h-3.5 w-3.5 text-white" />} items={newestItems} inquiryCounts={inquiryCounts} />

      <section className="relative overflow-hidden rounded-[26px] border border-white/10 bg-white/[0.04] p-4 sm:rounded-[30px] sm:p-6">
        <ShowcaseSectionWatermark align="center" intensity="strong" />
        <div className="relative z-10 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.24em] text-white/45">Encontre sua peca</p>
            <h3 className="mt-2 text-2xl font-semibold">Busque, filtre e compare com mais facilidade</h3>
            <p className="mt-3 text-sm text-white/60">{resultsLabel}</p>
          </div>

          <div className="grid w-full gap-3 lg:max-w-2xl lg:grid-cols-[minmax(0,1fr)_220px]">
            <label className="relative block">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-white/35" />
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar por nome, cor, material, categoria ou acabamento" className="w-full rounded-2xl border border-white/10 bg-slate-950/70 py-3 pl-11 pr-4 text-sm text-white outline-none transition focus:border-orange-400/60" />
            </label>

            <label className="relative block">
              <ArrowUpDown className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-white/35" />
              <select value={sortBy} onChange={(event) => setSortBy(event.target.value as SortOption)} className="w-full appearance-none rounded-2xl border border-white/10 bg-slate-950/70 py-3 pl-11 pr-4 text-sm text-white outline-none transition focus:border-orange-400/60">
                <option value="FEATURED">Ordenar por destaque</option>
                <option value="POPULAR">Mais pedidos</option>
                <option value="MOST_CLICKED">Mais clicados</option>
                <option value="READY_FIRST">Pronta entrega primeiro</option>
                <option value="LOWEST_PRICE">Menor preco</option>
                <option value="HIGHEST_PRICE">Maior preco</option>
                <option value="FASTEST">Prazo mais rapido</option>
                <option value="NEWEST">Mais recentes</option>
              </select>
            </label>
          </div>
        </div>

        <div className="relative z-10 mt-5 -mx-1 flex gap-2 overflow-x-auto px-1 pb-2 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0 sm:pb-0">
          <button type="button" onClick={() => setSelectedCategory("Todos")} className={`rounded-full border px-4 py-2 text-sm font-medium transition ${selectedCategory === "Todos" ? "border-orange-400/40 bg-orange-500/15 text-orange-100" : "border-white/10 bg-white/5 text-white/70 hover:bg-white/10"}`}>
            Todas
          </button>
          {categories.map((category) => (
            <button key={category} type="button" onClick={() => setSelectedCategory(category)} className={`rounded-full border px-4 py-2 text-sm font-medium transition ${selectedCategory === category ? "border-orange-400/40 bg-orange-500/15 text-orange-100" : "border-white/10 bg-white/5 text-white/70 hover:bg-white/10"}`}>
              {category}
            </button>
          ))}
        </div>

        <div className="relative z-10 mt-4 -mx-1 flex gap-2 overflow-x-auto px-1 pb-2 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0 sm:pb-0">
          {[
            { id: "ALL", label: "Tudo" },
            { id: "STOCK", label: "Pronta entrega" },
            { id: "MADE_TO_ORDER", label: "Sob encomenda" },
          ].map((option) => (
            <button key={option.id} type="button" onClick={() => setAvailabilityFilter(option.id as AvailabilityFilter)} className={`rounded-full border px-4 py-2 text-sm font-medium transition ${availabilityFilter === option.id ? "border-cyan-400/40 bg-cyan-500/15 text-cyan-100" : "border-white/10 bg-white/5 text-white/70 hover:bg-white/10"}`}>
              {option.label}
            </button>
          ))}
        </div>

        <div className="relative z-10 mt-4 -mx-1 flex gap-2 overflow-x-auto px-1 pb-2 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0 sm:pb-0">
          {priceFilterOptions.map((option) => (
            <button key={option.id} type="button" onClick={() => setPriceFilter(option.id)} className={`rounded-full border px-4 py-2 text-sm font-medium transition ${priceFilter === option.id ? "border-emerald-400/40 bg-emerald-500/15 text-emerald-100" : "border-white/10 bg-white/5 text-white/70 hover:bg-white/10"}`}>
              {option.label}
            </button>
          ))}
        </div>
      </section>

      <section id="catalogo-grid" className="grid gap-4 md:grid-cols-2 xl:gap-5 2xl:grid-cols-3">
        {filteredItems.length ? (
          filteredItems.map((item) => (
            <ShowcaseCard key={item.id} item={item} inquiryCount={getItemPopularity(item, inquiryCounts)} />
          ))
        ) : (
          <div className="md:col-span-2 2xl:col-span-3 rounded-[28px] border border-dashed border-white/15 bg-slate-950/50 p-8 text-sm text-white/60">
            Nenhum item encontrado para esse filtro. Tente outra categoria, ajuste o valor ou limpe a busca.
          </div>
        )}
      </section>

      <section className="relative overflow-hidden rounded-[28px] border border-white/10 bg-[linear-gradient(145deg,rgba(8,12,18,0.72),rgba(4,8,14,0.78))] p-1 sm:rounded-[32px]">
        <ShowcaseSectionWatermark align="center" />
        <div className="relative z-10 grid gap-4 lg:grid-cols-3">
        <div className="rounded-[24px] border border-white/10 bg-white/[0.04] p-4 sm:rounded-[28px] sm:p-5">
          <p className="text-xs uppercase tracking-[0.22em] text-white/45">Prazo medio</p>
          <p className="mt-4 text-base leading-7 text-white/72">{settings.averageLeadTimeText}</p>
        </div>
        <div className="rounded-[24px] border border-white/10 bg-white/[0.04] p-4 sm:rounded-[28px] sm:p-5">
          <p className="text-xs uppercase tracking-[0.22em] text-white/45">Materiais usados</p>
          <p className="mt-4 text-base leading-7 text-white/72">{settings.materialsText}</p>
        </div>
        <div className="rounded-[24px] border border-white/10 bg-white/[0.04] p-4 sm:rounded-[28px] sm:p-5">
          <p className="text-xs uppercase tracking-[0.22em] text-white/45">Cuidados com a peca</p>
          <p className="mt-4 text-base leading-7 text-white/72">{settings.careText}</p>
        </div>
        </div>
      </section>

      {featuredTestimonials.length ? (
        <section className="rounded-[26px] border border-white/10 bg-white/[0.04] p-4 sm:rounded-[30px] sm:p-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.24em] text-white/45">Prova social</p>
              <h3 className="mt-2 text-2xl font-semibold">Quem ja comprou fala pela loja</h3>
            </div>
            <Link href="/depoimentos" className="inline-flex items-center gap-2 text-sm font-semibold text-orange-200 transition hover:text-orange-100">
              Ver todos os depoimentos
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>

          <div className="mt-6 grid gap-4 lg:grid-cols-3">
            {featuredTestimonials.map((testimonial) => (
              <article key={testimonial.id} className="rounded-[28px] border border-white/10 bg-slate-950/60 p-5">
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
                {testimonial.productName ? <p className="mt-4 text-sm font-semibold text-orange-100">Produto: {testimonial.productName}</p> : null}
              </article>
            ))}
          </div>
        </section>
      ) : null}

      <section className="relative overflow-hidden rounded-[26px] border border-white/10 bg-[linear-gradient(145deg,rgba(8,12,18,0.98),rgba(4,8,14,0.98))] p-5 sm:rounded-[30px] sm:p-8">
        <ShowcaseSectionWatermark align="right" intensity="strong" />
        <div className="relative z-10 grid gap-6 xl:grid-cols-[1fr_0.92fr]">
          <div>
            <p className="text-xs uppercase tracking-[0.24em] text-white/45">{settings.portfolioTitle}</p>
            <h3 className="mt-3 text-3xl font-semibold">Acompanhe mais da loja e veja o estilo de cada peca</h3>
            <p className="mt-4 max-w-2xl text-sm leading-7 text-white/68 sm:text-base">{settings.portfolioBody}</p>

            <div className="mt-6 grid gap-3 sm:flex sm:flex-wrap">
              <a href={whatsappCatalogUrl} target="_blank" rel="noreferrer" className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-400 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-emerald-300 sm:w-auto">
                <MessageCircleMore className="h-4 w-4" />
                Falar no WhatsApp
              </a>
              {settings.instagramUrl ? (
                <a href={settings.instagramUrl} target="_blank" rel="noreferrer" className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/8 px-5 py-3 text-sm font-semibold text-white/92 transition hover:bg-white/12 sm:w-auto">
                  <Camera className="h-4 w-4" />
                  {settings.instagramHandle || "Ver Instagram"}
                </a>
              ) : null}
              <Link href="/depoimentos" className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-white/10 bg-black/25 px-5 py-3 text-sm font-semibold text-white/85 transition hover:bg-white/10 sm:w-auto">
                Ver depoimentos
              </Link>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 sm:gap-4">
            <div className="rounded-[22px] border border-white/10 bg-white/[0.04] p-4 sm:rounded-[26px] sm:p-5">
              <p className="text-xs uppercase tracking-[0.22em] text-white/45">Produtos</p>
              <p className="mt-3 text-3xl font-semibold">{items.length}</p>
              <p className="mt-2 text-sm leading-6 text-white/63">Itens ativos na vitrine com informacoes reais.</p>
            </div>
            <div className="rounded-[22px] border border-white/10 bg-white/[0.04] p-4 sm:rounded-[26px] sm:p-5">
              <p className="text-xs uppercase tracking-[0.22em] text-white/45">Visualizacoes</p>
              <p className="mt-3 text-3xl font-semibold">{totalViews}</p>
              <p className="mt-2 text-sm leading-6 text-white/63">Interesse acumulado na pagina dos produtos.</p>
            </div>
            <div className="rounded-[22px] border border-white/10 bg-white/[0.04] p-4 sm:rounded-[26px] sm:p-5">
              <p className="text-xs uppercase tracking-[0.22em] text-white/45">Cliques no WhatsApp</p>
              <p className="mt-3 text-3xl font-semibold">{totalClicks}</p>
              <p className="mt-2 text-sm leading-6 text-white/63">Conversas iniciadas direto pela loja.</p>
            </div>
            <div className="rounded-[22px] border border-white/10 bg-white/[0.04] p-4 sm:rounded-[26px] sm:p-5">
              <p className="text-xs uppercase tracking-[0.22em] text-white/45">Instagram</p>
              <p className="mt-3 text-2xl font-semibold">{settings.instagramHandle || "Conecte seu perfil"}</p>
              <p className="mt-2 text-sm leading-6 text-white/63">Mais um ponto de prova visual para quem gostou da vitrine.</p>
            </div>
          </div>
        </div>
      </section>
    </section>
  );
}
