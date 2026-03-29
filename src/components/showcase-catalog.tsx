/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { UserRole } from "@prisma/client";
import { ArrowUpRight, Boxes, Clock3, MessageCircleMore, Sparkles } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import type { SessionUser } from "@/lib/auth";
import type { DbShowcaseItem } from "@/lib/db-types";
import { formatCurrency } from "@/lib/format";

type ShowcaseCatalogProps = {
  user: SessionUser | null;
  items: DbShowcaseItem[];
  message?: string | null;
  pathname: string;
};

function getDescriptionPreview(description: string, maxLength = 180) {
  const normalized = description.replace(/\s+/g, " ").trim();

  if (normalized.length <= maxLength) {
    return normalized;
  }

  return `${normalized.slice(0, maxLength).trimEnd()}...`;
}

export function ShowcaseCatalog({ user, items, message, pathname }: ShowcaseCatalogProps) {
  const visibleItems = items.filter((item) => item.active);
  const readyToShipCount = visibleItems.filter((item) => item.fulfillmentType === "STOCK").length;
  const madeToOrderCount = visibleItems.length - readyToShipCount;

  return (
    <AppShell
      user={user}
      pathname={pathname}
      title="Peças 3D prontas e sob encomenda"
      subtitle="Um catálogo mais direto: escolha o item, ajuste a quantidade e avance para o WhatsApp em poucos cliques."
    >
      {message ? (
        <div className="rounded-[24px] border border-amber-400/20 bg-amber-500/10 px-5 py-4 text-sm text-amber-50">
          {message}
        </div>
      ) : null}

      <section className="rounded-[32px] border border-white/10 bg-white/[0.045] p-4 sm:p-6">
        <div className="relative overflow-hidden rounded-[30px] border border-white/10 bg-[radial-gradient(circle_at_top_left,_rgba(255,122,24,0.22),_transparent_34%),radial-gradient(circle_at_bottom_right,_rgba(89,185,255,0.16),_transparent_30%),linear-gradient(145deg,_rgba(8,12,18,0.96),_rgba(10,18,28,0.9))] p-6 sm:p-8">
          <div className="absolute right-[-90px] top-[-70px] h-48 w-48 rounded-full bg-orange-400/10 blur-3xl" />
          <div className="absolute bottom-[-90px] left-[-70px] h-52 w-52 rounded-full bg-cyan-400/10 blur-3xl" />

          <div className="relative flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
            <div className="max-w-4xl">
              <p className="text-xs uppercase tracking-[0.28em] text-orange-200/70">Compra direta</p>
              <h3 className="mt-3 max-w-3xl text-4xl font-semibold tracking-tight sm:text-5xl">
                Catálogo da loja
              </h3>
              <p className="mt-4 max-w-3xl text-sm leading-7 text-white/72 sm:text-base">
                Explore as peças em destaque, escolha a quantidade e avance para o contato no WhatsApp. Antes de abrir a conversa, o cliente informa apenas nome e telefone.
              </p>

              <div className="mt-6 grid gap-3 sm:grid-cols-3">
                <div className="rounded-[24px] border border-white/10 bg-black/25 p-4 backdrop-blur">
                  <div className="flex items-center gap-3">
                    <div className="rounded-2xl bg-orange-500/15 p-2 text-orange-200">
                      <Boxes className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-[0.22em] text-white/45">Itens ativos</p>
                      <p className="mt-1 text-2xl font-semibold">{visibleItems.length}</p>
                    </div>
                  </div>
                </div>
                <div className="rounded-[24px] border border-white/10 bg-black/25 p-4 backdrop-blur">
                  <div className="flex items-center gap-3">
                    <div className="rounded-2xl bg-emerald-400/15 p-2 text-emerald-200">
                      <Sparkles className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-[0.22em] text-white/45">Pronta entrega</p>
                      <p className="mt-1 text-2xl font-semibold">{readyToShipCount}</p>
                    </div>
                  </div>
                </div>
                <div className="rounded-[24px] border border-white/10 bg-black/25 p-4 backdrop-blur">
                  <div className="flex items-center gap-3">
                    <div className="rounded-2xl bg-cyan-400/15 p-2 text-cyan-200">
                      <Clock3 className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-[0.22em] text-white/45">Sob encomenda</p>
                      <p className="mt-1 text-2xl font-semibold">{madeToOrderCount}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-3 xl:max-w-xs xl:items-end">
              <div className="rounded-[24px] border border-white/10 bg-black/25 px-5 py-4 text-sm leading-6 text-white/68 backdrop-blur">
                Atendimento direto, sem cadastro obrigatório para o cliente.
              </div>
              {user && user.role !== UserRole.CLIENT ? (
                <Link
                  href="/admin"
                  className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/8 px-5 py-3 text-sm font-semibold text-white/90 transition hover:bg-white/12"
                >
                  Gerenciar vitrine e leads
                  <ArrowUpRight className="h-4 w-4" />
                </Link>
              ) : null}
            </div>
          </div>
        </div>

        <div className="mt-6 grid gap-5 md:grid-cols-2 2xl:grid-cols-3">
          {visibleItems.length ? (
            visibleItems.map((item) => {
              const managesStock = item.fulfillmentType === "STOCK";
              const isUnavailable = managesStock && item.stockQuantity <= 0;
              const stockLabel = managesStock
                ? item.stockQuantity > 0
                  ? `Em estoque: ${item.stockQuantity}`
                  : "Sem estoque"
                : "Sob encomenda";
              const actionLabel = isUnavailable
                ? "Indisponivel"
                : managesStock
                  ? "Comprar agora"
                  : "Encomendar";
              const availabilityClassName = isUnavailable
                ? "border-rose-400/30 bg-rose-500/15 text-rose-100"
                : managesStock
                  ? "border-emerald-400/25 bg-emerald-400/15 text-emerald-100"
                  : "border-cyan-400/25 bg-cyan-400/15 text-cyan-100";

              return (
                <article
                  key={item.id}
                  className="group flex h-full flex-col overflow-hidden rounded-[30px] border border-white/10 bg-[linear-gradient(180deg,rgba(8,12,18,0.96),rgba(5,8,14,0.98))] shadow-[0_22px_90px_rgba(0,0,0,0.26)]"
                >
                  <div className="relative h-64 overflow-hidden border-b border-white/10">
                    {item.imageUrl ? (
                      <img
                        src={item.imageUrl}
                        alt={item.name}
                        className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.04]"
                      />
                    ) : (
                      <div className="h-full bg-[radial-gradient(circle_at_top_left,_rgba(255,122,24,0.35),_transparent_28%),radial-gradient(circle_at_bottom_right,_rgba(89,185,255,0.22),_transparent_32%),linear-gradient(135deg,_rgba(255,255,255,0.08),_rgba(15,23,42,0.95))]" />
                    )}

                    <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/30 to-transparent" />

                    <div className="absolute left-4 top-4 flex flex-wrap gap-2">
                      <span
                        className={`rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] backdrop-blur ${availabilityClassName}`}
                      >
                        {stockLabel}
                      </span>
                      <span className="rounded-full border border-white/15 bg-black/35 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-white/80 backdrop-blur">
                        Sem cadastro
                      </span>
                    </div>

                    <div className="absolute bottom-4 left-4 right-4 flex items-end justify-between gap-4">
                      <div className="max-w-[70%]">
                        <p className="text-[11px] uppercase tracking-[0.24em] text-white/55">PrintFlow 3D</p>
                        <h4 className="mt-2 text-2xl font-semibold leading-tight text-white sm:text-[2rem]">
                          {item.name}
                        </h4>
                      </div>

                      <div className="shrink-0 rounded-[24px] border border-white/12 bg-slate-950/72 px-4 py-3 text-right backdrop-blur">
                        <p className="text-[11px] uppercase tracking-[0.18em] text-white/45">
                          {managesStock ? "Pronta entrega" : "Sob encomenda"}
                        </p>
                        <p className="mt-2 text-3xl font-semibold leading-none">
                          {formatCurrency(item.price)}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-1 flex-col p-5">
                    <div className="flex flex-wrap gap-2">
                      <span className="rounded-full border border-white/10 bg-white/6 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.18em] text-white/65">
                        Conversa no WhatsApp
                      </span>
                      <span className="rounded-full border border-white/10 bg-white/6 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.18em] text-white/65">
                        {managesStock ? "Pedido imediato" : "Produção por encomenda"}
                      </span>
                    </div>

                    <p className="mt-4 text-sm leading-7 text-white/72">
                      {getDescriptionPreview(item.description)}
                    </p>

                    <div className="mt-5 grid gap-3 rounded-[24px] border border-white/10 bg-white/[0.03] p-4 sm:grid-cols-2">
                      <div>
                        <p className="text-[11px] uppercase tracking-[0.2em] text-white/40">
                          Disponibilidade
                        </p>
                        <p className="mt-2 text-base font-semibold text-white/88">{stockLabel}</p>
                      </div>
                      <div>
                        <p className="text-[11px] uppercase tracking-[0.2em] text-white/40">
                          Fluxo de compra
                        </p>
                        <p className="mt-2 text-base font-semibold text-white/88">
                          Nome + telefone antes da conversa
                        </p>
                      </div>
                    </div>

                    <form action={`/comprar/${item.id}`} className="mt-auto pt-5">
                      <div className="grid gap-3 sm:grid-cols-[120px_minmax(0,1fr)]">
                        <label className="block text-sm text-white/70">
                          Quantidade
                          <input
                            name="quantity"
                            type="number"
                            min="1"
                            max={managesStock ? Math.max(item.stockQuantity, 1) : 999}
                            defaultValue="1"
                            disabled={isUnavailable}
                            className="mt-2 w-full rounded-2xl border border-white/10 bg-black/35 px-4 py-3 text-white outline-none focus:border-orange-400/60"
                          />
                        </label>
                        <button
                          type="submit"
                          disabled={isUnavailable}
                          className="inline-flex items-center justify-center gap-2 rounded-2xl bg-emerald-400 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-emerald-300 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-white/55"
                        >
                          <MessageCircleMore className="h-4 w-4" />
                          {actionLabel}
                        </button>
                      </div>
                    </form>
                  </div>
                </article>
              );
            })
          ) : (
            <div className="md:col-span-2 2xl:col-span-3 rounded-[28px] border border-dashed border-white/15 bg-slate-950/50 p-8 text-sm text-white/60">
              Ainda não há produtos cadastrados na vitrine.
            </div>
          )}
        </div>
      </section>
    </AppShell>
  );
}
