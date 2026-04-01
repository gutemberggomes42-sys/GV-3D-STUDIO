import Image from "next/image";
import Link from "next/link";
import { Box, Factory, Layers3, LogOut, Package, Printer, Sparkles, Wallet } from "lucide-react";
import { ShowcaseCartButton } from "@/components/showcase-cart-button";
import { studioBrandLogoPath, studioBrandName } from "@/lib/branding";
import { dashboardRoutes, ownerWhatsAppNumber, roleLabels } from "@/lib/constants";
import { logoutAction } from "@/lib/actions";
import type { SessionUser } from "@/lib/auth";
import { cn } from "@/lib/utils";

const iconByRoute: Record<string, typeof Box> = {
  "/": Box,
  "/portal": Layers3,
  "/admin": Factory,
  "/producao": Printer,
  "/maquinas": Printer,
  "/filamentos": Package,
  "/financeiro": Wallet,
};

type AppShellProps = {
  user: SessionUser | null;
  pathname: string;
  title: string;
  subtitle: string;
  children: React.ReactNode;
};

function BrandBackdrop({ compact = false }: { compact?: boolean }) {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      <div className="absolute left-[-10%] top-[-8%] h-[28rem] w-[28rem] rounded-full bg-cyan-400/16 blur-3xl sm:h-[40rem] sm:w-[40rem]" />
      <div className="absolute bottom-[-14%] right-[-8%] h-[28rem] w-[28rem] rounded-full bg-fuchsia-500/14 blur-3xl sm:h-[42rem] sm:w-[42rem]" />
      <div
        className={cn(
          "absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full blur-3xl",
          compact
            ? "h-[30rem] w-[30rem] bg-[radial-gradient(circle,_rgba(85,188,255,0.16)_0%,_rgba(168,85,247,0.11)_42%,_transparent_76%)] sm:h-[42rem] sm:w-[42rem] lg:h-[52rem] lg:w-[52rem]"
            : "h-[36rem] w-[36rem] bg-[radial-gradient(circle,_rgba(85,188,255,0.18)_0%,_rgba(168,85,247,0.13)_42%,_transparent_78%)] sm:h-[50rem] sm:w-[50rem] lg:h-[62rem] lg:w-[62rem]",
        )}
      />
      <div
        className={cn(
          "absolute left-1/2 top-[52%] -translate-x-1/2 -translate-y-1/2",
          compact
            ? "h-[42rem] w-[42rem] opacity-[0.14] sm:h-[56rem] sm:w-[56rem] lg:h-[68rem] lg:w-[68rem]"
            : "h-[48rem] w-[48rem] opacity-[0.16] sm:h-[62rem] sm:w-[62rem] lg:h-[78rem] lg:w-[78rem]",
        )}
      >
        <Image
          src={studioBrandLogoPath}
          alt=""
          fill
          sizes={compact ? "85vw" : "100vw"}
          className="object-contain saturate-[1.5] brightness-[1.08] contrast-[1.08] drop-shadow-[0_0_90px_rgba(95,201,255,0.2)]"
          priority
        />
      </div>
      <div
        className={cn(
          "absolute right-[-6%] top-[8%] rotate-[-12deg]",
          compact
            ? "h-60 w-60 opacity-[0.08] blur-[1px] sm:h-72 sm:w-72 lg:h-80 lg:w-80"
            : "h-72 w-72 opacity-[0.1] blur-[1px] sm:h-[26rem] sm:w-[26rem] lg:h-[30rem] lg:w-[30rem]",
        )}
      >
        <Image
          src={studioBrandLogoPath}
          alt=""
          fill
          sizes="34vw"
          className="object-contain saturate-[1.5] brightness-[1.15]"
        />
      </div>
      <div
        className={cn(
          "absolute bottom-[-8%] left-[-10%] rotate-[16deg]",
          compact
            ? "h-52 w-52 opacity-[0.06] blur-[1px] sm:h-72 sm:w-72"
            : "h-64 w-64 opacity-[0.08] blur-[1px] sm:h-80 sm:w-80 lg:h-[26rem] lg:w-[26rem]",
        )}
      >
        <Image
          src={studioBrandLogoPath}
          alt=""
          fill
          sizes="26vw"
          className="object-contain saturate-[1.45] brightness-110"
        />
      </div>
    </div>
  );
}

