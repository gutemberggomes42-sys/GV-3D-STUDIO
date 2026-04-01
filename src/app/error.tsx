"use client";

import { useEffect, useMemo } from "react";
import { studioBrandName } from "@/lib/branding";

const recoveryKey = "printflow_action_recovery";

type ErrorPageProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function ErrorPage({ error, reset }: ErrorPageProps) {
  const isServerActionMismatch = useMemo(() => {
    return error.message?.includes("Failed to find Server Action") ?? false;
  }, [error.message]);

  useEffect(() => {
    if (!isServerActionMismatch) {
      return;
    }

    const recoveryAlreadyTried = window.sessionStorage.getItem(recoveryKey) === "1";
    if (recoveryAlreadyTried) {
      return;
    }

    window.sessionStorage.setItem(recoveryKey, "1");
    const timer = window.setTimeout(() => {
      window.location.reload();
    }, 700);

    return () => {
      window.clearTimeout(timer);
    };
  }, [isServerActionMismatch]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 px-4 text-white">
      <section className="w-full max-w-xl rounded-[32px] border border-white/10 bg-white/5 p-8 shadow-[0_30px_90px_rgba(0,0,0,0.35)]">
        <p className="text-xs uppercase tracking-[0.24em] text-white/45">{studioBrandName}</p>
        <h1 className="mt-4 text-3xl font-semibold">
          {isServerActionMismatch ? "Atualizando a tela" : "Não foi possível carregar esta página"}
        </h1>
        <p className="mt-3 text-sm leading-6 text-white/70">
          {isServerActionMismatch
            ? "O sistema foi atualizado enquanto esta página estava aberta. Estamos recarregando automaticamente para sincronizar o formulário."
            : "Tente recarregar a página. Se o problema continuar, volte e abra novamente o módulo."}
        </p>

        <div className="mt-6 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="rounded-2xl bg-orange-500 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-orange-400"
          >
            Recarregar agora
          </button>
          <button
            type="button"
            onClick={() => reset()}
            className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-white transition hover:bg-white/10"
          >
            Tentar novamente
          </button>
        </div>

        {isServerActionMismatch ? null : (
          <p className="mt-5 text-xs text-white/45">
            Detalhe técnico: {error.message || "Erro inesperado."}
          </p>
        )}
      </section>
    </main>
  );
}
