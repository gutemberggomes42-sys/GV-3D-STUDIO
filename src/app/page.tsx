import { ShowcaseCatalog } from "@/components/showcase-catalog";
import { getCurrentUser } from "@/lib/auth";
import { getHydratedData } from "@/lib/view-data";

type HomePageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function HomePage({ searchParams }: HomePageProps) {
  const user = await getCurrentUser();
  const { showcaseItems } = await getHydratedData();
  const params = searchParams ? await searchParams : {};
  const message = typeof params.message === "string" ? params.message : null;

  return (
    <ShowcaseCatalog
      user={user}
      items={showcaseItems}
      message={message}
      pathname="/"
    />
  );
}
