"use server";

import {
  FinishLevel,
  MachineStatus,
  OrderStatus,
  PaymentMethod,
  PaymentStatus,
  Priority,
  PrintTechnology,
  UserRole,
} from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect, unstable_rethrow } from "next/navigation";
import { z } from "zod";
import { createUserSession, destroySession, hashPassword, requireRoles, requireUser, verifyPassword } from "@/lib/auth";
import { allowed3dFormats, ownerEmail, ownerWhatsAppNumber } from "@/lib/constants";
import { ensureCustomerRecord, isGeneratedCustomerEmail } from "@/lib/customer-records";
import type {
  DbAuditLog,
  DbExpense,
  DbPayable,
  DbMaterial,
  DbOrder,
  DbQualityCheck,
  DbShowcaseInquiry,
  DbShowcaseItem,
  DbShowcaseLibrary,
  DbShowcaseTestimonial,
  DbStorefrontSettings,
  DbExpenseCategory,
  DbPayableStatus,
  ShowcaseDeliveryMode,
  ShowcaseFulfillmentType,
  ShowcaseInquiryStatus,
  ShowcaseLeadTemperature,
  ShowcaseOrderStage,
} from "@/lib/db-types";
import {
  buildQuote,
  getFileExtension,
  getMaterialDerivedMetrics,
  recommendMachine,
} from "@/lib/pricing";
import { formatDateTime, formatDurationMinutes } from "@/lib/format";
import {
  parseStorefrontCampaignField,
  parseStorefrontGalleryField,
  parseStorefrontReelsField,
  parseShowcaseListField,
  parseShowcaseVariantField,
} from "@/lib/showcase";
import {
  estimateFreightCost,
  getAvailableDeliveryModes,
  getSuggestedCarrier,
  normalizeStateCode,
  sanitizePostalCode,
} from "@/lib/shipping";
import {
  createId,
  deleteBackupSnapshot,
  readDb,
  restoreBackupSnapshot,
  updateDb,
} from "@/lib/store";
import { saveUploadedFile } from "@/lib/upload-storage";

export type ActionState = {
  ok: boolean;
  message?: string;
  error?: string;
  fields?: Record<string, string>;
};

const authSchema = z.object({
  email: z.string().email("Informe um e-mail válido."),
  password: z.string().min(6, "A senha precisa ter pelo menos 6 caracteres."),
});

const registerSchema = authSchema.extend({
  name: z.string().min(3, "Informe o nome completo."),
  company: z.string().min(2, "Informe a empresa ou marque uso pessoal."),
  phone: z.string().min(8, "Informe telefone ou WhatsApp."),
  address: z.string().min(5, "Informe o endereço."),
  projectType: z.string().min(3, "Descreva o tipo de projeto."),
});

const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(6, "Informe sua senha atual."),
    newPassword: z.string().min(6, "A nova senha precisa ter pelo menos 6 caracteres."),
    confirmPassword: z.string().min(6, "Confirme a nova senha."),
  })
  .superRefine((data, ctx) => {
    if (data.newPassword !== data.confirmPassword) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "A confirmação da nova senha não confere.",
        path: ["confirmPassword"],
      });
    }

    if (data.currentPassword === data.newPassword) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Escolha uma nova senha diferente da atual.",
        path: ["newPassword"],
      });
    }
  });

const optionalPositiveNumberSchema = z.preprocess((value) => {
  if (value == null || value === "") {
    return undefined;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : value;
}, z.number().positive().optional());

const optionalNonNegativeNumberSchema = z.preprocess((value) => {
  if (value == null || value === "") {
    return undefined;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : value;
}, z.number().nonnegative().optional());

const orderSchema = z.object({
  title: z.string().min(4, "Dê um nome para o projeto."),
  type: z.string().min(3, "Escolha o tipo de projeto."),
  description: z.string().min(10, "Descreva o objetivo da peça."),
  materialId: z.string().min(1, "Escolha um material."),
  color: z.string().min(2, "Informe a cor desejada."),
  finishLevel: z.nativeEnum(FinishLevel),
  priority: z.nativeEnum(Priority),
  quantity: z.coerce.number().int().min(1).max(500),
  boundingBoxX: z.coerce.number().min(0.5),
  boundingBoxY: z.coerce.number().min(0.5),
  boundingBoxZ: z.coerce.number().min(0.5),
});

const materialSchema = z
  .object({
    name: z.string().min(2, "Informe o nome do material."),
    category: z.string().min(2, "Informe a categoria."),
    technology: z.nativeEnum(PrintTechnology),
    color: z.string().min(2, "Informe a cor."),
    brand: z.string().min(2, "Informe a marca."),
    lot: z.string().min(1, "Informe o lote."),
    stockAmount: z.coerce.number().positive("Informe o estoque em gramas ou ml."),
    minimumStock: z.coerce.number().nonnegative("Informe o estoque mínimo."),
    purchasePrice: z.coerce.number().positive("Informe o valor pago no material."),
    spoolWeightGrams: z.coerce.number().positive("Informe o peso total do rolo ou frasco."),
    spoolLengthMeters: z.coerce.number().nonnegative("Informe a metragem total do rolo."),
    filamentDiameterMm: z.coerce.number().positive("Informe o diâmetro do filamento."),
    supplier: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.technology === PrintTechnology.FDM && data.spoolLengthMeters <= 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Para filamento FDM, informe a metragem total do rolo.",
        path: ["spoolLengthMeters"],
      });
    }
  });

const machineSchema = z.object({
  name: z.string().min(2, "Informe o nome da impressora."),
  model: z.string().min(2, "Informe o modelo."),
  technology: z.nativeEnum(PrintTechnology),
  buildVolumeX: z.coerce.number().positive("Informe a largura útil."),
  buildVolumeY: z.coerce.number().positive("Informe a profundidade útil."),
  buildVolumeZ: z.coerce.number().positive("Informe a altura útil."),
  supportedMaterialNames: z.string().min(2, "Informe os materiais compatíveis."),
  purchasePrice: z.coerce.number().nonnegative("Informe o valor da impressora."),
  amountPaid: z.coerce.number().nonnegative("Informe o valor já pago."),
  purchasedAt: z.string().trim().optional(),
  location: z.string().optional(),
  notes: z.string().optional(),
}).superRefine((data, ctx) => {
  if (data.purchasePrice > 0 && data.amountPaid > data.purchasePrice) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "O valor pago não pode ser maior que o valor da impressora.",
      path: ["amountPaid"],
    });
  }

  if (data.purchasedAt && Number.isNaN(new Date(data.purchasedAt).getTime())) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Informe uma data válida para a compra da impressora.",
      path: ["purchasedAt"],
    });
  }
});

const expenseCategoryOptions = [
  "ENERGY",
  "LABOR",
  "RENT",
  "SHIPPING",
  "MARKETING",
  "MACHINE_PARTS",
  "SOFTWARE",
  "OTHER",
] as const;

const expenseSchema = z.object({
  title: z.string().trim().min(2, "Informe o nome do gasto."),
  category: z.enum(expenseCategoryOptions),
  amount: z.coerce.number().positive("Informe o valor do gasto."),
  paidAt: z
    .string()
    .trim()
    .min(1, "Informe a data do gasto.")
    .refine((value) => !Number.isNaN(new Date(value).getTime()), "Informe uma data válida."),
  notes: z.string().trim().optional(),
});

const payableSchema = z.object({
  title: z.string().trim().min(2, "Informe o nome da conta a pagar."),
  category: z.enum(expenseCategoryOptions),
  amount: z.coerce.number().positive("Informe o valor da conta."),
  dueDate: z
    .string()
    .trim()
    .min(1, "Informe a data de vencimento.")
    .refine((value) => !Number.isNaN(new Date(value).getTime()), "Informe uma data válida."),
  vendor: z.string().trim().optional(),
  notes: z.string().trim().optional(),
});

const payableStatusSchema = z.enum(["PENDING", "PAID", "OVERDUE"]);

const showcaseVariantSchema = z.object({
  id: z.string().trim().min(1),
  label: z.string().trim().min(1),
  color: z.string().trim().optional(),
  size: z.string().trim().optional(),
  finish: z.string().trim().optional(),
  priceAdjustment: z.coerce.number(),
  stockQuantity: optionalNonNegativeNumberSchema,
  galleryImageUrls: z.array(z.string().trim()).default([]),
  active: z.boolean().default(true),
});

const showcaseItemSchema = z
  .object({
    name: z.string().min(2, "Informe o nome do item."),
    category: z.string().min(2, "Informe a categoria do item."),
    libraryId: z.string().trim().optional(),
    tagline: z.string().trim().optional(),
    description: z.string().min(10, "Descreva o item exposto."),
    price: z.coerce.number().positive("Informe o valor do item."),
    estimatedPrintHours: z.coerce.number().positive("Informe o tempo de impressão cadastrado."),
    estimatedMaterialGrams: z.coerce.number().nonnegative("Informe o consumo estimado de material."),
    productionChecklist: z.string().trim().optional(),
    fulfillmentType: z.enum(["STOCK", "MADE_TO_ORDER"]),
    stockQuantity: z.coerce.number().int().nonnegative("Informe o estoque disponível."),
    leadTimeDays: z.coerce.number().int().nonnegative("Informe o prazo estimado."),
    materialLabel: z.string().trim().optional(),
    materialId: z.string().trim().optional(),
    colorOptions: z.array(z.string().trim()).default([]),
    sizeOptions: z.array(z.string().trim()).default([]),
    finishOptions: z.array(z.string().trim()).default([]),
    badges: z.array(z.string().trim()).default([]),
    deliveryModes: z.array(z.enum(["PICKUP", "LOCAL_DELIVERY", "SHIPPING"])).default([]),
    dimensionSummary: z.string().trim().optional(),
    shippingSummary: z.string().trim().optional(),
    promotionLabel: z.string().trim().optional(),
    compareAtPrice: optionalPositiveNumberSchema,
    couponCode: z.string().trim().optional(),
    couponDiscountPercent: optionalNonNegativeNumberSchema,
    seoTitle: z.string().trim().optional(),
    seoDescription: z.string().trim().optional(),
    seoKeywords: z.array(z.string().trim()).default([]),
    imageUrl: z.string().trim().optional(),
    videoUrl: z.string().trim().optional(),
    galleryImageUrls: z.array(z.string().trim()).default([]),
    variants: z.array(showcaseVariantSchema).default([]),
    featured: z.boolean(),
    active: z.boolean(),
  })
  .superRefine((data, ctx) => {
    if (data.compareAtPrice != null && data.compareAtPrice <= data.price) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "O preço de comparação precisa ser maior que o valor do produto.",
        path: ["compareAtPrice"],
      });
    }

    if (
      data.couponDiscountPercent != null &&
      (data.couponDiscountPercent < 0 || data.couponDiscountPercent > 100)
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "O desconto do cupom deve ficar entre 0 e 100%.",
        path: ["couponDiscountPercent"],
      });
    }
  });

const showcaseLibrarySchema = z.object({
  name: z.string().trim().min(2, "Informe o nome da biblioteca."),
  description: z.string().trim().optional(),
  coverImageUrl: z.string().trim().optional(),
  sortOrder: z.coerce.number().int().nonnegative("Informe a ordem da biblioteca."),
  active: z.boolean(),
});

const storefrontSettingsSchema = z.object({
  brandName: z.string().trim().min(2, "Informe o nome da loja."),
  heroEyebrow: z.string().trim().min(2, "Informe a chamada curta do banner."),
  heroTitle: z.string().trim().min(10, "Informe um titulo principal para o banner."),
  heroSubtitle: z.string().trim().min(20, "Informe a descricao do banner."),
  heroPrimaryCtaLabel: z.string().trim().min(2, "Informe o texto do botao principal."),
  heroSecondaryCtaLabel: z.string().trim().min(2, "Informe o texto do botao secundario."),
  heroHighlights: z.array(z.string().trim()).default([]),
  announcementText: z.string().trim().optional(),
  aboutTitle: z.string().trim().min(2, "Informe o titulo da secao quem somos."),
  aboutBody: z.string().trim().min(20, "Descreva melhor a sua loja."),
  customOrderTitle: z.string().trim().min(2, "Informe o titulo da secao encomendas."),
  customOrderBody: z.string().trim().min(20, "Explique como funciona a encomenda."),
  averageLeadTimeText: z.string().trim().min(8, "Informe o prazo medio."),
  materialsText: z.string().trim().min(8, "Explique os materiais usados."),
  careText: z.string().trim().min(8, "Explique os cuidados com a peca."),
  shippingTitle: z.string().trim().min(2, "Informe o titulo de entrega."),
  shippingBody: z.string().trim().min(8, "Explique retirada, entrega ou envio."),
  campaignBanners: z.array(
    z.object({
      id: z.string(),
      badge: z.string().trim().optional(),
      title: z.string().trim().min(2),
      subtitle: z.string().trim().min(6),
      startsAt: z.string().trim().optional(),
      endsAt: z.string().trim().optional(),
      ctaLabel: z.string().trim().optional(),
      ctaHref: z.string().trim().optional(),
    }),
  ).default([]),
  instagramUrl: z.string().trim().optional(),
  instagramHandle: z.string().trim().optional(),
  instagramButtonLabel: z.string().trim().min(2, "Informe o texto do botao do Instagram."),
  instagramSectionTitle: z.string().trim().min(2, "Informe o titulo da secao Instagram."),
  instagramSectionBody: z.string().trim().min(12, "Explique melhor o conteudo do Instagram."),
  instagramGallery: z.array(
    z.object({
      id: z.string(),
      title: z.string().trim().min(2),
      imageUrl: z.string().trim().min(3),
      linkUrl: z.string().trim().optional(),
    }),
  ).default([]),
  instagramReels: z.array(
    z.object({
      id: z.string(),
      title: z.string().trim().min(2),
      reelUrl: z.string().trim().min(3),
      thumbnailUrl: z.string().trim().optional(),
      caption: z.string().trim().optional(),
    }),
  ).default([]),
  instagramBehindScenes: z.array(z.string().trim()).default([]),
  portfolioTitle: z.string().trim().min(2, "Informe o titulo do portfolio."),
  portfolioBody: z.string().trim().min(8, "Explique o portfolio da loja."),
  seoTitle: z.string().trim().min(8, "Informe o titulo SEO da loja."),
  seoDescription: z.string().trim().min(20, "Informe a descricao SEO da loja."),
  seoKeywords: z.array(z.string().trim()).default([]),
  shareImageUrl: z.string().trim().optional(),
});

const testimonialSchema = z.object({
  customerName: z.string().trim().min(2, "Informe o nome do cliente."),
  city: z.string().trim().optional(),
  role: z.string().trim().optional(),
  instagramHandle: z.string().trim().optional(),
  productName: z.string().trim().optional(),
  quote: z.string().trim().min(10, "Escreva um depoimento mais completo."),
  imageUrl: z.string().trim().optional(),
  featured: z.boolean(),
  sortOrder: z.coerce.number().int().nonnegative("Informe a ordem do depoimento."),
});

