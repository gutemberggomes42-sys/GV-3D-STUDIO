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

export type IsoDateString = string;

export type DbUser = {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
  role: UserRole;
  phone?: string;
  company?: string;
  address?: string;
  projectType?: string;
  avatarColor: string;
  passwordChangedAt?: IsoDateString;
  createdAt: IsoDateString;
  updatedAt: IsoDateString;
};

export type DbSession = {
  id: string;
  token: string;
  userId: string;
  expiresAt: IsoDateString;
  createdAt: IsoDateString;
};

export type DbMaterial = {
  id: string;
  name: string;
  category: string;
  technology: PrintTechnology;
  color: string;
  brand: string;
  lot: string;
  stockAmount: number;
  unit: string;
  purchasePrice: number;
  spoolWeightGrams: number;
  spoolLengthMeters?: number;
  filamentDiameterMm?: number;
  costPerUnit: number;
  costPerMeter?: number;
  minimumStock: number;
  supplier?: string;
  leadTimeDays: number;
  createdAt: IsoDateString;
  updatedAt: IsoDateString;
};

export type DbMaintenanceRecord = {
  id: string;
  type: string;
  summary: string;
  status: string;
  scheduledAt: IsoDateString;
  completedAt?: IsoDateString;
  cost?: number;
  createdAt: IsoDateString;
};

export type DbMachine = {
  id: string;
  name: string;
  model: string;
  technology: PrintTechnology;
  buildVolumeX: number;
  buildVolumeY: number;
  buildVolumeZ: number;
  supportedMaterialNames: string;
  status: MachineStatus;
  responsibleOperator?: string;
  availableHours: number;
  failureRate: number;
  preventiveMaintenanceDays: number;
  lastMaintenanceAt?: IsoDateString;
  nozzleTemp?: number;
  bedTemp?: number;
  progressPercent: number;
  timeRemainingMinutes: number;
  webcamUrl?: string;
  location?: string;
  notes?: string;
  purchasePrice: number;
  amountPaid: number;
  purchasedAt?: IsoDateString;
  maintenanceRecords: DbMaintenanceRecord[];
  createdAt: IsoDateString;
  updatedAt: IsoDateString;
};

export type DbExpenseCategory =
  | "ENERGY"
  | "LABOR"
  | "RENT"
  | "SHIPPING"
  | "MARKETING"
  | "MACHINE_PARTS"
  | "SOFTWARE"
  | "OTHER";

export type DbPayableStatus = "PENDING" | "PAID" | "OVERDUE";

export type DbExpense = {
  id: string;
  title: string;
  category: DbExpenseCategory;
  amount: number;
  paidAt: IsoDateString;
  notes?: string;
  createdAt: IsoDateString;
  updatedAt: IsoDateString;
};

export type DbPayable = {
  id: string;
  title: string;
  category: DbExpenseCategory;
  amount: number;
  dueDate: IsoDateString;
  status: DbPayableStatus;
  paidAt?: IsoDateString;
  vendor?: string;
  notes?: string;
  createdAt: IsoDateString;
  updatedAt: IsoDateString;
};

export type DbPayment = {
  id: string;
  method: PaymentMethod;
  status: PaymentStatus;
  amount: number;
  dueDate?: IsoDateString;
  paidAt?: IsoDateString;
  referenceCode?: string;
  gateway?: string;
  createdAt: IsoDateString;
  updatedAt: IsoDateString;
};

export type DbOrderComment = {
  id: string;
  authorId?: string;
  message: string;
  internal: boolean;
  createdAt: IsoDateString;
};

export type DbOrderTimeline = {
  id: string;
  actorId?: string;
  label: string;
  details: string;
  statusSnapshot: OrderStatus;
  createdAt: IsoDateString;
};

export type DbQualityCheck = {
  id: string;
  inspectorId?: string;
  dimensionsOk: boolean;
  finishOk: boolean;
  deformationFree: boolean;
  colorOk: boolean;
  strengthOk: boolean;
  packagingOk: boolean;
  notes?: string;
  approved: boolean;
  createdAt: IsoDateString;
};

