import { AppShell } from "@/components/app-shell";
import { LoginForm } from "@/components/login-form";
import { RegisterForm } from "@/components/register-form";

type AccessPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function AccessPage({ searchParams }: AccessPageProps) {
  const params = searchParams ? await searchParams : {};
  const redirectTo = typeof params.redirectTo === "string" ? params.redirectTo : undefined;

  return (
    <AppShell
      user={null}
      pathname="/acesso"
      title="Acesso administrativo"
      subtitle="Tela reservada para login e cadastro interno."
    >
      <section className="mx-auto grid max-w-3xl gap-6">
        <div className="grid gap-6">
          <LoginForm redirectTo={redirectTo} />
          <RegisterForm redirectTo={redirectTo} />
        </div>
      </section>
    </AppShell>
  );
}