const showcaseInquiryStatusSchema = z.enum(["PENDING", "CLOSED", "NOT_CLOSED"]);
const showcaseLeadTemperatureSchema = z.enum(["COLD", "WARM", "HOT"]);
const showcaseOrderStageSchema = z.enum([
  "RECEIVED",
  "ANALYSIS",
  "WAITING_APPROVAL",
  "WAITING_PAYMENT",
  "QUEUED",
  "PRINTING",
  "POST_PROCESSING",
  "QUALITY",
  "READY_TO_SHIP",
  "SHIPPED",
  "COMPLETED",
  "FAILED_REWORK",
  "CANCELED",
]);
const showcaseInquirySchema = z
  .object({
    itemId: z.string().min(1, "Escolha o item da vitrine."),
    quantity: z.coerce.number().int().min(1).max(999),
    customerName: z.string().trim().min(2, "Informe o nome do cliente."),
    customerEmail: z.string().trim().optional(),
    customerPhone: z.string().trim().min(8, "Informe o telefone ou WhatsApp."),
    status: showcaseInquiryStatusSchema,
    tags: z.array(z.string().trim()).default([]),
    leadTemperature: showcaseLeadTemperatureSchema.default("WARM"),
    followUpAt: z.string().trim().optional(),
    lastContactAt: z.string().trim().optional(),
    nextAction: z.string().trim().optional(),
    lastOutcome: z.string().trim().optional(),
    lostReason: z.string().trim().optional(),
    notes: z.string().trim().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.customerEmail && !z.string().email().safeParse(data.customerEmail).success) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Informe um e-mail válido ou deixe o campo em branco.",
        path: ["customerEmail"],
      });
    }

    for (const [field, label] of [
      ["followUpAt", "follow-up"],
      ["lastContactAt", "último contato"],
    ] as const) {
      const value = data[field];

      if (value && Number.isNaN(new Date(value).getTime())) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Informe uma data válida para ${label}.`,
          path: [field],
        });
      }
    }

    if (data.status === "NOT_CLOSED" && !data.lostReason?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Ao marcar como não fechado, informe o motivo da perda.",
        path: ["lostReason"],
      });
    }
  });
const allowedImageFormats = ["png", "jpg", "jpeg", "webp", "gif"] as const;
const allowedVideoFormats = ["mp4", "webm", "mov", "m4v"] as const;

const machineDeletionLockedStatuses = new Set<OrderStatus>([
  OrderStatus.RECEIVED,
  OrderStatus.ANALYSIS,
  OrderStatus.WAITING_APPROVAL,
  OrderStatus.WAITING_PAYMENT,
  OrderStatus.QUEUED,
  OrderStatus.PRINTING,
  OrderStatus.POST_PROCESSING,
  OrderStatus.QUALITY,
  OrderStatus.READY_TO_SHIP,
  OrderStatus.SHIPPED,
  OrderStatus.FAILED_REWORK,
]);

function revalidateAll() {
  ["/", "/portal", "/admin", "/producao", "/maquinas", "/filamentos", "/financeiro"].forEach((route) => {
    revalidatePath(route);
  });
}

function rethrowNextRedirect(error: unknown) {
  unstable_rethrow(error);
}

function getSafeRedirectPath(formData: FormData) {
  const redirectTo = String(formData.get("redirectTo") ?? "").trim();
  if (!redirectTo || !redirectTo.startsWith("/") || redirectTo.startsWith("//")) {
    return undefined;
  }

  return redirectTo;
}

function parseMaterialFormData(formData: FormData) {
  return materialSchema.safeParse({
    name: formData.get("name"),
    category: formData.get("category"),
    technology: formData.get("technology"),
    color: formData.get("color"),
    brand: formData.get("brand"),
    lot: formData.get("lot"),
    stockAmount: formData.get("stockAmount"),
    minimumStock: formData.get("minimumStock"),
    purchasePrice: formData.get("purchasePrice"),
    spoolWeightGrams: formData.get("spoolWeightGrams"),
    spoolLengthMeters: formData.get("spoolLengthMeters") || 0,
    filamentDiameterMm: formData.get("filamentDiameterMm") || 1.75,
    supplier: formData.get("supplier")?.toString(),
  });
}

function getMaterialFormFields(formData: FormData) {
  return {
    name: String(formData.get("name") ?? ""),
    category: String(formData.get("category") ?? ""),
    technology: String(formData.get("technology") ?? ""),
    color: String(formData.get("color") ?? ""),
    brand: String(formData.get("brand") ?? ""),
    lot: String(formData.get("lot") ?? ""),
    stockAmount: String(formData.get("stockAmount") ?? ""),
    minimumStock: String(formData.get("minimumStock") ?? ""),
    purchasePrice: String(formData.get("purchasePrice") ?? ""),
    spoolWeightGrams: String(formData.get("spoolWeightGrams") ?? ""),
    spoolLengthMeters: String(formData.get("spoolLengthMeters") ?? ""),
    filamentDiameterMm: String(formData.get("filamentDiameterMm") ?? ""),
    supplier: String(formData.get("supplier") ?? ""),
  };
}

function parseMachineFormData(formData: FormData) {
  return machineSchema.safeParse({
    name: formData.get("name"),
    model: formData.get("model"),
    technology: formData.get("technology"),
    buildVolumeX: formData.get("buildVolumeX"),
    buildVolumeY: formData.get("buildVolumeY"),
    buildVolumeZ: formData.get("buildVolumeZ"),
    supportedMaterialNames: formData.get("supportedMaterialNames"),
    purchasePrice: formData.get("purchasePrice"),
    amountPaid: formData.get("amountPaid"),
    purchasedAt: formData.get("purchasedAt")?.toString(),
    location: formData.get("location")?.toString(),
    notes: formData.get("notes")?.toString(),
  });
}

function parseExpenseFormData(formData: FormData) {
  return expenseSchema.safeParse({
    title: formData.get("title"),
    category: formData.get("category"),
    amount: formData.get("amount"),
    paidAt: formData.get("paidAt"),
    notes: formData.get("notes")?.toString(),
  });
}

function parseShowcaseItemFormData(formData: FormData) {
  return showcaseItemSchema.safeParse({
    name: formData.get("name"),
    category: formData.get("category"),
    libraryId: formData.get("libraryId")?.toString(),
    tagline: formData.get("tagline")?.toString(),
    description: formData.get("description"),
    price: formData.get("price"),
    estimatedPrintHours: formData.get("estimatedPrintHours"),
    estimatedMaterialGrams: formData.get("estimatedMaterialGrams") || 0,
    productionChecklist: formData.get("productionChecklist")?.toString(),
    fulfillmentType: formData.get("fulfillmentType"),
    stockQuantity: formData.get("stockQuantity"),
    leadTimeDays: formData.get("leadTimeDays") || 0,
    materialLabel: formData.get("materialLabel")?.toString(),
    materialId: formData.get("materialId")?.toString(),
    colorOptions: parseShowcaseListField(formData.get("colorOptions")),
    sizeOptions: parseShowcaseListField(formData.get("sizeOptions")),
    finishOptions: parseShowcaseListField(formData.get("finishOptions")),
    badges: parseShowcaseListField(formData.get("badges")),
    deliveryModes: formData
      .getAll("deliveryModes")
      .map((entry) => entry.toString())
      .filter(Boolean),
    dimensionSummary: formData.get("dimensionSummary")?.toString(),
    shippingSummary: formData.get("shippingSummary")?.toString(),
    promotionLabel: formData.get("promotionLabel")?.toString(),
    compareAtPrice: formData.get("compareAtPrice"),
    couponCode: formData.get("couponCode")?.toString(),
    couponDiscountPercent: formData.get("couponDiscountPercent"),
    seoTitle: formData.get("seoTitle")?.toString(),
    seoDescription: formData.get("seoDescription")?.toString(),
    seoKeywords: parseShowcaseListField(formData.get("seoKeywords")),
    imageUrl: formData.get("imageUrl")?.toString(),
    videoUrl: formData.get("videoUrl")?.toString(),
    galleryImageUrls: parseShowcaseListField(formData.get("galleryImageUrls")),
    variants: parseShowcaseVariantField(formData.get("variantsText")),
    featured: formData.get("featured") === "on",
    active: formData.get("active") === "on",
  });
}

function getShowcaseItemFormFields(formData: FormData) {
  return {
    itemId: String(formData.get("itemId") ?? ""),
    name: String(formData.get("name") ?? ""),
    category: String(formData.get("category") ?? ""),
    libraryId: String(formData.get("libraryId") ?? ""),
    tagline: String(formData.get("tagline") ?? ""),
    description: String(formData.get("description") ?? ""),
    price: String(formData.get("price") ?? ""),
    estimatedPrintHours: String(formData.get("estimatedPrintHours") ?? ""),
    estimatedMaterialGrams: String(formData.get("estimatedMaterialGrams") ?? ""),
    productionChecklist: String(formData.get("productionChecklist") ?? ""),
    fulfillmentType: String(formData.get("fulfillmentType") ?? "STOCK"),
    stockQuantity: String(formData.get("stockQuantity") ?? ""),
    restockQuantity: String(formData.get("restockQuantity") ?? "0"),
    leadTimeDays: String(formData.get("leadTimeDays") ?? ""),
    materialLabel: String(formData.get("materialLabel") ?? ""),
    materialId: String(formData.get("materialId") ?? ""),
    colorOptions: String(formData.get("colorOptions") ?? ""),
    sizeOptions: String(formData.get("sizeOptions") ?? ""),
    finishOptions: String(formData.get("finishOptions") ?? ""),
    badges: String(formData.get("badges") ?? ""),
    deliveryModes: formData.getAll("deliveryModes").map((entry) => entry.toString()).join(","),
    dimensionSummary: String(formData.get("dimensionSummary") ?? ""),
    shippingSummary: String(formData.get("shippingSummary") ?? ""),
    promotionLabel: String(formData.get("promotionLabel") ?? ""),
    compareAtPrice: String(formData.get("compareAtPrice") ?? ""),
    couponCode: String(formData.get("couponCode") ?? ""),
    couponDiscountPercent: String(formData.get("couponDiscountPercent") ?? ""),
    seoTitle: String(formData.get("seoTitle") ?? ""),
    seoDescription: String(formData.get("seoDescription") ?? ""),
    seoKeywords: String(formData.get("seoKeywords") ?? ""),
    variantsText: String(formData.get("variantsText") ?? ""),
    imageUrl: String(formData.get("imageUrl") ?? ""),
    videoUrl: String(formData.get("videoUrl") ?? ""),
    galleryImageUrls: String(formData.get("galleryImageUrls") ?? ""),
    calculatorMaterialsJson: String(formData.get("calculatorMaterialsJson") ?? ""),
    calculatorPackagingCost: String(formData.get("calculatorPackagingCost") ?? ""),
    calculatorMaterialId: String(formData.get("calculatorMaterialId") ?? ""),
    calculatorFilamentPricePerKilo: String(formData.get("calculatorFilamentPricePerKilo") ?? ""),
    calculatorMaterialUsedGrams: String(formData.get("calculatorMaterialUsedGrams") ?? ""),
    calculatorPrintDurationHours: String(formData.get("calculatorPrintDurationHours") ?? ""),
    calculatorEnergyRate: String(formData.get("calculatorEnergyRate") ?? ""),
    calculatorPrinterPowerWatts: String(formData.get("calculatorPrinterPowerWatts") ?? ""),
    calculatorLaborRatePerHour: String(formData.get("calculatorLaborRatePerHour") ?? ""),
    calculatorLaborHours: String(formData.get("calculatorLaborHours") ?? ""),
    calculatorMarginPercent: String(formData.get("calculatorMarginPercent") ?? ""),
    featured: formData.get("featured") === "on" ? "true" : "false",
    active: formData.get("active") === "on" ? "true" : "false",
  };
}

function parseShowcaseLibraryFormData(formData: FormData) {
  return showcaseLibrarySchema.safeParse({
    name: formData.get("name"),
    description: formData.get("description")?.toString(),
    coverImageUrl: formData.get("coverImageUrl")?.toString(),
    sortOrder: formData.get("sortOrder") || 0,
    active: formData.get("active") === "on",
  });
}

function getShowcaseLibraryFormFields(formData: FormData) {
  return {
    libraryId: String(formData.get("libraryId") ?? ""),
    name: String(formData.get("name") ?? ""),
    description: String(formData.get("description") ?? ""),
    coverImageUrl: String(formData.get("coverImageUrl") ?? ""),
    sortOrder: String(formData.get("sortOrder") ?? "0"),
    active: formData.get("active") === "on" ? "true" : "false",
  };
}

function parseStorefrontSettingsFormData(formData: FormData) {
  return storefrontSettingsSchema.safeParse({
    brandName: formData.get("brandName"),
    heroEyebrow: formData.get("heroEyebrow"),
    heroTitle: formData.get("heroTitle"),
    heroSubtitle: formData.get("heroSubtitle"),
    heroPrimaryCtaLabel: formData.get("heroPrimaryCtaLabel"),
    heroSecondaryCtaLabel: formData.get("heroSecondaryCtaLabel"),
    heroHighlights: parseShowcaseListField(formData.get("heroHighlights")),
    announcementText: formData.get("announcementText")?.toString(),
    aboutTitle: formData.get("aboutTitle"),
    aboutBody: formData.get("aboutBody"),
    customOrderTitle: formData.get("customOrderTitle"),
    customOrderBody: formData.get("customOrderBody"),
    averageLeadTimeText: formData.get("averageLeadTimeText"),
    materialsText: formData.get("materialsText"),
    careText: formData.get("careText"),
    shippingTitle: formData.get("shippingTitle"),
    shippingBody: formData.get("shippingBody"),
    campaignBanners: parseStorefrontCampaignField(formData.get("campaignBanners")),
    instagramUrl: formData.get("instagramUrl")?.toString(),
    instagramHandle: formData.get("instagramHandle")?.toString(),
    instagramButtonLabel: formData.get("instagramButtonLabel"),
    instagramSectionTitle: formData.get("instagramSectionTitle"),
    instagramSectionBody: formData.get("instagramSectionBody"),
    instagramGallery: parseStorefrontGalleryField(formData.get("instagramGallery")),
    instagramReels: parseStorefrontReelsField(formData.get("instagramReels")),
    instagramBehindScenes: parseShowcaseListField(formData.get("instagramBehindScenes")),
    portfolioTitle: formData.get("portfolioTitle"),
    portfolioBody: formData.get("portfolioBody"),
    seoTitle: formData.get("seoTitle"),
    seoDescription: formData.get("seoDescription"),
    seoKeywords: parseShowcaseListField(formData.get("seoKeywords")),
    shareImageUrl: formData.get("shareImageUrl")?.toString(),
  });
}

function getStorefrontSettingsFormFields(formData: FormData) {
  return {
    brandName: String(formData.get("brandName") ?? ""),
    heroEyebrow: String(formData.get("heroEyebrow") ?? ""),
    heroTitle: String(formData.get("heroTitle") ?? ""),
    heroSubtitle: String(formData.get("heroSubtitle") ?? ""),
    heroPrimaryCtaLabel: String(formData.get("heroPrimaryCtaLabel") ?? ""),
    heroSecondaryCtaLabel: String(formData.get("heroSecondaryCtaLabel") ?? ""),
    heroHighlights: String(formData.get("heroHighlights") ?? ""),
    announcementText: String(formData.get("announcementText") ?? ""),
    aboutTitle: String(formData.get("aboutTitle") ?? ""),
    aboutBody: String(formData.get("aboutBody") ?? ""),
    customOrderTitle: String(formData.get("customOrderTitle") ?? ""),
    customOrderBody: String(formData.get("customOrderBody") ?? ""),
    averageLeadTimeText: String(formData.get("averageLeadTimeText") ?? ""),
    materialsText: String(formData.get("materialsText") ?? ""),
    careText: String(formData.get("careText") ?? ""),
    shippingTitle: String(formData.get("shippingTitle") ?? ""),
    shippingBody: String(formData.get("shippingBody") ?? ""),
    campaignBanners: String(formData.get("campaignBanners") ?? ""),
    instagramUrl: String(formData.get("instagramUrl") ?? ""),
    instagramHandle: String(formData.get("instagramHandle") ?? ""),
    instagramButtonLabel: String(formData.get("instagramButtonLabel") ?? ""),
    instagramSectionTitle: String(formData.get("instagramSectionTitle") ?? ""),
    instagramSectionBody: String(formData.get("instagramSectionBody") ?? ""),
    instagramGallery: String(formData.get("instagramGallery") ?? ""),
    instagramReels: String(formData.get("instagramReels") ?? ""),
    instagramBehindScenes: String(formData.get("instagramBehindScenes") ?? ""),
    portfolioTitle: String(formData.get("portfolioTitle") ?? ""),
    portfolioBody: String(formData.get("portfolioBody") ?? ""),
    seoTitle: String(formData.get("seoTitle") ?? ""),
    seoDescription: String(formData.get("seoDescription") ?? ""),
    seoKeywords: String(formData.get("seoKeywords") ?? ""),
    shareImageUrl: String(formData.get("shareImageUrl") ?? ""),
  };
}

function parseTestimonialFormData(formData: FormData) {
  return testimonialSchema.safeParse({
    customerName: formData.get("customerName"),
    city: formData.get("city")?.toString(),
    role: formData.get("role")?.toString(),
    instagramHandle: formData.get("instagramHandle")?.toString(),
    productName: formData.get("productName")?.toString(),
    quote: formData.get("quote"),
    imageUrl: formData.get("imageUrl")?.toString(),
    featured: formData.get("featured") === "on",
    sortOrder: formData.get("sortOrder") || 0,
  });
}

function getTestimonialFormFields(formData: FormData) {
  return {
    testimonialId: String(formData.get("testimonialId") ?? ""),
    customerName: String(formData.get("customerName") ?? ""),
    city: String(formData.get("city") ?? ""),
    role: String(formData.get("role") ?? ""),
    instagramHandle: String(formData.get("instagramHandle") ?? ""),
    productName: String(formData.get("productName") ?? ""),
    quote: String(formData.get("quote") ?? ""),
    imageUrl: String(formData.get("imageUrl") ?? ""),
    sortOrder: String(formData.get("sortOrder") ?? "0"),
    featured: formData.get("featured") === "on" ? "true" : "false",
  };
}

function parseShowcaseInquiryFormData(formData: FormData) {
  return showcaseInquirySchema.safeParse({
    itemId: formData.get("itemId"),
    quantity: formData.get("quantity"),
    customerName: formData.get("customerName"),
    customerEmail: formData.get("customerEmail")?.toString(),
    customerPhone: formData.get("customerPhone")?.toString(),
    status: formData.get("status"),
    tags: parseShowcaseListField(formData.get("tags")),
    leadTemperature: formData.get("leadTemperature") || "WARM",
    followUpAt: formData.get("followUpAt")?.toString(),
    lastContactAt: formData.get("lastContactAt")?.toString(),
    nextAction: formData.get("nextAction")?.toString(),
    lastOutcome: formData.get("lastOutcome")?.toString(),
    lostReason: formData.get("lostReason")?.toString(),
    notes: formData.get("notes")?.toString(),
  });
}

function getShowcaseInquiryFormFields(formData: FormData) {
  return {
    inquiryId: String(formData.get("inquiryId") ?? ""),
    itemId: String(formData.get("itemId") ?? ""),
    quantity: String(formData.get("quantity") ?? "1"),
    customerName: String(formData.get("customerName") ?? ""),
    customerEmail: String(formData.get("customerEmail") ?? ""),
    customerPhone: String(formData.get("customerPhone") ?? ""),
    status: String(formData.get("status") ?? "PENDING"),
    tags: String(formData.get("tags") ?? ""),
    leadTemperature: String(formData.get("leadTemperature") ?? "WARM"),
    followUpAt: String(formData.get("followUpAt") ?? ""),
    lastContactAt: String(formData.get("lastContactAt") ?? ""),
    nextAction: String(formData.get("nextAction") ?? ""),
    lastOutcome: String(formData.get("lastOutcome") ?? ""),
    lostReason: String(formData.get("lostReason") ?? ""),
    notes: String(formData.get("notes") ?? ""),
  };
}

function parsePayableFormData(formData: FormData) {
  return payableSchema.safeParse({
    title: formData.get("title"),
    category: formData.get("category"),
    amount: formData.get("amount"),
    dueDate: formData.get("dueDate"),
    vendor: formData.get("vendor")?.toString(),
    notes: formData.get("notes")?.toString(),
  });
}

function redirectAfterAuth(role: UserRole): never {
  if (role === UserRole.CLIENT) {
    redirect("/portal");
  }

  redirect("/admin");
}

function normalizeRedirectTarget(value: FormDataEntryValue | null) {
  const target = value?.toString().trim();

  if (!target || !target.startsWith("/")) {
    return null;
  }

  return target;
}

function buildAdminShowcaseSectionUrl(message: string) {
  return `/admin?section=vitrine&message=${encodeURIComponent(message)}`;
}

function buildAdminSettingsSectionUrl(message: string) {
  return `/admin?section=configuracoes&message=${encodeURIComponent(message)}`;
}

function buildAdminLibrariesSectionUrl(message: string) {
  return `/admin?section=bibliotecas&message=${encodeURIComponent(message)}`;
}

function buildAdminLeadsSectionUrl(message: string) {
  return `/admin?section=leads&message=${encodeURIComponent(message)}`;
}

function buildAdminOrdersSectionUrl(message: string) {
  return `/admin?section=pedidos&message=${encodeURIComponent(message)}`;
}

function buildAdminSummaryUrl(
  value: string,
  type: "message" | "error" = "message",
) {
  return `/admin?${type}=${encodeURIComponent(value)}`;
}

function generateOrderNumber(existingOrders: DbOrder[]) {
  const datePart = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const todaysOrders = existingOrders.filter((order) => order.orderNumber.includes(datePart)).length + 1;
  return `GV-${datePart}-${String(todaysOrders).padStart(3, "0")}`;
}

function generateShowcaseOrderNumber(existingInquiries: DbShowcaseInquiry[]) {
  const datePart = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const todaysOrders =
    existingInquiries.filter((inquiry) => inquiry.orderNumber?.includes(`WH-${datePart}`)).length + 1;
  return `WH-${datePart}-${String(todaysOrders).padStart(3, "0")}`;
}

function normalizeOptionalIsoDate(value?: string) {
  if (!value?.trim()) {
    return undefined;
  }

  return new Date(value).toISOString();
}

function pushAuditLog(
  db: Awaited<ReturnType<typeof readDb>>,
  {
    actorId,
    area,
    action,
    summary,
    entityType,
    entityId,
    details,
  }: Omit<DbAuditLog, "id" | "createdAt">,
) {
  const entry: DbAuditLog = {
    id: createId("log"),
    actorId,
    area,
    action,
    summary: summary.trim(),
    entityType: entityType?.trim() || undefined,
    entityId: entityId?.trim() || undefined,
    details: details?.trim() || undefined,
    createdAt: new Date().toISOString(),
  };

  db.auditLogs.unshift(entry);
  db.auditLogs = db.auditLogs.slice(0, 250);
}

function ensureShowcaseLibraryExists(
  db: Awaited<ReturnType<typeof readDb>>,
  libraryId: string | undefined,
) {
  const normalizedLibraryId = libraryId?.trim();

  if (!normalizedLibraryId) {
    return undefined;
  }

  const library = db.showcaseLibraries.find((entry) => entry.id === normalizedLibraryId);

  if (!library) {
    throw new Error("Selecione uma biblioteca válida para o produto.");
  }

  return library;
}

function buildExpensePayload(data: z.infer<typeof expenseSchema>): DbExpense {
  const now = new Date().toISOString();

  return {
    id: createId("exp"),
    title: data.title,
    category: data.category as DbExpenseCategory,
    amount: data.amount,
    paidAt: new Date(data.paidAt).toISOString(),
    notes: data.notes?.trim() || undefined,
    createdAt: now,
    updatedAt: now,
  };
}

function buildPayablePayload(data: z.infer<typeof payableSchema>): DbPayable {
  const now = new Date().toISOString();
  const dueDate = new Date(data.dueDate).toISOString();
  const dueTimestamp = new Date(dueDate).getTime();
  const status: DbPayableStatus = dueTimestamp < Date.now() ? "OVERDUE" : "PENDING";

  return {
    id: createId("payb"),
    title: data.title,
    category: data.category as DbExpenseCategory,
    amount: data.amount,
    dueDate,
    status,
    vendor: data.vendor?.trim() || undefined,
    notes: data.notes?.trim() || undefined,
    createdAt: now,
    updatedAt: now,
  };
}

function buildMaterialPayload(data: z.infer<typeof materialSchema>): DbMaterial {
  const now = new Date().toISOString();
  const derived = getMaterialDerivedMetrics({
    purchasePrice: data.purchasePrice,
    spoolWeightGrams: data.spoolWeightGrams,
    spoolLengthMeters: data.spoolLengthMeters,
    stockAmount: data.stockAmount,
  });

  return {
    id: createId("mat"),
    name: data.name,
    category: data.category,
    technology: data.technology,
    color: data.color,
    brand: data.brand,
    lot: data.lot,
    stockAmount: data.stockAmount,
    unit: data.technology === PrintTechnology.RESIN ? "ml" : "g",
    purchasePrice: data.purchasePrice,
    spoolWeightGrams: data.spoolWeightGrams,
    spoolLengthMeters: data.technology === PrintTechnology.FDM ? data.spoolLengthMeters : 0,
    filamentDiameterMm: data.technology === PrintTechnology.FDM ? data.filamentDiameterMm : undefined,
    costPerUnit: derived.costPerGram,
    costPerMeter: data.technology === PrintTechnology.FDM ? derived.costPerMeter : 0,
    minimumStock: data.minimumStock,
    supplier: data.supplier?.trim() || undefined,
    leadTimeDays: 0,
    createdAt: now,
    updatedAt: now,
  };
}

function buildShowcaseItemPayload(data: z.infer<typeof showcaseItemSchema>): DbShowcaseItem {
  const now = new Date().toISOString();

  return {
    id: createId("vit"),
    name: data.name,
    category: data.category,
    libraryId: data.libraryId?.trim() || undefined,
    tagline: data.tagline?.trim() || undefined,
    description: data.description,
    price: data.price,
    productionChecklist: data.productionChecklist?.trim() || undefined,
    materialLabel: data.materialLabel?.trim() || undefined,
    materialId: data.materialId?.trim() || undefined,
    colorOptions: data.colorOptions,
    sizeOptions: data.sizeOptions,
    finishOptions: data.finishOptions,
    badges: data.badges,
    deliveryModes: data.deliveryModes as ShowcaseDeliveryMode[],
    dimensionSummary: data.dimensionSummary?.trim() || undefined,
    shippingSummary: data.shippingSummary?.trim() || undefined,
    promotionLabel: data.promotionLabel?.trim() || undefined,
    compareAtPrice: data.compareAtPrice,
    couponCode: data.couponCode?.trim() || undefined,
    couponDiscountPercent: data.couponDiscountPercent,
    seoTitle: data.seoTitle?.trim() || undefined,
    seoDescription: data.seoDescription?.trim() || undefined,
    seoKeywords: data.seoKeywords,
    leadTimeDays: data.fulfillmentType === "MADE_TO_ORDER" ? data.leadTimeDays : 0,
    estimatedPrintHours: data.estimatedPrintHours,
    estimatedMaterialGrams: data.estimatedMaterialGrams,
    fulfillmentType: data.fulfillmentType,
    stockQuantity: data.fulfillmentType === "STOCK" ? data.stockQuantity : 0,
    imageUrl: data.imageUrl?.trim() || undefined,
    videoUrl: data.videoUrl?.trim() || undefined,
    galleryImageUrls: data.galleryImageUrls,
    variants: data.variants,
    viewCount: 0,
    whatsappClickCount: 0,
    featured: data.featured,
    active: data.active,
    createdAt: now,
    updatedAt: now,
  };
}

function buildShowcaseLibraryPayload(
  data: z.infer<typeof showcaseLibrarySchema>,
): DbShowcaseLibrary {
  const now = new Date().toISOString();

  return {
    id: createId("lib"),
    name: data.name.trim(),
    description: data.description?.trim() || undefined,
    coverImageUrl: data.coverImageUrl?.trim() || undefined,
    sortOrder: data.sortOrder,
    active: data.active,
    createdAt: now,
    updatedAt: now,
  };
}

function buildStorefrontSettingsPayload(
  data: z.infer<typeof storefrontSettingsSchema>,
): DbStorefrontSettings {
  return {
    brandName: data.brandName,
    heroEyebrow: data.heroEyebrow,
    heroTitle: data.heroTitle,
    heroSubtitle: data.heroSubtitle,
    heroPrimaryCtaLabel: data.heroPrimaryCtaLabel,
    heroSecondaryCtaLabel: data.heroSecondaryCtaLabel,
    heroHighlights: data.heroHighlights,
    announcementText: data.announcementText?.trim() || undefined,
    aboutTitle: data.aboutTitle,
    aboutBody: data.aboutBody,
    customOrderTitle: data.customOrderTitle,
    customOrderBody: data.customOrderBody,
    averageLeadTimeText: data.averageLeadTimeText,
    materialsText: data.materialsText,
    careText: data.careText,
    shippingTitle: data.shippingTitle,
    shippingBody: data.shippingBody,
    campaignBanners: data.campaignBanners.map((campaign) => ({
      ...campaign,
      badge: campaign.badge?.trim() || undefined,
      startsAt: campaign.startsAt?.trim() || undefined,
      endsAt: campaign.endsAt?.trim() || undefined,
      ctaLabel: campaign.ctaLabel?.trim() || undefined,
      ctaHref: campaign.ctaHref?.trim() || undefined,
    })),
    instagramUrl: data.instagramUrl?.trim() || undefined,
    instagramHandle: data.instagramHandle?.trim() || undefined,
    instagramButtonLabel: data.instagramButtonLabel,
    instagramSectionTitle: data.instagramSectionTitle,
    instagramSectionBody: data.instagramSectionBody,
    instagramGallery: data.instagramGallery.map((entry) => ({
      ...entry,
      linkUrl: entry.linkUrl?.trim() || undefined,
    })),
    instagramReels: data.instagramReels.map((entry) => ({
      ...entry,
      thumbnailUrl: entry.thumbnailUrl?.trim() || undefined,
      caption: entry.caption?.trim() || undefined,
    })),
    instagramBehindScenes: data.instagramBehindScenes,
    portfolioTitle: data.portfolioTitle,
    portfolioBody: data.portfolioBody,
    seoTitle: data.seoTitle,
    seoDescription: data.seoDescription,
    seoKeywords: data.seoKeywords,
    shareImageUrl: data.shareImageUrl?.trim() || undefined,
    updatedAt: new Date().toISOString(),
  };
}

function buildShowcaseTestimonialPayload(
  data: z.infer<typeof testimonialSchema>,
): DbShowcaseTestimonial {
  const now = new Date().toISOString();

  return {
    id: createId("tst"),
    customerName: data.customerName,
    city: data.city?.trim() || undefined,
    role: data.role?.trim() || undefined,
    instagramHandle: data.instagramHandle?.trim() || undefined,
    productName: data.productName?.trim() || undefined,
    quote: data.quote,
    imageUrl: data.imageUrl?.trim() || undefined,
    featured: data.featured,
    sortOrder: data.sortOrder,
    createdAt: now,
    updatedAt: now,
  };
}

function usesShowcaseInventory(item: Pick<DbShowcaseItem, "fulfillmentType">) {
  return item.fulfillmentType === "STOCK";
}

function getShowcaseFulfillmentLabel(fulfillmentType: ShowcaseFulfillmentType) {
  return fulfillmentType === "MADE_TO_ORDER" ? "Sob encomenda" : "Pronta entrega";
}

function getShowcaseLeadTimeText(
  fulfillmentType: ShowcaseFulfillmentType,
  leadTimeDays?: number,
) {
  if (fulfillmentType === "STOCK") {
    return "Pronta entrega";
  }

  if (!leadTimeDays) {
    return "A definir";
  }

  return leadTimeDays === 1 ? "1 dia util" : `${leadTimeDays} dias uteis`;
}

function buildShowcaseWhatsAppUrl({
  itemName,
  quantity,
  fulfillmentType,
  customerName,
  customerPhone,
  estimatedTotal,
  selectedVariantLabel,
  desiredColor,
  desiredSize,
  desiredFinish,
  notes,
  leadTimeLabel,
  couponCode,
}: {
  itemName: string;
  quantity: number;
  fulfillmentType: ShowcaseFulfillmentType;
  customerName: string;
  customerPhone: string;
  estimatedTotal?: number;
  selectedVariantLabel?: string;
  desiredColor?: string;
  desiredSize?: string;
  desiredFinish?: string;
  notes?: string;
  leadTimeLabel?: string;
  couponCode?: string;
}) {
  const message = [
    "Olá! Quero comprar este item da vitrine.",
    `Item: ${itemName}`,
    `Quantidade: ${quantity}`,
    `Disponibilidade: ${getShowcaseFulfillmentLabel(fulfillmentType)}`,
    estimatedTotal != null
      ? `Valor estimado: ${new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(estimatedTotal)}`
      : null,
    leadTimeLabel ? `Prazo: ${leadTimeLabel}` : null,
    selectedVariantLabel ? `Variacao: ${selectedVariantLabel}` : null,
    desiredColor ? `Cor desejada: ${desiredColor}` : null,
    desiredSize ? `Tamanho desejado: ${desiredSize}` : null,
    desiredFinish ? `Acabamento desejado: ${desiredFinish}` : null,
    couponCode ? `Cupom: ${couponCode}` : null,
    `Cliente: ${customerName}`,
    `Telefone: ${customerPhone}`,
    notes ? `Observacao: ${notes}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  return `https://api.whatsapp.com/send?phone=${ownerWhatsAppNumber}&text=${encodeURIComponent(message)}`;
}

