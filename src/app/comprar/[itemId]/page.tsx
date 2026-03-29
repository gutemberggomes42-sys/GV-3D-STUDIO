/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { getCurrentUser } from "@/lib/auth";
import { formatCurrency } from "@/lib/format";
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
          {item.imageUrl ? (
            <img
              src={item.imageUrl}
              alt={item.name}
              className="h-72 w-full border-b border-white/10 object-cover"
            />
          ) : (
            <div className="h-72 border-b border-white/10 bg-[radial-gradient(circle_at_top_left,_rgba(255,122,24,0.35),_transparent_28%),radial-gradient(circle_at_bottom_right,_rgba(89,185,255,0.22),_transparent_32%),linear-gradient(135deg,_rgba(255,255,255,0.08),_rgba(15,23,42,0.95))]" />
          )}

          <div className="p-6">
            <p className="text-xs uppercase tracking-[0.24em] text-white/45">
              Item selecionado
            </p>
            <h3 className="mt-3 text-3xl font-semibold">{item.name}</h3>
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
            href="/"
            className="inline-flex w-full items-center justify-center rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm font-semibold text-white/80 transition hover:bg-white/10 hover:text-white"
          >
            Voltar para a vitrine
          </Link>
        </form>
      </section>
    </AppShell>
  );
}
