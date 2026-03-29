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
  DbExpense,
  DbMaterial,
  DbOrder,
  DbQualityCheck,
  DbShowcaseItem,
  DbExpenseCategory,
  ShowcaseFulfillmentType,
  ShowcaseInquiryStatus,
  ShowcaseOrderStage,
} from "@/lib/db-types";
import {
  buildQuote,
  getFileExtension,
  getMaterialDerivedMetrics,
  recommendMachine,
} from "@/lib/pricing";
import { formatDateTime, formatDurationMinutes } from "@/lib/format";
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

const showcaseItemSchema = z.object({
  name: z.string().min(2, "Informe o nome do item."),
  description: z.string().min(10, "Descreva o item exposto."),
  price: z.coerce.number().positive("Informe o valor do item."),
  estimatedPrintHours: z.coerce.number().positive("Informe o tempo de impressão cadastrado."),
  fulfillmentType: z.enum(["STOCK", "MADE_TO_ORDER"]),
  stockQuantity: z.coerce.number().int().nonnegative("Informe o estoque disponível."),
  imageUrl: z.string().trim().optional(),
  active: z.boolean(),
});

const showcaseInquiryStatusSchema = z.enum(["PENDING", "CLOSED", "NOT_CLOSED"]);
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
  });
const allowedImageFormats = ["png", "jpg", "jpeg", "webp", "gif"] as const;

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
    description: formData.get("description"),
    price: formData.get("price"),
    estimatedPrintHours: formData.get("estimatedPrintHours"),
    fulfillmentType: formData.get("fulfillmentType"),
    stockQuantity: formData.get("stockQuantity"),
    imageUrl: formData.get("imageUrl")?.toString(),
    active: formData.get("active") === "on",
  });
}

function parseShowcaseInquiryFormData(formData: FormData) {
  return showcaseInquirySchema.safeParse({
    itemId: formData.get("itemId"),
    quantity: formData.get("quantity"),
    customerName: formData.get("customerName"),
    customerEmail: formData.get("customerEmail")?.toString(),
    customerPhone: formData.get("customerPhone")?.toString(),
    status: formData.get("status"),
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

function generateOrderNumber(existingOrders: DbOrder[]) {
  const datePart = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const todaysOrders = existingOrders.filter((order) => order.orderNumber.includes(datePart)).length + 1;
  return `PF-${datePart}-${String(todaysOrders).padStart(3, "0")}`;
}

function normalizeOptionalIsoDate(value?: string) {
  if (!value?.trim()) {
    return undefined;
  }

  return new Date(value).toISOString();
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
    description: data.description,
    price: data.price,
    estimatedPrintHours: data.estimatedPrintHours,
    fulfillmentType: data.fulfillmentType,
    stockQuantity: data.fulfillmentType === "STOCK" ? data.stockQuantity : 0,
    imageUrl: data.imageUrl?.trim() || undefined,
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
  const parsed = authSchema.safeParse({
    email: formData.get("email"),
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
      error: "Usuário não encontrado.",
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
  const parsed = registerSchema.safeParse({
    name: formData.get("name"),
    company: formData.get("company"),
    phone: formData.get("phone"),
    email: formData.get("email"),
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
      const normalizedEmail = parsed.data.email.toLowerCase();
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
        createdAt: now,
        updatedAt: now,
      };

      db.users.push(newUser);
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
  });

  revalidateAll();
}

export async function createMaterialAction(
  _previousState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireRoles([UserRole.ADMIN, UserRole.SUPERVISOR]);
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
  await requireRoles([UserRole.ADMIN, UserRole.SUPERVISOR]);
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
  await requireRoles([UserRole.ADMIN, UserRole.SUPERVISOR]);
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

      if (linkedOrders.length > 0) {
        throw new Error("Não é possível excluir um material já vinculado a pedidos.");
      }

      db.materials.splice(materialIndex, 1);
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
  await requireRoles([UserRole.ADMIN, UserRole.SUPERVISOR]);

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
      db.machines.unshift({
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
  await requireRoles([UserRole.ADMIN, UserRole.SUPERVISOR]);
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
  await requireRoles([UserRole.ADMIN, UserRole.SUPERVISOR]);
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

      db.machines.splice(machineIndex, 1);
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
  await requireRoles([UserRole.ADMIN, UserRole.SUPERVISOR]);
  const parsed = parseExpenseFormData(formData);

  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Não foi possível lançar o gasto.",
    };
  }

  try {
    await updateDb((db) => {
      db.expenses.unshift(buildExpensePayload(parsed.data));
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

export async function deleteExpenseAction(formData: FormData) {
  await requireRoles([UserRole.ADMIN, UserRole.SUPERVISOR]);
  const expenseId = String(formData.get("expenseId") ?? "");

  if (!expenseId) {
    throw new Error("Gasto não encontrado.");
  }

  await updateDb((db) => {
    const expenseIndex = db.expenses.findIndex((expense) => expense.id === expenseId);

    if (expenseIndex === -1) {
      throw new Error("Gasto não encontrado.");
    }

    db.expenses.splice(expenseIndex, 1);
  });

  revalidateAll();
}

export async function createShowcaseItemAction(
  _previousState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireRoles([UserRole.ADMIN, UserRole.SUPERVISOR]);
  const parsed = parseShowcaseItemFormData(formData);

  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Não foi possível salvar o item da vitrine.",
    };
  }

  try {
    const uploadedImageUrl = await resolveShowcaseImageUrl(formData);
    await updateDb((db) => {
      db.showcaseItems.unshift(
        buildShowcaseItemPayload({
          ...parsed.data,
          imageUrl: uploadedImageUrl ?? parsed.data.imageUrl,
        }),
      );
    });

    revalidateAll();
    return {
      ok: true,
      message: "Item da vitrine salvo com sucesso.",
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Não foi possível salvar o item da vitrine.",
    };
  }
}

export async function updateShowcaseItemAction(
  _previousState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireRoles([UserRole.ADMIN, UserRole.SUPERVISOR]);
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
    };
  }

  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Não foi possível atualizar o item da vitrine.",
    };
  }

  try {
    const uploadedImageUrl = await resolveShowcaseImageUrl(formData);
    await updateDb((db) => {
      const item = db.showcaseItems.find((candidate) => candidate.id === itemId);

      if (!item) {
        throw new Error("Item da vitrine não encontrado.");
      }

      item.name = parsed.data.name;
      item.description = parsed.data.description;
      item.price = parsed.data.price;
      item.estimatedPrintHours = parsed.data.estimatedPrintHours;
      item.fulfillmentType = parsed.data.fulfillmentType;
      item.stockQuantity =
        parsed.data.fulfillmentType === "STOCK"
          ? parsed.data.stockQuantity + restockQuantity
          : 0;
      item.imageUrl = uploadedImageUrl ?? (parsed.data.imageUrl?.trim() || undefined);
      item.active = parsed.data.active;
      item.updatedAt = new Date().toISOString();
    });

    revalidateAll();
    return {
      ok: true,
      message:
        parsed.data.fulfillmentType === "STOCK" && restockQuantity > 0
          ? "Item da vitrine atualizado com reposição de estoque aplicada."
          : "Item da vitrine atualizado com sucesso.",
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Não foi possível atualizar o item da vitrine.",
    };
  }
}

export async function deleteShowcaseItemAction(
  _previousState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireRoles([UserRole.ADMIN, UserRole.SUPERVISOR]);
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

      db.showcaseItems.splice(itemIndex, 1);
    });

    revalidateAll();
    return {
      ok: true,
      message: "Item da vitrine excluído com sucesso.",
    };
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
  await requireRoles([UserRole.ADMIN, UserRole.SUPERVISOR]);
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
        orderStage: status === "CLOSED" ? "RECEIVED" : undefined,
        plannedPrintMinutes: getPlannedMinutesFromHours(item.estimatedPrintHours * parsed.data.quantity),
        closedAt: status === "CLOSED" ? now : undefined,
        createdAt: now,
        updatedAt: now,
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
  await requireRoles([UserRole.ADMIN, UserRole.SUPERVISOR]);
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
      inquiry.updatedAt = now;
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
  await requireRoles([UserRole.ADMIN, UserRole.SUPERVISOR]);
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
  await requireRoles([UserRole.ADMIN, UserRole.SUPERVISOR]);
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
    inquiry.updatedAt = now;
  });

  revalidateAll();

  if (nextStatus === "CLOSED") {
    redirect("/admin?section=pedidos");
  }
}