function getPlannedMinutesFromHours(hours: number) {
  return Math.max(Math.round(hours * 60), 1);
}

function getElapsedMinutes(startedAt?: string, finishedAt?: string) {
  if (!startedAt) {
    return 0;
  }

  const startedMs = new Date(startedAt).getTime();
  const endMs = finishedAt ? new Date(finishedAt).getTime() : Date.now();

  if (Number.isNaN(startedMs) || Number.isNaN(endMs) || endMs <= startedMs) {
    return 0;
  }

  return Math.max(Math.round((endMs - startedMs) / 60000), 1);
}

function buildCompletionNotificationUrl({
  label,
  customerName,
  quantity,
  finishedAt,
  plannedPrintMinutes,
  elapsedPrintMinutes,
}: {
  label: string;
  customerName: string;
  quantity?: number;
  finishedAt: string;
  plannedPrintMinutes?: number;
  elapsedPrintMinutes?: number;
}) {
  const message = [
    "Pedido finalizado na GV 3D Studio.",
    `Item: ${label}`,
    `Cliente: ${customerName}`,
    typeof quantity === "number" ? `Quantidade: ${quantity}` : null,
    plannedPrintMinutes ? `Tempo previsto: ${formatDurationMinutes(plannedPrintMinutes)}` : null,
    elapsedPrintMinutes ? `Tempo real: ${formatDurationMinutes(elapsedPrintMinutes)}` : null,
    `Finalizado em: ${formatDateTime(new Date(finishedAt))}`,
  ]
    .filter(Boolean)
    .join("\n");

  return `https://api.whatsapp.com/send?phone=${ownerWhatsAppNumber}&text=${encodeURIComponent(message)}`;
}

async function resolveShowcaseImageUrl(formData: FormData) {
  const imageFile = formData.get("imageFile");

  if (!(imageFile instanceof File) || !imageFile.name) {
    return null;
  }

  const fileExtension = getFileExtension(imageFile.name);

  if (!allowedImageFormats.includes(fileExtension as (typeof allowedImageFormats)[number])) {
    throw new Error("Use uma imagem PNG, JPG, JPEG, WEBP ou GIF.");
  }

  return saveUpload(imageFile);
}

async function resolveShowcaseVideoUrl(formData: FormData) {
  const videoFile = formData.get("videoFile");

  if (!(videoFile instanceof File) || !videoFile.name || videoFile.size === 0) {
    return null;
  }

  const fileExtension = getFileExtension(videoFile.name);
  const contentType = (videoFile.type || "").toLowerCase();
  const allowedVideoMimeTypes = new Set([
    "video/mp4",
    "video/webm",
    "video/quicktime",
    "video/x-m4v",
  ]);

  // O video eh opcional. Se um arquivo de imagem cair aqui por engano, ignoramos
  // para nao bloquear o cadastro do produto por causa do campo adicional.
  if (contentType.startsWith("image/")) {
    return null;
  }

  const hasAcceptedExtension = allowedVideoFormats.includes(
    fileExtension as (typeof allowedVideoFormats)[number],
  );
  const hasAcceptedMimeType = allowedVideoMimeTypes.has(contentType);

  if (!hasAcceptedExtension && !hasAcceptedMimeType) {
    throw new Error("Use um video MP4, WEBM, MOV ou M4V.");
  }

  return saveUpload(videoFile);
}

async function resolveShowcaseGalleryImageUrls(formData: FormData) {
  const manualGalleryUrls = parseShowcaseListField(formData.get("galleryImageUrls"));
  const uploadedGalleryFiles = formData
    .getAll("galleryFiles")
    .filter((entry): entry is File => entry instanceof File && Boolean(entry.name));

  const uploadedGalleryUrls: string[] = [];

  for (const galleryFile of uploadedGalleryFiles) {
    const fileExtension = getFileExtension(galleryFile.name);

    if (!allowedImageFormats.includes(fileExtension as (typeof allowedImageFormats)[number])) {
      throw new Error("Use imagens PNG, JPG, JPEG, WEBP ou GIF na galeria.");
    }

    uploadedGalleryUrls.push(await saveUpload(galleryFile));
  }

  return Array.from(new Set([...manualGalleryUrls, ...uploadedGalleryUrls])).slice(0, 8);
}

async function resolveShowcaseTestimonialImageUrl(formData: FormData) {
  const imageFile = formData.get("testimonialImageFile");

  if (!(imageFile instanceof File) || !imageFile.name) {
    return null;
  }

  const fileExtension = getFileExtension(imageFile.name);

  if (!allowedImageFormats.includes(fileExtension as (typeof allowedImageFormats)[number])) {
    throw new Error("Use uma imagem PNG, JPG, JPEG, WEBP ou GIF no depoimento.");
  }

  return saveUpload(imageFile);
}

async function resolveShowcaseLibraryCoverImageUrl(formData: FormData) {
  const imageFile = formData.get("coverImageFile");

  if (!(imageFile instanceof File) || !imageFile.name) {
    return null;
  }

  const fileExtension = getFileExtension(imageFile.name);

  if (!allowedImageFormats.includes(fileExtension as (typeof allowedImageFormats)[number])) {
    throw new Error("Use uma imagem PNG, JPG, JPEG, WEBP ou GIF na capa da biblioteca.");
  }

  return saveUpload(imageFile);
}

async function saveUpload(file: File) {
  return saveUploadedFile(file);
}

function reserveShowcaseStock(item: DbShowcaseItem, quantity: number, now: string) {
  if (!usesShowcaseInventory(item)) {
    return;
  }

  if (item.stockQuantity < quantity) {
    throw new Error(`Estoque insuficiente para ${item.name}. Disponível: ${item.stockQuantity}.`);
  }

  item.stockQuantity -= quantity;
  item.updatedAt = now;
}

function releaseShowcaseStock(item: DbShowcaseItem, quantity: number, now: string) {
  if (!usesShowcaseInventory(item)) {
    return;
  }

  item.stockQuantity += quantity;
  item.updatedAt = now;
}

function hasReservedShowcaseStock(status: ShowcaseInquiryStatus, orderStage?: ShowcaseOrderStage) {
  return status === "CLOSED" && orderStage !== "CANCELED";
}

