import { ShowcaseCatalog } from "@/components/showcase-catalog";
import { getCurrentUser } from "@/lib/auth";
import { getHydratedData } from "@/lib/view-data";

type PortalPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function PortalPage({ searchParams }: PortalPageProps) {
  const user = await getCurrentUser();
  const { showcaseItems, showcaseInquiries } = await getHydratedData();
  const params = searchParams ? await searchParams : {};
  const message = typeof params.message === "string" ? params.message : null;
  const inquiryCounts = showcaseInquiries.reduce<Record<string, number>>((accumulator, inquiry) => {
    accumulator[inquiry.itemId] = (accumulator[inquiry.itemId] ?? 0) + 1;
    return accumulator;
  }, {});

  return (
    <ShowcaseCatalog
      user={user}
      items={showcaseItems}
      inquiryCounts={inquiryCounts}
      message={message}
      pathname="/portal"
    />
  );
}
