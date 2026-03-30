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
import { redirect } from "next/navigation";
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
  DbExpenseCategory,
  DbPayableStatus,
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
import { parseShowcaseListField } from "@/lib/showcase";
import { createId, readDb, updateDb } from "@/lib/store";
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

const showcaseItemSchema = z
  .object({
    name: z.string().min(2, "Informe o nome do item."),
    category: z.string().min(2, "Informe a categoria do item."),
    tagline: z.string().trim().optional(),
    description: z.string().min(10, "Descreva o item exposto."),
    price: z.coerce.number().positive("Informe o valor do item."),
    estimatedPrintHours: z.coerce.number().positive("Informe o tempo de impressão cadastrado."),
    estimatedMaterialGrams: z.coerce.number().nonnegative("Informe o consumo estimado de material."),
    fulfillmentType: z.enum(["STOCK", "MADE_TO_ORDER"]),
    stockQuantity: z.coerce.number().int().nonnegative("Informe o estoque disponível."),
    leadTimeDays: z.coerce.number().int().nonnegative("Informe o prazo estimado."),
    materialLabel: z.string().trim().optional(),
    materialId: z.string().trim().optional(),
    colorOptions: z.array(z.string().trim()).default([]),
    dimensionSummary: z.string().trim().optional(),
    imageUrl: z.string().trim().optional(),
    videoUrl: z.string().trim().optional(),
    galleryImageUrls: z.array(z.string().trim()).default([]),
    featured: z.boolean(),
    active: z.boolean(),
  })
  .superRefine((data, ctx) => {
    if (data.fulfillmentType === "MADE_TO_ORDER" && data.leadTimeDays <= 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Informe um prazo estimado para itens sob encomenda.",
        path: ["leadTimeDays"],
      });
    }
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
    tagline: formData.get("tagline")?.toString(),
    description: formData.get("description"),
    price: formData.get("price"),
    estimatedPrintHours: formData.get("estimatedPrintHours"),
    estimatedMaterialGrams: formData.get("estimatedMaterialGrams") || 0,
    fulfillmentType: formData.get("fulfillmentType"),
    stockQuantity: formData.get("stockQuantity"),
    leadTimeDays: formData.get("leadTimeDays") || 0,
    materialLabel: formData.get("materialLabel")?.toString(),
    materialId: formData.get("materialId")?.toString(),
    colorOptions: parseShowcaseListField(formData.get("colorOptions")),
    dimensionSummary: formData.get("dimensionSummary")?.toString(),
    imageUrl: formData.get("imageUrl")?.toString(),
    videoUrl: formData.get("videoUrl")?.toString(),
    galleryImageUrls: parseShowcaseListField(formData.get("galleryImageUrls")),
    featured: formData.get("featured") === "on",
    active: formData.get("active") === "on",
  });
}

function getShowcaseItemFormFields(formData: FormData) {
  return {
    itemId: String(formData.get("itemId") ?? ""),
    name: String(formData.get("name") ?? ""),
    category: String(formData.get("category") ?? ""),
    tagline: String(formData.get("tagline") ?? ""),
    description: String(formData.get("description") ?? ""),
    price: String(formData.get("price") ?? ""),
    estimatedPrintHours: String(formData.get("estimatedPrintHours") ?? ""),
    estimatedMaterialGrams: String(formData.get("estimatedMaterialGrams") ?? ""),
    fulfillmentType: String(formData.get("fulfillmentType") ?? "STOCK"),
    stockQuantity: String(formData.get("stockQuantity") ?? ""),
    restockQuantity: String(formData.get("restockQuantity") ?? "0"),
    leadTimeDays: String(formData.get("leadTimeDays") ?? ""),
    materialLabel: String(formData.get("materialLabel") ?? ""),
    materialId: String(formData.get("materialId") ?? ""),
    colorOptions: String(formData.get("colorOptions") ?? ""),
    dimensionSummary: String(formData.get("dimensionSummary") ?? ""),
    imageUrl: String(formData.get("imageUrl") ?? ""),
    videoUrl: String(formData.get("videoUrl") ?? ""),
    galleryImageUrls: String(formData.get("galleryImageUrls") ?? ""),
    calculatorMaterialId: String(formData.get("calculatorMaterialId") ?? ""),
    calculatorFilamentPricePerKilo: String(formData.get("calculatorFilamentPricePerKilo") ?? ""),
    calculatorMaterialUsedGrams: String(formData.get("calculatorMaterialUsedGrams") ?? ""),
    calculatorPrintDurationHours: String(formData.get("calculatorPrintDurationHours") ?? ""),
    calculatorEnergyRate: String(formData.get("calculatorEnergyRate") ?? ""),
    calculatorPrinterPowerWatts: String(formData.get("calculatorPrinterPowerWatts") ?? ""),
    calculatorMarginPercent: String(formData.get("calculatorMarginPercent") ?? ""),
    featured: formData.get("featured") === "on" ? "true" : "false",
    active: formData.get("active") === "on" ? "true" : "false",
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
    notes: formData.get("notes")?.toString(),
  });
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