function resolveShowcaseMaterialSelection(
  db: Awaited<ReturnType<typeof readDb>>,
  data: Pick<z.infer<typeof showcaseItemSchema>, "materialId" | "materialLabel">,
) {
  const materialId = data.materialId?.trim() || undefined;

  if (!materialId) {
    return {
      materialId: undefined,
      materialLabel: data.materialLabel?.trim() || undefined,
    };
  }

  const material = db.materials.find((candidate) => candidate.id === materialId);

  if (!material) {
    throw new Error("O material principal escolhido não foi encontrado.");
  }

  return {
    materialId: material.id,
    materialLabel: data.materialLabel?.trim() || material.name,
  };
}

function consumeMaterialStock(material: DbMaterial, amount: number, now: string) {
  if (amount <= 0) {
    return;
  }

  if (material.stockAmount < amount) {
    throw new Error(
      `Material insuficiente em ${material.name}. Disponível: ${material.stockAmount.toFixed(0)} ${material.unit}.`,
    );
  }

  material.stockAmount = Number((material.stockAmount - amount).toFixed(2));
  material.updatedAt = now;
}

function consumeInternalOrderMaterial(
  db: Awaited<ReturnType<typeof readDb>>,
  order: DbOrder,
  actorId?: string,
  now = new Date().toISOString(),
) {
  if (order.materialConsumedAt || !order.materialId || order.estimatedWeightGrams <= 0) {
    return;
  }

  const material = db.materials.find((candidate) => candidate.id === order.materialId);

  if (!material) {
    return;
  }

  const consumedAmount = Number(order.estimatedWeightGrams.toFixed(2));
  const consumedValue = Number((consumedAmount * material.costPerUnit).toFixed(2));

  consumeMaterialStock(material, consumedAmount, now);
  order.materialConsumedAt = now;
  order.materialConsumptionGrams = consumedAmount;
  order.materialConsumptionValue = consumedValue;
  pushAuditLog(db, {
    actorId,
    area: "materials",
    action: "consume_order",
    summary: `Material baixado para ${order.orderNumber}: ${consumedAmount.toFixed(0)} ${material.unit} de ${material.name}.`,
  });
}

function consumeShowcaseInquiryMaterial(
  db: Awaited<ReturnType<typeof readDb>>,
  inquiry: DbShowcaseInquiry,
  item: DbShowcaseItem | undefined,
  actorId?: string,
  now = new Date().toISOString(),
) {
  if (inquiry.materialConsumedAt || !item?.materialId || item.estimatedMaterialGrams <= 0) {
    return;
  }

  const material = db.materials.find((candidate) => candidate.id === item.materialId);

  if (!material) {
    return;
  }

  const consumedAmount = Number((item.estimatedMaterialGrams * inquiry.quantity).toFixed(2));

  if (consumedAmount <= 0) {
    return;
  }

  const consumedValue = Number((consumedAmount * material.costPerUnit).toFixed(2));

  consumeMaterialStock(material, consumedAmount, now);
  inquiry.materialConsumedAt = now;
  inquiry.materialConsumptionGrams = consumedAmount;
  inquiry.materialConsumptionValue = consumedValue;
  pushAuditLog(db, {
    actorId,
    area: "materials",
    action: "consume_showcase",
    summary: `Material baixado para ${inquiry.itemName}: ${consumedAmount.toFixed(0)} ${material.unit} de ${material.name}.`,
  });
}

function applyShowcaseOperationalMetadata(
  db: Awaited<ReturnType<typeof readDb>>,
  inquiry: DbShowcaseInquiry,
  item: DbShowcaseItem | undefined,
  now: string,
) {
  inquiry.orderNumber ??= generateShowcaseOrderNumber(db.showcaseInquiries);

  if (!inquiry.dueDate) {
    const leadDays =
      item?.leadTimeDays && item.leadTimeDays > 0
        ? item.leadTimeDays
        : Math.max(1, Math.ceil(((item?.estimatedPrintHours ?? 1) * inquiry.quantity) / 8));
    const dueDate = new Date(now);
    dueDate.setDate(dueDate.getDate() + leadDays);
    inquiry.dueDate = dueDate.toISOString();
  }
}

function findOrder(db: Awaited<ReturnType<typeof readDb>>, orderId: string) {
  return db.orders.find((order) => order.id === orderId);
}

function canAccessOrder(order: DbOrder, userId: string, role: UserRole) {
  if (role === UserRole.ADMIN || role === UserRole.SUPERVISOR || role === UserRole.OPERATOR) {
    return true;
  }

  return order.customerId === userId;
}

export async function loginAction(_previousState: ActionState, formData: FormData): Promise<ActionState> {
  const redirectTo = normalizeRedirectTarget(formData.get("redirectTo"));
  const normalizedEmail = String(formData.get("email") ?? "").trim().toLowerCase();
  const parsed = authSchema.safeParse({
    email: normalizedEmail,
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Não foi possível validar o login.",
    };
  }

  const db = await readDb();
  const user = db.users.find((item) => item.email.toLowerCase() === parsed.data.email.toLowerCase());

  if (!user) {
    return {
      ok: false,
      error:
        normalizedEmail === ownerEmail
          ? "Conta administrativa ainda não foi localizada. Recarregue a página e, se preciso, use o cadastro abaixo com o mesmo e-mail do dono."
          : "Usuário não encontrado.",
    };
  }

  const isValid = await verifyPassword(parsed.data.password, user.passwordHash);

  if (!isValid) {
    return {
      ok: false,
      error: "Senha inválida.",
    };
  }

  await createUserSession(user.id);
  if (redirectTo) {
    redirect(redirectTo);
  }
  redirectAfterAuth(user.role);
}

export async function registerAction(_previousState: ActionState, formData: FormData): Promise<ActionState> {
  const redirectTo = normalizeRedirectTarget(formData.get("redirectTo"));
  const normalizedEmail = String(formData.get("email") ?? "").trim().toLowerCase();
  const parsed = registerSchema.safeParse({
    name: formData.get("name"),
    company: formData.get("company"),
    phone: formData.get("phone"),
    email: normalizedEmail,
    password: formData.get("password"),
    address: formData.get("address"),
    projectType: formData.get("projectType"),
  });

  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Não foi possível criar a conta.",
    };
  }

  try {
    const now = new Date().toISOString();
    const passwordHash = await hashPassword(parsed.data.password);

    const user = await updateDb((db) => {
      const emailExists = db.users.some(
        (item) => item.email.toLowerCase() === normalizedEmail,
      );

      if (emailExists) {
        throw new Error("Já existe uma conta com esse e-mail.");
      }

      const role =
        normalizedEmail === ownerEmail || db.users.length === 0 ? UserRole.ADMIN : UserRole.CLIENT;
      const newUser = {
        id: createId("usr"),
        name: parsed.data.name,
        email: normalizedEmail,
        passwordHash,
        role,
        phone: parsed.data.phone,
        company: parsed.data.company,
        address: parsed.data.address,
        projectType: parsed.data.projectType,
        avatarColor: "#ffc857",
        passwordChangedAt: now,
        createdAt: now,
        updatedAt: now,
      };

      db.users.push(newUser);
      pushAuditLog(db, {
        actorId: newUser.id,
        area: "auth",
        action: "register",
        summary:
          role === UserRole.ADMIN
            ? `Conta administrativa criada para ${newUser.email}.`
            : `Novo cliente cadastrado: ${newUser.name}.`,
      });
      return newUser;
    });

    await createUserSession(user.id);
    if (redirectTo) {
      redirect(redirectTo);
    }
    redirectAfterAuth(user.role);
  } catch (error) {
    rethrowNextRedirect(error);
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Não foi possível criar a conta.",
    };
  }
}

export async function logoutAction() {
  await destroySession();
  redirect("/");
}

export async function changeOwnPasswordAction(
  _previousState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser();
  const parsed = changePasswordSchema.safeParse({
    currentPassword: formData.get("currentPassword"),
    newPassword: formData.get("newPassword"),
    confirmPassword: formData.get("confirmPassword"),
  });

  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Não foi possível atualizar a senha.",
    };
  }

  try {
    const db = await readDb();
    const currentUser = db.users.find((candidate) => candidate.id === user.id);

    if (!currentUser) {
      throw new Error("Usuário não encontrado.");
    }

    const passwordMatches = await verifyPassword(
      parsed.data.currentPassword,
      currentUser.passwordHash,
    );

    if (!passwordMatches) {
      throw new Error("A senha atual não confere.");
    }

    const newPasswordHash = await hashPassword(parsed.data.newPassword);

    await updateDb((mutableDb) => {
      const mutableUser = mutableDb.users.find((candidate) => candidate.id === user.id);

      if (!mutableUser) {
        throw new Error("Usuário não encontrado.");
      }

      const now = new Date().toISOString();
      mutableUser.passwordHash = newPasswordHash;
      mutableUser.passwordChangedAt = now;
      mutableUser.updatedAt = now;
      pushAuditLog(mutableDb, {
        actorId: user.id,
        area: "security",
        action: "change_password",
        summary: `Senha atualizada por ${mutableUser.email}.`,
      });
    });

    revalidateAll();
    return {
      ok: true,
      message: "Senha atualizada com sucesso.",
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Não foi possível atualizar a senha.",
    };
  }
}

export async function createOrderAction(
  _previousState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser();
  const file = formData.get("modelFile");

  if (!(file instanceof File) || !file.name) {
    return {
      ok: false,
      error: "Envie um arquivo STL, OBJ ou 3MF para gerar o orçamento.",
    };
  }

  const fileExtension = getFileExtension(file.name);

  if (!allowed3dFormats.includes(fileExtension as (typeof allowed3dFormats)[number])) {
    return {
      ok: false,
      error: "Formato inválido. Use STL, OBJ ou 3MF.",
    };
  }

  const parsed = orderSchema.safeParse({
    title: formData.get("title"),
    type: formData.get("type"),
    description: formData.get("description"),
    materialId: formData.get("materialId"),
    color: formData.get("color"),
    finishLevel: formData.get("finishLevel"),
    priority: formData.get("priority"),
    quantity: formData.get("quantity"),
    boundingBoxX: formData.get("boundingBoxX"),
    boundingBoxY: formData.get("boundingBoxY"),
    boundingBoxZ: formData.get("boundingBoxZ"),
  });

  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Revise os dados do projeto.",
    };
  }

  try {
    const fileUrl = await saveUpload(file);

    await updateDb((db) => {
      const material = db.materials.find((item) => item.id === parsed.data.materialId);

      if (!material) {
        throw new Error("Material não encontrado.");
      }

      const quote = buildQuote({
        fileName: file.name,
        fileSizeBytes: file.size,
        dimensions: {
          x: parsed.data.boundingBoxX,
          y: parsed.data.boundingBoxY,
          z: parsed.data.boundingBoxZ,
        },
        quantity: parsed.data.quantity,
        finishLevel: parsed.data.finishLevel,
        priority: parsed.data.priority,
        material,
      });

      const now = new Date().toISOString();

      const order: DbOrder = {
        id: createId("ord"),
        orderNumber: generateOrderNumber(db.orders),
        title: parsed.data.title,
        type: parsed.data.type,
        description: parsed.data.description,
        fileName: file.name,
        fileUrl,
        fileFormat: fileExtension,
        fileSizeKb: Math.max(1, Math.round(file.size / 1024)),
        technology: quote.technology,
        quantity: parsed.data.quantity,
        color: parsed.data.color,
        finishLevel: parsed.data.finishLevel,
        urgencyMultiplier: quote.urgencyMultiplier,
        priority: parsed.data.priority,
        status: OrderStatus.WAITING_APPROVAL,
        paymentStatus: PaymentStatus.PENDING,
        boundingBoxX: parsed.data.boundingBoxX,
        boundingBoxY: parsed.data.boundingBoxY,
        boundingBoxZ: parsed.data.boundingBoxZ,
        estimatedVolumeCm3: quote.estimatedVolumeCm3,
        estimatedSupportCm3: quote.estimatedSupportCm3,
        estimatedHours: quote.estimatedHours,
        estimatedWeightGrams: quote.estimatedWeightGrams,
        estimatedMetersUsed: quote.estimatedMetersUsed,
        failureRisk: quote.failureRisk,
        needsManualReview: quote.needsManualReview,
        materialCost: quote.materialCost,
        machineCost: quote.machineCost,
        energyCost: quote.energyCost,
        laborCost: quote.laborCost,
        finishingCost: quote.finishingCost,
        packagingCost: quote.packagingCost,
        subtotal: quote.subtotal,
        marginPercent: quote.marginPercent,
        totalPrice: quote.totalPrice,
        realCost: quote.subtotal,
        grossMargin: Number((quote.totalPrice - quote.subtotal).toFixed(2)),
        dueDate: quote.dueDate.toISOString(),
        materialName: material.name,
        materialId: material.id,
        customerId: user.id,
        payments: [],
        comments: [],
        timeline: [
          {
            id: createId("tml"),
            actorId: user.id,
            label: "Pedido recebido",
            details: "Arquivo enviado pelo portal do cliente.",
            statusSnapshot: OrderStatus.RECEIVED,
            createdAt: now,
          },
          {
            id: createId("tml"),
            actorId: user.id,
            label: "Orçamento automático gerado",
            details: quote.needsManualReview
              ? "Análise automática concluída com recomendação de revisão manual."
              : "Preço e prazo calculados automaticamente.",
            statusSnapshot: OrderStatus.WAITING_APPROVAL,
            createdAt: now,
          },
        ],
        qualityChecks: [],
        createdAt: now,
        updatedAt: now,
      };

      db.orders.unshift(order);
      pushAuditLog(db, {
        actorId: user.id,
        area: "orders",
        action: "create",
        summary: `Novo pedido ${order.orderNumber} criado por ${user.name}.`,
      });
    });

    revalidateAll();
    redirect("/portal?message=Pedido%20criado%20com%20orcamento%20automatico.");
  } catch (error) {
    rethrowNextRedirect(error);
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Não foi possível criar o pedido.",
    };
  }
}

export async function approveOrderAction(formData: FormData) {
  const user = await requireUser();
  const orderId = String(formData.get("orderId") ?? "");

  await updateDb((db) => {
    const order = findOrder(db, orderId);

    if (!order || !canAccessOrder(order, user.id, user.role)) {
      throw new Error("Pedido não encontrado.");
    }

    const now = new Date().toISOString();
    order.status = OrderStatus.WAITING_PAYMENT;
    order.approvedByCustomerAt = now;
    order.updatedAt = now;
    order.timeline.unshift({
      id: createId("tml"),
      actorId: user.id,
      label: "Orçamento aprovado",
      details: "Cliente confirmou o início do pedido.",
      statusSnapshot: OrderStatus.WAITING_PAYMENT,
      createdAt: now,
    });
    pushAuditLog(db, {
      actorId: user.id,
      area: "orders",
      action: "approve",
      summary: `Pedido ${order.orderNumber} aprovado pelo cliente.`,
    });
  });

  revalidateAll();
}

export async function markOrderPaidAction(formData: FormData) {
  const user = await requireUser();
  const orderId = String(formData.get("orderId") ?? "");
  const method = String(formData.get("method") ?? "PIX") as PaymentMethod;

  await updateDb((db) => {
    const order = findOrder(db, orderId);

    if (!order || !canAccessOrder(order, user.id, user.role)) {
      throw new Error("Pedido não encontrado.");
    }

    const now = new Date().toISOString();
    const recommendedMachine = recommendMachine(order, db.machines);
    const queuePosition =
      db.orders.filter((item) => item.status === OrderStatus.QUEUED || item.status === OrderStatus.PRINTING)
        .length + 1;

    order.paymentStatus = PaymentStatus.PAID;
    order.paidAt = now;
    order.status = OrderStatus.QUEUED;
    order.queuePosition = queuePosition;
    order.assignedMachineId = recommendedMachine?.id ?? order.assignedMachineId;
    order.payments.unshift({
      id: createId("pay"),
      method,
      status: PaymentStatus.PAID,
      amount: order.totalPrice,
      paidAt: now,
      gateway: "Registro manual",
      referenceCode: createId("trx").toUpperCase(),
      createdAt: now,
      updatedAt: now,
    });
    order.timeline.unshift({
      id: createId("tml"),
      actorId: user.id,
      label: "Pagamento confirmado",
      details: recommendedMachine
        ? `Pedido enviado para fila com sugestão da máquina ${recommendedMachine.name}.`
        : "Pedido liberado para fila de produção.",
      statusSnapshot: OrderStatus.QUEUED,
      createdAt: now,
    });
    order.updatedAt = now;
    pushAuditLog(db, {
      actorId: user.id,
      area: "finance",
      action: "mark_paid",
      summary: `Pagamento confirmado para ${order.orderNumber} via ${method}.`,
    });
  });

  revalidateAll();
}

export async function createMaterialAction(
  _previousState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireRoles([UserRole.ADMIN, UserRole.SUPERVISOR]);
  const redirectTo = getSafeRedirectPath(formData);
  const fields = getMaterialFormFields(formData);

  const parsed = parseMaterialFormData(formData);

  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Não foi possível salvar o material.",
      fields,
    };
  }

  try {
    await updateDb((db) => {
      const material = buildMaterialPayload(parsed.data);
      db.materials.unshift(material);
      pushAuditLog(db, {
        actorId: user.id,
        area: "materials",
        action: "create",
        summary: `Material ${material.name} cadastrado com custo real atualizado.`,
      });
    });

    revalidateAll();
    if (redirectTo) {
      redirect(redirectTo);
    }
    return {
      ok: true,
      message: "Material salvo com cálculo automático de custo por grama e por metro.",
    };
  } catch (error) {
    rethrowNextRedirect(error);
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Não foi possível salvar o material.",
      fields,
    };
  }
}

