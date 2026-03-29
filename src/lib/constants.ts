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
import type {
  DbExpenseCategory,
  ShowcaseInquiryStatus,
  ShowcaseOrderStage,
} from "@/lib/db-types";

export const ownerEmail = "gutemberggg10@gmail.com";
export const ownerWhatsAppNumber = "5564996435078";
export const ownerWhatsAppDisplay = "(64) 99643-5078";

export const roleLabels: Record<UserRole, string> = {
  CLIENT: "Cliente",
  OPERATOR: "Operador",
  SUPERVISOR: "Supervisor",
  ADMIN: "Administrador",
};

export const technologyLabels: Record<PrintTechnology, string> = {
  FDM: "FDM",
  SLA: "SLA",
  RESIN: "Resina",
  SLS: "SLS",
};

export const priorityLabels: Record<Priority, string> = {
  LOW: "Baixa",
  MEDIUM: "Média",
  HIGH: "Alta",
  URGENT: "Urgente",
};

export const paymentStatusLabels: Record<PaymentStatus, string> = {
  PENDING: "Pendente",
  PARTIAL: "Parcial",
  PAID: "Pago",
  REFUNDED: "Estornado",
};

export const paymentMethodLabels: Record<PaymentMethod, string> = {
  PIX: "Pix",
  CARD: "Cartão",
  BOLETO: "Boleto",
  TRANSFER: "Transferência",
};

export const expenseCategoryLabels: Record<DbExpenseCategory, string> = {
  ENERGY: "Energia",
  LABOR: "Mão de obra",
  RENT: "Aluguel / estrutura",
  SHIPPING: "Envio / entrega",
  MARKETING: "Marketing",
  MACHINE_PARTS: "Peças / manutenção",
  SOFTWARE: "Software / serviços",
  OTHER: "Outro gasto",
};

export const finishLabels: Record<FinishLevel, string> = {
  RAW: "Bruto",
  STANDARD: "Padrão",
  PREMIUM: "Premium",
  PAINTED: "Pintado",
};

export const orderStatusMeta: Record<
  OrderStatus,
  { label: string; className: string }
> = {
  RECEIVED: {
    label: "Recebido",
    className: "bg-slate-500/15 text-slate-100 ring-slate-400/30",
  },
  ANALYSIS: {
    label: "Em análise",
    className: "bg-blue-500/15 text-blue-100 ring-blue-400/30",
  },
  WAITING_APPROVAL: {
    label: "Aguardando aprovação",
    className: "bg-amber-500/15 text-amber-100 ring-amber-400/30",
  },
  WAITING_PAYMENT: {
    label: "Aguardando pagamento",
    className: "bg-yellow-500/15 text-yellow-100 ring-yellow-400/30",
  },
  QUEUED: {
    label: "Em fila",
    className: "bg-violet-500/15 text-violet-100 ring-violet-400/30",
  },
  PRINTING: {
    label: "Imprimindo",
    className: "bg-cyan-500/15 text-cyan-100 ring-cyan-400/30",
  },
  POST_PROCESSING: {
    label: "Pós-processamento",
    className: "bg-fuchsia-500/15 text-fuchsia-100 ring-fuchsia-400/30",
  },
  QUALITY: {
    label: "Controle de qualidade",
    className: "bg-emerald-500/15 text-emerald-100 ring-emerald-400/30",
  },
  READY_TO_SHIP: {
    label: "Pronto para envio",
    className: "bg-lime-500/15 text-lime-100 ring-lime-400/30",
  },
  SHIPPED: {
    label: "Enviado",
    className: "bg-sky-500/15 text-sky-100 ring-sky-400/30",
  },
  COMPLETED: {
    label: "Finalizado",
    className: "bg-emerald-500/20 text-emerald-50 ring-emerald-400/30",
  },
  CANCELED: {
    label: "Cancelado",
    className: "bg-rose-500/15 text-rose-100 ring-rose-400/30",
  },
  FAILED_REWORK: {
    label: "Falhou / retrabalho",
    className: "bg-red-500/15 text-red-100 ring-red-400/30",
  },
};

