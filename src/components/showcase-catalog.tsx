import { UserRole } from "@prisma/client";
import { AppShell } from "@/components/app-shell";
import { ShowcaseCatalogExplorer } from "@/components/showcase-catalog-explorer";
import type { SessionUser } from "@/lib/auth";
import type {
  DbShowcaseItem,
  DbShowcaseLibrary,
  DbShowcaseTestimonial,
  DbStorefrontSettings,
} from "@/lib/db-types";

type ShowcaseCatalogProps = {
  user: SessionUser | null;
  items: DbShowcaseItem[];
  libraries: DbShowcaseLibrary[];
  inquiryCounts: Record<string, number>;
  settings: DbStorefrontSettings;
  testimonials: DbShowcaseTestimonial[];
  message?: string | null;
  pathname: string;
};

export function ShowcaseCatalog({
  user,
  items,
  libraries,
  inquiryCounts,
  settings,
  testimonials,
  message,
  pathname,
}: ShowcaseCatalogProps) {
  const visibleItems = items.filter((item) => item.active);

  return (
    <AppShell
      user={user}
      pathname={pathname}
      title={settings.brandName}
      subtitle={settings.heroSubtitle}
    >
      {message ? (
        <div className="rounded-[24px] border border-amber-400/20 bg-amber-500/10 px-5 py-4 text-sm text-amber-50">
          {message}
        </div>
      ) : null}

      <ShowcaseCatalogExplorer
        items={visibleItems}
        libraries={libraries}
        inquiryCounts={inquiryCounts}
        settings={settings}
        testimonials={testimonials}
        canManage={Boolean(user && user.role !== UserRole.CLIENT)}
      />
    </AppShell>
  );
}