export async function updateMaterialAction(
  _previousState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireRoles([UserRole.ADMIN, UserRole.SUPERVISOR]);
  const materialId = String(formData.get("materialId") ?? "");
  const redirectTo = getSafeRedirectPath(formData);
  const fields = getMaterialFormFields(formData);
  const parsed = parseMaterialFormData(formData);

  if (!materialId) {
    return {
      ok: false,
      error: "Material não encontrado para atualização.",
      fields,
    };
  }

  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Não foi possível atualizar o material.",
      fields,
    };
  }

  try {
    await updateDb((db) => {
      const material = db.materials.find((item) => item.id === materialId);

      if (!material) {
        throw new Error("Material não encontrado.");
      }

      const now = new Date().toISOString();
      const derived = getMaterialDerivedMetrics({
        purchasePrice: parsed.data.purchasePrice,
        spoolWeightGrams: parsed.data.spoolWeightGrams,
        spoolLengthMeters: parsed.data.spoolLengthMeters,
        stockAmount: parsed.data.stockAmount,
      });

      material.name = parsed.data.name;
      material.category = parsed.data.category;
      material.technology = parsed.data.technology;
      material.color = parsed.data.color;
      material.brand = parsed.data.brand;
      material.lot = parsed.data.lot;
      material.stockAmount = parsed.data.stockAmount;
      material.unit = parsed.data.technology === PrintTechnology.RESIN ? "ml" : "g";
      material.purchasePrice = parsed.data.purchasePrice;
      material.spoolWeightGrams = parsed.data.spoolWeightGrams;
      material.spoolLengthMeters =
        parsed.data.technology === PrintTechnology.FDM ? parsed.data.spoolLengthMeters : 0;
      material.filamentDiameterMm =
        parsed.data.technology === PrintTechnology.FDM ? parsed.data.filamentDiameterMm : undefined;
      material.costPerUnit = derived.costPerGram;
      material.costPerMeter =
        parsed.data.technology === PrintTechnology.FDM ? derived.costPerMeter : 0;
      material.minimumStock = parsed.data.minimumStock;
      material.supplier = parsed.data.supplier?.trim() || undefined;
      material.updatedAt = now;
      pushAuditLog(db, {
        actorId: user.id,
        area: "materials",
        action: "update",
        summary: `Material ${material.name} atualizado no estoque.`,
      });
    });

    revalidateAll();
    if (redirectTo) {
      redirect(redirectTo);
    }
    return {
      ok: true,
      message: "Material atualizado com novo cálculo automático de custo por grama e por metro.",
    };
  } catch (error) {
    rethrowNextRedirect(error);
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Não foi possível atualizar o material.",
      fields,
    };
  }
}

export async function deleteMaterialAction(
  _previousState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireRoles([UserRole.ADMIN, UserRole.SUPERVISOR]);
  const materialId = String(formData.get("materialId") ?? "");
  const redirectTo = getSafeRedirectPath(formData);

  if (!materialId) {
    return {
      ok: false,
      error: "Material não encontrado para exclusão.",
    };
  }

  try {
    await updateDb((db) => {
      const materialIndex = db.materials.findIndex((item) => item.id === materialId);

      if (materialIndex === -1) {
        throw new Error("Material não encontrado.");
      }

      const linkedOrders = db.orders.filter((order) => order.materialId === materialId);
      const linkedShowcaseItems = db.showcaseItems.filter((item) => item.materialId === materialId);

      if (linkedOrders.length > 0 || linkedShowcaseItems.length > 0) {
        throw new Error("Não é possível excluir um material já vinculado a pedidos ou produtos da vitrine.");
      }

      const material = db.materials[materialIndex];
      db.materials.splice(materialIndex, 1);
      pushAuditLog(db, {
        actorId: user.id,
        area: "materials",
        action: "delete",
        summary: `Material ${material.name} excluído do cadastro.`,
      });
    });

    revalidateAll();
    if (redirectTo) {
      redirect(redirectTo);
    }
    return {
      ok: true,
      message: "Material excluído com sucesso.",
    };
  } catch (error) {
    rethrowNextRedirect(error);
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Não foi possível excluir o material.",
    };
  }
}

export async function createMachineAction(
  _previousState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireRoles([UserRole.ADMIN, UserRole.SUPERVISOR]);

  const parsed = parseMachineFormData(formData);

  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Não foi possível salvar a impressora.",
    };
  }

  try {
    await updateDb((db) => {
      const now = new Date().toISOString();
      const machine = {
        id: createId("mac"),
        name: parsed.data.name,
        model: parsed.data.model,
        technology: parsed.data.technology,
        buildVolumeX: parsed.data.buildVolumeX,
        buildVolumeY: parsed.data.buildVolumeY,
        buildVolumeZ: parsed.data.buildVolumeZ,
        supportedMaterialNames: parsed.data.supportedMaterialNames,
        status: MachineStatus.AVAILABLE,
        responsibleOperator: undefined,
        availableHours: 24,
        failureRate: 0,
        preventiveMaintenanceDays: 30,
        lastMaintenanceAt: undefined,
        nozzleTemp: undefined,
        bedTemp: undefined,
        progressPercent: 0,
        timeRemainingMinutes: 0,
        webcamUrl: "/printer-cam.svg",
        purchasePrice: parsed.data.purchasePrice,
        amountPaid: parsed.data.amountPaid,
        purchasedAt: normalizeOptionalIsoDate(parsed.data.purchasedAt) ?? now,
        location: parsed.data.location?.trim() || undefined,
        notes: parsed.data.notes?.trim() || undefined,
        maintenanceRecords: [],
        createdAt: now,
        updatedAt: now,
      };
      db.machines.unshift(machine);
      pushAuditLog(db, {
        actorId: user.id,
        area: "machines",
        action: "create",
        summary: `Impressora ${machine.name} cadastrada.`,
      });
    });

    revalidateAll();
    return {
      ok: true,
      message: "Impressora cadastrada com sucesso.",
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Não foi possível salvar a impressora.",
    };
  }
}

export async function updateMachineAction(
  _previousState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireRoles([UserRole.ADMIN, UserRole.SUPERVISOR]);
  const machineId = String(formData.get("machineId") ?? "");
  const parsed = parseMachineFormData(formData);

  if (!machineId) {
    return {
      ok: false,
      error: "Impressora não encontrada para atualização.",
    };
  }

  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Não foi possível atualizar a impressora.",
    };
  }

  try {
    await updateDb((db) => {
      const machine = db.machines.find((item) => item.id === machineId);

      if (!machine) {
        throw new Error("Impressora não encontrada.");
      }

      machine.name = parsed.data.name;
      machine.model = parsed.data.model;
      machine.technology = parsed.data.technology;
      machine.buildVolumeX = parsed.data.buildVolumeX;
      machine.buildVolumeY = parsed.data.buildVolumeY;
      machine.buildVolumeZ = parsed.data.buildVolumeZ;
      machine.supportedMaterialNames = parsed.data.supportedMaterialNames;
      machine.purchasePrice = parsed.data.purchasePrice;
      machine.amountPaid = parsed.data.amountPaid;
      machine.purchasedAt = normalizeOptionalIsoDate(parsed.data.purchasedAt) ?? machine.purchasedAt;
      machine.location = parsed.data.location?.trim() || undefined;
      machine.notes = parsed.data.notes?.trim() || undefined;
      machine.updatedAt = new Date().toISOString();
      pushAuditLog(db, {
        actorId: user.id,
        area: "machines",
        action: "update",
        summary: `Impressora ${machine.name} atualizada.`,
      });
    });

    revalidateAll();
    return {
      ok: true,
      message: "Impressora atualizada com sucesso.",
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Não foi possível atualizar a impressora.",
    };
  }
}

export async function deleteMachineAction(
  _previousState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireRoles([UserRole.ADMIN, UserRole.SUPERVISOR]);
  const machineId = String(formData.get("machineId") ?? "");

  if (!machineId) {
    return {
      ok: false,
      error: "Impressora não encontrada para exclusão.",
    };
  }

  try {
    await updateDb((db) => {
      const machineIndex = db.machines.findIndex((item) => item.id === machineId);

      if (machineIndex === -1) {
        throw new Error("Impressora não encontrada.");
      }

      const activeLinkedOrders = db.orders.filter(
        (order) =>
          order.assignedMachineId === machineId && machineDeletionLockedStatuses.has(order.status),
      );
      const activeLinkedShowcaseOrders = db.showcaseInquiries.filter(
        (inquiry) =>
          inquiry.assignedMachineId === machineId &&
          inquiry.status === "CLOSED" &&
          inquiry.orderStage !== "COMPLETED" &&
          inquiry.orderStage !== "CANCELED",
      );

      if (activeLinkedOrders.length > 0 || activeLinkedShowcaseOrders.length > 0) {
        throw new Error("Não é possível excluir uma impressora com pedidos ativos vinculados.");
      }

      const machine = db.machines[machineIndex];
      db.machines.splice(machineIndex, 1);
      pushAuditLog(db, {
        actorId: user.id,
        area: "machines",
        action: "delete",
        summary: `Impressora ${machine.name} excluída do cadastro.`,
      });
    });

    revalidateAll();
    return {
      ok: true,
      message: "Impressora excluída com sucesso.",
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Não foi possível excluir a impressora.",
    };
  }
}

export async function createExpenseAction(
  _previousState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireRoles([UserRole.ADMIN, UserRole.SUPERVISOR]);
  const parsed = parseExpenseFormData(formData);

  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Não foi possível lançar o gasto.",
    };
  }

  try {
    await updateDb((db) => {
      const expense = buildExpensePayload(parsed.data);
      db.expenses.unshift(expense);
      pushAuditLog(db, {
        actorId: user.id,
        area: "finance",
        action: "create_expense",
        summary: `Gasto lançado: ${expense.title}.`,
      });
    });

    revalidateAll();
    return {
      ok: true,
      message: "Gasto lançado com sucesso.",
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Não foi possível lançar o gasto.",
    };
  }
}

export async function createPayableAction(
  _previousState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireRoles([UserRole.ADMIN, UserRole.SUPERVISOR]);
  const parsed = parsePayableFormData(formData);

  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Não foi possível lançar a conta a pagar.",
    };
  }

  try {
    await updateDb((db) => {
      const payable = buildPayablePayload(parsed.data);
      db.payables.unshift(payable);
      pushAuditLog(db, {
        actorId: user.id,
        area: "finance",
        action: "create_payable",
        summary: `Conta a pagar lançada: ${payable.title}.`,
      });
    });

    revalidateAll();
    return {
      ok: true,
      message: "Conta a pagar lançada com sucesso.",
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Não foi possível lançar a conta a pagar.",
    };
  }
}

export async function updatePayableStatusAction(formData: FormData) {
  const user = await requireRoles([UserRole.ADMIN, UserRole.SUPERVISOR]);
  const payableId = String(formData.get("payableId") ?? "");
  const parsedStatus = payableStatusSchema.safeParse(formData.get("status"));

  if (!payableId || !parsedStatus.success) {
    throw new Error("Conta a pagar não encontrada.");
  }

  const nextStatus = parsedStatus.data as DbPayableStatus;

  await updateDb((db) => {
    const payable = db.payables.find((entry) => entry.id === payableId);

    if (!payable) {
      throw new Error("Conta a pagar não encontrada.");
    }

    const now = new Date().toISOString();
    payable.status = nextStatus;
    payable.paidAt = nextStatus === "PAID" ? now : undefined;
    payable.updatedAt = now;
    pushAuditLog(db, {
      actorId: user.id,
      area: "finance",
      action: "update_payable_status",
      summary: `Conta ${payable.title} movida para ${nextStatus}.`,
    });
  });

  revalidateAll();
}

export async function deletePayableAction(formData: FormData) {
  const user = await requireRoles([UserRole.ADMIN, UserRole.SUPERVISOR]);
  const payableId = String(formData.get("payableId") ?? "");

  if (!payableId) {
    throw new Error("Conta a pagar não encontrada.");
  }

  await updateDb((db) => {
    const payableIndex = db.payables.findIndex((entry) => entry.id === payableId);

    if (payableIndex === -1) {
      throw new Error("Conta a pagar não encontrada.");
    }

    const payable = db.payables[payableIndex];
    db.payables.splice(payableIndex, 1);
    pushAuditLog(db, {
      actorId: user.id,
      area: "finance",
      action: "delete_payable",
      summary: `Conta removida: ${payable.title}.`,
    });
  });

  revalidateAll();
}

export async function deleteExpenseAction(formData: FormData) {
  const user = await requireRoles([UserRole.ADMIN, UserRole.SUPERVISOR]);
  const expenseId = String(formData.get("expenseId") ?? "");

  if (!expenseId) {
    throw new Error("Gasto não encontrado.");
  }

  await updateDb((db) => {
    const expenseIndex = db.expenses.findIndex((expense) => expense.id === expenseId);

    if (expenseIndex === -1) {
      throw new Error("Gasto não encontrado.");
    }

    const expense = db.expenses[expenseIndex];
    db.expenses.splice(expenseIndex, 1);
    pushAuditLog(db, {
      actorId: user.id,
      area: "finance",
      action: "delete_expense",
      summary: `Gasto removido: ${expense.title}.`,
    });
  });

  revalidateAll();
}

export async function deleteBackupSnapshotAction(formData: FormData) {
  await requireRoles([UserRole.ADMIN, UserRole.SUPERVISOR]);
  const fileName = String(formData.get("fileName") ?? "").trim();

  if (!fileName) {
    redirect(buildAdminSummaryUrl("Snapshot do sistema não encontrado.", "error"));
  }

  try {
    const deleted = await deleteBackupSnapshot(fileName);

    if (!deleted) {
      redirect(buildAdminSummaryUrl("Snapshot do sistema não encontrado.", "error"));
    }

    revalidateAll();
    redirect(buildAdminSummaryUrl("Snapshot do sistema excluído com sucesso."));
  } catch (error) {
    rethrowNextRedirect(error);
    redirect(
      buildAdminSummaryUrl(
        error instanceof Error
          ? error.message
          : "Não foi possível excluir o snapshot do sistema.",
        "error",
      ),
    );
  }
}

export async function createBackupSnapshotAction() {
  const user = await requireRoles([UserRole.ADMIN, UserRole.SUPERVISOR]);

  try {
    await updateDb((db) => {
      pushAuditLog(db, {
        actorId: user.id,
        area: "backup",
        action: "create_snapshot",
        summary: "Snapshot manual criado pelo admin.",
        entityType: "backup",
      });
    });
    revalidateAll();
    redirect(buildAdminSummaryUrl("Snapshot manual criado com sucesso."));
  } catch (error) {
    rethrowNextRedirect(error);
    redirect(
      buildAdminSummaryUrl(
        error instanceof Error
          ? error.message
          : "Não foi possível criar o snapshot manual do sistema.",
        "error",
      ),
    );
  }
}

export async function restoreBackupSnapshotAction(formData: FormData) {
  const user = await requireRoles([UserRole.ADMIN]);
  const fileName = String(formData.get("fileName") ?? "").trim();

  if (!fileName) {
    redirect(buildAdminSummaryUrl("Snapshot do sistema não encontrado.", "error"));
  }

  try {
    const restored = await restoreBackupSnapshot(fileName);

    if (!restored) {
      redirect(buildAdminSummaryUrl("Snapshot do sistema não encontrado.", "error"));
    }

    await updateDb((db) => {
      pushAuditLog(db, {
        actorId: user.id,
        area: "backup",
        action: "restore_snapshot",
        summary: `Snapshot restaurado: ${fileName}.`,
        entityType: "backup",
        entityId: fileName,
      });
    });
    revalidateAll();
    redirect(buildAdminSummaryUrl("Snapshot restaurado com sucesso."));
  } catch (error) {
    rethrowNextRedirect(error);
    redirect(
      buildAdminSummaryUrl(
        error instanceof Error
          ? error.message
          : "Não foi possível restaurar o snapshot do sistema.",
        "error",
      ),
    );
  }
}

export async function createShowcaseItemAction(
  _previousState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireRoles([UserRole.ADMIN, UserRole.SUPERVISOR]);
  const fields = getShowcaseItemFormFields(formData);
  const parsed = parseShowcaseItemFormData(formData);

  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Não foi possível salvar o item da vitrine.",
      fields,
    };
  }

  try {
    const uploadedImageUrl = await resolveShowcaseImageUrl(formData);
    const uploadedVideoUrl = await resolveShowcaseVideoUrl(formData);
    const galleryImageUrls = await resolveShowcaseGalleryImageUrls(formData);
    await updateDb((db) => {
      const materialSelection = resolveShowcaseMaterialSelection(db, parsed.data);
      ensureShowcaseLibraryExists(db, parsed.data.libraryId);
      const item = buildShowcaseItemPayload({
        ...parsed.data,
        ...materialSelection,
        imageUrl: uploadedImageUrl ?? parsed.data.imageUrl,
        videoUrl: uploadedVideoUrl ?? parsed.data.videoUrl,
        galleryImageUrls,
      });
      db.showcaseItems.unshift(item);
      pushAuditLog(db, {
        actorId: user.id,
        area: "showcase",
        action: "create_item",
        summary: `Produto da vitrine cadastrado: ${item.name}.`,
        entityType: "showcase_item",
        entityId: item.id,
        details: item.productionChecklist ? "Checklist de produção configurado." : undefined,
      });
    });

    revalidateAll();
    redirect(buildAdminShowcaseSectionUrl("Item da vitrine salvo com sucesso."));
  } catch (error) {
    rethrowNextRedirect(error);
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Não foi possível salvar o item da vitrine.",
      fields,
    };
  }
}

