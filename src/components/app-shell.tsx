import Link from "next/link";
import { Box, Factory, KeyRound, Layers3, LogOut, Package, Printer, Wallet } from "lucide-react";
import { dashboardRoutes, roleLabels } from "@/lib/constants";
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

export function AppShell({ user, pathname, title, subtitle, children }: AppShellProps) {
  const visibleRoutes = user
    ? dashboardRoutes.filter((route) => route.roles.includes(user.role))
    : [];
  const brandTitle = user ? "Operação 3D de ponta a ponta" : "PrintFlow 3D";
  const brandDescription = user
    ? "Portal do cliente, fila de produção, máquinas, estoque e financeiro no mesmo painel."
    : null;

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(255,122,24,0.22),_transparent_28%),radial-gradient(circle_at_top_right,_rgba(89,185,255,0.18),_transparent_30%),linear-gradient(180deg,_#05070a_0%,_#091119_45%,_#05070a_100%)] text-white">
      <div className="mx-auto grid min-h-screen max-w-[1600px] gap-6 px-4 py-4 lg:grid-cols-[280px_minmax(0,1fr)] lg:px-6">
        <aside className="relative rounded-[32px] border border-white/10 bg-black/30 p-6 backdrop-blur-xl">
          <div className="rounded-[28px] border border-orange-400/20 bg-gradient-to-br from-orange-500/25 via-orange-500/10 to-transparent p-5">
            <p className="text-xs uppercase tracking-[0.28em] text-orange-200/70">PrintFlow 3D</p>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight">{brandTitle}</h1>
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

          {!user ? (
            <Link
              href="/acesso"
              aria-label="Acesso administrativo"
              className="group absolute bottom-5 left-5 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 p-2 text-white/60 opacity-15 transition hover:opacity-100 focus-visible:opacity-100"
            >
              <KeyRound className="h-3.5 w-3.5" />
              <span className="max-w-0 overflow-hidden text-xs font-semibold opacity-0 transition-all duration-200 group-hover:max-w-24 group-hover:opacity-100 group-focus-visible:max-w-24 group-focus-visible:opacity-100">
                Admin
              </span>
            </Link>
          ) : null}
        </aside>

        <main className="rounded-[32px] border border-white/10 bg-black/20 p-4 backdrop-blur-xl lg:p-6">
          <header className="rounded-[28px] border border-white/10 bg-white/5 p-6">
            <p className="text-xs uppercase tracking-[0.28em] text-white/45">PrintFlow 3D</p>
            <div className="mt-4 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <h2 className="text-3xl font-semibold tracking-tight lg:text-4xl">{title}</h2>
                <p className="mt-3 max-w-3xl text-sm leading-6 text-white/70">{subtitle}</p>
              </div>
            </div>
          </header>

          <div className="mt-6 space-y-6">{children}</div>
        </main>
      </div>
    </div>
  );
}
