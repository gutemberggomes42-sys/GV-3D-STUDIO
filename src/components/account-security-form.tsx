"use client";

import { useActionState } from "react";
import { changeOwnPasswordAction, type ActionState } from "@/lib/actions";
import { formatDateTime } from "@/lib/format";
import { SubmitButton } from "@/components/submit-button";

const initialState: ActionState = { ok: false };

type AccountSecurityFormProps = {
  lastChangedAt?: string;
};

export function AccountSecurityForm({ lastChangedAt }: AccountSecurityFormProps) {
  const [state, formAction] = useActionState(changeOwnPasswordAction, initialState);

  return (
    <section className="rounded-[28px] border border-white/10 bg-white/5 p-6">
      <p className="text-xs uppercase tracking-[0.24em] text-white/45">Segurança</p>
      <h3 className="mt-2 text-2xl font-semibold">Trocar senha do admin</h3>
      <p className="mt-2 text-sm leading-6 text-white/65">
        Proteja o acesso administrativo e deixe registrado quando a senha foi renovada por último.
      </p>

      <div className="mt-5 rounded-[22px] border border-white/10 bg-slate-950/60 px-4 py-3 text-sm text-white/60">
        Última troca registrada:{" "}
        <span className="font-semibold text-white/85">
          {lastChangedAt ? formatDateTime(new Date(lastChangedAt)) : "sem histórico"}
        </span>
      </div>

      <form action={formAction} className="mt-5 space-y-4">
        <div className="grid gap-4 md:grid-cols-3">
          <label className="block text-sm text-white/70">
            Senha atual
            <input
              name="currentPassword"
              type="password"
              className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 outline-none focus:border-orange-400/60"
            />
          </label>
          <label className="block text-sm text-white/70">
            Nova senha
            <input
              name="newPassword"
              type="password"
              className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 outline-none focus:border-orange-400/60"
            />
          </label>
          <label className="block text-sm text-white/70">
            Confirmar nova senha
            <input
              name="confirmPassword"
              type="password"
              className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 outline-none focus:border-orange-400/60"
            />
          </label>
        </div>

        {state.error ? <p className="text-sm text-rose-300">{state.error}</p> : null}
        {state.message ? <p className="text-sm text-emerald-300">{state.message}</p> : null}

        <SubmitButton
          label="Atualizar senha"
          pendingLabel="Salvando senha..."
          className="w-full bg-orange-500 text-slate-950 hover:bg-orange-400 md:w-auto"
        />
      </form>
    </section>
  );
}