function BrandSurfaceWatermark({ compact = false }: { compact?: boolean }) {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      <div
        className={cn(
          "absolute right-[-8%] top-[10%] rounded-full blur-3xl",
          compact
            ? "h-[24rem] w-[24rem] bg-cyan-400/14 sm:h-[34rem] sm:w-[34rem] lg:h-[42rem] lg:w-[42rem]"
            : "h-[28rem] w-[28rem] bg-cyan-400/16 sm:h-[38rem] sm:w-[38rem] lg:h-[48rem] lg:w-[48rem]",
        )}
      />
      <div
        className={cn(
          "absolute bottom-[-12%] left-[-10%] rounded-full blur-3xl",
          compact
            ? "h-[20rem] w-[20rem] bg-fuchsia-500/10 sm:h-[28rem] sm:w-[28rem]"
            : "h-[24rem] w-[24rem] bg-fuchsia-500/12 sm:h-[34rem] sm:w-[34rem]",
        )}
      />
      <div
        className={cn(
          "absolute right-[-4%] top-1/2 -translate-y-1/2",
          compact
            ? "h-[34rem] w-[34rem] opacity-[0.22] sm:h-[46rem] sm:w-[46rem] lg:h-[58rem] lg:w-[58rem]"
            : "h-[40rem] w-[40rem] opacity-[0.28] sm:h-[54rem] sm:w-[54rem] lg:h-[68rem] lg:w-[68rem]",
        )}
      >
        <Image
          src={studioBrandLogoPath}
          alt=""
          fill
          sizes={compact ? "72vw" : "88vw"}
          className="object-contain saturate-[1.7] brightness-[1.14] contrast-[1.12] drop-shadow-[0_0_110px_rgba(105,189,255,0.22)]"
        />
      </div>
      <div
        className={cn(
          "absolute left-[14%] top-[14%] -rotate-[16deg]",
          compact
            ? "h-40 w-40 opacity-[0.12] sm:h-56 sm:w-56"
            : "h-48 w-48 opacity-[0.14] sm:h-64 sm:w-64",
        )}
      >
        <Image
          src={studioBrandLogoPath}
          alt=""
          fill
          sizes="20vw"
          className="object-contain saturate-[1.5] brightness-[1.1]"
        />
      </div>
      <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(3,7,11,0.34)_0%,rgba(3,7,11,0.16)_34%,rgba(3,7,11,0.02)_62%,rgba(3,7,11,0.14)_100%)]" />
    </div>
  );
}

