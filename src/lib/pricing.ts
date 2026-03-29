import {
  FinishLevel,
  Priority,
  PrintTechnology,
} from "@prisma/client";
import { addDays } from "date-fns";
import type { DbMaterial } from "@/lib/db-types";

type QuoteMaterial = Pick<
  DbMaterial,
  | "id"
  | "name"
  | "technology"
  | "purchasePrice"
  | "costPerUnit"
  | "costPerMeter"
  | "stockAmount"
  | "unit"
  | "spoolWeightGrams"
  | "spoolLengthMeters"
>;

type DimensionInput = {
  x: number;
  y: number;
  z: number;
};

type QuoteInput = {
  fileName: string;
  fileSizeBytes: number;
  dimensions: DimensionInput;
  quantity: number;
  finishLevel: FinishLevel;
  priority: Priority;
  material: QuoteMaterial;
};

type MachineCandidate = {
  id: string;
  name: string;
  status: string;
  technology: PrintTechnology;
  buildVolumeX: number;
  buildVolumeY: number;
  buildVolumeZ: number;
  supportedMaterialNames: string;
  failureRate: number;
};

type OrderShape = {
  technology: PrintTechnology;
  boundingBoxX: number;
  boundingBoxY: number;
  boundingBoxZ: number;
  materialName: string;
};

const densityByTechnology: Record<PrintTechnology, number> = {
  FDM: 1.24,
  SLA: 1.16,
  RESIN: 1.12,
  SLS: 0.98,
};

const fillFactorByTechnology: Record<PrintTechnology, number> = {
  FDM: 0.18,
  SLA: 0.23,
  RESIN: 0.2,
  SLS: 0.24,
};

const supportFactorByTechnology: Record<PrintTechnology, number> = {
  FDM: 0.12,
  SLA: 0.18,
  RESIN: 0.22,
  SLS: 0.08,
};

const machineRateByTechnology: Record<PrintTechnology, number> = {
  FDM: 16,
  SLA: 22,
  RESIN: 24,
  SLS: 32,
};

const finishMultiplier: Record<FinishLevel, number> = {
  RAW: 1,
  STANDARD: 1.08,
  PREMIUM: 1.18,
  PAINTED: 1.32,
};

const priorityMultiplier: Record<Priority, number> = {
  LOW: 0.95,
  MEDIUM: 1,
  HIGH: 1.12,
  URGENT: 1.24,
};

function round(value: number) {
  return Number(value.toFixed(2));
}

export function getMaterialDerivedMetrics(material: Pick<
  DbMaterial,
  "purchasePrice" | "spoolWeightGrams" | "spoolLengthMeters" | "stockAmount"
>) {
  const costPerGram =
    material.spoolWeightGrams > 0 ? material.purchasePrice / material.spoolWeightGrams : 0;
  const gramsPerMeter =
    material.spoolLengthMeters && material.spoolLengthMeters > 0
      ? material.spoolWeightGrams / material.spoolLengthMeters
      : 0;
  const costPerMeter =
    material.spoolLengthMeters && material.spoolLengthMeters > 0
      ? material.purchasePrice / material.spoolLengthMeters
      : 0;
  const stockMetersRemaining = gramsPerMeter > 0 ? material.stockAmount / gramsPerMeter : 0;

  return {
    costPerGram: round(costPerGram),
    gramsPerMeter: round(gramsPerMeter),
    costPerMeter: round(costPerMeter),
    stockMetersRemaining: round(stockMetersRemaining),
  };
}

export function getFileExtension(fileName: string) {
  return fileName.split(".").pop()?.toLowerCase() ?? "";
}

export function sanitizeFileName(fileName: string) {
  return fileName
    .normalize("NFD")
    .replace(/[^\w.\-]+/g, "-")
    .replace(/-+/g, "-")
    .toLowerCase();
}

