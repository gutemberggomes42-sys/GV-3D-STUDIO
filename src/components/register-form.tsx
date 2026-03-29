"use client";

import { useActionState } from "react";
import { registerAction, type ActionState } from "@/lib/actions";
import { SubmitButton } from "@/components/submit-button";

const initialState: ActionState = { ok: false };

type RegisterFormProps = {
  redirectTo?: string;
};

export function RegisterForm({ redirectTo }: RegisterFormProps) {
  const [state, formAction] = useActionState(registerAction, initialState);

  return (
    <form action={formAction} className="space-y-4 rounded-[28px] border border-white/10 bg-white/5 p-6">
      {redirectTo ? <input type="hidden" name="redirectTo" value={redirectTo} /> : null}
      <div>
        <p className="text-xs uppercase tracking-[0.24em] text-white/45">Cadastro</p>
        <h3 className="mt-2 text-2xl font-semibold">Criar conta no sistema</h3>
        <p className="mt-2 text-sm text-white/65">
          Se esta for a primeira conta do sistema, ela será criada como administradora. A conta do dono também recebe acesso administrativo para acompanhar os contatos da vitrine.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <label className="block text-sm text-white/70">
          Nome completo
          <input name="name" className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 outline-none focus:border-orange-400/60" />
        </label>
        <label className="block text-sm text-white/70">
          Empresa
          <input name="company" className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 outline-none focus:border-orange-400/60" />
        </label>
        <label className="block text-sm text-white/70">
          Telefone
          <input name="phone" className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 outline-none focus:border-orange-400/60" />
        </label>
        <label className="block text-sm text-white/70">
          Tipo de projeto
          <input name="projectType" className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 outline-none focus:border-orange-400/60" />
        </label>
      </div>

      <label className="block text-sm text-white/70">
        Endereço
        <input name="address" className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 outline-none focus:border-orange-400/60" />
      </label>

      <div className="grid gap-4 md:grid-cols-2">
        <label className="block text-sm text-white/70">
          E-mail
          <input name="email" type="email" className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 outline-none focus:border-orange-400/60" />
        </label>
        <label className="block text-sm text-white/70">
          Senha
          <input name="password" type="password" className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 outline-none focus:border-orange-400/60" />
        </label>
      </div>

      {state.error ? <p className="text-sm text-rose-300">{state.error}</p> : null}

      <SubmitButton label="Criar conta" pendingLabel="Criando conta..." className="w-full bg-emerald-400 text-slate-950 hover:bg-emerald-300" />
    </form>
  );
}
