import type { PrintFlowDb } from "@/lib/db-types";

export function createInitialData(): PrintFlowDb {
  const now = new Date().toISOString();

  return {
    users: [],
    sessions: [],
    materials: [],
    machines: [],
    expenses: [],
    payables: [],
    orders: [],
    storefrontSettings: {
      brandName: "PrintFlow 3D",
      heroEyebrow: "Colecao autoral",
      heroTitle: "Pecas 3D feitas para impressionar, decorar e presentear",
      heroSubtitle:
        "Explore a vitrine, encontre modelos com personalidade e fale direto no WhatsApp para comprar ou encomendar.",
      heroPrimaryCtaLabel: "Ver produtos",
      heroSecondaryCtaLabel: "Chamar no WhatsApp",
      heroHighlights: [
        "Informacoes reais",
        "Pronta entrega e encomenda",
        "Atendimento rapido no WhatsApp",
      ],
      announcementText: "Bem-vindo a uma loja de impressao 3D com pecas feitas para chamar atencao.",
      aboutTitle: "Quem somos",
      aboutBody:
        "A PrintFlow 3D cria pecas impressas em 3D com foco em qualidade visual, praticidade e atendimento direto para cada cliente.",
      customOrderTitle: "Como funciona a encomenda",
      customOrderBody:
        "Escolha um produto, informe a quantidade e os detalhes desejados e continue a conversa no WhatsApp para alinhar cor, prazo e entrega.",
      averageLeadTimeText: "Prazo medio de producao: de 2 a 7 dias uteis, conforme o item e a fila.",
      materialsText: "Trabalhamos com filamentos e resinas selecionados conforme acabamento, resistencia e objetivo da peca.",
      careText: "Evite altas temperaturas, limpeza agressiva e impacto excessivo para manter a peca bonita por mais tempo.",
      shippingTitle: "Entrega e retirada",
      shippingBody:
        "Consulte retirada, entrega local e envio para outras regioes conforme o produto e o prazo.",
      instagramUrl: "",
      instagramHandle: "",
      portfolioTitle: "Portfolio da loja",
      portfolioBody:
        "Mostre aqui o Instagram, fotos reais de pecas prontas e trabalhos especiais para passar mais confianca.",
      seoTitle: "PrintFlow 3D | Loja de pecas impressas em 3D",
      seoDescription:
        "Vitrine de pecas impressas em 3D com pronta entrega e encomenda, atendimento rapido no WhatsApp e informacoes reais de prazo, material e acabamento.",
      seoKeywords: ["impressao 3d", "pecas decorativas", "presentes geek", "vitrine 3d"],
      shareImageUrl: "",
      updatedAt: now,
    },
    showcaseItems: [],
    showcaseTestimonials: [],
    showcaseInquiries: [],
    auditLogs: [],
  };
}
