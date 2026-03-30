import { UserRole } from "@prisma/client";
import { AppShell } from "@/components/app-shell";
import { ShowcaseCatalogExplorer } from "@/components/showcase-catalog-explorer";
import type { SessionUser } from "@/lib/auth";
import type { DbShowcaseItem } from "@/lib/db-types";

type ShowcaseCatalogProps = {
  user: SessionUser | null;
  items: DbShowcaseItem[];
  message?: string | null;
  pathname: string;
};

export function ShowcaseCatalog({ user, items, message, pathname }: ShowcaseCatalogProps) {
  const visibleItems = items.filter((item) => item.active);

  return (
    <AppShell
      user={user}
      pathname={pathname}
      title="Catalogo da loja"
      subtitle="Seja bem-vindo. Conheca nossa colecao de pecas 3D e fale conosco pelo WhatsApp para comprar ou encomendar."
    >
      {message ? (
        <div className="rounded-[24px] border border-amber-400/20 bg-amber-500/10 px-5 py-4 text-sm text-amber-50">
          {message}
        </div>
      ) : null}

      <ShowcaseCatalogExplorer
        items={visibleItems}
        canManage={Boolean(user && user.role !== UserRole.CLIENT)}
      />
    </AppShell>
  );
}