export async function updateShowcaseItemAction(
  _previousState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireRoles([UserRole.ADMIN, UserRole.SUPERVISOR]);
  const fields = getShowcaseItemFormFields(formData);
  const itemId = String(formData.get("itemId") ?? "");
  const parsed = parseShowcaseItemFormData(formData);
  const requestedRestock = Number(formData.get("restockQuantity") ?? "0");
  const restockQuantity =
    Number.isFinite(requestedRestock) && requestedRestock > 0
      ? Math.round(requestedRestock)
      : 0;

  if (!itemId) {
    return {
      ok: false,
      error: "Item da vitrine não encontrado para atualização.",
      fields,
    };
  }

  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Não foi possível atualizar o item da vitrine.",
      fields,
    };
  }

  try {
    const uploadedImageUrl = await resolveShowcaseImageUrl(formData);
    const uploadedVideoUrl = await resolveShowcaseVideoUrl(formData);
    const galleryImageUrls = await resolveShowcaseGalleryImageUrls(formData);
    await updateDb((db) => {
      const item = db.showcaseItems.find((candidate) => candidate.id === itemId);

      if (!item) {
        throw new Error("Item da vitrine não encontrado.");
      }

      const materialSelection = resolveShowcaseMaterialSelection(db, parsed.data);
      ensureShowcaseLibraryExists(db, parsed.data.libraryId);

      item.name = parsed.data.name;
      item.category = parsed.data.category;
      item.libraryId = parsed.data.libraryId?.trim() || undefined;
      item.tagline = parsed.data.tagline?.trim() || undefined;
      item.description = parsed.data.description;
      item.price = parsed.data.price;
      item.productionChecklist = parsed.data.productionChecklist?.trim() || undefined;
      item.materialLabel = materialSelection.materialLabel;
      item.materialId = materialSelection.materialId;
      item.colorOptions = parsed.data.colorOptions;
      item.sizeOptions = parsed.data.sizeOptions;
      item.finishOptions = parsed.data.finishOptions;
      item.badges = parsed.data.badges;
      item.deliveryModes = parsed.data.deliveryModes as ShowcaseDeliveryMode[];
      item.dimensionSummary = parsed.data.dimensionSummary?.trim() || undefined;
      item.shippingSummary = parsed.data.shippingSummary?.trim() || undefined;
      item.promotionLabel = parsed.data.promotionLabel?.trim() || undefined;
      item.compareAtPrice = parsed.data.compareAtPrice;
      item.couponCode = parsed.data.couponCode?.trim() || undefined;
      item.couponDiscountPercent = parsed.data.couponDiscountPercent;
      item.seoTitle = parsed.data.seoTitle?.trim() || undefined;
      item.seoDescription = parsed.data.seoDescription?.trim() || undefined;
      item.seoKeywords = parsed.data.seoKeywords;
      item.leadTimeDays =
        parsed.data.fulfillmentType === "MADE_TO_ORDER" ? parsed.data.leadTimeDays : 0;
      item.estimatedPrintHours = parsed.data.estimatedPrintHours;
      item.estimatedMaterialGrams = parsed.data.estimatedMaterialGrams;
      item.fulfillmentType = parsed.data.fulfillmentType;
      item.stockQuantity =
        parsed.data.fulfillmentType === "STOCK"
          ? parsed.data.stockQuantity + restockQuantity
          : 0;
      item.imageUrl = uploadedImageUrl ?? (parsed.data.imageUrl?.trim() || undefined);
      item.videoUrl = uploadedVideoUrl ?? (parsed.data.videoUrl?.trim() || undefined);
      item.galleryImageUrls = galleryImageUrls;
      item.variants = parsed.data.variants;
      item.featured = parsed.data.featured;
      item.active = parsed.data.active;
      item.updatedAt = new Date().toISOString();
      pushAuditLog(db, {
        actorId: user.id,
        area: "showcase",
        action: "update_item",
        summary: `Produto da vitrine atualizado: ${item.name}.`,
        entityType: "showcase_item",
        entityId: item.id,
        details: parsed.data.productionChecklist?.trim() ? "Checklist de produção configurado." : undefined,
      });
    });

    revalidateAll();
    redirect(
      buildAdminShowcaseSectionUrl(
        parsed.data.fulfillmentType === "STOCK" && restockQuantity > 0
          ? "Item da vitrine atualizado com reposição de estoque aplicada."
          : "Item da vitrine atualizado com sucesso.",
      ),
    );
  } catch (error) {
    rethrowNextRedirect(error);
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Não foi possível atualizar o item da vitrine.",
      fields,
    };
  }
}

export async function deleteShowcaseItemAction(
  _previousState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireRoles([UserRole.ADMIN, UserRole.SUPERVISOR]);
  const itemId = String(formData.get("itemId") ?? "");

  if (!itemId) {
    return {
      ok: false,
      error: "Item da vitrine não encontrado para exclusão.",
    };
  }

  try {
    await updateDb((db) => {
      const itemIndex = db.showcaseItems.findIndex((candidate) => candidate.id === itemId);

      if (itemIndex === -1) {
        throw new Error("Item da vitrine não encontrado.");
      }

      const item = db.showcaseItems[itemIndex];

      if (item.syncSource?.mode === "FILESYSTEM") {
        throw new Error("Esse item veio da pasta sincronizada. Para removê-lo, apague a pasta/arquivo de origem ou desative a exibição do produto.");
      }

      db.showcaseItems.splice(itemIndex, 1);
      pushAuditLog(db, {
        actorId: user.id,
        area: "showcase",
        action: "delete_item",
        summary: `Produto da vitrine excluído: ${item.name}.`,
        entityType: "showcase_item",
        entityId: item.id,
      });
    });

    revalidateAll();
    redirect(buildAdminShowcaseSectionUrl("Item da vitrine excluído com sucesso."));
  } catch (error) {
    rethrowNextRedirect(error);
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Não foi possível excluir o item da vitrine.",
    };
  }
}

export async function createShowcaseLibraryAction(
  _previousState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireRoles([UserRole.ADMIN, UserRole.SUPERVISOR]);
  const fields = getShowcaseLibraryFormFields(formData);
  const parsed = parseShowcaseLibraryFormData(formData);

  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Nao foi possivel salvar a biblioteca.",
      fields,
    };
  }

  try {
    const uploadedCoverImageUrl = await resolveShowcaseLibraryCoverImageUrl(formData);

    await updateDb((db) => {
      const library = buildShowcaseLibraryPayload({
        ...parsed.data,
        coverImageUrl: uploadedCoverImageUrl ?? parsed.data.coverImageUrl,
      });
      db.showcaseLibraries.push(library);
      pushAuditLog(db, {
        actorId: user.id,
        area: "showcase_library",
        action: "create_library",
        summary: `Biblioteca cadastrada: ${library.name}.`,
        entityType: "showcase_library",
        entityId: library.id,
        details: library.active ? "Biblioteca ativa." : "Biblioteca salva como inativa.",
      });
    });

    revalidateAll();
    redirect(buildAdminLibrariesSectionUrl("Biblioteca salva com sucesso."));
  } catch (error) {
    rethrowNextRedirect(error);
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Nao foi possivel salvar a biblioteca.",
      fields,
    };
  }
}

export async function updateShowcaseLibraryAction(
  _previousState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireRoles([UserRole.ADMIN, UserRole.SUPERVISOR]);
  const fields = getShowcaseLibraryFormFields(formData);
  const libraryId = String(formData.get("libraryId") ?? "").trim();
  const parsed = parseShowcaseLibraryFormData(formData);

  if (!libraryId) {
    return {
      ok: false,
      error: "Biblioteca nao encontrada para atualizacao.",
      fields,
    };
  }

  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Nao foi possivel atualizar a biblioteca.",
      fields,
    };
  }

  try {
    const uploadedCoverImageUrl = await resolveShowcaseLibraryCoverImageUrl(formData);

    await updateDb((db) => {
      const library = db.showcaseLibraries.find((entry) => entry.id === libraryId);

      if (!library) {
        throw new Error("Biblioteca nao encontrada.");
      }

      library.name = parsed.data.name.trim();
      library.description = parsed.data.description?.trim() || undefined;
      library.coverImageUrl = uploadedCoverImageUrl ?? (parsed.data.coverImageUrl?.trim() || undefined);
      library.sortOrder = parsed.data.sortOrder;
      library.active = parsed.data.active;
      library.updatedAt = new Date().toISOString();

      pushAuditLog(db, {
        actorId: user.id,
        area: "showcase_library",
        action: "update_library",
        summary: `Biblioteca atualizada: ${library.name}.`,
        entityType: "showcase_library",
        entityId: library.id,
      });
    });

    revalidateAll();
    redirect(buildAdminLibrariesSectionUrl("Biblioteca atualizada com sucesso."));
  } catch (error) {
    rethrowNextRedirect(error);
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Nao foi possivel atualizar a biblioteca.",
      fields,
    };
  }
}

export async function deleteShowcaseLibraryAction(
  _previousState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireRoles([UserRole.ADMIN, UserRole.SUPERVISOR]);
  const libraryId = String(formData.get("libraryId") ?? "").trim();

  if (!libraryId) {
    return {
      ok: false,
      error: "Biblioteca nao encontrada para exclusao.",
    };
  }

  try {
    await updateDb((db) => {
      const libraryIndex = db.showcaseLibraries.findIndex((entry) => entry.id === libraryId);

      if (libraryIndex === -1) {
        throw new Error("Biblioteca nao encontrada.");
      }

      const library = db.showcaseLibraries[libraryIndex];
      if (library.syncSource?.mode === "FILESYSTEM") {
        throw new Error("Essa biblioteca veio da pasta sincronizada. Para removê-la, apague a pasta de origem ou desative a biblioteca.");
      }

      db.showcaseLibraries.splice(libraryIndex, 1);
      const now = new Date().toISOString();
      const linkedItems = db.showcaseItems.filter((item) => item.libraryId === library.id);

      for (const item of linkedItems) {
        item.libraryId = undefined;
        item.updatedAt = now;
      }

      pushAuditLog(db, {
        actorId: user.id,
        area: "showcase_library",
        action: "delete_library",
        summary: `Biblioteca removida: ${library.name}.`,
        entityType: "showcase_library",
        entityId: library.id,
        details:
          linkedItems.length > 0
            ? `${linkedItems.length} produtos ficaram sem vinculo de biblioteca.`
            : undefined,
      });
    });

    revalidateAll();
    redirect(buildAdminLibrariesSectionUrl("Biblioteca removida com sucesso."));
  } catch (error) {
    rethrowNextRedirect(error);
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Nao foi possivel excluir a biblioteca.",
    };
  }
}

export async function bulkUpdateShowcaseItemsAction(formData: FormData) {
  const user = await requireRoles([UserRole.ADMIN, UserRole.SUPERVISOR]);
  const itemIds = formData
    .getAll("itemIds")
    .map((entry) => entry.toString().trim())
    .filter(Boolean);
  const operation = String(formData.get("operation") ?? "").trim();

  if (!itemIds.length) {
    redirect(buildAdminShowcaseSectionUrl("Selecione ao menos um produto da vitrine."));
  }

  if (!["feature", "unfeature", "activate", "deactivate"].includes(operation)) {
    redirect(buildAdminShowcaseSectionUrl("Escolha uma ação em lote válida."));
  }

  await updateDb((db) => {
    const selectedItems = db.showcaseItems.filter((item) => itemIds.includes(item.id));

    if (!selectedItems.length) {
      throw new Error("Nenhum produto selecionado foi encontrado.");
    }

    const now = new Date().toISOString();

    for (const item of selectedItems) {
      if (operation === "feature") {
        item.featured = true;
      }
      if (operation === "unfeature") {
        item.featured = false;
      }
      if (operation === "activate") {
        item.active = true;
      }
      if (operation === "deactivate") {
        item.active = false;
      }
      item.updatedAt = now;
    }

    pushAuditLog(db, {
      actorId: user.id,
      area: "showcase",
      action: "bulk_update_items",
      summary: `${selectedItems.length} produtos atualizados em lote.`,
      entityType: "showcase_item",
      details: `Ação aplicada: ${operation}.`,
    });
  });

  revalidateAll();
  redirect(buildAdminShowcaseSectionUrl("Ação em lote aplicada aos produtos selecionados."));
}

export async function updateStorefrontSettingsAction(
  _previousState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireRoles([UserRole.ADMIN, UserRole.SUPERVISOR]);
  const fields = getStorefrontSettingsFormFields(formData);
  const parsed = parseStorefrontSettingsFormData(formData);

  if (!parsed.success) {
    return {
      ok: false,
      error:
        parsed.error.issues[0]?.message ?? "Nao foi possivel salvar as configuracoes da loja.",
      fields,
    };
  }

  try {
    await updateDb((db) => {
      db.storefrontSettings = buildStorefrontSettingsPayload(parsed.data);
      pushAuditLog(db, {
        actorId: user.id,
        area: "storefront",
        action: "update_settings",
        summary: "Configuracoes publicas da loja atualizadas.",
      });
    });

    revalidateAll();
    redirect(buildAdminSettingsSectionUrl("Configuracoes da loja salvas com sucesso."));
  } catch (error) {
    rethrowNextRedirect(error);
    return {
      ok: false,
      error:
        error instanceof Error
          ? error.message
          : "Nao foi possivel salvar as configuracoes da loja.",
      fields,
    };
  }
}

export async function createShowcaseTestimonialAction(
  _previousState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireRoles([UserRole.ADMIN, UserRole.SUPERVISOR]);
  const fields = getTestimonialFormFields(formData);
  const parsed = parseTestimonialFormData(formData);

  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Nao foi possivel salvar o depoimento.",
      fields,
    };
  }

  try {
    const uploadedImageUrl = await resolveShowcaseTestimonialImageUrl(formData);

    await updateDb((db) => {
      const testimonial = buildShowcaseTestimonialPayload({
        ...parsed.data,
        imageUrl: uploadedImageUrl ?? parsed.data.imageUrl,
      });
      db.showcaseTestimonials.unshift(testimonial);
      pushAuditLog(db, {
        actorId: user.id,
        area: "storefront",
        action: "create_testimonial",
        summary: `Depoimento cadastrado para ${testimonial.customerName}.`,
      });
    });

    revalidateAll();
    redirect(buildAdminSettingsSectionUrl("Depoimento salvo com sucesso."));
  } catch (error) {
    rethrowNextRedirect(error);
    return {
      ok: false,
      error:
        error instanceof Error ? error.message : "Nao foi possivel salvar o depoimento.",
      fields,
    };
  }
}

export async function updateShowcaseTestimonialAction(
  _previousState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireRoles([UserRole.ADMIN, UserRole.SUPERVISOR]);
  const fields = getTestimonialFormFields(formData);
  const testimonialId = String(formData.get("testimonialId") ?? "");
  const parsed = parseTestimonialFormData(formData);

  if (!testimonialId) {
    return {
      ok: false,
      error: "Depoimento nao encontrado para atualizacao.",
      fields,
    };
  }

  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Nao foi possivel atualizar o depoimento.",
      fields,
    };
  }

  try {
    const uploadedImageUrl = await resolveShowcaseTestimonialImageUrl(formData);

    await updateDb((db) => {
      const testimonial = db.showcaseTestimonials.find((entry) => entry.id === testimonialId);

      if (!testimonial) {
        throw new Error("Depoimento nao encontrado.");
      }

      testimonial.customerName = parsed.data.customerName;
      testimonial.city = parsed.data.city?.trim() || undefined;
      testimonial.role = parsed.data.role?.trim() || undefined;
      testimonial.instagramHandle = parsed.data.instagramHandle?.trim() || undefined;
      testimonial.productName = parsed.data.productName?.trim() || undefined;
      testimonial.quote = parsed.data.quote;
      testimonial.imageUrl = uploadedImageUrl ?? (parsed.data.imageUrl?.trim() || undefined);
      testimonial.featured = parsed.data.featured;
      testimonial.sortOrder = parsed.data.sortOrder;
      testimonial.updatedAt = new Date().toISOString();
      pushAuditLog(db, {
        actorId: user.id,
        area: "storefront",
        action: "update_testimonial",
        summary: `Depoimento atualizado: ${testimonial.customerName}.`,
      });
    });

    revalidateAll();
    redirect(buildAdminSettingsSectionUrl("Depoimento atualizado com sucesso."));
  } catch (error) {
    rethrowNextRedirect(error);
    return {
      ok: false,
      error:
        error instanceof Error ? error.message : "Nao foi possivel atualizar o depoimento.",
      fields,
    };
  }
}

export async function deleteShowcaseTestimonialAction(
  _previousState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireRoles([UserRole.ADMIN, UserRole.SUPERVISOR]);
  const testimonialId = String(formData.get("testimonialId") ?? "");

  if (!testimonialId) {
    return {
      ok: false,
      error: "Depoimento nao encontrado para exclusao.",
    };
  }

  try {
    await updateDb((db) => {
      const testimonialIndex = db.showcaseTestimonials.findIndex(
        (entry) => entry.id === testimonialId,
      );

      if (testimonialIndex === -1) {
        throw new Error("Depoimento nao encontrado.");
      }

      const [testimonial] = db.showcaseTestimonials.splice(testimonialIndex, 1);
      pushAuditLog(db, {
        actorId: user.id,
        area: "storefront",
        action: "delete_testimonial",
        summary: `Depoimento removido: ${testimonial.customerName}.`,
      });
    });

    revalidateAll();
    redirect(buildAdminSettingsSectionUrl("Depoimento removido com sucesso."));
  } catch (error) {
    rethrowNextRedirect(error);
    return {
      ok: false,
      error:
        error instanceof Error ? error.message : "Nao foi possivel excluir o depoimento.",
    };
  }
}

export async function createShowcaseInquiryAction(
  _previousState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireRoles([UserRole.ADMIN, UserRole.SUPERVISOR]);
  const fields = getShowcaseInquiryFormFields(formData);
  const parsed = parseShowcaseInquiryFormData(formData);

  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Não foi possível lançar o pedido manual.",
      fields,
    };
  }

  try {
    await updateDb(async (db) => {
      const item = db.showcaseItems.find((candidate) => candidate.id === parsed.data.itemId);

      if (!item) {
        throw new Error("Item da vitrine não encontrado.");
      }

      const now = new Date().toISOString();
      const customerName = parsed.data.customerName.trim();
      const customerPhone = parsed.data.customerPhone.trim();
      const customerEmail = parsed.data.customerEmail?.trim() || "";
      const status = parsed.data.status as ShowcaseInquiryStatus;
      const customer = await ensureCustomerRecord(db, {
        name: customerName,
        phone: customerPhone,
        email: customerEmail,
      });

      if (status === "CLOSED") {
        reserveShowcaseStock(item, parsed.data.quantity, now);
      }

      db.showcaseInquiries.unshift({
        id: createId("ldw"),
        itemId: item.id,
        itemName: item.name,
        orderNumber: status === "CLOSED" ? generateShowcaseOrderNumber(db.showcaseInquiries) : undefined,
        quantity: parsed.data.quantity,
        customerId: customer.id,
        customerName,
        customerEmail: isGeneratedCustomerEmail(customer.email) ? "" : customer.email,
        customerPhone,
        source: "MANUAL",
        notes: parsed.data.notes?.trim() || undefined,
        ownerEmail,
        whatsappNumber: ownerWhatsAppNumber,
          whatsappUrl: buildShowcaseWhatsAppUrl({
            itemName: item.name,
            quantity: parsed.data.quantity,
            fulfillmentType: item.fulfillmentType,
            customerName,
            customerPhone,
            estimatedTotal: item.price * parsed.data.quantity,
            notes: parsed.data.notes?.trim() || undefined,
            leadTimeLabel: getShowcaseLeadTimeText(item.fulfillmentType, item.leadTimeDays),
            couponCode: item.couponCode,
          }),
        status,
        tags: parsed.data.tags,
        leadTemperature: parsed.data.leadTemperature as ShowcaseLeadTemperature,
        followUpAt: normalizeOptionalIsoDate(parsed.data.followUpAt),
        lastContactAt: normalizeOptionalIsoDate(parsed.data.lastContactAt),
        nextAction: parsed.data.nextAction?.trim() || undefined,
        lastOutcome: parsed.data.lastOutcome?.trim() || undefined,
        lostReason: parsed.data.lostReason?.trim() || undefined,
        orderStage: status === "CLOSED" ? "RECEIVED" : undefined,
        plannedPrintMinutes: getPlannedMinutesFromHours(item.estimatedPrintHours * parsed.data.quantity),
        dueDate:
          status === "CLOSED"
            ? new Date(
                new Date(now).getTime() +
                  Math.max(item.leadTimeDays || 1, 1) * 24 * 60 * 60 * 1000,
              ).toISOString()
            : undefined,
        closedAt: status === "CLOSED" ? now : undefined,
        createdAt: now,
        updatedAt: now,
      });
      pushAuditLog(db, {
        actorId: user.id,
        area: "crm",
        action: "create_lead",
        summary: `Lead manual criado para ${customerName} em ${item.name}.`,
        entityType: "showcase_inquiry",
        entityId: db.showcaseInquiries[0]?.id,
        details: parsed.data.nextAction?.trim() || parsed.data.notes?.trim() || undefined,
      });
    });

    revalidateAll();
    return {
      ok: true,
      message: "Pedido manual do WhatsApp lançado com sucesso.",
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Não foi possível lançar o pedido manual.",
      fields,
    };
  }
}