export const machineStatusMeta: Record<
  MachineStatus,
  { label: string; className: string }
> = {
  AVAILABLE: {
    label: "Disponível",
    className: "bg-emerald-500/15 text-emerald-100 ring-emerald-400/30",
  },
  BUSY: {
    label: "Ocupada",
    className: "bg-cyan-500/15 text-cyan-100 ring-cyan-400/30",
  },
  PAUSED: {
    label: "Pausada",
    className: "bg-amber-500/15 text-amber-100 ring-amber-400/30",
  },
  MAINTENANCE: {
    label: "Manutenção",
    className: "bg-fuchsia-500/15 text-fuchsia-100 ring-fuchsia-400/30",
  },
  ERROR: {
    label: "Erro",
    className: "bg-red-500/15 text-red-100 ring-red-400/30",
  },
  OFFLINE: {
    label: "Offline",
    className: "bg-slate-500/15 text-slate-100 ring-slate-400/30",
  },
};

export const showcaseInquiryStatusMeta: Record<
  ShowcaseInquiryStatus,
  { label: string; className: string }
> = {
  PENDING: {
    label: "Aguardando retorno",
    className: "bg-amber-500/15 text-amber-100 ring-amber-400/30",
  },
  CLOSED: {
    label: "Fechado",
    className: "bg-emerald-500/20 text-emerald-50 ring-emerald-400/30",
  },
  NOT_CLOSED: {
    label: "Não fechado",
    className: "bg-rose-500/15 text-rose-100 ring-rose-400/30",
  },
};

export const showcaseOrderStageMeta: Record<
  ShowcaseOrderStage,
  { label: string; className: string }
> = {
  RECEIVED: orderStatusMeta.RECEIVED,
  ANALYSIS: orderStatusMeta.ANALYSIS,
  WAITING_APPROVAL: orderStatusMeta.WAITING_APPROVAL,
  WAITING_PAYMENT: orderStatusMeta.WAITING_PAYMENT,
  QUEUED: orderStatusMeta.QUEUED,
  PRINTING: orderStatusMeta.PRINTING,
  POST_PROCESSING: orderStatusMeta.POST_PROCESSING,
  QUALITY: orderStatusMeta.QUALITY,
  READY_TO_SHIP: orderStatusMeta.READY_TO_SHIP,
  SHIPPED: orderStatusMeta.SHIPPED,
  COMPLETED: orderStatusMeta.COMPLETED,
  FAILED_REWORK: orderStatusMeta.FAILED_REWORK,
  CANCELED: orderStatusMeta.CANCELED,
};

export const showcaseOrderStageOptions: ShowcaseOrderStage[] = [
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
];

export const dashboardRoutes: Array<{
  href: string;
  label: string;
  roles: UserRole[];
}> = [
  { href: "/", label: "Vitrine", roles: [UserRole.CLIENT, UserRole.OPERATOR, UserRole.SUPERVISOR, UserRole.ADMIN] },
  { href: "/portal", label: "Vitrine / WhatsApp", roles: [UserRole.CLIENT, UserRole.OPERATOR, UserRole.SUPERVISOR, UserRole.ADMIN] },
  { href: "/admin", label: "Painel administrativo", roles: [UserRole.SUPERVISOR, UserRole.ADMIN] },
  { href: "/producao", label: "Produção", roles: [UserRole.OPERATOR, UserRole.SUPERVISOR, UserRole.ADMIN] },
  { href: "/maquinas", label: "Máquinas / IoT", roles: [UserRole.OPERATOR, UserRole.SUPERVISOR, UserRole.ADMIN] },
  { href: "/filamentos", label: "Controle de filamento", roles: [UserRole.OPERATOR, UserRole.SUPERVISOR, UserRole.ADMIN] },
  { href: "/financeiro", label: "Financeiro", roles: [UserRole.SUPERVISOR, UserRole.ADMIN] },
];

export const allowed3dFormats = ["stl", "obj", "3mf"] as const;
