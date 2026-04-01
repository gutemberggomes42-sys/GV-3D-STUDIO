import type { Metadata } from "next";
import { AppShell } from "@/components/app-shell";
import { ShowcaseCartView } from "@/components/showcase-cart-view";
import { getCurrentUser } from "@/lib/auth";
import { getHydratedData } from "@/lib/view-data";

export async function generateMetadata(): Promise<Metadata> {
  const { storefrontSettings } = await getHydratedData();

  return {
    title: `Carrinho | ${storefrontSettings.brandName}`,
    description: "Reveja os itens escolhidos e envie tudo em uma unica conversa pelo WhatsApp.",
  };
}

export default async function ShowcaseCartPage() {
  const user = await getCurrentUser();
  const { showcaseItems } = await getHydratedData();

  return (
    <AppShell
      user={user}
      pathname="/"
      title="Seu carrinho"
      subtitle="Reuna varias pecas da vitrine, ajuste quantidades e envie tudo em uma unica mensagem para o WhatsApp."
    >
      <ShowcaseCartView items={showcaseItems.filter((item) => item.active)} />
    </AppShell>
  );
}
