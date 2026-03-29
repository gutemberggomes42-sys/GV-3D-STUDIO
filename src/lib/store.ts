import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { PrintFlowDb } from "@/lib/db-types";
import { createInitialData } from "@/lib/seed-data";

const dataDirectory = path.join(process.cwd(), "storage");
const dataPath = path.join(dataDirectory, "printflow-db.json");

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function sortByDateDesc<T extends { createdAt: string }>(items: T[]) {
  return [...items].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

async function ensureDataFile() {
  await mkdir(dataDirectory, { recursive: true });

  try {
    await readFile(dataPath, "utf8");
  } catch {
    const initialData = createInitialData();
    await writeFile(dataPath, JSON.stringify(initialData, null, 2), "utf8");
  }
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
      };
    }),
    showcaseItems: (data.showcaseItems ?? initial.showcaseItems).map((item) => {
      const normalizedItem = item as Partial<PrintFlowDb["showcaseItems"][number]>;
      return {
        ...item,
        imageUrl: normalizedItem.imageUrl ?? undefined,
        fulfillmentType: normalizedItem.fulfillmentType ?? "STOCK",
        stockQuantity: normalizedItem.stockQuantity ?? 0,
        estimatedPrintHours: normalizedItem.estimatedPrintHours ?? 1,
        active: normalizedItem.active ?? true,
      };
    }),
    showcaseInquiries: (data.showcaseInquiries ?? initial.showcaseInquiries).map((inquiry) => {
      const normalizedInquiry = inquiry as Partial<PrintFlowDb["showcaseInquiries"][number]>;
      return {
        ...inquiry,
        customerEmail: normalizedInquiry.customerEmail ?? "",
        customerPhone: normalizedInquiry.customerPhone ?? undefined,
        source: normalizedInquiry.source ?? "CATALOG",
        notes: normalizedInquiry.notes ?? undefined,
        status: normalizedInquiry.status ?? "PENDING",
        orderStage:
          normalizedInquiry.status === "CLOSED"
            ? normalizedInquiry.orderStage ?? "RECEIVED"
            : undefined,
        assignedMachineId: normalizedInquiry.assignedMachineId ?? undefined,
        printingStartedAt: normalizedInquiry.printingStartedAt ?? undefined,
        printingCompletedAt: normalizedInquiry.printingCompletedAt ?? undefined,
        plannedPrintMinutes: normalizedInquiry.plannedPrintMinutes ?? 0,
      };
    }),
  };
}

export async function readDb() {
  await ensureDataFile();
  const contents = await readFile(dataPath, "utf8");
  return normalizeDb(JSON.parse(contents) as Partial<PrintFlowDb>);
}

export async function writeDb(data: PrintFlowDb) {
  await ensureDataFile();
  await writeFile(dataPath, JSON.stringify(data, null, 2), "utf8");
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
    orders: sortByDateDesc(db.orders),
    showcaseItems: sortByDateDesc(db.showcaseItems),
    showcaseInquiries: sortByDateDesc(db.showcaseInquiries),
  };
}

export function createId(prefix: string) {
  return `${prefix}_${randomUUID().replace(/-/g, "").slice(0, 10)}`;
}
