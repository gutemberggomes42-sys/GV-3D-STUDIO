/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { redirect } from "next/navigation";
import { Clock3, PackageCheck, Ruler, SwatchBook } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { getCurrentUser } from "@/lib/auth";
import { formatCurrency, formatHours } from "@/lib/format";
import {
  getShowcaseAvailabilityLabel,
  getShowcaseColorSummary,
  getShowcaseGallery,
  getShowcaseLeadTimeLabel,
} from "@/lib/showcase";
import { getHydratedData } from "@/lib/view-data";

type BuyItemPageProps = {
  params: Promise<{ itemId: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function getRequestedQuantity(value: string | string[] | undefined) {
  const rawValue = typeof value === "string" ? value : "1";
  const parsed = Number(rawValue);

  if (!Number.isFinite(parsed)) {
    return 1;
  }

  return Math.max(1, Math.min(999, Math.round(parsed)));
}

export default async function BuyItemPage({
  params,
  searchParams,
}: BuyItemPageProps) {
  const user = await getCurrentUser();
  const { itemId } = await params;
  const query = searchParams ? await searchParams : {};
  const requestedQuantity = getRequestedQuantity(query.quantity);
  const message = typeof query.message === "string" ? query.message : null;
  const { showcaseItems } = await getHydratedData();
  const item = showcaseItems.find((candidate) => candidate.id === itemId && candidate.active);

  if (!item) {
    redirect("/?message=Item%20da%20vitrine%20nao%20encontrado.");
  }

  const managesStock = item.fulfillmentType === "STOCK";

  if (managesStock && item.stockQuantity <= 0) {
    redirect("/?message=Este%20produto%20esta%20sem%20estoque%20no%20momento.");
  }

  const quantity = managesStock ? Math.min(requestedQuantity, item.stockQuantity) : requestedQuantity;
  const heroImage = getShowcaseGallery(item)[0];

  return (
    <AppShell
      user={user}
      pathname="/"
      title="Confirmar compra pelo WhatsApp"
      subtitle="Nao precisa cadastro. Informe somente nome e telefone para gerar a mensagem e abrir a conversa."
    >
      {message ? (
        <div className="rounded-[24px] border border-amber-400/20 bg-amber-500/10 px-5 py-4 text-sm text-amber-50">
          {message}
        </div>
      ) : null}

      <section className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <article className="overflow-hidden rounded-[28px] border border-white/10 bg-white/5">
          {heroImage ? (
            <img
              src={heroImage}
              alt={item.name}
              className="h-72 w-full border-b border-white/10 object-cover"
            />
          ) : (
            <div className="h-72 border-b border-white/10 bg-[radial-gradient(circle_at_top_left,_rgba(255,122,24,0.35),_transparent_28%),radial-gradient(circle_at_bottom_right,_rgba(89,185,255,0.22),_transparent_32%),linear-gradient(135deg,_rgba(255,255,255,0.08),_rgba(15,23,42,0.95))]" />
          )}

          <div className="p-6">
            <div className="flex flex-wrap gap-2">
              <span className="rounded-full border border-white/10 bg-white/6 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-white/80">
                {item.category}
              </span>
              <span className="rounded-full border border-emerald-400/25 bg-emerald-400/15 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-100">
                {getShowcaseAvailabilityLabel(item)}
              </span>
              <span className="rounded-full border border-cyan-400/25 bg-cyan-400/15 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan-100">
                {getShowcaseLeadTimeLabel(item)}
              </span>
            </div>
            <h3 className="mt-3 text-3xl font-semibold">{item.name}</h3>
            {item.tagline ? (
              <p className="mt-3 text-base leading-7 text-white/78">{item.tagline}</p>
            ) : null}
            <p className="mt-3 text-sm leading-6 text-white/68">
              {item.description}
            </p>

            <div className="mt-6 grid gap-3 md:grid-cols-3">
              <div className="rounded-[22px] border border-white/10 bg-slate-950/60 p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-white/45">Valor</p>
                <p className="mt-2 text-2xl font-semibold">{formatCurrency(item.price)}</p>
              </div>
              <div className="rounded-[22px] border border-white/10 bg-slate-950/60 p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-white/45">Quantidade</p>
                <p className="mt-2 text-2xl font-semibold">{quantity}</p>
              </div>
              <div className="rounded-[22px] border border-white/10 bg-slate-950/60 p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-white/45">
                  {managesStock ? "Estoque atual" : "Disponibilidade"}
                </p>
                <p className="mt-2 text-2xl font-semibold">
                  {managesStock ? item.stockQuantity : "Sob encomenda"}
                </p>
              </div>
            </div>

            <div className="mt-5 grid gap-3 rounded-[24px] border border-white/10 bg-white/[0.03] p-4 sm:grid-cols-2">
              <div>
                <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-white/45">
                  <PackageCheck className="h-3.5 w-3.5" />
                  Material
                </div>
                <p className="mt-2 text-sm font-semibold text-white/88">{item.materialLabel ?? "Sob consulta"}</p>
              </div>
              <div>
                <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-white/45">
                  <SwatchBook className="h-3.5 w-3.5" />
                  Cores
                </div>
                <p className="mt-2 text-sm font-semibold text-white/88">{getShowcaseColorSummary(item)}</p>
              </div>
              <div>
                <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-white/45">
                  <Ruler className="h-3.5 w-3.5" />
                  Medidas
                </div>
                <p className="mt-2 text-sm font-semibold text-white/88">{item.dimensionSummary ?? "Sob consulta"}</p>
              </div>
              <div>
                <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-white/45">
                  <Clock3 className="h-3.5 w-3.5" />
                  Impressao
                </div>
                <p className="mt-2 text-sm font-semibold text-white/88">{formatHours(item.estimatedPrintHours)}</p>
              </div>
            </div>
          </div>
        </article>

        <form
          action={`/comprar/${item.id}/enviar`}
          method="post"
          className="space-y-4 rounded-[28px] border border-white/10 bg-white/5 p-6"
        >
          <input type="hidden" name="quantity" value={String(quantity)} />

          <div>
            <p className="text-xs uppercase tracking-[0.24em] text-white/45">
              Dados para contato
            </p>
            <h3 className="mt-2 text-2xl font-semibold">Preencha e envie para o WhatsApp</h3>
            <p className="mt-2 text-sm leading-6 text-white/65">
              Depois de preencher, o sistema registra o interesse no painel do admin e abre a mensagem pronta para voce enviar.
            </p>
          </div>

          <label className="block text-sm text-white/70">
            Nome
            <input
              name="customerName"
              defaultValue=""
              className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 outline-none focus:border-emerald-400/60"
              placeholder="Seu nome"
            />
          </label>

          <label className="block text-sm text-white/70">
            Telefone / WhatsApp
            <input
              name="customerPhone"
              defaultValue=""
              className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 outline-none focus:border-emerald-400/60"
              placeholder="(64) 99999-9999"
            />
          </label>

          <button
            type="submit"
            className="inline-flex w-full items-center justify-center rounded-2xl bg-emerald-400 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-emerald-300"
          >
            Enviar para meu WhatsApp
          </button>

          <Link
            href={`/produto/${item.id}`}
            className="inline-flex w-full items-center justify-center rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm font-semibold text-white/80 transition hover:bg-white/10 hover:text-white"
          >
            Voltar para a pagina do produto
          </Link>
        </form>
      </section>
    </AppShell>
  );
}