function generateOrderNumber(existingOrders: DbOrder[]) {
  const datePart = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const todaysOrders = existingOrders.filter((order) => order.orderNumber.includes(datePart)).length + 1;
  return `PF-${datePart}-${String(todaysOrders).padStart(3, "0")}`;
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
  }: Omit<DbAuditLog, "id" | "createdAt">,
) {
  const entry: DbAuditLog = {
    id: createId("log"),
    actorId,
    area,
    action,
    summary: summary.trim(),
    createdAt: new Date().toISOString(),
  };

  db.auditLogs.unshift(entry);
  db.auditLogs = db.auditLogs.slice(0, 250);
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
    tagline: data.tagline?.trim() || undefined,
    description: data.description,
    price: data.price,
    materialLabel: data.materialLabel?.trim() || undefined,
    materialId: data.materialId?.trim() || undefined,
    colorOptions: data.colorOptions,
    dimensionSummary: data.dimensionSummary?.trim() || undefined,
    leadTimeDays: data.fulfillmentType === "MADE_TO_ORDER" ? data.leadTimeDays : 0,
    estimatedPrintHours: data.estimatedPrintHours,
    estimatedMaterialGrams: data.estimatedMaterialGrams,
    fulfillmentType: data.fulfillmentType,
    stockQuantity: data.fulfillmentType === "STOCK" ? data.stockQuantity : 0,
    imageUrl: data.imageUrl?.trim() || undefined,
    videoUrl: data.videoUrl?.trim() || undefined,
    galleryImageUrls: data.galleryImageUrls,
    featured: data.featured,
    active: data.active,
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

function buildShowcaseWhatsAppUrl({
  itemName,
  quantity,
  fulfillmentType,
  customerName,
  customerPhone,
}: {
  itemName: string;
  quantity: number;
  fulfillmentType: ShowcaseFulfillmentType;
  customerName: string;
  customerPhone: string;
}) {
  const message = [
    "Olá! Quero comprar este item da vitrine.",
    `Item: ${itemName}`,
    `Quantidade: ${quantity}`,
    `Disponibilidade: ${getShowcaseFulfillmentLabel(fulfillmentType)}`,
    `Cliente: ${customerName}`,
    `Telefone: ${customerPhone}`,
  ].join("\n");

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
    "Pedido finalizado no PrintFlow 3D.",
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

  if (!(videoFile instanceof File) || !videoFile.name) {
    return null;
  }

  const fileExtension = getFileExtension(videoFile.name);

  if (!allowedVideoFormats.includes(fileExtension as (typeof allowedVideoFormats)[number])) {
    throw new Error("Use um video MP4, WEBM ou MOV.");
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
      });
    });

    revalidateAll();
    redirect(buildAdminShowcaseSectionUrl("Item da vitrine salvo com sucesso."));
  } catch (error) {
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

      item.name = parsed.data.name;
      item.category = parsed.data.category;
      item.tagline = parsed.data.tagline?.trim() || undefined;
      item.description = parsed.data.description;
      item.price = parsed.data.price;
      item.materialLabel = materialSelection.materialLabel;
      item.materialId = materialSelection.materialId;
      item.colorOptions = parsed.data.colorOptions;
      item.dimensionSummary = parsed.data.dimensionSummary?.trim() || undefined;
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
      item.featured = parsed.data.featured;
      item.active = parsed.data.active;
      item.updatedAt = new Date().toISOString();
      pushAuditLog(db, {
        actorId: user.id,
        area: "showcase",
        action: "update_item",
        summary: `Produto da vitrine atualizado: ${item.name}.`,
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
      db.showcaseItems.splice(itemIndex, 1);
      pushAuditLog(db, {
        actorId: user.id,
        area: "showcase",
        action: "delete_item",
        summary: `Produto da vitrine excluído: ${item.name}.`,
      });
    });

    revalidateAll();
    redirect(buildAdminShowcaseSectionUrl("Item da vitrine excluído com sucesso."));
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Não foi possível excluir o item da vitrine.",
    };
  }
}

export async function createShowcaseInquiryAction(
  _previousState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireRoles([UserRole.ADMIN, UserRole.SUPERVISOR]);
  const parsed = parseShowcaseInquiryFormData(formData);

  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Não foi possível lançar o pedido manual.",
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
        }),
        status,
        tags: parsed.data.tags,
        leadTemperature: parsed.data.leadTemperature as ShowcaseLeadTemperature,
        followUpAt: normalizeOptionalIsoDate(parsed.data.followUpAt),
        lastContactAt: normalizeOptionalIsoDate(parsed.data.lastContactAt),
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
    };
  }
}

export async function updateShowcaseInquiryAction(
  _previousState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireRoles([UserRole.ADMIN, UserRole.SUPERVISOR]);
  const inquiryId = String(formData.get("inquiryId") ?? "");
  const parsed = parseShowcaseInquiryFormData(formData);

  if (!inquiryId) {
    return {
      ok: false,
      error: "Pedido do WhatsApp não encontrado para edição.",
    };
  }

  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Não foi possível atualizar o pedido do WhatsApp.",
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
    });
  });

  revalidateAll();

  if (nextStatus === "CLOSED") {
    redirect("/admin?section=pedidos");
  }
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
    if (nextOrderStage === "COMPLETED") {
      inquiry.printingCompletedAt = now;
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
    });
  });

  revalidateAll();

  if (completionNotificationUrl) {
    redirect(completionNotificationUrl);
  }
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