export async function updateShowcaseInquiryAction(
  _previousState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireRoles([UserRole.ADMIN, UserRole.SUPERVISOR]);
  const inquiryId = String(formData.get("inquiryId") ?? "");
  const fields = getShowcaseInquiryFormFields(formData);
  const parsed = parseShowcaseInquiryFormData(formData);

  if (!inquiryId) {
    return {
      ok: false,
      error: "Pedido do WhatsApp não encontrado para edição.",
      fields,
    };
  }

  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Não foi possível atualizar o pedido do WhatsApp.",
      fields,
    };
  }

  try {
    await updateDb(async (db) => {
      const inquiry = db.showcaseInquiries.find((candidate) => candidate.id === inquiryId);

      if (!inquiry) {
        throw new Error("Pedido do WhatsApp não encontrado.");
      }

      const previousItem = db.showcaseItems.find((candidate) => candidate.id === inquiry.itemId);
      const nextItem = db.showcaseItems.find((candidate) => candidate.id === parsed.data.itemId);

      if (!nextItem) {
        throw new Error("Item da vitrine não encontrado.");
      }

      const now = new Date().toISOString();
      const nextStatus = parsed.data.status as ShowcaseInquiryStatus;
      const customerName = parsed.data.customerName.trim();
      const customerPhone = parsed.data.customerPhone.trim();
      const nextOrderStage =
        nextStatus === "CLOSED" ? (inquiry.orderStage ?? "RECEIVED") : undefined;
      const customer = await ensureCustomerRecord(db, {
        name: customerName,
        phone: customerPhone,
        email: parsed.data.customerEmail?.trim() || "",
      });

      if (hasReservedShowcaseStock(inquiry.status, inquiry.orderStage) && previousItem) {
        releaseShowcaseStock(previousItem, inquiry.quantity, now);
      }

      if (hasReservedShowcaseStock(nextStatus, nextOrderStage)) {
        reserveShowcaseStock(nextItem, parsed.data.quantity, now);
      }

      inquiry.itemId = nextItem.id;
      inquiry.itemName = nextItem.name;
      inquiry.quantity = parsed.data.quantity;
      inquiry.customerId = customer.id;
      inquiry.customerName = customerName;
      inquiry.customerEmail = isGeneratedCustomerEmail(customer.email) ? "" : customer.email;
      inquiry.customerPhone = customerPhone;
      inquiry.notes = parsed.data.notes?.trim() || undefined;
      inquiry.status = nextStatus;
      inquiry.tags = parsed.data.tags;
      inquiry.leadTemperature = parsed.data.leadTemperature as ShowcaseLeadTemperature;
      inquiry.followUpAt = normalizeOptionalIsoDate(parsed.data.followUpAt);
      inquiry.lastContactAt = normalizeOptionalIsoDate(parsed.data.lastContactAt);
      inquiry.nextAction = parsed.data.nextAction?.trim() || undefined;
      inquiry.lastOutcome = parsed.data.lastOutcome?.trim() || undefined;
      inquiry.lostReason = parsed.data.lostReason?.trim() || undefined;
      inquiry.orderStage = nextOrderStage;
      inquiry.plannedPrintMinutes = getPlannedMinutesFromHours(
        nextItem.estimatedPrintHours * parsed.data.quantity,
      );
      inquiry.assignedMachineId = nextStatus === "CLOSED" ? inquiry.assignedMachineId : undefined;
      inquiry.closedAt = nextStatus === "CLOSED" ? now : undefined;
        inquiry.whatsappUrl = buildShowcaseWhatsAppUrl({
          itemName: nextItem.name,
          quantity: parsed.data.quantity,
          fulfillmentType: nextItem.fulfillmentType,
          customerName,
          customerPhone,
          estimatedTotal: nextItem.price * parsed.data.quantity,
          notes: parsed.data.notes?.trim() || undefined,
          leadTimeLabel: getShowcaseLeadTimeText(nextItem.fulfillmentType, nextItem.leadTimeDays),
          couponCode: nextItem.couponCode,
        });
      if (nextStatus === "CLOSED") {
        applyShowcaseOperationalMetadata(db, inquiry, nextItem, now);
      } else {
        inquiry.orderNumber = undefined;
        inquiry.dueDate = undefined;
      }
      inquiry.updatedAt = now;
      pushAuditLog(db, {
        actorId: user.id,
        area: "crm",
        action: "update_lead",
        summary: `Lead de ${customerName} atualizado para ${nextStatus}.`,
        entityType: "showcase_inquiry",
        entityId: inquiry.id,
        details:
          parsed.data.lastOutcome?.trim() ||
          parsed.data.nextAction?.trim() ||
          parsed.data.notes?.trim() ||
          undefined,
      });
    });

    revalidateAll();
    return {
      ok: true,
      message: "Pedido do WhatsApp atualizado com sucesso.",
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Não foi possível atualizar o pedido do WhatsApp.",
      fields,
    };
  }
}

export async function deleteShowcaseInquiryAction(
  _previousState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireRoles([UserRole.ADMIN, UserRole.SUPERVISOR]);
  const inquiryId = String(formData.get("inquiryId") ?? "");

  if (!inquiryId) {
    return {
      ok: false,
      error: "Pedido do WhatsApp não encontrado para exclusão.",
    };
  }

  try {
    await updateDb((db) => {
      const inquiryIndex = db.showcaseInquiries.findIndex(
        (candidate) => candidate.id === inquiryId,
      );

      if (inquiryIndex === -1) {
        throw new Error("Pedido do WhatsApp não encontrado.");
      }

      const inquiry = db.showcaseInquiries[inquiryIndex];
      const item = db.showcaseItems.find((candidate) => candidate.id === inquiry.itemId);
      const now = new Date().toISOString();

      if (hasReservedShowcaseStock(inquiry.status, inquiry.orderStage) && item) {
        releaseShowcaseStock(item, inquiry.quantity, now);
      }

      db.showcaseInquiries.splice(inquiryIndex, 1);
      pushAuditLog(db, {
        actorId: user.id,
        area: "crm",
        action: "delete_lead",
        summary: `Lead de ${inquiry.customerName} excluído.`,
        entityType: "showcase_inquiry",
        entityId: inquiry.id,
      });
    });

    revalidateAll();
    return {
      ok: true,
      message: "Pedido do WhatsApp excluído com sucesso.",
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Não foi possível excluir o pedido do WhatsApp.",
    };
  }
}

export async function updateShowcaseInquiryStatusAction(formData: FormData) {
  const user = await requireRoles([UserRole.ADMIN, UserRole.SUPERVISOR]);
  const inquiryId = String(formData.get("inquiryId") ?? "");
  const parsedStatus = showcaseInquiryStatusSchema.safeParse(formData.get("status"));

  if (!inquiryId || !parsedStatus.success) {
    throw new Error("Lead da vitrine não encontrado.");
  }

  const nextStatus = parsedStatus.data as ShowcaseInquiryStatus;

  await updateDb((db) => {
    const inquiry = db.showcaseInquiries.find((candidate) => candidate.id === inquiryId);

    if (!inquiry) {
      throw new Error("Lead da vitrine não encontrado.");
    }

    const item = db.showcaseItems.find((candidate) => candidate.id === inquiry.itemId);
    const now = new Date().toISOString();
    const nextOrderStage = nextStatus === "CLOSED" ? (inquiry.orderStage ?? "RECEIVED") : undefined;

    if (
      item &&
      !hasReservedShowcaseStock(inquiry.status, inquiry.orderStage) &&
      hasReservedShowcaseStock(nextStatus, nextOrderStage)
    ) {
      reserveShowcaseStock(item, inquiry.quantity, now);
    }

    if (
      item &&
      hasReservedShowcaseStock(inquiry.status, inquiry.orderStage) &&
      !hasReservedShowcaseStock(nextStatus, nextOrderStage)
    ) {
      releaseShowcaseStock(item, inquiry.quantity, now);
    }

    inquiry.status = nextStatus;
    inquiry.orderStage = nextOrderStage;
    inquiry.assignedMachineId = nextStatus === "CLOSED" ? inquiry.assignedMachineId : undefined;
    inquiry.closedAt = nextStatus === "CLOSED" ? now : undefined;
    if (nextStatus === "NOT_CLOSED" && !inquiry.lostReason) {
      inquiry.lostReason = "Marcado como não fechado no painel.";
    }
    inquiry.lastContactAt = now;
    if (nextStatus === "CLOSED") {
      applyShowcaseOperationalMetadata(db, inquiry, item, now);
    } else {
      inquiry.orderNumber = undefined;
      inquiry.dueDate = undefined;
    }
    inquiry.updatedAt = now;
    pushAuditLog(db, {
      actorId: user.id,
      area: "crm",
      action: "update_lead_status",
      summary: `Lead de ${inquiry.customerName} marcado como ${nextStatus}.`,
      entityType: "showcase_inquiry",
      entityId: inquiry.id,
      details: inquiry.lostReason ?? inquiry.nextAction ?? undefined,
    });
  });

  revalidateAll();

  if (nextStatus === "CLOSED") {
    redirect("/admin?section=pedidos");
  }
}

export async function bulkUpdateShowcaseInquiryAction(formData: FormData) {
  const user = await requireRoles([UserRole.ADMIN, UserRole.SUPERVISOR]);
  const inquiryIds = formData
    .getAll("inquiryIds")
    .map((entry) => entry.toString().trim())
    .filter(Boolean);
  const operation = String(formData.get("operation") ?? "").trim();

  if (!inquiryIds.length) {
    redirect(buildAdminLeadsSectionUrl("Selecione ao menos um lead."));
  }

  const validOperations = new Set([
    "set_pending",
    "set_closed",
    "set_not_closed",
    "set_hot",
    "set_warm",
    "set_cold",
    "followup_today",
    "followup_tomorrow",
    "clear_followup",
  ]);

  if (!validOperations.has(operation)) {
    redirect(buildAdminLeadsSectionUrl("Escolha uma ação em lote válida."));
  }

  await updateDb((db) => {
    const now = new Date().toISOString();
    const selectedLeads = db.showcaseInquiries.filter((inquiry) => inquiryIds.includes(inquiry.id));

    if (!selectedLeads.length) {
      throw new Error("Nenhum lead selecionado foi encontrado.");
    }

    for (const inquiry of selectedLeads) {
      const item = db.showcaseItems.find((candidate) => candidate.id === inquiry.itemId);
      const previousReserved = hasReservedShowcaseStock(inquiry.status, inquiry.orderStage);

      if (operation === "set_pending" || operation === "set_closed" || operation === "set_not_closed") {
        const nextStatus =
          operation === "set_pending"
            ? "PENDING"
            : operation === "set_closed"
              ? "CLOSED"
              : "NOT_CLOSED";
        const nextOrderStage = nextStatus === "CLOSED" ? inquiry.orderStage ?? "RECEIVED" : undefined;
        const nextReserved = hasReservedShowcaseStock(nextStatus, nextOrderStage);

        if (item && previousReserved && !nextReserved) {
          releaseShowcaseStock(item, inquiry.quantity, now);
        }

        if (item && !previousReserved && nextReserved) {
          reserveShowcaseStock(item, inquiry.quantity, now);
        }

        inquiry.status = nextStatus;
        inquiry.orderStage = nextOrderStage;
        inquiry.closedAt = nextStatus === "CLOSED" ? now : undefined;
        inquiry.assignedMachineId = nextStatus === "CLOSED" ? inquiry.assignedMachineId : undefined;
        if (nextStatus === "NOT_CLOSED" && !inquiry.lostReason) {
          inquiry.lostReason = "Marcado como não fechado em lote.";
        }

        if (nextStatus === "CLOSED") {
          applyShowcaseOperationalMetadata(db, inquiry, item, now);
        } else {
          inquiry.orderNumber = undefined;
          inquiry.dueDate = undefined;
        }
      }

      if (operation === "set_hot" || operation === "set_warm" || operation === "set_cold") {
        inquiry.leadTemperature =
          operation === "set_hot" ? "HOT" : operation === "set_warm" ? "WARM" : "COLD";
      }

      if (operation === "followup_today") {
        const followUp = new Date();
        followUp.setHours(followUp.getHours() + 2);
        inquiry.followUpAt = followUp.toISOString();
      }

      if (operation === "followup_tomorrow") {
        const followUp = new Date();
        followUp.setDate(followUp.getDate() + 1);
        followUp.setHours(9, 0, 0, 0);
        inquiry.followUpAt = followUp.toISOString();
      }

      if (operation === "clear_followup") {
        inquiry.followUpAt = undefined;
      }

      inquiry.lastContactAt = now;
      inquiry.updatedAt = now;
    }

    pushAuditLog(db, {
      actorId: user.id,
      area: "crm",
      action: "bulk_update_leads",
      summary: `${selectedLeads.length} leads atualizados em lote.`,
      entityType: "showcase_inquiry",
      details: `Ação aplicada: ${operation}.`,
    });
  });

  revalidateAll();

  if (operation === "set_closed") {
    redirect(buildAdminOrdersSectionUrl("Leads fechados movidos para pedidos."));
  }

  redirect(buildAdminLeadsSectionUrl("Ação em lote aplicada aos leads selecionados."));
}

export async function updateShowcaseInquiryOrderStageAction(formData: FormData) {
  const user = await requireRoles([UserRole.ADMIN, UserRole.SUPERVISOR]);
  const inquiryId = String(formData.get("inquiryId") ?? "");
  const parsedStage = showcaseOrderStageSchema.safeParse(formData.get("orderStage"));

  if (!inquiryId || !parsedStage.success) {
    throw new Error("Pedido do WhatsApp não encontrado.");
  }

  const nextOrderStage = parsedStage.data as ShowcaseOrderStage;
  let completionNotificationUrl: string | null = null;

  await updateDb((db) => {
    const inquiry = db.showcaseInquiries.find((candidate) => candidate.id === inquiryId);

    if (!inquiry || inquiry.status !== "CLOSED") {
      throw new Error("Pedido do WhatsApp não encontrado.");
    }

    const item = db.showcaseItems.find((candidate) => candidate.id === inquiry.itemId);
    const previousOrderStage = inquiry.orderStage ?? "RECEIVED";
    const previousMachine =
      inquiry.assignedMachineId
        ? db.machines.find((candidate) => candidate.id === inquiry.assignedMachineId)
        : undefined;
    const now = new Date().toISOString();

    if (item && previousOrderStage !== "CANCELED" && nextOrderStage === "CANCELED") {
      releaseShowcaseStock(item, inquiry.quantity, now);
    }

    if (item && previousOrderStage === "CANCELED" && nextOrderStage !== "CANCELED") {
      reserveShowcaseStock(item, inquiry.quantity, now);
    }

    applyShowcaseOperationalMetadata(db, inquiry, item, now);
    inquiry.orderStage = nextOrderStage;
    if (nextOrderStage === "PRINTING") {
      inquiry.printingStartedAt = now;
      inquiry.printingCompletedAt = undefined;
      inquiry.plannedPrintMinutes = getPlannedMinutesFromHours(
        (item?.estimatedPrintHours ?? 1) * inquiry.quantity,
      );
      consumeShowcaseInquiryMaterial(db, inquiry, item, user.id, now);
      if (previousMachine) {
        previousMachine.status = MachineStatus.BUSY;
        previousMachine.progressPercent = Math.max(previousMachine.progressPercent, 8);
        previousMachine.timeRemainingMinutes =
          inquiry.plannedPrintMinutes ?? previousMachine.timeRemainingMinutes;
        previousMachine.updatedAt = now;
      }
    }
    if (nextOrderStage === "READY_TO_SHIP" && inquiry.deliveryMode === "PICKUP") {
      inquiry.shippingCarrier = getSuggestedCarrier("PICKUP");
      inquiry.trackingCode = undefined;
    }
    if (nextOrderStage === "SHIPPED") {
      inquiry.shippedAt = now;
      if (inquiry.deliveryMode !== "PICKUP") {
        inquiry.trackingCode ??= createId("trk").toUpperCase();
      }
      inquiry.shippingCarrier ??= getSuggestedCarrier(inquiry.deliveryMode ?? "SHIPPING");
    }
    if (nextOrderStage === "COMPLETED") {
      inquiry.printingCompletedAt = now;
      inquiry.deliveredAt = now;
      inquiry.deliveryRecipient ??= inquiry.customerName;
      inquiry.shippingCarrier ??= getSuggestedCarrier(inquiry.deliveryMode ?? "PICKUP");
      completionNotificationUrl = buildCompletionNotificationUrl({
        label: inquiry.itemName,
        customerName: inquiry.customerName,
        quantity: inquiry.quantity,
        finishedAt: now,
        plannedPrintMinutes: inquiry.plannedPrintMinutes,
        elapsedPrintMinutes: getElapsedMinutes(inquiry.printingStartedAt, now),
      });
    }
    if (previousOrderStage === "PRINTING" && nextOrderStage !== "PRINTING" && previousMachine) {
      previousMachine.status = MachineStatus.AVAILABLE;
      previousMachine.progressPercent = 100;
      previousMachine.timeRemainingMinutes = 0;
      previousMachine.updatedAt = now;
    }
    if (nextOrderStage !== "QUEUED" && nextOrderStage !== "PRINTING") {
      inquiry.assignedMachineId = undefined;
    }
    inquiry.updatedAt = now;
    pushAuditLog(db, {
      actorId: user.id,
      area: "showcase_order",
      action: "update_stage",
      summary: `Pedido de ${inquiry.customerName} movido para ${nextOrderStage}.`,
      entityType: "showcase_inquiry",
      entityId: inquiry.id,
      details: inquiry.orderNumber ?? inquiry.itemName,
    });
  });

  revalidateAll();

  if (completionNotificationUrl) {
    redirect(completionNotificationUrl);
  }
}

