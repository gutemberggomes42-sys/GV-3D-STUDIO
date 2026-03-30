import { randomUUID } from "node:crypto";
import { mkdir, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { hashSync } from "bcryptjs";
import { UserRole } from "@prisma/client";
import { ownerEmail } from "@/lib/constants";
import type { DbBackupSnapshot, PrintFlowDb } from "@/lib/db-types";
import { createInitialData } from "@/lib/seed-data";

const dataDirectory = path.join(process.cwd(), "storage");
const dataPath = path.join(dataDirectory, "printflow-db.json");
const backupDirectory = path.join(dataDirectory, "backups");
const maxBackupFiles = 30;

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function sortByDateDesc<T extends { createdAt: string }>(items: T[]) {
  return [...items].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

async function ensureDataFile() {
  await mkdir(dataDirectory, { recursive: true });
  await mkdir(backupDirectory, { recursive: true });

  try {
    await readFile(dataPath, "utf8");
  } catch {
    const initialData = createInitialData();
    await writeFile(dataPath, JSON.stringify(initialData, null, 2), "utf8");
  }
}

async function ensureOwnerBootstrap(data: PrintFlowDb) {
  const bootstrapPassword = process.env.OWNER_BOOTSTRAP_PASSWORD?.trim();

  if (!bootstrapPassword) {
    return data;
  }

  const bootstrapEmail = (process.env.OWNER_BOOTSTRAP_EMAIL?.trim() || ownerEmail).toLowerCase();
  const bootstrapName = process.env.OWNER_BOOTSTRAP_NAME?.trim() || "Guto";
  const bootstrapPhone = process.env.OWNER_BOOTSTRAP_PHONE?.trim() || "64996435078";
  const now = new Date().toISOString();

  const existingUser = data.users.find(
    (user) => user.email.toLowerCase() === bootstrapEmail,
  );

  if (existingUser) {
    if (existingUser.role !== UserRole.ADMIN) {
      existingUser.role = UserRole.ADMIN;
      existingUser.updatedAt = now;
      await writeDb(data);
    }

    return data;
  }

  data.users.unshift({
    id: createId("usr"),
    name: bootstrapName,
    email: bootstrapEmail,
    passwordHash: hashSync(bootstrapPassword, 10),
    role: UserRole.ADMIN,
    phone: bootstrapPhone,
    company: "PrintFlow 3D",
    address: "A configurar",
    projectType: "Vitrine e vendas",
    avatarColor: "#ffc857",
    createdAt: now,
    updatedAt: now,
  });

  await writeDb(data);
  return data;
}

function normalizeDb(data: Partial<PrintFlowDb>): PrintFlowDb {
  const initial = createInitialData();

  return {
    users: data.users ?? initial.users,
    sessions: data.sessions ?? initial.sessions,
    materials: (data.materials ?? initial.materials).map((material) => {
      const normalizedMaterial = material as Partial<PrintFlowDb["materials"][number]>;
      return {
        ...material,
        purchasePrice: normalizedMaterial.purchasePrice ?? 0,
        spoolWeightGrams: normalizedMaterial.spoolWeightGrams ?? material.stockAmount ?? 0,
        spoolLengthMeters: normalizedMaterial.spoolLengthMeters ?? 0,
        filamentDiameterMm: normalizedMaterial.filamentDiameterMm ?? 1.75,
        costPerUnit: normalizedMaterial.costPerUnit ?? 0,
        costPerMeter: normalizedMaterial.costPerMeter ?? 0,
      };
    }),
    machines: (data.machines ?? initial.machines).map((machine) => {
      const normalizedMachine = machine as Partial<PrintFlowDb["machines"][number]>;
      return {
        ...machine,
        purchasePrice: normalizedMachine.purchasePrice ?? 0,
        amountPaid: normalizedMachine.amountPaid ?? 0,
        purchasedAt: normalizedMachine.purchasedAt ?? machine.createdAt,
      };
    }),
    expenses: (data.expenses ?? initial.expenses).map((expense) => ({
      ...expense,
      notes: expense.notes ?? undefined,
    })),
    payables: (data.payables ?? initial.payables).map((payable) => ({
      ...payable,
      status:
        payable.status === "PAID"
          ? "PAID"
          : new Date(payable.dueDate).getTime() < Date.now()
            ? "OVERDUE"
            : "PENDING",
      paidAt: payable.paidAt ?? undefined,
      vendor: payable.vendor ?? undefined,
      notes: payable.notes ?? undefined,
    })),
    orders: (data.orders ?? initial.orders).map((order) => {
      const normalizedOrder = order as Partial<PrintFlowDb["orders"][number]>;
      return {
        ...order,
        estimatedMetersUsed: normalizedOrder.estimatedMetersUsed ?? 0,
        printingStartedAt: normalizedOrder.printingStartedAt ?? undefined,
        printingCompletedAt: normalizedOrder.printingCompletedAt ?? undefined,
        plannedPrintMinutes:
          normalizedOrder.plannedPrintMinutes ??
          Math.max(Math.round((normalizedOrder.estimatedHours ?? order.estimatedHours ?? 0) * 60), 0),
        materialConsumedAt: normalizedOrder.materialConsumedAt ?? undefined,
        materialConsumptionGrams: normalizedOrder.materialConsumptionGrams ?? 0,
        materialConsumptionValue: normalizedOrder.materialConsumptionValue ?? 0,
      };
    }),
    showcaseItems: (data.showcaseItems ?? initial.showcaseItems).map((item) => {
      const normalizedItem = item as Partial<PrintFlowDb["showcaseItems"][number]>;
      return {
        ...item,
        category: normalizedItem.category?.trim() || "Colecao PrintFlow",
        tagline: normalizedItem.tagline?.trim() || undefined,
        imageUrl: normalizedItem.imageUrl ?? undefined,
        materialLabel: normalizedItem.materialLabel?.trim() || undefined,
        materialId: normalizedItem.materialId ?? undefined,
        colorOptions:
          normalizedItem.colorOptions?.map((entry) => entry.trim()).filter(Boolean) ?? [],
        dimensionSummary: normalizedItem.dimensionSummary?.trim() || undefined,
        leadTimeDays:
          normalizedItem.leadTimeDays ??
          (normalizedItem.fulfillmentType === "MADE_TO_ORDER" ? 5 : 0),
        videoUrl: normalizedItem.videoUrl ?? undefined,
        galleryImageUrls:
          normalizedItem.galleryImageUrls?.map((entry) => entry.trim()).filter(Boolean) ?? [],
        fulfillmentType: normalizedItem.fulfillmentType ?? "STOCK",
        stockQuantity: normalizedItem.stockQuantity ?? 0,
        estimatedPrintHours: normalizedItem.estimatedPrintHours ?? 1,
        estimatedMaterialGrams: normalizedItem.estimatedMaterialGrams ?? 0,
        featured: normalizedItem.featured ?? false,
        active: normalizedItem.active ?? true,
      };
    }),
    showcaseInquiries: (data.showcaseInquiries ?? initial.showcaseInquiries).map((inquiry) => {
      const normalizedInquiry = inquiry as Partial<PrintFlowDb["showcaseInquiries"][number]>;
      return {
        ...inquiry,
        orderNumber: normalizedInquiry.orderNumber ?? undefined,
        customerEmail: normalizedInquiry.customerEmail ?? "",
        customerPhone: normalizedInquiry.customerPhone ?? undefined,
        source: normalizedInquiry.source ?? "CATALOG",
        notes: normalizedInquiry.notes ?? undefined,
        status: normalizedInquiry.status ?? "PENDING",
        tags: normalizedInquiry.tags?.map((entry) => entry.trim()).filter(Boolean) ?? [],
        leadTemperature: normalizedInquiry.leadTemperature ?? "WARM",
        followUpAt: normalizedInquiry.followUpAt ?? undefined,
        lastContactAt: normalizedInquiry.lastContactAt ?? undefined,
        orderStage:
          normalizedInquiry.status === "CLOSED"
            ? normalizedInquiry.orderStage ?? "RECEIVED"
            : undefined,
        assignedMachineId: normalizedInquiry.assignedMachineId ?? undefined,
        printingStartedAt: normalizedInquiry.printingStartedAt ?? undefined,
        printingCompletedAt: normalizedInquiry.printingCompletedAt ?? undefined,
        plannedPrintMinutes: normalizedInquiry.plannedPrintMinutes ?? 0,
        materialConsumedAt: normalizedInquiry.materialConsumedAt ?? undefined,
        materialConsumptionGrams: normalizedInquiry.materialConsumptionGrams ?? 0,
        materialConsumptionValue: normalizedInquiry.materialConsumptionValue ?? 0,
        dueDate: normalizedInquiry.dueDate ?? undefined,
      };
    }),
    auditLogs: (data.auditLogs ?? initial.auditLogs).map((entry) => ({
      ...entry,
      actorId: entry.actorId ?? undefined,
    })),
  };
}

export async function readDb() {
  await ensureDataFile();
  const contents = await readFile(dataPath, "utf8");
  const normalizedData = normalizeDb(JSON.parse(contents) as Partial<PrintFlowDb>);
  return ensureOwnerBootstrap(normalizedData);
}

export async function writeDb(data: PrintFlowDb) {
  await ensureDataFile();
  const serialized = JSON.stringify(data, null, 2);
  await writeFile(dataPath, serialized, "utf8");
  await saveBackupSnapshot(serialized);
}

async function saveBackupSnapshot(serialized: string) {
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const fileName = `printflow-backup-${stamp}.json`;
  const backupPath = path.join(backupDirectory, fileName);
  await writeFile(backupPath, serialized, "utf8");

  const backupFiles = (await readdir(backupDirectory))
    .filter((entry) => entry.endsWith(".json"))
    .sort((left, right) => right.localeCompare(left));

  const staleFiles = backupFiles.slice(maxBackupFiles);

  await Promise.all(
    staleFiles.map((entry) => rm(path.join(backupDirectory, entry), { force: true })),
  );
}

export async function listBackupSnapshots(): Promise<DbBackupSnapshot[]> {
  await ensureDataFile();
  const entries = await readdir(backupDirectory);
  const jsonFiles = entries.filter((entry) => entry.endsWith(".json"));
  const snapshots = await Promise.all(
    jsonFiles.map(async (fileName) => {
      const filePath = path.join(backupDirectory, fileName);
      const fileStat = await stat(filePath);
      return {
        fileName,
        createdAt: fileStat.birthtime.toISOString(),
        sizeBytes: fileStat.size,
      };
    }),
  );

  return snapshots.sort((left, right) => right.createdAt.localeCompare(left.createdAt));
}

export function getBackupFilePath(fileName: string) {
  return path.join(backupDirectory, path.basename(fileName));
}

let updateQueue = Promise.resolve();

export async function updateDb<T>(updater: (data: PrintFlowDb) => Promise<T> | T) {
  let release: (() => void) | undefined;
  const nextQueue = new Promise<void>((resolve) => {
    release = resolve;
  });

  const previousQueue = updateQueue;
  updateQueue = nextQueue;

  await previousQueue;

  try {
    const data = await readDb();
    const result = await updater(data);
    await writeDb(data);
    return result;
  } finally {
    release?.();
  }
}

export async function getSnapshot() {
  const db = await readDb();

  return {
    users: clone(db.users),
    materials: clone(db.materials),
    machines: clone(db.machines),
    expenses: clone(db.expenses),
    payables: clone(db.payables),
    orders: sortByDateDesc(db.orders),
    showcaseItems: sortByDateDesc(db.showcaseItems),
    showcaseInquiries: sortByDateDesc(db.showcaseInquiries),
    auditLogs: sortByDateDesc(db.auditLogs),
  };
}

export function createId(prefix: string) {
  return `${prefix}_${randomUUID().replace(/-/g, "").slice(0, 10)}`;
}