export async function updateShowcaseInquiryOrderStageAction(formData: FormData) {
  await requireRoles([UserRole.ADMIN, UserRole.SUPERVISOR]);
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

    inquiry.orderStage = nextOrderStage;
    if (nextOrderStage === "PRINTING") {
      inquiry.printingStartedAt = now;
      inquiry.printingCompletedAt = undefined;
      inquiry.plannedPrintMinutes = getPlannedMinutesFromHours(
        (item?.estimatedPrintHours ?? 1) * inquiry.quantity,
      );
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
  });

  revalidateAll();

  if (completionNotificationUrl) {
    redirect(completionNotificationUrl);
  }
}

export async function assignShowcaseInquiryMachineAction(formData: FormData) {
  await requireRoles([UserRole.OPERATOR, UserRole.SUPERVISOR, UserRole.ADMIN]);
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
    }
    inquiry.updatedAt = now;

    if (nextOrderStage === "PRINTING") {
      machine.status = MachineStatus.BUSY;
      machine.progressPercent = Math.max(machine.progressPercent, 8);
      machine.timeRemainingMinutes = inquiry.plannedPrintMinutes ?? Math.max(machine.timeRemainingMinutes, 60);
      machine.updatedAt = now;
    }
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
  });

  revalidateAll();
}

export async function advanceOrderStatusAction(formData: FormData) {
  await requireRoles([UserRole.OPERATOR, UserRole.SUPERVISOR, UserRole.ADMIN]);
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
      label: "Status atualizado",
      details: `Pedido movido para ${nextStatus}.`,
      statusSnapshot: nextStatus,
      createdAt: now,
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
  await requireRoles([UserRole.OPERATOR, UserRole.SUPERVISOR, UserRole.ADMIN]);
  const machineId = String(formData.get("machineId") ?? "");
  const status = String(formData.get("status") ?? "") as MachineStatus;

  await updateDb((db) => {
    const machine = db.machines.find((item) => item.id === machineId);

    if (!machine) {
      throw new Error("Impressora não encontrada.");
    }

    machine.status = status;
    machine.updatedAt = new Date().toISOString();
  });

  revalidateAll();
}