export function buildQuote(input: QuoteInput) {
  const { dimensions, quantity, material, finishLevel, priority, fileSizeBytes } = input;
  const materialMetrics = getMaterialDerivedMetrics({
    purchasePrice: material.purchasePrice,
    spoolWeightGrams: material.spoolWeightGrams,
    spoolLengthMeters: material.spoolLengthMeters,
    stockAmount: material.stockAmount,
  });
  const baseVolume = dimensions.x * dimensions.y * dimensions.z;
  const fillFactor = fillFactorByTechnology[material.technology];
  const supportFactor = supportFactorByTechnology[material.technology];
  const density = densityByTechnology[material.technology];
  const materialVolume = baseVolume * fillFactor;
  const supportVolume = materialVolume * supportFactor;
  const estimatedVolumeCm3 = materialVolume + supportVolume;
  const estimatedWeightGrams = estimatedVolumeCm3 * density * quantity;
  const estimatedMetersUsed =
    materialMetrics.gramsPerMeter > 0 ? estimatedWeightGrams / materialMetrics.gramsPerMeter : 0;
  const estimatedHours =
    ((estimatedVolumeCm3 * quantity) / machineRateByTechnology[material.technology]) *
    finishMultiplier[finishLevel];
  const fileFactor = Math.min(fileSizeBytes / 1_000_000, 4);
  const failureRisk = Math.min(
    92,
    Math.round(
      16 +
        (dimensions.z > dimensions.x + dimensions.y ? 18 : 6) +
        fileFactor * 9 +
        (finishLevel === FinishLevel.PAINTED ? 10 : 0) +
        (priority === Priority.URGENT ? 8 : 0),
    ),
  );
  const materialCost =
    material.costPerMeter && material.costPerMeter > 0
      ? estimatedMetersUsed * material.costPerMeter
      : estimatedWeightGrams * material.costPerUnit;
  const machineCost = estimatedHours * 18;
  const energyCost = estimatedHours * 1.95;
  const laborCost = quantity * 11 * finishMultiplier[finishLevel];
  const finishingCost = quantity * 7.5 * (finishMultiplier[finishLevel] - 0.2);
  const packagingCost = 8 + quantity * 1.6;
  const subtotal =
    (materialCost + machineCost + energyCost + laborCost + finishingCost + packagingCost) *
    priorityMultiplier[priority];
  const marginPercent =
    23 +
    (priority === Priority.URGENT ? 8 : priority === Priority.HIGH ? 5 : 0) +
    (finishLevel === FinishLevel.PAINTED ? 6 : finishLevel === FinishLevel.PREMIUM ? 3 : 0);
  const totalPrice = subtotal * (1 + marginPercent / 100);
  const leadDays = Math.max(2, Math.ceil(estimatedHours / 10) + (priority === Priority.URGENT ? 0 : 2));

  return {
    technology: material.technology,
    quantity,
    estimatedVolumeCm3: round(estimatedVolumeCm3),
    estimatedSupportCm3: round(supportVolume),
    estimatedHours: round(estimatedHours),
    estimatedWeightGrams: round(estimatedWeightGrams),
    estimatedMetersUsed: round(estimatedMetersUsed),
    failureRisk,
    needsManualReview: failureRisk >= 70 || estimatedWeightGrams > material.stockAmount,
    materialCost: round(materialCost),
    machineCost: round(machineCost),
    energyCost: round(energyCost),
    laborCost: round(laborCost),
    finishingCost: round(finishingCost),
    packagingCost: round(packagingCost),
    subtotal: round(subtotal),
    marginPercent: round(marginPercent),
    totalPrice: round(totalPrice),
    dueDate: addDays(new Date(), leadDays),
    urgencyMultiplier: priorityMultiplier[priority],
  };
}

export function recommendMachine(
  order: OrderShape,
  machines: MachineCandidate[],
) {
  const compatibleMachines = machines
    .filter((machine) => machine.technology === order.technology)
    .filter((machine) => machine.buildVolumeX >= order.boundingBoxX)
    .filter((machine) => machine.buildVolumeY >= order.boundingBoxY)
    .filter((machine) => machine.buildVolumeZ >= order.boundingBoxZ)
    .filter((machine) =>
      machine.supportedMaterialNames.toLowerCase().includes(order.materialName.toLowerCase()),
    )
    .sort((a, b) => {
      if (a.status !== b.status) {
        return a.status === "AVAILABLE" ? -1 : 1;
      }

      return a.failureRate - b.failureRate;
    });

  return compatibleMachines[0] ?? null;
}
