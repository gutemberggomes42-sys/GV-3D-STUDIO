import { ShowcaseCatalog } from "@/components/showcase-catalog";
import { getCurrentUser } from "@/lib/auth";
import { getHydratedData } from "@/lib/view-data";
import type { Metadata } from "next";

type HomePageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateMetadata(): Promise<Metadata> {
  const { storefrontSettings } = await getHydratedData();

  return {
    title: storefrontSettings.seoTitle,
    description: storefrontSettings.seoDescription,
    keywords: storefrontSettings.seoKeywords,
    openGraph: {
      title: storefrontSettings.seoTitle,
      description: storefrontSettings.seoDescription,
      images: storefrontSettings.shareImageUrl ? [storefrontSettings.shareImageUrl] : [],
    },
  };
}

export default async function HomePage({ searchParams }: HomePageProps) {
  const user = await getCurrentUser();
  const { showcaseItems, showcaseInquiries, storefrontSettings, showcaseTestimonials } =
    await getHydratedData();
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
      settings={storefrontSettings}
      testimonials={showcaseTestimonials}
      message={message}
      pathname="/"
    />
  );
}