export type DbOrder = {
  id: string;
  orderNumber: string;
  title: string;
  type: string;
  description?: string;
  fileName: string;
  fileUrl: string;
  fileFormat: string;
  fileSizeKb: number;
  technology: PrintTechnology;
  quantity: number;
  color: string;
  finishLevel: FinishLevel;
  urgencyMultiplier: number;
  priority: Priority;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  boundingBoxX: number;
  boundingBoxY: number;
  boundingBoxZ: number;
  estimatedVolumeCm3: number;
  estimatedSupportCm3: number;
  estimatedHours: number;
  estimatedWeightGrams: number;
  estimatedMetersUsed: number;
  failureRisk: number;
  needsManualReview: boolean;
  materialCost: number;
  machineCost: number;
  energyCost: number;
  laborCost: number;
  finishingCost: number;
  packagingCost: number;
  subtotal: number;
  marginPercent: number;
  totalPrice: number;
  realCost?: number;
  grossMargin?: number;
  dueDate?: IsoDateString;
  approvedByCustomerAt?: IsoDateString;
  paidAt?: IsoDateString;
  shippedAt?: IsoDateString;
  deliveredAt?: IsoDateString;
  shippingCarrier?: string;
  trackingCode?: string;
  invoiceNumber?: string;
  queuePosition?: number;
  printingStartedAt?: IsoDateString;
  printingCompletedAt?: IsoDateString;
  plannedPrintMinutes?: number;
  materialConsumedAt?: IsoDateString;
  materialConsumptionGrams?: number;
  materialConsumptionValue?: number;
  materialName: string;
  materialId?: string;
  customerId: string;
  assignedMachineId?: string;
  assignedOperatorId?: string;
  reprintOfId?: string;
  payments: DbPayment[];
  comments: DbOrderComment[];
  timeline: DbOrderTimeline[];
  qualityChecks: DbQualityCheck[];
  createdAt: IsoDateString;
  updatedAt: IsoDateString;
};

export type ShowcaseInquiryStatus = "PENDING" | "CLOSED" | "NOT_CLOSED";
export type ShowcaseInquirySource = "CATALOG" | "MANUAL";
export type ShowcaseFulfillmentType = "STOCK" | "MADE_TO_ORDER";
export type ShowcaseLeadTemperature = "COLD" | "WARM" | "HOT";
export type ShowcaseOrderStage =
  | "RECEIVED"
  | "ANALYSIS"
  | "WAITING_APPROVAL"
  | "WAITING_PAYMENT"
  | "QUEUED"
  | "PRINTING"
  | "POST_PROCESSING"
  | "QUALITY"
  | "READY_TO_SHIP"
  | "SHIPPED"
  | "COMPLETED"
  | "FAILED_REWORK"
  | "CANCELED";

export type DbShowcaseItem = {
  id: string;
  name: string;
  category: string;
  tagline?: string;
  description: string;
  price: number;
  materialLabel?: string;
  materialId?: string;
  colorOptions: string[];
  dimensionSummary?: string;
  leadTimeDays: number;
  imageUrl?: string;
  videoUrl?: string;
  galleryImageUrls: string[];
  fulfillmentType: ShowcaseFulfillmentType;
  stockQuantity: number;
  estimatedPrintHours: number;
  estimatedMaterialGrams: number;
  featured: boolean;
  active: boolean;
  createdAt: IsoDateString;
  updatedAt: IsoDateString;
};

export type DbShowcaseInquiry = {
  id: string;
  itemId: string;
  itemName: string;
  orderNumber?: string;
  quantity: number;
  customerId: string;
  customerName: string;
  customerEmail: string;
  customerPhone?: string;
  source: ShowcaseInquirySource;
  notes?: string;
  ownerEmail: string;
  whatsappNumber: string;
  whatsappUrl: string;
  status: ShowcaseInquiryStatus;
  tags: string[];
  leadTemperature: ShowcaseLeadTemperature;
  followUpAt?: IsoDateString;
  lastContactAt?: IsoDateString;
  orderStage?: ShowcaseOrderStage;
  assignedMachineId?: string;
  printingStartedAt?: IsoDateString;
  printingCompletedAt?: IsoDateString;
  plannedPrintMinutes?: number;
  materialConsumedAt?: IsoDateString;
  materialConsumptionGrams?: number;
  materialConsumptionValue?: number;
  dueDate?: IsoDateString;
  closedAt?: IsoDateString;
  createdAt: IsoDateString;
  updatedAt: IsoDateString;
};

export type DbAuditLog = {
  id: string;
  actorId?: string;
  area: string;
  action: string;
  summary: string;
  createdAt: IsoDateString;
};

export type DbBackupSnapshot = {
  fileName: string;
  createdAt: IsoDateString;
  sizeBytes: number;
};

export type PrintFlowDb = {
  users: DbUser[];
  sessions: DbSession[];
  materials: DbMaterial[];
  machines: DbMachine[];
  expenses: DbExpense[];
  payables: DbPayable[];
  orders: DbOrder[];
  showcaseItems: DbShowcaseItem[];
  showcaseInquiries: DbShowcaseInquiry[];
  auditLogs: DbAuditLog[];
};