export async function updateShowcaseInquiryShippingAction(formData: FormData) {
  const user = await requireRoles([UserRole.ADMIN, UserRole.SUPERVISOR]);
  const inquiryId = String(formData.get("inquiryId") ?? "").trim();
  const deliveryModeValue = String(formData.get("deliveryMode") ?? "").trim();

  if (!inquiryId || !deliveryModeValue) {
    throw new Error("Pedido do WhatsApp não encontrado.");
  }

  const parsedDeliveryMode = z
    .enum(["PICKUP", "LOCAL_DELIVERY", "SHIPPING"])
    .safeParse(deliveryModeValue);

  if (!parsedDeliveryMode.success) {
    throw new Error("Escolha uma forma de entrega válida.");
  }

  const deliveryMode = parsedDeliveryMode.data as ShowcaseDeliveryMode;
  const deliveryPostalCode = sanitizePostalCode(String(formData.get("deliveryPostalCode") ?? ""));
  const deliveryAddress = String(formData.get("deliveryAddress") ?? "").trim();
  const deliveryNeighborhood = String(formData.get("deliveryNeighborhood") ?? "").trim();
  const deliveryCity = String(formData.get("deliveryCity") ?? "").trim();
  const deliveryState = normalizeStateCode(String(formData.get("deliveryState") ?? ""));
  const shippingCarrierInput = String(formData.get("shippingCarrier") ?? "").trim();
  const trackingCodeInput = String(formData.get("trackingCode") ?? "").trim().toUpperCase();
  const deliveryRecipient = String(formData.get("deliveryRecipient") ?? "").trim();
  const proofOfDeliveryNotes = String(formData.get("proofOfDeliveryNotes") ?? "").trim();

  await updateDb((db) => {
    const inquiry = db.showcaseInquiries.find((candidate) => candidate.id === inquiryId);

    if (!inquiry || inquiry.status !== "CLOSED") {
      throw new Error("Pedido do WhatsApp não encontrado.");
    }

    const item = db.showcaseItems.find((candidate) => candidate.id === inquiry.itemId);

    if (!item) {
      throw new Error("Item da vitrine não encontrado.");
    }

    const allowedModes = getAvailableDeliveryModes(item);

    if (!allowedModes.includes(deliveryMode)) {
      throw new Error("Essa forma de entrega não está liberada para o produto.");
    }

    if (deliveryMode !== "PICKUP" && (!deliveryAddress || !deliveryCity)) {
      throw new Error("Informe pelo menos endereço e cidade para calcular a entrega.");
    }

    if (deliveryMode === "SHIPPING" && (!deliveryPostalCode || !deliveryState)) {
      throw new Error("Para envio, informe CEP e UF.");
    }

    const now = new Date().toISOString();
    const freight = estimateFreightCost({
      deliveryMode,
      quantity: inquiry.quantity,
      estimatedMaterialGrams: (item.estimatedMaterialGrams ?? 0) * inquiry.quantity,
      estimatedPrintHours: (item.estimatedPrintHours ?? 0) * inquiry.quantity,
      postalCode: deliveryPostalCode,
      city: deliveryCity,
      state: deliveryState,
    });

    inquiry.deliveryMode = deliveryMode;
    inquiry.freightEstimate = freight.amount;
    inquiry.deliveryPostalCode = deliveryPostalCode || undefined;
    inquiry.deliveryAddress = deliveryAddress || undefined;
    inquiry.deliveryNeighborhood = deliveryNeighborhood || undefined;
    inquiry.deliveryCity = deliveryCity || undefined;
    inquiry.deliveryState = deliveryState || undefined;
    inquiry.shippingCarrier = shippingCarrierInput || freight.carrier;
    inquiry.trackingCode =
      deliveryMode === "PICKUP"
        ? undefined
        : trackingCodeInput || (inquiry.orderStage === "SHIPPED" ? createId("trk").toUpperCase() : inquiry.trackingCode);
    inquiry.deliveryRecipient = deliveryRecipient || inquiry.deliveryRecipient || inquiry.customerName;
    inquiry.proofOfDeliveryNotes = proofOfDeliveryNotes || undefined;
    inquiry.updatedAt = now;

    if (inquiry.orderStage === "SHIPPED" && !inquiry.shippedAt) {
      inquiry.shippedAt = now;
    }

    if (inquiry.orderStage === "COMPLETED") {
      inquiry.deliveredAt ??= now;
    }

    pushAuditLog(db, {
      actorId: user.id,
      area: "shipping",
      action: "update_showcase_delivery",
      summary: `Entrega do pedido ${inquiry.orderNumber ?? inquiry.itemName} atualizada.`,
      entityType: "showcase_inquiry",
      entityId: inquiry.id,
      details: `${deliveryMode} · ${freight.amount.toFixed(2)}`,
    });
  });

  revalidateAll();
}

export async function assignShowcaseInquiryMachineAction(formData: FormData) {
  const user = await requireRoles([UserRole.OPERATOR, UserRole.SUPERVISOR, UserRole.ADMIN]);
  const inquiryId = String(formData.get("inquiryId") ?? "");
  const machineId = String(formData.get("machineId") ?? "");
  const parsedStage = showcaseOrderStageSchema.safeParse(formData.get("orderStage"));

  if (!inquiryId || !machineId || !parsedStage.success) {
    throw new Error("Pedido do WhatsApp ou impressora não encontrados.");
  }

  const nextOrderStage = parsedStage.data as ShowcaseOrderStage;

  await updateDb((db) => {
    const inquiry = db.showcaseInquiries.find((candidate) => candidate.id === inquiryId);
    const machine = db.machines.find((candidate) => candidate.id === machineId);
    const item = db.showcaseItems.find((candidate) => candidate.id === inquiry?.itemId);
    const previousMachine =
      inquiry?.assignedMachineId
        ? db.machines.find((candidate) => candidate.id === inquiry.assignedMachineId)
        : undefined;

    if (!inquiry || inquiry.status !== "CLOSED" || !machine) {
      throw new Error("Pedido do WhatsApp ou impressora não encontrados.");
    }

    const now = new Date().toISOString();
    if (previousMachine && previousMachine.id !== machine.id) {
      previousMachine.status = MachineStatus.AVAILABLE;
      previousMachine.progressPercent = 0;
      previousMachine.timeRemainingMinutes = 0;
      previousMachine.updatedAt = now;
    }
    inquiry.assignedMachineId = machine.id;
    inquiry.orderStage = nextOrderStage;
    if (nextOrderStage === "PRINTING") {
      inquiry.printingStartedAt = now;
      inquiry.printingCompletedAt = undefined;
      inquiry.plannedPrintMinutes = getPlannedMinutesFromHours(
        (item?.estimatedPrintHours ?? 1) * inquiry.quantity,
      );
      consumeShowcaseInquiryMaterial(db, inquiry, item, user.id, now);
    }
    inquiry.updatedAt = now;

    if (nextOrderStage === "PRINTING") {
      machine.status = MachineStatus.BUSY;
      machine.progressPercent = Math.max(machine.progressPercent, 8);
      machine.timeRemainingMinutes = inquiry.plannedPrintMinutes ?? Math.max(machine.timeRemainingMinutes, 60);
      machine.updatedAt = now;
    }

    pushAuditLog(db, {
      actorId: user.id,
      area: "machines",
      action: "assign_showcase",
      summary: `Pedido ${inquiry.itemName} vinculado à máquina ${machine.name}.`,
      entityType: "showcase_inquiry",
      entityId: inquiry.id,
      details: machine.name,
    });
  });

  revalidateAll();
}

export async function assignMachineAction(formData: FormData) {
  const user = await requireRoles([UserRole.OPERATOR, UserRole.SUPERVISOR, UserRole.ADMIN]);
  const orderId = String(formData.get("orderId") ?? "");
  const machineId = String(formData.get("machineId") ?? "");
  const nextStatus = (String(formData.get("nextStatus") ?? OrderStatus.PRINTING) as OrderStatus);

  await updateDb((db) => {
    const order = findOrder(db, orderId);
    const machine = db.machines.find((item) => item.id === machineId);
    const previousMachine =
      order?.assignedMachineId
        ? db.machines.find((item) => item.id === order.assignedMachineId)
        : undefined;

    if (!order || !machine) {
      throw new Error("Pedido ou impressora não encontrados.");
    }

    const now = new Date().toISOString();
    if (previousMachine && previousMachine.id !== machine.id) {
      previousMachine.status = MachineStatus.AVAILABLE;
      previousMachine.progressPercent = 0;
      previousMachine.timeRemainingMinutes = 0;
      previousMachine.updatedAt = now;
    }
    order.assignedMachineId = machine.id;
    order.assignedOperatorId = user.id;
    order.status = nextStatus;
    if (nextStatus === OrderStatus.PRINTING) {
      order.printingStartedAt = now;
      order.printingCompletedAt = undefined;
      order.plannedPrintMinutes = getPlannedMinutesFromHours(order.estimatedHours);
      consumeInternalOrderMaterial(db, order, user.id, now);
    }
    order.updatedAt = now;
    order.timeline.unshift({
      id: createId("tml"),
      actorId: user.id,
      label: "Produção roteada",
      details: `Pedido atribuído à ${machine.name}.`,
      statusSnapshot: nextStatus,
      createdAt: now,
    });

    machine.status = nextStatus === OrderStatus.PRINTING ? MachineStatus.BUSY : machine.status;
    machine.progressPercent = nextStatus === OrderStatus.PRINTING ? Math.max(machine.progressPercent, 8) : machine.progressPercent;
    machine.timeRemainingMinutes =
      nextStatus === OrderStatus.PRINTING
        ? order.plannedPrintMinutes ?? Math.max(Math.round(order.estimatedHours * 60), 45)
        : machine.timeRemainingMinutes;
    machine.updatedAt = now;
    pushAuditLog(db, {
      actorId: user.id,
      area: "machines",
      action: "assign_order",
      summary: `Pedido ${order.orderNumber} vinculado à máquina ${machine.name}.`,
    });
  });

  revalidateAll();
}

export async function advanceOrderStatusAction(formData: FormData) {
  const user = await requireRoles([UserRole.OPERATOR, UserRole.SUPERVISOR, UserRole.ADMIN]);
  const orderId = String(formData.get("orderId") ?? "");
  const nextStatus = String(formData.get("nextStatus") ?? "") as OrderStatus;
  let completionNotificationUrl: string | null = null;

  await updateDb((db) => {
    const order = findOrder(db, orderId);

    if (!order) {
      throw new Error("Pedido não encontrado.");
    }

    const previousStatus = order.status;
    const assignedMachine =
      order.assignedMachineId
        ? db.machines.find((candidate) => candidate.id === order.assignedMachineId)
        : undefined;
    const now = new Date().toISOString();
    order.status = nextStatus;
    if (nextStatus === OrderStatus.PRINTING) {
      order.printingStartedAt = now;
      order.printingCompletedAt = undefined;
      order.plannedPrintMinutes = getPlannedMinutesFromHours(order.estimatedHours);
      consumeInternalOrderMaterial(db, order, user.id, now);
      if (assignedMachine) {
        assignedMachine.status = MachineStatus.BUSY;
        assignedMachine.progressPercent = Math.max(assignedMachine.progressPercent, 8);
        assignedMachine.timeRemainingMinutes =
          order.plannedPrintMinutes ?? assignedMachine.timeRemainingMinutes;
        assignedMachine.updatedAt = now;
      }
    }
    order.updatedAt = now;

    if (nextStatus === OrderStatus.SHIPPED) {
      order.shippedAt = now;
      order.trackingCode ??= createId("trk").toUpperCase();
      order.shippingCarrier ??= "Transportadora parceira";
    }

    if (nextStatus === OrderStatus.COMPLETED) {
      order.deliveredAt = now;
      order.printingCompletedAt = now;
      const customer = db.users.find((candidate) => candidate.id === order.customerId);
      completionNotificationUrl = buildCompletionNotificationUrl({
        label: `${order.orderNumber} · ${order.title}`,
        customerName: customer?.company ?? customer?.name ?? "Cliente sem cadastro",
        quantity: order.quantity,
        finishedAt: now,
        plannedPrintMinutes: order.plannedPrintMinutes,
        elapsedPrintMinutes: getElapsedMinutes(order.printingStartedAt, now),
      });
    }
    if (previousStatus === OrderStatus.PRINTING && nextStatus !== OrderStatus.PRINTING && assignedMachine) {
      assignedMachine.status = MachineStatus.AVAILABLE;
      assignedMachine.progressPercent = 100;
      assignedMachine.timeRemainingMinutes = 0;
      assignedMachine.updatedAt = now;
    }

    order.timeline.unshift({
      id: createId("tml"),
      actorId: user.id,
      label: "Status atualizado",
      details: `Pedido movido para ${nextStatus}.`,
      statusSnapshot: nextStatus,
      createdAt: now,
    });
    pushAuditLog(db, {
      actorId: user.id,
      area: "orders",
      action: "update_status",
      summary: `Pedido ${order.orderNumber} movido para ${nextStatus}.`,
      entityType: "order",
      entityId: order.id,
      details: order.title,
    });
  });

  revalidateAll();

  if (completionNotificationUrl) {
    redirect(completionNotificationUrl);
  }
}

export async function approveQualityAction(formData: FormData) {
  const user = await requireRoles([UserRole.OPERATOR, UserRole.SUPERVISOR, UserRole.ADMIN]);
  const orderId = String(formData.get("orderId") ?? "");

  await updateDb((db) => {
    const order = findOrder(db, orderId);

    if (!order) {
      throw new Error("Pedido não encontrado.");
    }

    const now = new Date().toISOString();
    const qualityCheck: DbQualityCheck = {
      id: createId("qck"),
      inspectorId: user.id,
      dimensionsOk: true,
      finishOk: true,
      deformationFree: true,
      colorOk: true,
      strengthOk: true,
      packagingOk: true,
      approved: true,
      notes: "Checklist aprovado no fluxo operacional.",
      createdAt: now,
    };

    order.qualityChecks.unshift(qualityCheck);
    order.status = OrderStatus.READY_TO_SHIP;
    order.updatedAt = now;
    order.timeline.unshift({
      id: createId("tml"),
      actorId: user.id,
      label: "Qualidade aprovada",
      details: "Checklist técnico concluído com sucesso.",
      statusSnapshot: OrderStatus.READY_TO_SHIP,
      createdAt: now,
    });
  });

  revalidateAll();
}

export async function addCommentAction(formData: FormData) {
  const user = await requireUser();
  const orderId = String(formData.get("orderId") ?? "");
  const message = String(formData.get("message") ?? "").trim();
  const internal = String(formData.get("internal") ?? "false") === "true";

  if (!message) {
    return;
  }

  await updateDb((db) => {
    const order = findOrder(db, orderId);

    if (!order || !canAccessOrder(order, user.id, user.role)) {
      throw new Error("Pedido não encontrado.");
    }

    order.comments.unshift({
      id: createId("cmt"),
      authorId: user.id,
      message,
      internal: internal && user.role !== UserRole.CLIENT,
      createdAt: new Date().toISOString(),
    });
    order.updatedAt = new Date().toISOString();
  });

  revalidateAll();
}

export async function reprintOrderAction(formData: FormData) {
  const user = await requireUser();
  const sourceOrderId = String(formData.get("orderId") ?? "");

  await updateDb((db) => {
    const source = findOrder(db, sourceOrderId);

    if (!source || !canAccessOrder(source, user.id, user.role)) {
      throw new Error("Pedido não encontrado.");
    }

    const now = new Date().toISOString();
    const duplicated: DbOrder = {
      ...source,
      id: createId("ord"),
      orderNumber: generateOrderNumber(db.orders),
      status: OrderStatus.WAITING_APPROVAL,
      paymentStatus: PaymentStatus.PENDING,
      approvedByCustomerAt: undefined,
      paidAt: undefined,
      shippedAt: undefined,
      deliveredAt: undefined,
      trackingCode: undefined,
      invoiceNumber: undefined,
      queuePosition: undefined,
      assignedMachineId: undefined,
      assignedOperatorId: undefined,
      reprintOfId: source.id,
      payments: [],
      comments: [
        {
          id: createId("cmt"),
          authorId: user.id,
          message: "Reimpressão criada a partir de um pedido concluído.",
          internal: false,
          createdAt: now,
        },
      ],
      timeline: [
        {
          id: createId("tml"),
          actorId: user.id,
          label: "Pedido reimpresso",
          details: `Nova solicitação criada a partir do pedido ${source.orderNumber}.`,
          statusSnapshot: OrderStatus.WAITING_APPROVAL,
          createdAt: now,
        },
      ],
      qualityChecks: [],
      createdAt: now,
      updatedAt: now,
    };

    db.orders.unshift(duplicated);
  });

  revalidateAll();
}

export async function updateMachineStatusAction(formData: FormData) {
  const user = await requireRoles([UserRole.OPERATOR, UserRole.SUPERVISOR, UserRole.ADMIN]);
  const machineId = String(formData.get("machineId") ?? "");
  const status = String(formData.get("status") ?? "") as MachineStatus;

  await updateDb((db) => {
    const machine = db.machines.find((item) => item.id === machineId);

    if (!machine) {
      throw new Error("Impressora não encontrada.");
    }

    machine.status = status;
    machine.updatedAt = new Date().toISOString();
    pushAuditLog(db, {
      actorId: user.id,
      area: "machines",
      action: "update_status",
      summary: `Máquina ${machine.name} movida para ${status}.`,
    });
  });

  revalidateAll();
}
