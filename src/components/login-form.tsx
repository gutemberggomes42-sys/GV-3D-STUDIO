"use client";

import { useActionState } from "react";
import { loginAction, type ActionState } from "@/lib/actions";
import { SubmitButton } from "@/components/submit-button";

const initialState: ActionState = { ok: false };

type LoginFormProps = {
  redirectTo?: string;
};

export function LoginForm({ redirectTo }: LoginFormProps) {
  const [state, formAction] = useActionState(loginAction, initialState);

  return (
    <form action={formAction} className="space-y-4 rounded-[28px] border border-white/10 bg-white/5 p-6">
      {redirectTo ? <input type="hidden" name="redirectTo" value={redirectTo} /> : null}
      <div>
        <p className="text-xs uppercase tracking-[0.24em] text-white/45">Acesso</p>
        <h3 className="mt-2 text-2xl font-semibold">Entrar na area administrativa</h3>
      </div>

      <label className="block text-sm text-white/70">
        E-mail
        <input
          name="email"
          type="email"
          className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-white outline-none transition focus:border-orange-400/60"
          placeholder="voce@empresa.com"
        />
      </label>

      <label className="block text-sm text-white/70">
        Senha
        <input
          name="password"
          type="password"
          className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-white outline-none transition focus:border-orange-400/60"
          placeholder="••••••••"
        />
      </label>

      {state.error ? <p className="text-sm text-rose-300">{state.error}</p> : null}

      <SubmitButton label="Entrar" pendingLabel="Validando acesso..." className="w-full bg-orange-500 text-slate-950 hover:bg-orange-400" />
    </form>
  );
}