export function AppShell({ user, pathname, title, subtitle, children }: AppShellProps) {
  const visibleRoutes = user
    ? dashboardRoutes.filter((route) => route.roles.includes(user.role))
    : [];
  const brandTitle = studioBrandName;
  const brandDescription = user
    ? "Portal do cliente, fila de produção, máquinas, estoque e financeiro no mesmo painel."
    : null;

  if (!user) {
    return (
      <div className="relative isolate min-h-screen overflow-hidden bg-[radial-gradient(circle_at_top_left,_rgba(255,122,24,0.22),_transparent_28%),radial-gradient(circle_at_top_right,_rgba(89,185,255,0.18),_transparent_30%),linear-gradient(180deg,_#05070a_0%,_#091119_45%,_#05070a_100%)] text-white">
        <BrandBackdrop />
        <div className="relative z-10 mx-auto max-w-[1700px] px-4 py-4 lg:px-6">
          <div className="relative overflow-hidden rounded-[34px] border border-white/10 bg-black/22 backdrop-blur-xl">
            <BrandSurfaceWatermark />
            <header className="relative z-10 border-b border-white/10 bg-white/[0.03] px-5 py-5 sm:px-6 lg:px-8">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex items-start gap-4 rounded-[28px] border border-white/8 bg-white/[0.025] px-3 py-3 sm:px-4">
                  <Link
                    href="/acesso"
                    aria-label="Entrar na area administrativa"
                    className="relative shrink-0 transition hover:scale-[1.02] focus-visible:scale-[1.02]"
                  >
                    <div className="absolute inset-0 rounded-[28px] bg-[radial-gradient(circle_at_top,_rgba(89,185,255,0.3),_transparent_58%),radial-gradient(circle_at_bottom,_rgba(140,82,255,0.28),_transparent_60%)] blur-xl" />
                    <div className="relative overflow-hidden rounded-[26px] border border-white/12 bg-[linear-gradient(160deg,rgba(255,255,255,0.18),rgba(255,255,255,0.04))] p-1.5 shadow-[0_18px_40px_rgba(0,0,0,0.28)] transition hover:border-white/20 hover:bg-[linear-gradient(160deg,rgba(255,255,255,0.22),rgba(255,255,255,0.05))]">
                      <Image
                        src={studioBrandLogoPath}
                        alt={studioBrandName}
                        width={96}
                        height={96}
                        className="h-[72px] w-[72px] rounded-[20px] object-cover sm:h-[82px] sm:w-[82px]"
                        priority
                      />
                    </div>
                  </Link>
                  <div className="pt-1">
                    <div className="inline-flex items-center rounded-full border border-orange-300/18 bg-orange-400/8 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.32em] text-orange-100/78">
                      {studioBrandName}
                    </div>
                    <h1 className="mt-3 text-[1.9rem] font-semibold leading-tight tracking-tight text-white sm:text-[2.2rem]">
                      Pecas 3D autorais com acabamento premium
                    </h1>
                    <p className="mt-3 max-w-2xl text-sm leading-7 text-white/68 sm:text-[15px]">
                      Decoracao, presentes e encomendas personalizadas com pronta entrega, informacoes reais e atendimento direto no WhatsApp.
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap gap-3">
                  <Link
                    href="/"
                    className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/7 px-4 py-3 text-sm font-semibold text-white/85 transition hover:bg-white/12"
                  >
                    <Sparkles className="h-4 w-4" />
                    Ver vitrine
                  </Link>
                  <ShowcaseCartButton />
                  <a
                    href={`https://wa.me/${ownerWhatsAppNumber}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-2 rounded-2xl bg-emerald-400 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-emerald-300"
                  >
                    Atendimento no WhatsApp
                  </a>
                </div>
              </div>
            </header>

            <main className="relative z-10 px-4 py-4 sm:px-6 sm:py-6 lg:px-8">
              <section className="rounded-[28px] border border-white/10 bg-white/[0.04] p-6">
                <p className="text-xs uppercase tracking-[0.28em] text-white/45">{brandTitle}</p>
                <div className="mt-4 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
                  <div>
                    <h2 className="text-3xl font-semibold tracking-tight lg:text-4xl">{title}</h2>
                    <p className="mt-3 max-w-3xl text-sm leading-6 text-white/70">{subtitle}</p>
                  </div>
                </div>
              </section>

              <div className="mt-6 space-y-6">{children}</div>
            </main>

            <footer className="relative z-10 border-t border-white/10 bg-white/[0.03] px-5 py-5 sm:px-6 lg:px-8">
              <div className="grid gap-4 md:grid-cols-3">
                <div className="rounded-[24px] border border-white/10 bg-black/20 p-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-white/45">Loja autoral</p>
                  <p className="mt-3 text-sm leading-6 text-white/68">
                    Pecas pensadas para decorar, presentear e dar mais personalidade ao seu espaco.
                  </p>
                </div>
                <div className="rounded-[24px] border border-white/10 bg-black/20 p-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-white/45">Compra simples</p>
                  <p className="mt-3 text-sm leading-6 text-white/68">
                    O cliente escolhe a quantidade, informa os dados essenciais e segue direto para a conversa.
                  </p>
                </div>
                <div className="rounded-[24px] border border-white/10 bg-black/20 p-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-white/45">Informacoes reais</p>
                  <p className="mt-3 text-sm leading-6 text-white/68">
                    Estoque, prazo, material, fotos e video quando houver, sem promessas inventadas.
                  </p>
                </div>
              </div>
            </footer>

          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative isolate min-h-screen overflow-hidden bg-[radial-gradient(circle_at_top_left,_rgba(255,122,24,0.22),_transparent_28%),radial-gradient(circle_at_top_right,_rgba(89,185,255,0.18),_transparent_30%),linear-gradient(180deg,_#05070a_0%,_#091119_45%,_#05070a_100%)] text-white">
      <BrandBackdrop compact />
      <div className="relative z-10 mx-auto grid min-h-screen max-w-[1600px] gap-6 px-4 py-4 lg:grid-cols-[280px_minmax(0,1fr)] lg:px-6">
        <aside className="relative rounded-[32px] border border-white/10 bg-black/30 p-6 backdrop-blur-xl">
          <div className="rounded-[28px] border border-orange-400/20 bg-gradient-to-br from-orange-500/25 via-orange-500/10 to-transparent p-5">
            <div className="flex items-center gap-4">
              <div className="overflow-hidden rounded-[22px] border border-white/10 bg-white/5 p-1">
                <Image
                  src={studioBrandLogoPath}
                  alt={studioBrandName}
                  width={76}
                  height={76}
                  className="h-[60px] w-[60px] rounded-[16px] object-cover"
                  priority
                />
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.28em] text-orange-200/70">{studioBrandName}</p>
                <h1 className="mt-2 text-3xl font-semibold tracking-tight">{brandTitle}</h1>
              </div>
            </div>
            {brandDescription ? (
              <p className="mt-3 text-sm leading-6 text-white/70">{brandDescription}</p>
            ) : null}
          </div>

          {visibleRoutes.length ? (
            <nav className="mt-6 space-y-2">
              {visibleRoutes.map((route) => {
                const Icon = iconByRoute[route.href] ?? Box;
                const active = pathname === route.href;

                return (
                  <Link
                    key={route.href}
                    href={route.href}
                    className={cn(
                      "flex items-center gap-3 rounded-2xl px-4 py-3 text-sm transition",
                      active
                        ? "bg-white/12 text-white shadow-[0_18px_60px_rgba(255,122,24,0.16)]"
                        : "text-white/70 hover:bg-white/6 hover:text-white",
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    <span>{route.label}</span>
                  </Link>
                );
              })}
            </nav>
          ) : null}

          {user ? (
            <div className="mt-8 rounded-[24px] border border-white/10 bg-white/5 p-4">
              <p className="text-xs uppercase tracking-[0.24em] text-white/45">Sessão atual</p>
              <p className="mt-3 text-lg font-semibold">{user.name}</p>
              <p className="text-sm text-white/60">{roleLabels[user.role]}</p>
              <p className="mt-1 text-sm text-white/45">{user.company ?? user.email}</p>
              <form action={logoutAction} className="mt-4">
                <button
                  type="submit"
                  className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-black/30 px-4 py-2 text-sm font-medium text-white/80 transition hover:bg-white/10 hover:text-white"
                >
                  <LogOut className="h-4 w-4" />
                  Encerrar sessão
                </button>
              </form>
            </div>
          ) : null}
        </aside>

        <main className="relative overflow-hidden rounded-[32px] border border-white/10 bg-black/20 p-4 backdrop-blur-xl lg:p-6">
          <BrandSurfaceWatermark compact />
          <header className="relative z-10 rounded-[28px] border border-white/10 bg-white/5 p-6">
            <div className="flex items-center gap-3">
              <Image
                src={studioBrandLogoPath}
                alt={studioBrandName}
                width={44}
                height={44}
                className="h-11 w-11 rounded-2xl border border-white/10 bg-white/5 object-cover"
                priority
              />
              <p className="text-xs uppercase tracking-[0.28em] text-white/45">{studioBrandName}</p>
            </div>
            <div className="mt-4 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <h2 className="text-3xl font-semibold tracking-tight lg:text-4xl">{title}</h2>
                <p className="mt-3 max-w-3xl text-sm leading-6 text-white/70">{subtitle}</p>
              </div>
            </div>
          </header>

          <div className="relative z-10 mt-6 space-y-6">{children}</div>
        </main>
      </div>
    </div>
  );
}
