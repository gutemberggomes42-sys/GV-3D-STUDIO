import Link from "next/link";
import { MachineStatus, OrderStatus, UserRole } from "@prisma/client";
import { AccountSecurityForm } from "@/components/account-security-form";
import { AppShell } from "@/components/app-shell";
import { MachineEditor } from "@/components/machine-editor";
import { MachineForm } from "@/components/machine-form";
import { MaterialEditor } from "@/components/material-editor";
import { MaterialForm } from "@/components/material-form";
import { MetricCard } from "@/components/metric-card";
import { ShowcaseDeliveryManager } from "@/components/showcase-delivery-manager";
import { ShowcaseInquiryEditor } from "@/components/showcase-inquiry-editor";
import { ShowcaseInquiryForm } from "@/components/showcase-inquiry-form";
import { ShowcaseItemEditor } from "@/components/showcase-item-editor";
import { ShowcaseItemForm } from "@/components/showcase-item-form";
import { ShowcaseTestimonialEditor } from "@/components/showcase-testimonial-editor";
import { ShowcaseTestimonialForm } from "@/components/showcase-testimonial-form";
import { StatusPill } from "@/components/status-pill";
import { StorefrontSettingsForm } from "@/components/storefront-settings-form";
import { SubmitButton } from "@/components/submit-button";
import {
  advanceOrderStatusAction,
  bulkUpdateShowcaseInquiryAction,
  bulkUpdateShowcaseItemsAction,
  createBackupSnapshotAction,
  deleteBackupSnapshotAction,
  restoreBackupSnapshotAction,
  updateMachineStatusAction,
  updateShowcaseInquiryOrderStageAction,
} from "@/lib/actions";
import { requireRoles } from "@/lib/auth";
import {
  payableStatusLabels,
  machineStatusMeta,
  orderStatusMeta,
  showcaseInquiryStatusMeta,
  showcaseLeadTemperatureMeta,
  showcaseOrderStageMeta,
  showcaseOrderStageOptions,
  technologyLabels,
} from "@/lib/constants";
import {
  formatCurrency,
  formatDateTime,
  formatHours,
  formatWeight,
} from "@/lib/format";
import {
  getHydratedData,
  getOverviewMetrics,
  groupOrdersByStatus,
} from "@/lib/view-data";
import { isGeneratedCustomerEmail } from "@/lib/customer-records";
import {
  getShowcaseAvailabilityLabel,
  getShowcaseLeadTimeLabel,
  getShowcasePrimaryImage,
  getShowcasePrimaryVideo,
  getShowcaseTagline,
} from "@/lib/showcase";
import { getSuggestedCarrier } from "@/lib/shipping";
import { listBackupSnapshots } from "@/lib/store";
import { cn } from "@/lib/utils";

type AdminSection =
  | "summary"
  | "vitrine"
  | "configuracoes"
  | "leads"
  | "pedidos"
  | "clientes"
  | "materiais"
  | "maquinas";

type AdminPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

type AdminSearchType =
  | "all"
  | "orders"
  | "showcase"
  | "leads"
  | "customers"
  | "materials"
  | "machines";

type AdminSearchStatusFilter = "all" | "active" | "closed" | "attention";
type AdminSearchPeriod = "all" | "today" | "7d" | "30d";

const adminSections: Array<{
  key: AdminSection;
  label: string;
  description: string;
}> = [
  { key: "summary", label: "Resumo", description: "Visão geral e atalhos do dono" },
  { key: "vitrine", label: "Vitrine", description: "Cadastrar e editar produtos expostos" },
  { key: "configuracoes", label: "Configurações", description: "Banner, textos e presença da marca" },
  { key: "leads", label: "Leads", description: "Ver quem chamou no WhatsApp" },
  { key: "pedidos", label: "Pedidos", description: "Faturamento, fila e andamento" },
  { key: "clientes", label: "Clientes", description: "Carteira e recorrência" },
  { key: "materiais", label: "Materiais", description: "Filamentos, resinas e custo real" },
  { key: "maquinas", label: "Máquinas", description: "Impressoras, status e manutenção" },
];

function isAdminSection(value: string | undefined): value is AdminSection {
  return adminSections.some((section) => section.key === value);
}

function getSectionHref(section: AdminSection) {
  return section === "summary" ? "/admin" : `/admin?section=${section}`;
}

function normalizeSearchText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function matchesSearch(query: string, ...parts: Array<string | number | undefined | null>) {
  if (!query) {
    return false;
  }

  const haystack = normalizeSearchText(
    parts
      .filter((part) => part != null)
      .map((part) => String(part))
      .join(" "),
  );

  return haystack.includes(query);
}

function getShowcaseInquiryTotalValue(
  inquiry: { quantity: number; estimatedTotal?: number; freightEstimate?: number },
  fallbackItemPrice: number,
) {
  return (inquiry.estimatedTotal ?? fallbackItemPrice * inquiry.quantity) + (inquiry.freightEstimate ?? 0);
}

function formatShortDate(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function isSearchType(value: string | undefined): value is AdminSearchType {
  return ["all", "orders", "showcase", "leads", "customers", "materials", "machines"].includes(
    value ?? "",
  );
}

function isSearchStatusFilter(value: string | undefined): value is AdminSearchStatusFilter {
  return ["all", "active", "closed", "attention"].includes(value ?? "");
}

function isSearchPeriod(value: string | undefined): value is AdminSearchPeriod {
  return ["all", "today", "7d", "30d"].includes(value ?? "");
}

function isWithinSearchPeriod(
  value: string | undefined,
  period: AdminSearchPeriod,
  now = Date.now(),
) {
  if (period === "all") {
    return true;
  }

  if (!value) {
    return false;
  }

  const time = new Date(value).getTime();

  if (Number.isNaN(time)) {
    return false;
  }

  if (period === "today") {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    return time >= todayStart.getTime();
  }

  const days = period === "7d" ? 7 : 30;
  return time >= now - days * 24 * 60 * 60 * 1000;
}

export default async function AdminPage({ searchParams }: AdminPageProps) {
  const user = await requireRoles([UserRole.SUPERVISOR, UserRole.ADMIN]);
  const params = searchParams ? await searchParams : {};
  const rawSection = typeof params.section === "string" ? params.section : undefined;
  const message = typeof params.message === "string" ? params.message : undefined;
  const error = typeof params.error === "string" ? params.error : undefined;
  const rawQuery = typeof params.q === "string" ? params.q : "";
  const rawSearchType = typeof params.type === "string" ? params.type : undefined;
  const rawStatusFilter = typeof params.statusFilter === "string" ? params.statusFilter : undefined;
  const rawPeriod = typeof params.period === "string" ? params.period : undefined;
  const searchQuery = rawQuery.trim();
  const normalizedSearchQuery = normalizeSearchText(searchQuery);
  const searchType = isSearchType(rawSearchType) ? rawSearchType : "all";
  const searchStatusFilter = isSearchStatusFilter(rawStatusFilter) ? rawStatusFilter : "all";
  const searchPeriod = isSearchPeriod(rawPeriod) ? rawPeriod : "all";
  const activeSection = isAdminSection(rawSection) ? rawSection : "summary";
  const {
    orders,
    materials,
    machines,
    users,
    expenses,
    payables,
    storefrontSettings,
    showcaseItems,
    showcaseTestimonials,
    showcaseInquiries,
    auditLogs,
  } = await getHydratedData();
  const backupSnapshots = await listBackupSnapshots();
  const now = new Date().getTime();
  const dayInMs = 24 * 60 * 60 * 1000;
  const overview = getOverviewMetrics(orders, machines, materials);
  const ordersByStatus = groupOrdersByStatus(orders);

  const showcaseActiveCount = showcaseItems.filter((item) => item.active).length;
  const showcaseOutOfStockCount = showcaseItems.filter(
    (item) => item.fulfillmentType === "STOCK" && item.stockQuantity <= 0,
  ).length;
  const showcaseViewsTotal = showcaseItems.reduce((sum, item) => sum + item.viewCount, 0);
  const showcaseClicksTotal = showcaseItems.reduce((sum, item) => sum + item.whatsappClickCount, 0);
  const showcaseConversionRate =
    showcaseViewsTotal > 0 ? ((showcaseClicksTotal / showcaseViewsTotal) * 100).toFixed(1) : "0.0";
  const showcaseCriticalStockItems = showcaseItems.filter(
    (item) => item.active && item.fulfillmentType === "STOCK" && item.stockQuantity < 2,
  );
  const leadsPendingCount = showcaseInquiries.filter((item) => item.status === "PENDING").length;
  const leadsClosedCount = showcaseInquiries.filter((item) => item.status === "CLOSED").length;
  const hotLeadCount = showcaseInquiries.filter(
    (item) => item.status === "PENDING" && item.leadTemperature === "HOT",
  ).length;
  const dueFollowUpLeads = showcaseInquiries.filter(
    (item) =>
      item.status === "PENDING" &&
      item.followUpAt &&
      new Date(item.followUpAt).getTime() <= now,
  );
  const staleLeadCount = showcaseInquiries.filter((item) => {
    if (item.status !== "PENDING") {
      return false;
    }

    const lastTouch = item.lastContactAt ?? item.createdAt;
    return now - new Date(lastTouch).getTime() >= 2 * dayInMs;
  }).length;
  const closedShowcaseOrders = showcaseInquiries.filter((item) => item.status === "CLOSED");
  const showcaseItemPriceMap = new Map(showcaseItems.map((item) => [item.id, item.price]));
  const topShowcaseByClicks = [...showcaseItems]
    .sort((left, right) => right.whatsappClickCount - left.whatsappClickCount || right.viewCount - left.viewCount)
    .slice(0, 5);
  const topShowcaseByViews = [...showcaseItems]
    .sort((left, right) => right.viewCount - left.viewCount || right.whatsappClickCount - left.whatsappClickCount)
    .slice(0, 5);
  const showcaseRevenueValue = closedShowcaseOrders
    .filter((item) => (item.orderStage ?? "RECEIVED") === "COMPLETED")
    .reduce(
      (sum, item) =>
        sum + getShowcaseInquiryTotalValue(item, showcaseItemPriceMap.get(item.itemId) ?? 0),
      0,
    );
  const showcasePendingRevenue = closedShowcaseOrders
    .filter((item) => {
      const stage = item.orderStage ?? "RECEIVED";
      return stage !== "COMPLETED" && stage !== "CANCELED";
    })
    .reduce(
      (sum, item) =>
        sum + getShowcaseInquiryTotalValue(item, showcaseItemPriceMap.get(item.itemId) ?? 0),
      0,
    );
  const showcaseActiveOrdersCount = closedShowcaseOrders.filter((item) => {
    const stage = item.orderStage ?? "RECEIVED";
    return stage !== "COMPLETED" && stage !== "CANCELED";
  }).length;
  const summaryRevenue = overview.revenue + showcaseRevenueValue;
  const summaryPendingRevenue = overview.pendingRevenue + showcasePendingRevenue;
  const summaryActiveOrders = overview.activeOrders + showcaseActiveOrdersCount;
  const summaryMachinesBusy = new Set([
    ...machines.filter((machine) => machine.status === MachineStatus.BUSY).map((machine) => machine.id),
    ...closedShowcaseOrders
      .filter((item) => item.orderStage === "PRINTING" && item.assignedMachineId)
      .map((item) => item.assignedMachineId as string),
  ]).size;
  const showcaseOrdersByStage = showcaseOrderStageOptions.reduce<Record<string, number>>(
    (accumulator, stage) => {
      accumulator[stage] = closedShowcaseOrders.filter(
        (item) => (item.orderStage ?? "RECEIVED") === stage,
      ).length;
      return accumulator;
    },
    {},
  );
  const showcaseCountsByOrderStatus: Partial<Record<OrderStatus, number>> = {
    [OrderStatus.RECEIVED]: showcaseOrdersByStage.RECEIVED ?? 0,
    [OrderStatus.ANALYSIS]: 0,
    [OrderStatus.WAITING_APPROVAL]: 0,
    [OrderStatus.WAITING_PAYMENT]: showcaseOrdersByStage.WAITING_PAYMENT ?? 0,
    [OrderStatus.QUEUED]: showcaseOrdersByStage.QUEUED ?? 0,
    [OrderStatus.PRINTING]: showcaseOrdersByStage.PRINTING ?? 0,
    [OrderStatus.POST_PROCESSING]: showcaseOrdersByStage.POST_PROCESSING ?? 0,
    [OrderStatus.QUALITY]: showcaseOrdersByStage.QUALITY ?? 0,
    [OrderStatus.READY_TO_SHIP]: showcaseOrdersByStage.READY_TO_SHIP ?? 0,
    [OrderStatus.SHIPPED]: showcaseOrdersByStage.SHIPPED ?? 0,
    [OrderStatus.COMPLETED]: showcaseOrdersByStage.COMPLETED ?? 0,
    [OrderStatus.FAILED_REWORK]: 0,
    [OrderStatus.CANCELED]: showcaseOrdersByStage.CANCELED ?? 0,
  };
  const showcaseWaitingHandlingCount = closedShowcaseOrders.filter((item) => {
    const stage = item.orderStage ?? "RECEIVED";
    return (
      stage === "RECEIVED" ||
      stage === "ANALYSIS" ||
      stage === "WAITING_APPROVAL" ||
      stage === "WAITING_PAYMENT"
    );
  }).length;
  const showcaseProductionCount = closedShowcaseOrders.filter((item) => {
    const stage = item.orderStage ?? "RECEIVED";
    return (
      stage === "QUEUED" ||
      stage === "PRINTING" ||
      stage === "POST_PROCESSING" ||
      stage === "QUALITY" ||
      stage === "FAILED_REWORK"
    );
  }).length;
  const recentPedidos = [
    ...orders.map((order) => ({
      kind: "internal" as const,
      sortAt: order.createdAt,
      order,
    })),
    ...closedShowcaseOrders.map((inquiry) => ({
      kind: "whatsapp" as const,
      sortAt: inquiry.closedAt ?? inquiry.updatedAt,
      inquiry,
    })),
  ]
    .sort((left, right) => right.sortAt.localeCompare(left.sortAt))
    .slice(0, 10);
  const machineAttentionCount = machines.filter(
    (machine) =>
      machine.status === MachineStatus.ERROR ||
      machine.status === MachineStatus.MAINTENANCE ||
      machine.status === MachineStatus.OFFLINE,
  ).length;
  const maintenanceDueMachines = machines.filter((machine) => {
    const referenceDate = machine.lastMaintenanceAt ?? machine.createdAt;
    const referenceTime = new Date(referenceDate).getTime();
    return now - referenceTime >= machine.preventiveMaintenanceDays * dayInMs;
  });
  const staleOrders = orders.filter((order) => {
    if (order.status === OrderStatus.COMPLETED || order.status === OrderStatus.CANCELED) {
      return false;
    }

    return now - new Date(order.updatedAt).getTime() >= 3 * dayInMs;
  });
  const waitingApprovalCount =
    (ordersByStatus[OrderStatus.WAITING_APPROVAL]?.length ?? 0) +
    (ordersByStatus[OrderStatus.WAITING_PAYMENT]?.length ?? 0);
  const productionQueueCount =
    (ordersByStatus[OrderStatus.QUEUED]?.length ?? 0) +
    (ordersByStatus[OrderStatus.PRINTING]?.length ?? 0) +
    (ordersByStatus[OrderStatus.POST_PROCESSING]?.length ?? 0) +
    (ordersByStatus[OrderStatus.QUALITY]?.length ?? 0) +
    (ordersByStatus[OrderStatus.FAILED_REWORK]?.length ?? 0);
  const customers = users
    .filter((candidate) => candidate.role === UserRole.CLIENT)
    .map((customer) => {
      const customerOrders = orders.filter((order) => order.customerId === customer.id);
      const customerShowcaseOrders = showcaseInquiries.filter(
        (inquiry) => inquiry.customerId === customer.id,
      );
      const customerShowcaseRevenue = customerShowcaseOrders
        .filter(
          (inquiry) =>
            inquiry.status === "CLOSED" &&
            (inquiry.orderStage ?? "RECEIVED") !== "CANCELED",
        )
        .reduce(
          (sum, inquiry) =>
            sum +
            getShowcaseInquiryTotalValue(inquiry, showcaseItemPriceMap.get(inquiry.itemId) ?? 0),
          0,
        );
      const latestShowcaseOrder = customerShowcaseOrders[0];
      const lastOrderCreatedAt = customerOrders[0]?.createdAt;
      const lastShowcaseCreatedAt = latestShowcaseOrder?.createdAt;
      const hasLatestShowcaseOrder =
        Boolean(lastShowcaseCreatedAt) &&
        (!lastOrderCreatedAt || lastShowcaseCreatedAt > lastOrderCreatedAt);

      return {
        customer,
        orderCount: customerOrders.length + customerShowcaseOrders.length,
        internalOrderCount: customerOrders.length,
        showcaseOrderCount: customerShowcaseOrders.length,
        totalRevenue:
          customerOrders.reduce((sum, order) => sum + order.totalPrice, 0) +
          customerShowcaseRevenue,
        lastOrder: customerOrders[0],
        lastShowcaseOrder: latestShowcaseOrder,
        hasLatestShowcaseOrder,
      };
    })
    .sort((left, right) => {
      if (right.orderCount !== left.orderCount) {
        return right.orderCount - left.orderCount;
      }

      return right.totalRevenue - left.totalRevenue;
    });
  const materialLinksCount =
    orders.filter((order) => order.materialId).length +
    showcaseItems.filter((item) => item.materialId).length;
  const crmQueue = [...showcaseInquiries].sort((left, right) => {
    const leftFollowUpTime = left.followUpAt ? new Date(left.followUpAt).getTime() : Number.MAX_SAFE_INTEGER;
    const rightFollowUpTime = right.followUpAt ? new Date(right.followUpAt).getTime() : Number.MAX_SAFE_INTEGER;
    const leftWeight =
      (left.status === "PENDING" ? 1000 : 0) +
      (left.leadTemperature === "HOT" ? 300 : left.leadTemperature === "WARM" ? 150 : 40) -
      leftFollowUpTime / 1_000_000;
    const rightWeight =
      (right.status === "PENDING" ? 1000 : 0) +
      (right.leadTemperature === "HOT" ? 300 : right.leadTemperature === "WARM" ? 150 : 40) -
      rightFollowUpTime / 1_000_000;

    return rightWeight - leftWeight;
  });
  const leadHistoryById = showcaseInquiries.reduce<Record<string, typeof auditLogs>>((accumulator, inquiry) => {
    accumulator[inquiry.id] = auditLogs.filter(
      (entry) => entry.entityType === "showcase_inquiry" && entry.entityId === inquiry.id,
    );
    return accumulator;
  }, {});
  const orderHistoryById = orders.reduce<Record<string, typeof auditLogs>>((accumulator, order) => {
    accumulator[order.id] = auditLogs.filter(
      (entry) => entry.entityType === "order" && entry.entityId === order.id,
    );
    return accumulator;
  }, {});
  const alertCenter = [
    {
      id: "followups",
      label: "Follow-ups vencidos",
      count: dueFollowUpLeads.length,
      detail: "Leads que já deveriam ter recebido resposta.",
      href: "/admin?section=leads",
      tone: "amber",
    },
    {
      id: "orders",
      label: "Pedidos parados",
      count: staleOrders.length,
      detail: "Pedidos sem atualização há mais de 3 dias.",
      href: "/admin?section=pedidos",
      tone: "rose",
    },
    {
      id: "materials",
      label: "Materiais críticos",
      count: materials.filter((material) => material.stockAmount <= material.minimumStock).length,
      detail: "Filamentos e resinas no limite mínimo.",
      href: "/admin?section=materiais",
      tone: "sky",
    },
    {
      id: "maintenance",
      label: "Manutenção vencida",
      count: maintenanceDueMachines.length,
      detail: "Máquinas que já passaram da preventiva.",
      href: "/admin?section=maquinas",
      tone: "violet",
    },
    {
      id: "payables",
      label: "Contas vencidas",
      count: payables.filter((payable) => payable.status !== "PAID" && new Date(payable.dueDate).getTime() < now).length,
      detail: "Pagamentos pendentes que já venceram.",
      href: "/financeiro",
      tone: "slate",
    },
  ];
  const messageTemplates = [
    {
      title: "Retorno inicial",
      body:
        "Olá! Vi seu interesse na peça e já separei os detalhes para você. Se quiser, eu confirmo cor, prazo e forma de entrega agora mesmo.",
    },
    {
      title: "Cobrança / pagamento",
      body:
        "Seu pedido está pronto para avançar. Posso te enviar a chave Pix ou outra forma de pagamento para reservar a produção.",
    },
    {
      title: "Retirada / envio",
      body:
        "Sua peça já está finalizada. Posso combinar retirada, entrega local ou envio pelos Correios ainda hoje.",
    },
  ];
  const operatorSummary = users
    .filter((candidate) => candidate.role === UserRole.OPERATOR || candidate.role === UserRole.SUPERVISOR)
    .map((candidate) => {
      const activeAssignedOrders = orders.filter(
        (order) =>
          order.assignedOperatorId === candidate.id &&
          order.status !== OrderStatus.COMPLETED &&
          order.status !== OrderStatus.CANCELED,
      );
      const printingOrders = activeAssignedOrders.filter((order) => order.status === OrderStatus.PRINTING);
      const responsibleMachines = machines.filter(
        (machine) => normalizeSearchText(machine.responsibleOperator ?? "") === normalizeSearchText(candidate.name),
      );
      const busyMachines = responsibleMachines.filter((machine) => machine.status === MachineStatus.BUSY);

      return {
        user: candidate,
        activeAssignedOrders: activeAssignedOrders.length,
        printingOrders: printingOrders.length,
        responsibleMachines: responsibleMachines.length,
        busyMachines: busyMachines.length,
      };
    });
  const permissionMatrix = [
    {
      role: "Administrador",
      items: ["Vê tudo", "Restaura snapshot", "Financeiro completo", "Configurações da loja"],
    },
    {
      role: "Supervisor",
      items: ["Produção e leads", "Materiais e máquinas", "Cria snapshots", "Sem restaurar backup"],
    },
    {
      role: "Operador",
      items: ["Movimenta produção", "Atualiza máquinas", "Sem financeiro", "Sem vitrine/configurações"],
    },
  ];
  const showcaseConversionByItem = showcaseItems
    .map((item) => {
      const relatedInquiries = showcaseInquiries.filter((inquiry) => inquiry.itemId === item.id);
      const relatedClosed = relatedInquiries.filter((inquiry) => inquiry.status === "CLOSED");
      const estimatedRevenue = relatedClosed.reduce(
        (sum, inquiry) => sum + getShowcaseInquiryTotalValue(inquiry, item.price),
        0,
      );
      const conversionRate = relatedInquiries.length
        ? (relatedClosed.length / relatedInquiries.length) * 100
        : 0;

      return {
        item,
        leadCount: relatedInquiries.length,
        closedCount: relatedClosed.length,
        conversionRate,
        estimatedRevenue,
      };
    })
    .sort((left, right) => right.closedCount - left.closedCount || right.estimatedRevenue - left.estimatedRevenue)
    .slice(0, 6);
  const showcaseConversionByCategory = Object.values(
    showcaseItems.reduce<
      Record<
        string,
        { category: string; leadCount: number; closedCount: number; estimatedRevenue: number; clickCount: number }
      >
    >((accumulator, item) => {
      const categoryKey = item.category.trim();
      accumulator[categoryKey] ??= {
        category: categoryKey,
        leadCount: 0,
        closedCount: 0,
        estimatedRevenue: 0,
        clickCount: 0,
      };
      const relatedInquiries = showcaseInquiries.filter((inquiry) => inquiry.itemId === item.id);
      const relatedClosed = relatedInquiries.filter((inquiry) => inquiry.status === "CLOSED");
      accumulator[categoryKey].leadCount += relatedInquiries.length;
      accumulator[categoryKey].closedCount += relatedClosed.length;
      accumulator[categoryKey].estimatedRevenue += relatedClosed.reduce(
        (sum, inquiry) => sum + getShowcaseInquiryTotalValue(inquiry, item.price),
        0,
      );
      accumulator[categoryKey].clickCount += item.whatsappClickCount;
      return accumulator;
    }, {}),
  )
    .map((entry) => ({
      ...entry,
      conversionRate: entry.leadCount ? (entry.closedCount / entry.leadCount) * 100 : 0,
    }))
    .sort((left, right) => right.closedCount - left.closedCount || right.estimatedRevenue - left.estimatedRevenue)
    .slice(0, 5);
  const kanbanColumns: Array<{
    id: string;
    label: string;
    statuses: OrderStatus[];
    inquiryStages: Array<(typeof showcaseOrderStageOptions)[number]>;
  }> = [
    {
      id: "intake",
      label: "Entrada",
      statuses: [OrderStatus.RECEIVED, OrderStatus.ANALYSIS],
      inquiryStages: ["RECEIVED", "ANALYSIS"],
    },
    {
      id: "approval",
      label: "Aprovação e pagamento",
      statuses: [OrderStatus.WAITING_APPROVAL, OrderStatus.WAITING_PAYMENT],
      inquiryStages: ["WAITING_APPROVAL", "WAITING_PAYMENT"],
    },
    {
      id: "production",
      label: "Fila e impressão",
      statuses: [OrderStatus.QUEUED, OrderStatus.PRINTING],
      inquiryStages: ["QUEUED", "PRINTING"],
    },
    {
      id: "finishing",
      label: "Acabamento e envio",
      statuses: [OrderStatus.POST_PROCESSING, OrderStatus.QUALITY, OrderStatus.READY_TO_SHIP, OrderStatus.SHIPPED],
      inquiryStages: ["POST_PROCESSING", "QUALITY", "READY_TO_SHIP", "SHIPPED"],
    },
    {
      id: "done",
      label: "Finalizados e exceções",
      statuses: [OrderStatus.COMPLETED, OrderStatus.FAILED_REWORK, OrderStatus.CANCELED],
      inquiryStages: ["COMPLETED", "FAILED_REWORK", "CANCELED"],
    },
  ];

  const sectionCounts: Record<AdminSection, string> = {
    summary: "8 areas",
    vitrine: `${showcaseItems.length} itens`,
    configuracoes: `${showcaseTestimonials.length} ajustes`,
    leads: `${showcaseInquiries.length} contatos`,
    pedidos: `${orders.length + closedShowcaseOrders.length} pedidos`,
    clientes: `${customers.length} clientes`,
    materiais: `${materials.length} materiais`,
    maquinas: `${machines.length} máquinas`,
  };

  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);
  const monthStartTime = monthStart.getTime();
  const weekAheadTime = now + 7 * dayInMs;
  const overduePayables = payables.filter((payable) => {
    if (payable.status === "PAID") {
      return false;
    }

    return new Date(payable.dueDate).getTime() < now;
  });
  const upcomingPayables = payables.filter((payable) => {
    if (payable.status === "PAID") {
      return false;
    }

    const dueTime = new Date(payable.dueDate).getTime();
    return dueTime >= now && dueTime <= weekAheadTime;
  });
  const currentMonthRevenue = [
    ...orders
      .filter(
        (order) =>
          order.paymentStatus === "PAID" &&
          new Date(order.paidAt ?? order.updatedAt).getTime() >= monthStartTime,
      )
      .map((order) => order.totalPrice),
    ...closedShowcaseOrders
      .filter(
        (inquiry) =>
          (inquiry.orderStage ?? "RECEIVED") === "COMPLETED" &&
          new Date(inquiry.closedAt ?? inquiry.updatedAt).getTime() >= monthStartTime,
      )
      .map(
        (inquiry) =>
          (showcaseItems.find((item) => item.id === inquiry.itemId)?.price ?? 0) * inquiry.quantity,
      ),
  ].reduce((sum, value) => sum + value, 0);
  const currentMonthExpenses = [
    ...expenses
      .filter((expense) => new Date(expense.paidAt).getTime() >= monthStartTime)
      .map((expense) => expense.amount),
    ...payables
      .filter(
        (payable) =>
          payable.status === "PAID" &&
          payable.paidAt &&
          new Date(payable.paidAt).getTime() >= monthStartTime,
      )
      .map((payable) => payable.amount),
  ].reduce((sum, value) => sum + value, 0);
  const quickActions = [
    { label: "Novo produto", href: "/admin?section=vitrine#novo-produto", description: "Cadastrar peça nova na vitrine" },
    { label: "Novo lead manual", href: "/admin?section=leads#novo-lead", description: "Lançar contato vindo do WhatsApp" },
    { label: "Novo material", href: "/admin?section=materiais#novo-material", description: "Registrar filamento ou resina" },
    { label: "Nova impressora", href: "/admin?section=maquinas#nova-maquina", description: "Cadastrar máquina e custo" },
    { label: "Financeiro", href: "/financeiro", description: "Abrir contas, lucro e fluxo" },
    { label: "Produção", href: "/producao", description: "Ver fila, impressão e acabamento" },
  ];
  const reminderItems = [
    ...dueFollowUpLeads.map((lead) => ({
      id: `lead-${lead.id}`,
      title: `${lead.customerName} precisa de retorno`,
      detail: `${lead.itemName} · follow-up ${lead.followUpAt ? formatShortDate(lead.followUpAt) : "agora"}`,
      href: `/admin?section=leads#lead-${lead.id}`,
      tone: "amber" as const,
    })),
    ...overduePayables.map((payable) => ({
      id: `payable-${payable.id}`,
      title: `Conta vencida: ${payable.title}`,
      detail: `${formatCurrency(payable.amount)} · venceu em ${formatShortDate(payable.dueDate)}`,
      href: "/financeiro",
      tone: "rose" as const,
    })),
    ...upcomingPayables.slice(0, 4).map((payable) => ({
      id: `upcoming-${payable.id}`,
      title: `Conta perto do vencimento: ${payable.title}`,
      detail: `${formatCurrency(payable.amount)} · vence em ${formatShortDate(payable.dueDate)}`,
      href: "/financeiro",
      tone: "sky" as const,
    })),
    ...maintenanceDueMachines.map((machine) => ({
      id: `machine-${machine.id}`,
      title: `Manutenção atrasada: ${machine.name}`,
      detail: `${machine.model} · revisar hoje`,
      href: `/admin?section=maquinas#maquina-${machine.id}`,
      tone: "violet" as const,
    })),
    ...staleOrders.slice(0, 4).map((order) => ({
      id: `order-${order.id}`,
      title: `Pedido parado: ${order.orderNumber}`,
      detail: `${order.title} · sem atualização recente`,
      href: "/admin?section=pedidos",
      tone: "slate" as const,
    })),
  ].slice(0, 10);
  const roleSummary = [
    {
      label: "Administradores",
      count: users.filter((candidate) => candidate.role === UserRole.ADMIN).length,
      description: "Controle total, financeiro, vitrine e configurações.",
    },
    {
      label: "Supervisores",
      count: users.filter((candidate) => candidate.role === UserRole.SUPERVISOR).length,
      description: "Acompanham produção, leads, materiais e máquinas.",
    },
    {
      label: "Operadores",
      count: users.filter((candidate) => candidate.role === UserRole.OPERATOR).length,
      description: "Movem produção e status das impressoras.",
    },
  ];
  const monthLabels = Array.from({ length: 6 }).map((_, index) => {
    const reference = new Date();
    reference.setMonth(reference.getMonth() - (5 - index), 1);
    reference.setHours(0, 0, 0, 0);
    return reference;
  });
  const monthlyPerformance = monthLabels.map((reference) => {
    const key = `${reference.getFullYear()}-${String(reference.getMonth() + 1).padStart(2, "0")}`;
    const label = new Intl.DateTimeFormat("pt-BR", {
      month: "short",
    }).format(reference);
    const revenue = orders.reduce((sum, order) => {
      const referenceDate = order.paidAt ?? order.updatedAt;
      return order.paymentStatus === "PAID" && referenceDate.startsWith(key)
        ? sum + order.totalPrice
        : sum;
    }, 0);
    const storefrontRevenue = closedShowcaseOrders.reduce((sum, inquiry) => {
      const referenceDate = inquiry.closedAt ?? inquiry.updatedAt;
      return (inquiry.orderStage ?? "RECEIVED") === "COMPLETED" && referenceDate.startsWith(key)
        ? sum + (showcaseItems.find((item) => item.id === inquiry.itemId)?.price ?? 0) * inquiry.quantity
        : sum;
    }, 0);
    const outgoing = expenses.reduce((sum, expense) => {
      return expense.paidAt.startsWith(key) ? sum + expense.amount : sum;
    }, 0) + payables.reduce((sum, payable) => {
      return payable.status === "PAID" && payable.paidAt?.startsWith(key) ? sum + payable.amount : sum;
    }, 0);
    const conversions = closedShowcaseOrders.filter(
      (inquiry) => (inquiry.closedAt ?? inquiry.updatedAt).startsWith(key),
    ).length;

    return {
      key,
      label,
      revenue: revenue + storefrontRevenue,
      outgoing,
      conversions,
    };
  });
  const performanceMax = Math.max(
    1,
    ...monthlyPerformance.flatMap((entry) => [entry.revenue, entry.outgoing, entry.conversions * 100]),
  );
  const matchedOrders = normalizedSearchQuery
    ? orders.filter((order) => {
        const statusMatch =
          searchStatusFilter === "all"
            ? true
            : searchStatusFilter === "active"
              ? order.status !== OrderStatus.COMPLETED && order.status !== OrderStatus.CANCELED
              : searchStatusFilter === "closed"
                ? order.status === OrderStatus.COMPLETED || order.status === OrderStatus.CANCELED
                : staleOrders.some((staleOrder) => staleOrder.id === order.id);

        return (
          (searchType === "all" || searchType === "orders") &&
          statusMatch &&
          isWithinSearchPeriod(order.updatedAt, searchPeriod, now) &&
          matchesSearch(
            normalizedSearchQuery,
            order.orderNumber,
            order.title,
            order.customer?.name,
            order.customer?.company,
            order.materialName,
          )
        );
      })
    : [];
  const matchedShowcaseItems = normalizedSearchQuery
    ? showcaseItems.filter((item) => {
        const statusMatch =
          searchStatusFilter === "all"
            ? true
            : searchStatusFilter === "active"
              ? item.active
              : searchStatusFilter === "closed"
                ? !item.active
                : showcaseCriticalStockItems.some((criticalItem) => criticalItem.id === item.id);

        return (
          (searchType === "all" || searchType === "showcase") &&
          statusMatch &&
          isWithinSearchPeriod(item.updatedAt, searchPeriod, now) &&
          matchesSearch(
            normalizedSearchQuery,
            item.name,
            item.category,
            item.description,
            item.materialLabel,
            item.tagline,
          )
        );
      })
    : [];
  const matchedLeads = normalizedSearchQuery
    ? showcaseInquiries.filter((inquiry) => {
        const statusMatch =
          searchStatusFilter === "all"
            ? true
            : searchStatusFilter === "active"
              ? inquiry.status === "PENDING"
              : searchStatusFilter === "closed"
                ? inquiry.status !== "PENDING"
                : dueFollowUpLeads.some((lead) => lead.id === inquiry.id) || inquiry.leadTemperature === "HOT";

        return (
          (searchType === "all" || searchType === "leads") &&
          statusMatch &&
          isWithinSearchPeriod(inquiry.updatedAt, searchPeriod, now) &&
          matchesSearch(
            normalizedSearchQuery,
            inquiry.customerName,
            inquiry.customerPhone,
            inquiry.customerEmail,
            inquiry.itemName,
            inquiry.tags.join(" "),
          )
        );
      })
    : [];
  const matchedCustomers = normalizedSearchQuery
    ? customers.filter(({ customer, orderCount }) => {
        const statusMatch =
          searchStatusFilter === "all"
            ? true
            : searchStatusFilter === "active"
              ? orderCount > 0
              : searchStatusFilter === "closed"
                ? orderCount === 0
                : customer.phone == null && customer.email == null;

        return (
          (searchType === "all" || searchType === "customers") &&
          statusMatch &&
          isWithinSearchPeriod(customer.updatedAt, searchPeriod, now) &&
          matchesSearch(
            normalizedSearchQuery,
            customer.name,
            customer.company,
            customer.email,
            customer.phone,
          )
        );
      })
    : [];
  const matchedMaterials = normalizedSearchQuery
    ? materials.filter((material) => {
        const statusMatch =
          searchStatusFilter === "all"
            ? true
            : searchStatusFilter === "active"
              ? material.stockAmount > material.minimumStock
              : searchStatusFilter === "closed"
                ? material.stockAmount <= 0
                : material.stockAmount <= material.minimumStock;

        return (
          (searchType === "all" || searchType === "materials") &&
          statusMatch &&
          isWithinSearchPeriod(material.updatedAt, searchPeriod, now) &&
          matchesSearch(
            normalizedSearchQuery,
            material.name,
            material.brand,
            material.color,
            material.category,
          )
        );
      })
    : [];
  const matchedMachines = normalizedSearchQuery
    ? machines.filter((machine) => {
        const statusMatch =
          searchStatusFilter === "all"
            ? true
            : searchStatusFilter === "active"
              ? machine.status !== MachineStatus.OFFLINE && machine.status !== MachineStatus.ERROR
              : searchStatusFilter === "closed"
                ? machine.status === MachineStatus.OFFLINE
                : machine.status === MachineStatus.ERROR || machine.status === MachineStatus.MAINTENANCE;

        return (
          (searchType === "all" || searchType === "machines") &&
          statusMatch &&
          isWithinSearchPeriod(machine.updatedAt, searchPeriod, now) &&
          matchesSearch(
            normalizedSearchQuery,
            machine.name,
            machine.model,
            machine.location,
            machine.supportedMaterialNames,
          )
        );
      })
    : [];
  const totalSearchResults =
    matchedOrders.length +
    matchedShowcaseItems.length +
    matchedLeads.length +
    matchedCustomers.length +
    matchedMaterials.length +
    matchedMachines.length;

  return (
    <AppShell
      user={user}
      pathname="/admin"
      title="Painel administrativo"
      subtitle="Separei o administrativo em áreas com botões próprios para você abrir só o que precisa, sem deixar tudo misturado no mesmo lugar."
    >
      {error ? (
        <div className="rounded-[24px] border border-rose-400/25 bg-rose-500/10 px-5 py-4 text-sm text-rose-100">
          {error}
        </div>
      ) : null}

      {message ? (
        <div className="rounded-[24px] border border-emerald-400/20 bg-emerald-500/10 px-5 py-4 text-sm text-emerald-50">
          {message}
        </div>
      ) : null}

      <section className="grid gap-4 xl:grid-cols-4">
        <MetricCard label="Receita da operação" value={formatCurrency(summaryRevenue)} caption="Pedidos pagos e pedidos da vitrine já finalizados." accent="orange" />
        <MetricCard label="Pedidos ativos" value={String(summaryActiveOrders)} caption="Pedidos internos e da vitrine ainda não encerrados." accent="mint" />
        <MetricCard label="Leads pendentes" value={String(leadsPendingCount)} caption="Clientes aguardando retorno no WhatsApp." accent="blue" />
        <MetricCard label="Máquinas ocupadas" value={String(summaryMachinesBusy)} caption="Impressoras em uso em pedidos internos e da vitrine." accent="rose" />
      </section>

      <section className="rounded-[28px] border border-white/10 bg-white/5 p-6">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.24em] text-white/45">Central de alertas</p>
            <h3 className="mt-2 text-2xl font-semibold">O que precisa de ação agora</h3>
            <p className="mt-2 text-sm leading-6 text-white/65">
              Separei os pontos que mais travam vendas, produção e caixa para você resolver rápido.
            </p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3 text-sm text-white/70">
            {alertCenter.reduce((sum, item) => sum + item.count, 0)} pendências críticas monitoradas
          </div>
        </div>

        <div className="mt-6 grid gap-4 lg:grid-cols-5">
          {alertCenter.map((alert) => (
            <Link
              key={alert.id}
              href={alert.href}
              className={cn(
                "rounded-[22px] border p-4 transition hover:-translate-y-0.5",
                alert.tone === "amber" && "border-amber-400/25 bg-amber-500/10 hover:bg-amber-500/15",
                alert.tone === "rose" && "border-rose-400/25 bg-rose-500/10 hover:bg-rose-500/15",
                alert.tone === "sky" && "border-sky-400/25 bg-sky-500/10 hover:bg-sky-500/15",
                alert.tone === "violet" && "border-violet-400/25 bg-violet-500/10 hover:bg-violet-500/15",
                alert.tone === "slate" && "border-white/10 bg-slate-950/60 hover:bg-white/10",
              )}
            >
              <p className="text-[11px] uppercase tracking-[0.18em] text-white/55">{alert.label}</p>
              <p className="mt-3 text-3xl font-semibold text-white">{alert.count}</p>
              <p className="mt-2 text-sm leading-6 text-white/65">{alert.detail}</p>
            </Link>
          ))}
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <section className="rounded-[28px] border border-white/10 bg-white/5 p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.24em] text-white/45">Busca global</p>
              <h3 className="mt-2 text-2xl font-semibold">Encontre qualquer item do admin sem caçar tela por tela</h3>
              <p className="mt-2 text-sm leading-6 text-white/65">
                Procure por cliente, pedido, produto da vitrine, material, máquina ou lead do WhatsApp.
              </p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-slate-950/50 px-4 py-3 text-sm text-white/65">
              {searchQuery ? `${totalSearchResults} resultados para “${searchQuery}”` : "Digite um termo para filtrar tudo"}
            </div>
          </div>

          <form action="/admin" method="GET" className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-[minmax(0,1.2fr)_200px_180px_160px_auto_auto]">
            {activeSection !== "summary" ? <input type="hidden" name="section" value={activeSection} /> : null}
            <input
              type="search"
              name="q"
              defaultValue={searchQuery}
              placeholder="Buscar por nome, pedido, telefone, material, máquina..."
              className="w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-white outline-none placeholder:text-white/35 focus:border-orange-400/60"
            />
            <select
              name="type"
              defaultValue={searchType}
              className="w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-white outline-none focus:border-orange-400/60"
            >
              <option value="all">Tudo</option>
              <option value="orders">Pedidos</option>
              <option value="showcase">Vitrine</option>
              <option value="leads">Leads</option>
              <option value="customers">Clientes</option>
              <option value="materials">Materiais</option>
              <option value="machines">Máquinas</option>
            </select>
            <select
              name="statusFilter"
              defaultValue={searchStatusFilter}
              className="w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-white outline-none focus:border-orange-400/60"
            >
              <option value="all">Qualquer status</option>
              <option value="active">Ativos / em aberto</option>
              <option value="closed">Fechados / concluídos</option>
              <option value="attention">Pedem atenção</option>
            </select>
            <select
              name="period"
              defaultValue={searchPeriod}
              className="w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-white outline-none focus:border-orange-400/60"
            >
              <option value="all">Qualquer período</option>
              <option value="today">Hoje</option>
              <option value="7d">Últimos 7 dias</option>
              <option value="30d">Últimos 30 dias</option>
            </select>
            <button
              type="submit"
              className="rounded-2xl border border-orange-400/30 bg-orange-500 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-orange-400"
            >
              Buscar
            </button>
            <Link
              href={getSectionHref(activeSection)}
              className="rounded-2xl border border-white/10 bg-slate-950/60 px-5 py-3 text-center text-sm text-white/75 transition hover:bg-white/10 hover:text-white"
            >
              Limpar
            </Link>
          </form>

          <div className="mt-4 flex flex-wrap gap-2 text-xs text-white/55">
            <span className="rounded-full border border-orange-400/20 bg-orange-500/10 px-3 py-1 text-orange-100">
              Filtro atual: {searchType === "all" ? "tudo" : searchType} · {searchStatusFilter === "all" ? "qualquer status" : searchStatusFilter} · {searchPeriod === "all" ? "qualquer período" : searchPeriod}
            </span>
            {["leads quentes", "pedido gv", "resina", "cliente", "bambu", "faturamento"].map((hint) => (
              <span key={hint} className="rounded-full border border-white/10 bg-black/25 px-3 py-1">
                {hint}
              </span>
            ))}
          </div>
        </section>

        <section className="rounded-[28px] border border-white/10 bg-white/5 p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.24em] text-white/45">Ações rápidas</p>
              <h3 className="mt-2 text-2xl font-semibold">Resolva o mais comum em poucos cliques</h3>
            </div>
            <form action={createBackupSnapshotAction}>
              <SubmitButton
                label="Criar snapshot"
                pendingLabel="Criando..."
                className="border-sky-400/30 bg-sky-500/10 text-sky-100 hover:bg-sky-500/20"
              />
            </form>
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            {quickActions.map((action) => (
              <Link
                key={action.label}
                href={action.href}
                className="rounded-[22px] border border-white/10 bg-slate-950/60 p-4 transition hover:bg-white/10"
              >
                <p className="font-semibold text-white">{action.label}</p>
                <p className="mt-2 text-sm leading-6 text-white/60">{action.description}</p>
              </Link>
            ))}
          </div>
        </section>
      </section>

      {searchQuery ? (
        <section className="rounded-[28px] border border-white/10 bg-white/5 p-6">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.24em] text-white/45">Resultados da busca</p>
              <h3 className="mt-2 text-2xl font-semibold">Atalhos diretos para o que você procurou</h3>
            </div>
            <p className="text-sm text-white/60">
              {totalSearchResults ? `${totalSearchResults} resultados encontrados` : "Nenhum resultado encontrado"}
            </p>
          </div>

          <div className="mt-6 grid gap-4 xl:grid-cols-3">
            {[
              {
                label: "Pedidos",
                items: matchedOrders.slice(0, 4).map((order) => ({
                  key: order.id,
                  title: order.orderNumber,
                  detail: `${order.title} · ${order.customer?.company ?? order.customer?.name ?? "Sem cliente"}`,
                  href: "/admin?section=pedidos",
                })),
              },
              {
                label: "Produtos da vitrine",
                items: matchedShowcaseItems.slice(0, 4).map((item) => ({
                  key: item.id,
                  title: item.name,
                  detail: `${item.category} · ${formatCurrency(item.price)}`,
                  href: `/admin?section=vitrine#produto-${item.id}`,
                })),
              },
              {
                label: "Leads do WhatsApp",
                items: matchedLeads.slice(0, 4).map((lead) => ({
                  key: lead.id,
                  title: lead.customerName,
                  detail: `${lead.itemName} · ${lead.customerPhone ?? "sem telefone"}`,
                  href: `/admin?section=leads#lead-${lead.id}`,
                })),
              },
              {
                label: "Clientes",
                items: matchedCustomers.slice(0, 4).map(({ customer }) => ({
                  key: customer.id,
                  title: customer.company ?? customer.name,
                  detail: customer.phone ?? customer.email,
                  href: `/admin?section=clientes#cliente-${customer.id}`,
                })),
              },
              {
                label: "Materiais",
                items: matchedMaterials.slice(0, 4).map((material) => ({
                  key: material.id,
                  title: material.name,
                  detail: `${material.brand} · ${material.color} · ${technologyLabels[material.technology]}`,
                  href: `/admin?section=materiais#material-${material.id}`,
                })),
              },
              {
                label: "Máquinas",
                items: matchedMachines.slice(0, 4).map((machine) => ({
                  key: machine.id,
                  title: machine.name,
                  detail: `${machine.model} · ${machine.location ?? "Sem localização"}`,
                  href: `/admin?section=maquinas#maquina-${machine.id}`,
                })),
              },
            ].map((group) => (
              <div key={group.label} className="rounded-[24px] border border-white/10 bg-slate-950/60 p-4">
                <p className="text-sm font-semibold text-white">{group.label}</p>
                <div className="mt-4 space-y-3">
                  {group.items.length ? (
                    group.items.map((item) => (
                      <Link
                        key={item.key}
                        href={item.href}
                        className="block rounded-2xl border border-white/10 bg-black/25 px-4 py-3 transition hover:bg-white/10"
                      >
                        <p className="font-medium text-white">{item.title}</p>
                        <p className="mt-1 text-sm text-white/60">{item.detail}</p>
                      </Link>
                    ))
                  ) : (
                    <div className="rounded-2xl border border-dashed border-white/10 bg-black/20 px-4 py-3 text-sm text-white/45">
                      Nada encontrado nesta área.
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <section className="rounded-[28px] border border-white/10 bg-white/5 p-6">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.24em] text-white/45">Botões por área</p>
            <h3 className="mt-2 text-2xl font-semibold">Abra só a parte que você quer mexer</h3>
            <p className="mt-2 text-sm text-white/65">
              Cada botão leva para uma área separada dentro do admin, sem juntar vitrine, leads, materiais e máquinas no mesmo bloco.
            </p>
          </div>

          <div className="grid w-full gap-3 sm:flex sm:w-auto sm:flex-wrap">
            <Link href="/producao" className="rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3 text-center text-sm text-white/75 transition hover:bg-white/10 hover:text-white">
              Abrir produção
            </Link>
            <Link href="/maquinas" className="rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3 text-center text-sm text-white/75 transition hover:bg-white/10 hover:text-white">
              Abrir máquinas
            </Link>
            <Link href="/financeiro" className="rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3 text-center text-sm text-white/75 transition hover:bg-white/10 hover:text-white">
              Abrir financeiro
            </Link>
          </div>
        </div>

        <div className="mt-6 flex gap-3 overflow-x-auto pb-2 md:grid md:overflow-visible md:pb-0 md:grid-cols-2 xl:grid-cols-4">
          {adminSections.map((section) => {
            const active = activeSection === section.key;

            return (
              <Link
                key={section.key}
                href={getSectionHref(section.key)}
                className={cn(
                  "min-w-[220px] shrink-0 rounded-[24px] border px-5 py-4 transition md:min-w-0",
                  active
                    ? "border-orange-400/45 bg-orange-500/15 shadow-[0_22px_80px_rgba(255,122,24,0.16)]"
                    : "border-white/10 bg-slate-950/50 hover:border-white/20 hover:bg-white/10",
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-lg font-semibold text-white">{section.label}</p>
                    <p className="mt-2 text-sm leading-6 text-white/65">{section.description}</p>
                  </div>
                  <span className="rounded-full border border-white/10 bg-black/25 px-3 py-1 text-xs text-white/70">
                    {sectionCounts[section.key]}
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      </section>

      {showcaseCriticalStockItems.length ? (
        <section className="mx-auto max-w-4xl rounded-[30px] border border-amber-400/30 bg-[linear-gradient(135deg,rgba(245,158,11,0.18),rgba(127,29,29,0.14))] p-6 text-center shadow-[0_24px_90px_rgba(245,158,11,0.14)]">
          <p className="text-xs uppercase tracking-[0.28em] text-amber-100/70">
            Alerta de estoque
          </p>
          <h3 className="mt-3 text-3xl font-semibold text-white">
            Produto da vitrine com estoque muito baixo
          </h3>
          <p className="mx-auto mt-3 max-w-2xl text-sm leading-6 text-white/75">
            Os itens abaixo estao com menos de 2 unidades em estoque e precisam de reposicao.
          </p>

          <div className="mt-6 flex flex-wrap justify-center gap-3">
            {showcaseCriticalStockItems.map((item) => (
              <div
                key={item.id}
                className="rounded-full border border-white/10 bg-black/25 px-4 py-2 text-sm text-white/85"
              >
                {item.name} · {item.stockQuantity} em estoque
              </div>
            ))}
          </div>

          <div className="mt-6">
            <Link
              href="/admin?section=vitrine"
              className="inline-flex items-center justify-center rounded-2xl border border-amber-300/30 bg-amber-400/90 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-amber-300"
            >
              Ir para a vitrine e repor
            </Link>
          </div>
        </section>
      ) : null}

      {activeSection === "summary" ? (
        <section className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
          <section className="rounded-[28px] border border-white/10 bg-white/5 p-6">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.24em] text-white/45">Agenda do admin</p>
                <h3 className="mt-2 text-2xl font-semibold">Lembretes que pedem ação hoje</h3>
              </div>
              <div className="rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3 text-sm text-white/65">
                {reminderItems.length} itens na fila
              </div>
            </div>

            <div className="mt-6 space-y-3">
              {reminderItems.length ? (
                reminderItems.map((item) => (
                  <Link
                    key={item.id}
                    href={item.href}
                    className={cn(
                      "flex items-center justify-between gap-4 rounded-[22px] border p-4 transition hover:bg-white/10",
                      item.tone === "amber" && "border-amber-400/20 bg-amber-500/5",
                      item.tone === "rose" && "border-rose-400/20 bg-rose-500/5",
                      item.tone === "sky" && "border-sky-400/20 bg-sky-500/5",
                      item.tone === "violet" && "border-violet-400/20 bg-violet-500/5",
                      item.tone === "slate" && "border-white/10 bg-slate-950/60",
                    )}
                  >
                    <div>
                      <p className="font-semibold text-white">{item.title}</p>
                      <p className="mt-1 text-sm text-white/60">{item.detail}</p>
                    </div>
                    <span className="text-sm text-orange-200">Abrir</span>
                  </Link>
                ))
              ) : (
                <div className="rounded-[22px] border border-dashed border-white/15 bg-slate-950/40 p-4 text-sm text-white/60">
                  Sem pendências urgentes agora. O painel está sob controle.
                </div>
              )}
            </div>
          </section>

          <div className="grid gap-6">
            <section className="rounded-[28px] border border-white/10 bg-white/5 p-6">
              <p className="text-xs uppercase tracking-[0.24em] text-white/45">Resumo financeiro no admin</p>
              <div className="mt-5 grid gap-4 md:grid-cols-2">
                <div className="rounded-[22px] border border-white/10 bg-slate-950/60 p-4">
                  <p className="text-sm text-white/55">Receita do mês</p>
                  <p className="mt-2 text-2xl font-semibold">{formatCurrency(currentMonthRevenue)}</p>
                </div>
                <div className="rounded-[22px] border border-white/10 bg-slate-950/60 p-4">
                  <p className="text-sm text-white/55">Saídas do mês</p>
                  <p className="mt-2 text-2xl font-semibold">{formatCurrency(currentMonthExpenses)}</p>
                </div>
                <div className="rounded-[22px] border border-white/10 bg-slate-950/60 p-4">
                  <p className="text-sm text-white/55">Contas vencidas</p>
                  <p className="mt-2 text-2xl font-semibold">{overduePayables.length}</p>
                  <p className="mt-2 text-sm text-white/60">
                    {formatCurrency(overduePayables.reduce((sum, payable) => sum + payable.amount, 0))}
                  </p>
                </div>
                <div className="rounded-[22px] border border-white/10 bg-slate-950/60 p-4">
                  <p className="text-sm text-white/55">Saldo do mês</p>
                  <p className="mt-2 text-2xl font-semibold">
                    {formatCurrency(currentMonthRevenue - currentMonthExpenses)}
                  </p>
                </div>
              </div>
            </section>

            <section className="rounded-[28px] border border-white/10 bg-white/5 p-6">
              <p className="text-xs uppercase tracking-[0.24em] text-white/45">Equipe e permissões</p>
              <div className="mt-5 grid gap-4 md:grid-cols-3">
                {roleSummary.map((role) => (
                  <div key={role.label} className="rounded-[22px] border border-white/10 bg-slate-950/60 p-4">
                    <p className="text-sm text-white/55">{role.label}</p>
                    <p className="mt-2 text-2xl font-semibold">{role.count}</p>
                    <p className="mt-2 text-sm leading-6 text-white/60">{role.description}</p>
                  </div>
                ))}
              </div>
            </section>
          </div>
        </section>
      ) : null}

      {activeSection === "summary" ? (
        <section className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
          <section className="rounded-[28px] border border-white/10 bg-white/5 p-6">
            <p className="text-xs uppercase tracking-[0.24em] text-white/45">Produção no admin</p>
            <h3 className="mt-2 text-2xl font-semibold">Situação rápida da operação</h3>
            <div className="mt-6 grid gap-4 md:grid-cols-2">
              <div className="rounded-[22px] border border-white/10 bg-slate-950/60 p-4">
                <p className="text-sm text-white/55">Recebidos / análise</p>
                <p className="mt-2 text-2xl font-semibold">
                  {(ordersByStatus[OrderStatus.RECEIVED]?.length ?? 0) + (ordersByStatus[OrderStatus.ANALYSIS]?.length ?? 0)}
                </p>
              </div>
              <div className="rounded-[22px] border border-white/10 bg-slate-950/60 p-4">
                <p className="text-sm text-white/55">Em fila / imprimindo</p>
                <p className="mt-2 text-2xl font-semibold">
                  {(ordersByStatus[OrderStatus.QUEUED]?.length ?? 0) + (ordersByStatus[OrderStatus.PRINTING]?.length ?? 0) + (showcaseOrdersByStage.QUEUED ?? 0) + (showcaseOrdersByStage.PRINTING ?? 0)}
                </p>
              </div>
              <div className="rounded-[22px] border border-white/10 bg-slate-950/60 p-4">
                <p className="text-sm text-white/55">Pós / qualidade</p>
                <p className="mt-2 text-2xl font-semibold">
                  {(ordersByStatus[OrderStatus.POST_PROCESSING]?.length ?? 0) + (ordersByStatus[OrderStatus.QUALITY]?.length ?? 0) + (showcaseOrdersByStage.POST_PROCESSING ?? 0) + (showcaseOrdersByStage.QUALITY ?? 0)}
                </p>
              </div>
              <div className="rounded-[22px] border border-white/10 bg-slate-950/60 p-4">
                <p className="text-sm text-white/55">Falhas / manutenção</p>
                <p className="mt-2 text-2xl font-semibold">
                  {(ordersByStatus[OrderStatus.FAILED_REWORK]?.length ?? 0) + machineAttentionCount}
                </p>
              </div>
            </div>
          </section>

          <section className="rounded-[28px] border border-white/10 bg-white/5 p-6">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.24em] text-white/45">Relatórios com gráfico</p>
                <h3 className="mt-2 text-2xl font-semibold">Últimos 6 meses do admin</h3>
              </div>
              <p className="text-sm text-white/60">Receita, saídas e conversões da vitrine</p>
            </div>

            <div className="mt-6 grid gap-4 md:grid-cols-6">
              {monthlyPerformance.map((entry) => (
                <div key={entry.key} className="rounded-[22px] border border-white/10 bg-slate-950/60 p-4">
                  <p className="text-xs uppercase tracking-[0.18em] text-white/45">{entry.label}</p>
                  <div className="mt-4 grid h-36 grid-cols-3 items-end gap-2">
                    <div className="flex flex-col items-center gap-2">
                      <div
                        className="w-full rounded-t-xl bg-emerald-400/80"
                        style={{ height: `${Math.max(10, (entry.revenue / performanceMax) * 100)}%` }}
                      />
                      <span className="text-[10px] text-white/45">Receita</span>
                    </div>
                    <div className="flex flex-col items-center gap-2">
                      <div
                        className="w-full rounded-t-xl bg-rose-400/80"
                        style={{ height: `${Math.max(10, (entry.outgoing / performanceMax) * 100)}%` }}
                      />
                      <span className="text-[10px] text-white/45">Saídas</span>
                    </div>
                    <div className="flex flex-col items-center gap-2">
                      <div
                        className="w-full rounded-t-xl bg-sky-400/80"
                        style={{ height: `${Math.max(10, ((entry.conversions * 100) / performanceMax) * 100)}%` }}
                      />
                      <span className="text-[10px] text-white/45">Leads</span>
                    </div>
                  </div>
                  <div className="mt-4 space-y-1 text-xs text-white/55">
                    <p>{formatCurrency(entry.revenue)}</p>
                    <p>{formatCurrency(entry.outgoing)}</p>
                    <p>{entry.conversions} fechados</p>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </section>
      ) : null}

      {activeSection === "summary" ? (
        <section className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
          <div className="rounded-[28px] border border-white/10 bg-white/5 p-6">
            <p className="text-xs uppercase tracking-[0.24em] text-white/45">O que precisa de atenção</p>
            <h3 className="mt-2 text-2xl font-semibold">Prioridades rápidas</h3>
            <div className="mt-6 space-y-3">
              {[
                { label: "Leads sem resposta", value: `${leadsPendingCount} pendentes`, href: "/admin?section=leads" },
                { label: "Follow-up vencido", value: `${dueFollowUpLeads.length} contatos`, href: "/admin?section=leads" },
                { label: "Leads quentes", value: `${hotLeadCount} oportunidades`, href: "/admin?section=leads" },
                { label: "Leads parados", value: `${staleLeadCount} contatos`, href: "/admin?section=leads" },
                { label: "Pedidos aguardando retorno ou pagamento", value: `${waitingApprovalCount} em espera`, href: "/admin?section=pedidos" },
                { label: "Pedidos parados há dias", value: `${staleOrders.length} pedidos`, href: "/admin?section=pedidos" },
                { label: "Materiais em estoque baixo", value: `${overview.lowStockMaterials} materiais`, href: "/admin?section=materiais" },
                { label: "Produtos da vitrine sem estoque", value: `${showcaseOutOfStockCount} itens`, href: "/admin?section=vitrine" },
                { label: "Máquinas com atenção", value: `${machineAttentionCount} máquinas`, href: "/admin?section=maquinas" },
                { label: "Manutenção preventiva vencida", value: `${maintenanceDueMachines.length} máquinas`, href: "/admin?section=maquinas" },
              ].map((item) => (
                <Link key={item.label} href={item.href} className="flex items-center justify-between gap-4 rounded-[22px] border border-white/10 bg-slate-950/60 p-4 transition hover:bg-white/10">
                  <div>
                    <p className="font-semibold">{item.label}</p>
                    <p className="mt-1 text-sm text-white/60">{item.value}</p>
                  </div>
                  <span className="text-sm text-orange-200">Abrir</span>
                </Link>
              ))}
            </div>
          </div>

          <div className="grid gap-6">
            <div className="rounded-[28px] border border-white/10 bg-white/5 p-6">
              <p className="text-xs uppercase tracking-[0.24em] text-white/45">Panorama rápido</p>
              <div className="mt-6 grid gap-4 md:grid-cols-2">
                <div className="rounded-[22px] border border-white/10 bg-slate-950/60 p-4">
                  <p className="text-sm text-white/55">Vitrine ativa</p>
                  <p className="mt-2 text-2xl font-semibold">{showcaseActiveCount} itens no ar</p>
                </div>
                <div className="rounded-[22px] border border-white/10 bg-slate-950/60 p-4">
                  <p className="text-sm text-white/55">Negócios fechados</p>
                  <p className="mt-2 text-2xl font-semibold">{leadsClosedCount} conversões</p>
                </div>
                <div className="rounded-[22px] border border-white/10 bg-slate-950/60 p-4">
                  <p className="text-sm text-white/55">Fila de produção</p>
                  <p className="mt-2 text-2xl font-semibold">{productionQueueCount} pedidos</p>
                </div>
                <div className="rounded-[22px] border border-white/10 bg-slate-950/60 p-4">
                  <p className="text-sm text-white/55">Contas a receber</p>
                  <p className="mt-2 text-2xl font-semibold">{formatCurrency(summaryPendingRevenue)}</p>
                </div>
                <div className="rounded-[22px] border border-white/10 bg-slate-950/60 p-4">
                  <p className="text-sm text-white/55">Leads com follow-up vencido</p>
                  <p className="mt-2 text-2xl font-semibold">{dueFollowUpLeads.length}</p>
                </div>
                <div className="rounded-[22px] border border-white/10 bg-slate-950/60 p-4">
                  <p className="text-sm text-white/55">Pedidos parados</p>
                  <p className="mt-2 text-2xl font-semibold">{staleOrders.length}</p>
                </div>
              </div>
            </div>

            <div className="rounded-[28px] border border-white/10 bg-white/5 p-6">
              <p className="text-xs uppercase tracking-[0.24em] text-white/45">Últimos pedidos</p>
              <div className="mt-6 space-y-3">
                {orders.length ? (
                  orders.slice(0, 5).map((order) => (
                    <div key={order.id} className="rounded-[22px] border border-white/10 bg-slate-950/60 p-4">
                      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                        <div>
                          <p className="text-sm text-white/45">{order.orderNumber}</p>
                          <p className="mt-1 text-lg font-semibold">{order.title}</p>
                          <p className="mt-1 text-sm text-white/60">
                            {order.customer?.company ?? order.customer?.name} · {formatCurrency(order.totalPrice)}
                          </p>
                        </div>
                        <StatusPill {...orderStatusMeta[order.status]} />
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="rounded-[22px] border border-dashed border-white/15 bg-slate-950/40 p-4 text-sm text-white/60">
                    Ainda não há pedidos cadastrados.
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>
      ) : null}

      {activeSection === "summary" ? (
        <section className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
          <AccountSecurityForm lastChangedAt={user.passwordChangedAt} />

          <section className="rounded-[28px] border border-white/10 bg-white/5 p-6">
            <p className="text-xs uppercase tracking-[0.24em] text-white/45">Auditoria</p>
            <h3 className="mt-2 text-2xl font-semibold">Últimas ações administrativas</h3>
            <div className="mt-6 space-y-3">
              {auditLogs.length ? (
                auditLogs.slice(0, 6).map((entry) => (
                  <div
                    key={entry.id}
                    className="rounded-[22px] border border-white/10 bg-slate-950/60 p-4"
                  >
                    <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                      <div>
                        <p className="text-sm font-semibold text-white">{entry.summary}</p>
                        <p className="mt-1 text-xs uppercase tracking-[0.18em] text-white/45">
                          {entry.area} · {entry.action}
                        </p>
                        {entry.details ? (
                          <p className="mt-2 text-sm text-white/60">{entry.details}</p>
                        ) : null}
                      </div>
                      <p className="text-sm text-white/55">
                        {formatDateTime(new Date(entry.createdAt))}
                      </p>
                    </div>
                  </div>
                ))
              ) : (
                <div className="rounded-[22px] border border-dashed border-white/15 bg-slate-950/40 p-4 text-sm text-white/60">
                  Ainda não há ações registradas no histórico.
                </div>
              )}
            </div>
          </section>
        </section>
      ) : null}

      {activeSection === "summary" ? (
        <section className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
          <section className="rounded-[28px] border border-white/10 bg-white/5 p-6">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.24em] text-white/45">Conversão da vitrine</p>
                <h3 className="mt-2 text-2xl font-semibold">Produtos e categorias que mais fecham</h3>
              </div>
              <Link href="/admin?section=vitrine" className="text-sm text-orange-200 transition hover:text-orange-100">
                Abrir vitrine
              </Link>
            </div>

            <div className="mt-6 space-y-3">
              {showcaseConversionByItem.length ? (
                showcaseConversionByItem.map((entry) => (
                  <div key={entry.item.id} className="rounded-[22px] border border-white/10 bg-slate-950/60 p-4">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                      <div>
                        <p className="font-semibold text-white">{entry.item.name}</p>
                        <p className="mt-1 text-sm text-white/60">
                          {entry.leadCount} leads · {entry.closedCount} fechados · {entry.conversionRate.toFixed(1)}% conversão
                        </p>
                      </div>
                      <p className="text-sm font-semibold text-emerald-100">{formatCurrency(entry.estimatedRevenue)}</p>
                    </div>
                  </div>
                ))
              ) : (
                <div className="rounded-[22px] border border-dashed border-white/15 bg-slate-950/40 p-4 text-sm text-white/60">
                  Ainda não há dados suficientes para medir conversão da vitrine.
                </div>
              )}
            </div>
          </section>

          <section className="rounded-[28px] border border-white/10 bg-white/5 p-6">
            <p className="text-xs uppercase tracking-[0.24em] text-white/45">Categorias com melhor resposta</p>
            <h3 className="mt-2 text-2xl font-semibold">O que mais converte por grupo</h3>
            <div className="mt-6 space-y-3">
              {showcaseConversionByCategory.length ? (
                showcaseConversionByCategory.map((entry) => (
                  <div key={entry.category} className="rounded-[22px] border border-white/10 bg-slate-950/60 p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="font-semibold text-white">{entry.category}</p>
                        <p className="mt-1 text-sm text-white/60">
                          {entry.closedCount} fechados · {entry.clickCount} cliques · {entry.conversionRate.toFixed(1)}% conversão
                        </p>
                      </div>
                      <p className="text-sm font-semibold text-cyan-100">{formatCurrency(entry.estimatedRevenue)}</p>
                    </div>
                  </div>
                ))
              ) : (
                <div className="rounded-[22px] border border-dashed border-white/15 bg-slate-950/40 p-4 text-sm text-white/60">
                  Cadastre mais interações para o painel descobrir as categorias mais fortes.
                </div>
              )}
            </div>
          </section>
        </section>
      ) : null}

      {activeSection === "summary" ? (
        <section className="grid gap-6 xl:grid-cols-[1fr_1fr]">
          <section className="rounded-[28px] border border-white/10 bg-white/5 p-6">
            <p className="text-xs uppercase tracking-[0.24em] text-white/45">Equipe operacional</p>
            <h3 className="mt-2 text-2xl font-semibold">Quem está com carga agora</h3>
            <div className="mt-6 space-y-3">
              {operatorSummary.length ? (
                operatorSummary.map((entry) => (
                  <div key={entry.user.id} className="rounded-[22px] border border-white/10 bg-slate-950/60 p-4">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                      <div>
                        <p className="font-semibold text-white">{entry.user.name}</p>
                        <p className="mt-1 text-sm text-white/60">{entry.user.role === UserRole.SUPERVISOR ? "Supervisor" : "Operador"}</p>
                      </div>
                      <div className="grid gap-3 sm:grid-cols-4">
                        <div className="rounded-2xl border border-white/10 bg-black/25 px-3 py-2 text-center">
                          <p className="text-[11px] uppercase tracking-[0.18em] text-white/45">Ativos</p>
                          <p className="mt-1 font-semibold text-white">{entry.activeAssignedOrders}</p>
                        </div>
                        <div className="rounded-2xl border border-white/10 bg-black/25 px-3 py-2 text-center">
                          <p className="text-[11px] uppercase tracking-[0.18em] text-white/45">Imprimindo</p>
                          <p className="mt-1 font-semibold text-white">{entry.printingOrders}</p>
                        </div>
                        <div className="rounded-2xl border border-white/10 bg-black/25 px-3 py-2 text-center">
                          <p className="text-[11px] uppercase tracking-[0.18em] text-white/45">Máquinas</p>
                          <p className="mt-1 font-semibold text-white">{entry.responsibleMachines}</p>
                        </div>
                        <div className="rounded-2xl border border-white/10 bg-black/25 px-3 py-2 text-center">
                          <p className="text-[11px] uppercase tracking-[0.18em] text-white/45">Ocupadas</p>
                          <p className="mt-1 font-semibold text-white">{entry.busyMachines}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="rounded-[22px] border border-dashed border-white/15 bg-slate-950/40 p-4 text-sm text-white/60">
                  Ainda não há operadores ou supervisores cadastrados.
                </div>
              )}
            </div>
          </section>

          <section className="rounded-[28px] border border-white/10 bg-white/5 p-6">
            <p className="text-xs uppercase tracking-[0.24em] text-white/45">Permissões e modelos rápidos</p>
            <h3 className="mt-2 text-2xl font-semibold">Quem pode fazer o quê</h3>
            <div className="mt-6 space-y-4">
              {permissionMatrix.map((entry) => (
                <div key={entry.role} className="rounded-[22px] border border-white/10 bg-slate-950/60 p-4">
                  <p className="font-semibold text-white">{entry.role}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {entry.items.map((item) => (
                      <span key={item} className="rounded-full border border-white/10 bg-black/25 px-3 py-1 text-xs text-white/75">
                        {item}
                      </span>
                    ))}
                  </div>
                </div>
              ))}

              <div className="rounded-[22px] border border-white/10 bg-slate-950/60 p-4">
                <p className="font-semibold text-white">Modelos prontos de mensagem</p>
                <div className="mt-4 space-y-3">
                  {messageTemplates.map((template) => (
                    <div key={template.title} className="rounded-2xl border border-white/10 bg-black/25 p-3">
                      <p className="text-sm font-semibold text-white">{template.title}</p>
                      <p className="mt-2 text-sm leading-6 text-white/65">{template.body}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>
        </section>
      ) : null}

      {activeSection === "summary" ? (
        <section className="rounded-[28px] border border-white/10 bg-white/5 p-6">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.24em] text-white/45">Backups automáticos</p>
              <h3 className="mt-2 text-2xl font-semibold">Snapshots do sistema</h3>
              <p className="mt-2 text-sm leading-6 text-white/65">
                Cada atualização salva um backup automático do banco local para facilitar recuperação em caso de erro.
              </p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3 text-sm text-white/70">
              {backupSnapshots.length} backups disponíveis
            </div>
          </div>

          <div className="mt-6 space-y-3">
            {backupSnapshots.length ? (
              backupSnapshots.slice(0, 8).map((snapshot) => (
                <div
                  key={snapshot.fileName}
                  className="flex flex-col gap-3 rounded-[22px] border border-white/10 bg-slate-950/60 p-4 md:flex-row md:items-center md:justify-between"
                >
                  <div>
                    <p className="font-semibold text-white">{snapshot.fileName}</p>
                    <p className="mt-1 text-sm text-white/55">
                      Gerado em {formatDateTime(new Date(snapshot.createdAt))} · {(snapshot.sizeBytes / 1024).toFixed(1)} KB
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-3">
                    <a
                      href={`/backups/${snapshot.fileName}`}
                      className="rounded-2xl border border-sky-400/25 bg-sky-500/10 px-4 py-3 text-sm font-semibold text-sky-100 transition hover:bg-sky-500/20"
                    >
                      Baixar backup
                    </a>
                    {user.role === UserRole.ADMIN ? (
                      <form action={restoreBackupSnapshotAction}>
                        <input type="hidden" name="fileName" value={snapshot.fileName} />
                        <SubmitButton
                          label="Restaurar snapshot"
                          pendingLabel="Restaurando..."
                          confirmMessage="Restaurar este snapshot agora? O estado atual será substituído."
                          className="border-amber-400/25 bg-amber-500/10 text-amber-100 hover:bg-amber-500/20"
                        />
                      </form>
                    ) : null}
                    <form action={deleteBackupSnapshotAction}>
                      <input type="hidden" name="fileName" value={snapshot.fileName} />
                      <SubmitButton
                        label="Excluir snapshot"
                        pendingLabel="Excluindo..."
                        confirmMessage="Excluir este snapshot do sistema?"
                        className="border-rose-400/30 bg-rose-500/10 text-rose-100 hover:bg-rose-500/20"
                      />
                    </form>
                  </div>
                </div>
              ))
            ) : (
              <div className="rounded-[22px] border border-dashed border-white/15 bg-slate-950/40 p-4 text-sm text-white/60">
                Ainda não há backups disponíveis.
              </div>
            )}
          </div>
        </section>
      ) : null}

      {activeSection === "vitrine" ? (
        <>
          <section className="grid gap-4 xl:grid-cols-4">
            <MetricCard label="Itens ativos" value={String(showcaseActiveCount)} caption="Produtos visíveis no catálogo." accent="orange" />
            <MetricCard label="Itens sem estoque" value={String(showcaseOutOfStockCount)} caption="Produtos que precisam reposição." accent="rose" />
            <MetricCard label="Visualizações" value={String(showcaseViewsTotal)} caption="Acessos nas páginas dos produtos." accent="blue" />
            <MetricCard label="Cliques no WhatsApp" value={String(showcaseClicksTotal)} caption={`${showcaseConversionRate}% de cliques sobre visualizações.`} accent="mint" />
          </section>

          <section id="novo-produto">
            <ShowcaseItemForm materials={materials} />
          </section>

          <section className="rounded-[28px] border border-white/10 bg-white/5 p-6">
            <p className="text-xs uppercase tracking-[0.24em] text-white/45">Produtos cadastrados</p>
            <h3 className="mt-2 text-2xl font-semibold">Clique no anúncio para abrir a edição</h3>
            <p className="mt-2 text-sm text-white/60">
              Deixei a lista mais compacta. O formulário completo de atualização só aparece quando você abre o produto.
            </p>
            <form
              id="bulk-showcase-items-form"
              action={bulkUpdateShowcaseItemsAction}
              className="mt-5 grid gap-3 md:grid-cols-[minmax(0,1fr)_220px_auto]"
            >
              <div className="rounded-2xl border border-white/10 bg-black/25 px-4 py-3 text-sm text-white/60">
                Marque vários anúncios para destacar, ativar ou ocultar de uma vez.
              </div>
              <select
                name="operation"
                defaultValue="feature"
                className="rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-white outline-none focus:border-orange-400/60"
              >
                <option value="feature">Destacar selecionados</option>
                <option value="unfeature">Remover destaque</option>
                <option value="activate">Ativar produtos</option>
                <option value="deactivate">Ocultar produtos</option>
              </select>
              <SubmitButton
                label="Aplicar em lote"
                pendingLabel="Aplicando..."
                confirmMessage="Aplicar esta ação aos produtos selecionados?"
                className="border-orange-400/30 bg-orange-500 text-slate-950 hover:bg-orange-400"
              />
            </form>
            <div className="mt-6 space-y-4">
              {showcaseItems.length ? (
                showcaseItems.map((item) => {
                  const interestCount = showcaseInquiries.filter((inquiry) => inquiry.itemId === item.id).length;
                  const primaryImage = getShowcasePrimaryImage(item);
                  const hasVideo = Boolean(getShowcasePrimaryVideo(item));

                  return (
                    <details
                      key={item.id}
                      id={`produto-${item.id}`}
                      className="overflow-hidden rounded-[24px] border border-white/10 bg-slate-950/45"
                    >
                      <summary className="list-none cursor-pointer p-4 transition hover:bg-white/5 [&::-webkit-details-marker]:hidden">
                        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                          <div className="flex items-center gap-4">
                            <input
                              type="checkbox"
                              name="itemIds"
                              value={item.id}
                              form="bulk-showcase-items-form"
                              className="h-5 w-5 rounded border-white/20 bg-black/30"
                            />
                            <div className="h-24 w-24 shrink-0 overflow-hidden rounded-[22px] border border-white/10 bg-slate-950/70">
                              {primaryImage ? (
                                <div
                                  className="h-full w-full bg-cover bg-center"
                                  style={{ backgroundImage: `url("${primaryImage}")` }}
                                />
                              ) : (
                                <div className="h-full w-full bg-[radial-gradient(circle_at_top_left,_rgba(255,122,24,0.35),_transparent_32%),radial-gradient(circle_at_bottom_right,_rgba(89,185,255,0.22),_transparent_32%),linear-gradient(135deg,_rgba(255,255,255,0.08),_rgba(15,23,42,0.95))]" />
                              )}
                            </div>

                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <p className="text-lg font-semibold text-white">{item.name}</p>
                                <span className="rounded-full border border-white/10 bg-black/25 px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-white/65">
                                  {item.category}
                                </span>
                                {item.featured ? (
                                  <span className="rounded-full border border-amber-300/20 bg-amber-400/10 px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-amber-100">
                                    Destaque
                                  </span>
                                ) : null}
                                {hasVideo ? (
                                  <span className="rounded-full border border-sky-400/20 bg-sky-500/10 px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-sky-100">
                                    Com vídeo
                                  </span>
                                ) : null}
                              </div>
                              <p className="mt-2 max-w-2xl text-sm leading-6 text-white/62">
                                {getShowcaseTagline(item)}
                              </p>
                              <div className="mt-3 flex flex-wrap gap-2 text-xs text-white/55">
                                <span className="rounded-full border border-white/10 bg-black/25 px-3 py-1">
                                  {getShowcaseAvailabilityLabel(item)}
                                </span>
                                <span className="rounded-full border border-white/10 bg-black/25 px-3 py-1">
                                  {getShowcaseLeadTimeLabel(item)}
                                </span>
                                <span className="rounded-full border border-white/10 bg-black/25 px-3 py-1">
                                  {interestCount} contatos
                                </span>
                                <span className="rounded-full border border-white/10 bg-black/25 px-3 py-1">
                                  {item.whatsappClickCount} cliques
                                </span>
                              </div>
                            </div>
                          </div>

                          <div className="grid gap-3 sm:grid-cols-3 lg:min-w-[320px]">
                            <div className="rounded-2xl border border-white/10 bg-black/25 px-4 py-3">
                              <p className="text-[11px] uppercase tracking-[0.18em] text-white/45">Valor</p>
                              <p className="mt-2 text-base font-semibold text-white">
                                {formatCurrency(item.price)}
                              </p>
                            </div>
                            <div className="rounded-2xl border border-white/10 bg-black/25 px-4 py-3">
                              <p className="text-[11px] uppercase tracking-[0.18em] text-white/45">Visualizações</p>
                              <p className="mt-2 text-base font-semibold text-white">{item.viewCount}</p>
                            </div>
                            <div className="rounded-2xl border border-white/10 bg-black/25 px-4 py-3">
                              <p className="text-[11px] uppercase tracking-[0.18em] text-white/45">Abrir edição</p>
                              <p className="mt-2 text-sm font-semibold text-orange-200">Clique para atualizar</p>
                            </div>
                            <div className="rounded-2xl border border-white/10 bg-black/25 px-4 py-3">
                              <p className="text-[11px] uppercase tracking-[0.18em] text-white/45">Checklist</p>
                              <p className="mt-2 text-sm font-semibold text-white">
                                {item.productionChecklist ? "Configurado" : "Sem checklist"}
                              </p>
                            </div>
                          </div>
                        </div>
                      </summary>

                      <div className="border-t border-white/10 p-4 pt-5">
                        <ShowcaseItemEditor
                          item={item}
                          interestCount={interestCount}
                          materials={materials}
                        />
                      </div>
                    </details>
                  );
                })
              ) : (
                <div className="rounded-[22px] border border-dashed border-white/15 bg-slate-950/40 p-5 text-sm text-white/60">
                  Nenhum item cadastrado ainda. Use o formulário acima para subir a primeira peça da vitrine.
                </div>
              )}
            </div>
          </section>
        </>
      ) : null}

      {activeSection === "configuracoes" ? (
        <>
          <section className="grid gap-4 xl:grid-cols-4">
            <MetricCard label="Visualizações" value={String(showcaseViewsTotal)} caption="Acessos nas páginas dos produtos." accent="blue" />
            <MetricCard label="Cliques no WhatsApp" value={String(showcaseClicksTotal)} caption={`${showcaseConversionRate}% de cliques sobre visualizações.`} accent="mint" />
            <MetricCard label="Depoimentos" value={String(showcaseTestimonials.length)} caption="Prova social cadastrada para a loja." accent="orange" />
            <MetricCard label="Itens em destaque" value={String(showcaseItems.filter((item) => item.featured).length)} caption="Produtos marcados como destaque." accent="rose" />
          </section>

          <section className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
            <StorefrontSettingsForm settings={storefrontSettings} />

            <div className="space-y-6">
              <section className="rounded-[28px] border border-white/10 bg-white/5 p-6">
                <p className="text-xs uppercase tracking-[0.24em] text-white/45">Relatórios da loja</p>
                <h3 className="mt-2 text-2xl font-semibold">Entenda o que chama mais atenção</h3>

                <div className="mt-6 grid gap-4 md:grid-cols-2">
                  <div className="rounded-[24px] border border-white/10 bg-slate-950/60 p-4">
                    <p className="text-sm font-semibold text-white">Mais clicados no WhatsApp</p>
                    <div className="mt-4 space-y-3">
                      {topShowcaseByClicks.length ? (
                        topShowcaseByClicks.map((item) => (
                          <div key={item.id} className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-black/25 px-4 py-3">
                            <div>
                              <p className="font-medium text-white">{item.name}</p>
                              <p className="text-sm text-white/55">{item.viewCount} visualizações</p>
                            </div>
                            <span className="rounded-full border border-emerald-400/20 bg-emerald-500/10 px-3 py-1 text-sm text-emerald-100">
                              {item.whatsappClickCount} cliques
                            </span>
                          </div>
                        ))
                      ) : (
                        <p className="text-sm text-white/60">Ainda não há cliques suficientes para ranking.</p>
                      )}
                    </div>
                  </div>

                  <div className="rounded-[24px] border border-white/10 bg-slate-950/60 p-4">
                    <p className="text-sm font-semibold text-white">Mais visualizados</p>
                    <div className="mt-4 space-y-3">
                      {topShowcaseByViews.length ? (
                        topShowcaseByViews.map((item) => (
                          <div key={item.id} className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-black/25 px-4 py-3">
                            <div>
                              <p className="font-medium text-white">{item.name}</p>
                              <p className="text-sm text-white/55">{item.whatsappClickCount} cliques no WhatsApp</p>
                            </div>
                            <span className="rounded-full border border-sky-400/20 bg-sky-500/10 px-3 py-1 text-sm text-sky-100">
                              {item.viewCount} views
                            </span>
                          </div>
                        ))
                      ) : (
                        <p className="text-sm text-white/60">Ainda não há visualizações suficientes para ranking.</p>
                      )}
                    </div>
                  </div>
                </div>
              </section>

              <ShowcaseTestimonialForm />
            </div>
          </section>

          <section className="rounded-[28px] border border-white/10 bg-white/5 p-6">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.24em] text-white/45">Depoimentos</p>
                <h3 className="mt-2 text-2xl font-semibold">Editar prova social da loja</h3>
              </div>
              <Link href="/depoimentos" className="text-sm text-orange-200 transition hover:text-orange-100">
                Abrir página pública de depoimentos
              </Link>
            </div>

            <div className="mt-6 space-y-4">
              {showcaseTestimonials.length ? (
                [...showcaseTestimonials]
                  .sort((left, right) => left.sortOrder - right.sortOrder)
                  .map((testimonial) => (
                    <ShowcaseTestimonialEditor key={testimonial.id} testimonial={testimonial} />
                  ))
              ) : (
                <div className="rounded-[22px] border border-dashed border-white/15 bg-slate-950/40 p-5 text-sm text-white/60">
                  Ainda não há depoimentos cadastrados para a loja.
                </div>
              )}
            </div>
          </section>
        </>
      ) : null}

      {activeSection === "leads" ? (
        <>
          <section className="grid gap-4 xl:grid-cols-4">
            <MetricCard label="Pendentes" value={String(leadsPendingCount)} caption="Aguardando seu retorno." accent="orange" />
            <MetricCard label="Follow-up vencido" value={String(dueFollowUpLeads.length)} caption="Leads pedindo retorno imediato." accent="rose" />
            <MetricCard label="Leads quentes" value={String(hotLeadCount)} caption="Oportunidades mais perto do fechamento." accent="mint" />
            <MetricCard label="Total de leads" value={String(showcaseInquiries.length)} caption="Histórico completo de contatos." accent="blue" />
          </section>

          <section id="novo-lead">
            <ShowcaseInquiryForm items={showcaseItems} />
          </section>

          <section className="rounded-[28px] border border-white/10 bg-white/5 p-6">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.24em] text-white/45">WhatsApp da vitrine</p>
                <h3 className="mt-2 text-2xl font-semibold">Editar pedidos e contatos do WhatsApp</h3>
              </div>
              <Link href="/admin?section=vitrine" className="text-sm text-orange-200 transition hover:text-orange-100">
                Voltar para produtos
              </Link>
            </div>

            <form
              id="bulk-showcase-inquiries-form"
              action={bulkUpdateShowcaseInquiryAction}
              className="mt-5 grid gap-3 md:grid-cols-[minmax(0,1fr)_240px_auto]"
            >
              <div className="rounded-2xl border border-white/10 bg-black/25 px-4 py-3 text-sm text-white/60">
                Selecione vários leads para mover status, temperatura ou agenda de follow-up de uma vez.
              </div>
              <select
                name="operation"
                defaultValue="set_hot"
                className="rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-white outline-none focus:border-orange-400/60"
              >
                <option value="set_hot">Marcar como quente</option>
                <option value="set_warm">Marcar como morno</option>
                <option value="set_cold">Marcar como frio</option>
                <option value="set_pending">Voltar para pendente</option>
                <option value="set_closed">Marcar como fechado</option>
                <option value="set_not_closed">Marcar como não fechado</option>
                <option value="followup_today">Follow-up hoje</option>
                <option value="followup_tomorrow">Follow-up amanhã</option>
                <option value="clear_followup">Limpar follow-up</option>
              </select>
              <SubmitButton
                label="Aplicar em lote"
                pendingLabel="Aplicando..."
                confirmMessage="Aplicar esta ação aos leads selecionados?"
                className="border-orange-400/30 bg-orange-500 text-slate-950 hover:bg-orange-400"
              />
            </form>

            <div className="mt-6 space-y-4">
              {crmQueue.length ? (
                crmQueue.map((inquiry) => (
                  <details
                    key={inquiry.id}
                    id={`lead-${inquiry.id}`}
                    className="overflow-hidden rounded-[24px] border border-white/10 bg-slate-950/45"
                  >
                    <summary className="list-none cursor-pointer p-4 transition hover:bg-white/5 [&::-webkit-details-marker]:hidden">
                      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <input
                              type="checkbox"
                              name="inquiryIds"
                              value={inquiry.id}
                              form="bulk-showcase-inquiries-form"
                              className="mr-1 h-5 w-5 rounded border-white/20 bg-black/30"
                            />
                            <p className="text-lg font-semibold text-white">{inquiry.customerName}</p>
                            <StatusPill {...showcaseInquiryStatusMeta[inquiry.status]} />
                            <StatusPill {...showcaseLeadTemperatureMeta[inquiry.leadTemperature]} />
                          </div>
                          <p className="mt-2 text-sm text-white/60">
                            {inquiry.itemName} · {inquiry.customerPhone ?? "sem telefone"}
                          </p>
                          <p className="mt-2 text-xs uppercase tracking-[0.18em] text-white/40">
                            Follow-up {inquiry.followUpAt ? formatDateTime(new Date(inquiry.followUpAt)) : "sem data"} · origem {inquiry.source === "MANUAL" ? "manual" : "catálogo"}
                          </p>
                          {(inquiry.nextAction || inquiry.lastOutcome || inquiry.lostReason) ? (
                            <div className="mt-3 flex flex-wrap gap-2 text-xs text-white/60">
                              {inquiry.nextAction ? (
                                <span className="rounded-full border border-emerald-400/20 bg-emerald-500/10 px-3 py-1 text-emerald-100">
                                  Próxima ação: {inquiry.nextAction}
                                </span>
                              ) : null}
                              {inquiry.lastOutcome ? (
                                <span className="rounded-full border border-sky-400/20 bg-sky-500/10 px-3 py-1 text-sky-100">
                                  Último resultado: {inquiry.lastOutcome}
                                </span>
                              ) : null}
                              {inquiry.lostReason ? (
                                <span className="rounded-full border border-rose-400/20 bg-rose-500/10 px-3 py-1 text-rose-100">
                                  Perda: {inquiry.lostReason}
                                </span>
                              ) : null}
                            </div>
                          ) : null}
                        </div>
                        <div className="grid gap-3 sm:grid-cols-4 lg:min-w-[430px]">
                          <div className="rounded-2xl border border-white/10 bg-black/25 px-4 py-3">
                            <p className="text-[11px] uppercase tracking-[0.18em] text-white/45">Quantidade</p>
                            <p className="mt-2 text-base font-semibold text-white">{inquiry.quantity}</p>
                          </div>
                          <div className="rounded-2xl border border-white/10 bg-black/25 px-4 py-3">
                            <p className="text-[11px] uppercase tracking-[0.18em] text-white/45">Etiquetas</p>
                            <p className="mt-2 text-base font-semibold text-white">{inquiry.tags.length}</p>
                          </div>
                          <div className="rounded-2xl border border-white/10 bg-black/25 px-4 py-3">
                            <p className="text-[11px] uppercase tracking-[0.18em] text-white/45">Histórico</p>
                            <p className="mt-2 text-base font-semibold text-white">{leadHistoryById[inquiry.id]?.length ?? 0}</p>
                          </div>
                          <div className="rounded-2xl border border-white/10 bg-black/25 px-4 py-3">
                            <p className="text-[11px] uppercase tracking-[0.18em] text-white/45">Abrir edição</p>
                            <p className="mt-2 text-sm font-semibold text-orange-200">Clique para editar</p>
                          </div>
                        </div>
                      </div>
                    </summary>

                    <div className="border-t border-white/10 p-4 pt-5">
                      <ShowcaseInquiryEditor inquiry={inquiry} items={showcaseItems} />
                      <div className="mt-4 rounded-[22px] border border-white/10 bg-black/20 p-4">
                        <p className="text-xs uppercase tracking-[0.18em] text-white/45">Histórico do lead</p>
                        <div className="mt-3 space-y-3">
                          {(leadHistoryById[inquiry.id] ?? []).length ? (
                            (leadHistoryById[inquiry.id] ?? []).slice(0, 5).map((entry) => (
                              <div key={entry.id} className="rounded-2xl border border-white/10 bg-slate-950/60 p-3">
                                <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                                  <div>
                                    <p className="font-medium text-white">{entry.summary}</p>
                                    {entry.details ? (
                                      <p className="mt-1 text-sm text-white/60">{entry.details}</p>
                                    ) : null}
                                  </div>
                                  <p className="text-xs uppercase tracking-[0.18em] text-white/40">
                                    {formatDateTime(new Date(entry.createdAt))}
                                  </p>
                                </div>
                              </div>
                            ))
                          ) : (
                            <div className="rounded-2xl border border-dashed border-white/15 bg-slate-950/40 p-3 text-sm text-white/55">
                              Ainda não há histórico detalhado deste lead.
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </details>
                ))
              ) : (
                <div className="rounded-[22px] border border-dashed border-white/15 bg-slate-950/40 p-5 text-sm text-white/60">
                  Ainda não houve cliques na vitrine.
                </div>
              )}
            </div>
          </section>
        </>
      ) : null}

      {activeSection === "pedidos" ? (
        <>
          <section className="grid gap-4 xl:grid-cols-4">
            <MetricCard label="Total de pedidos" value={String(orders.length + closedShowcaseOrders.length)} caption="Pedidos internos e fechados pelo WhatsApp." accent="orange" />
            <MetricCard label="Aguardando ação" value={String(waitingApprovalCount + showcaseWaitingHandlingCount)} caption="Aprovação, pagamento ou confirmação inicial." accent="rose" />
            <MetricCard label="Em produção" value={String(productionQueueCount + showcaseProductionCount)} caption="Fila, impressão e acabamento." accent="blue" />
            <MetricCard label="Receita pendente" value={formatCurrency(summaryPendingRevenue)} caption="Valor ainda não compensado." accent="mint" />
          </section>

          <section className="rounded-[28px] border border-white/10 bg-white/5 p-6">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.24em] text-white/45">Pedidos fechados pelo WhatsApp</p>
                <h3 className="mt-2 text-2xl font-semibold">Vendas confirmadas da vitrine</h3>
                <p className="mt-2 text-sm text-white/65">
                  Quando você marca um lead como fechado, ele aparece aqui automaticamente.
                </p>
              </div>
              <Link href="/admin?section=leads" className="text-sm text-orange-200 transition hover:text-orange-100">
                Voltar para leads
              </Link>
            </div>

            <div className="mt-6 space-y-4">
              {closedShowcaseOrders.length ? (
                closedShowcaseOrders.map((inquiry) => (
                  <article key={inquiry.id} className="rounded-[24px] border border-white/10 bg-slate-950/60 p-5">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                      <div>
                        <p className="text-sm text-white/45">
                          {inquiry.orderNumber ?? (inquiry.source === "MANUAL" ? "Pedido manual" : "Pedido da vitrine")}
                        </p>
                        <h4 className="mt-1 text-xl font-semibold">{inquiry.itemName}</h4>
                        <p className="mt-2 text-sm text-white/65">
                          {inquiry.customerName} · {inquiry.customerPhone}
                        </p>
                        {inquiry.customerEmail ? (
                          <p className="mt-1 text-sm text-white/55">{inquiry.customerEmail}</p>
                        ) : null}
                        <p className="mt-2 text-sm text-white/60">
                          Quantidade: {inquiry.quantity}
                        </p>
                        <p className="mt-1 text-sm text-white/60">
                          Valor com entrega: {formatCurrency(
                            getShowcaseInquiryTotalValue(inquiry, showcaseItemPriceMap.get(inquiry.itemId) ?? 0),
                          )}
                        </p>
                        {inquiry.dueDate ? (
                          <p className="mt-1 text-sm text-white/55">
                            Prazo estimado: {formatDateTime(new Date(inquiry.dueDate))}
                          </p>
                        ) : null}
                        {inquiry.notes ? (
                          <p className="mt-2 text-sm text-white/55">{inquiry.notes}</p>
                        ) : null}
                      </div>
                      <div className="flex flex-col gap-3 lg:items-end">
                        <StatusPill {...showcaseOrderStageMeta[inquiry.orderStage ?? "RECEIVED"]} />
                        <p className="text-sm text-white/60">
                          Fechado em {formatDateTime(new Date(inquiry.closedAt ?? inquiry.updatedAt))}
                        </p>
                        <a
                          href={inquiry.whatsappUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="rounded-2xl border border-emerald-400/30 bg-emerald-500/15 px-4 py-3 text-sm font-semibold text-emerald-100 transition hover:bg-emerald-500/25"
                        >
                          Abrir conversa
                        </a>
                      </div>
                    </div>
                    <div className="mt-5">
                      <ShowcaseDeliveryManager inquiry={inquiry} />
                    </div>
                  </article>
                ))
              ) : (
                <div className="rounded-[22px] border border-dashed border-white/15 bg-slate-950/40 p-5 text-sm text-white/60">
                  Ainda não há pedidos fechados vindos do WhatsApp.
                </div>
              )}
            </div>
          </section>

          <section className="rounded-[28px] border border-white/10 bg-white/5 p-6">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.24em] text-white/45">Kanban de pedidos</p>
                <h3 className="mt-2 text-2xl font-semibold">Mova pedidos sem sair do admin</h3>
                <p className="mt-2 text-sm text-white/65">
                  Separei os pedidos internos e da vitrine em colunas operacionais com troca rápida de etapa.
                </p>
              </div>
              <Link href="/producao" className="text-sm text-orange-200 transition hover:text-orange-100">
                Abrir produção completa
              </Link>
            </div>

            <div className="mt-6 grid gap-4 xl:grid-cols-5">
              {kanbanColumns.map((column) => {
                const internalCards = orders.filter((order) => column.statuses.includes(order.status));
                const showcaseCards = closedShowcaseOrders.filter((inquiry) =>
                  column.inquiryStages.includes((inquiry.orderStage ?? "RECEIVED") as (typeof column.inquiryStages)[number]),
                );

                return (
                  <div key={column.id} className="rounded-[24px] border border-white/10 bg-slate-950/50 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-white">{column.label}</p>
                        <p className="mt-1 text-xs uppercase tracking-[0.18em] text-white/45">
                          {internalCards.length + showcaseCards.length} itens
                        </p>
                      </div>
                    </div>

                    <div className="mt-4 space-y-3">
                      {internalCards.map((order) => (
                        <article key={order.id} className="rounded-[20px] border border-white/10 bg-black/25 p-4">
                          <p className="text-xs uppercase tracking-[0.18em] text-white/40">{order.orderNumber}</p>
                          <p className="mt-2 font-semibold text-white">{order.title}</p>
                          <p className="mt-1 text-sm text-white/60">
                            {order.customer?.company ?? order.customer?.name ?? "Sem cliente"} · {formatCurrency(order.totalPrice)}
                          </p>
                          <div className="mt-3 flex flex-wrap gap-2">
                            <StatusPill {...orderStatusMeta[order.status]} />
                            {order.assignedOperator ? (
                              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/70">
                                {order.assignedOperator.name}
                              </span>
                            ) : null}
                          </div>
                          <form action={advanceOrderStatusAction} className="mt-4 space-y-3">
                            <input type="hidden" name="orderId" value={order.id} />
                            <select
                              name="nextStatus"
                              defaultValue={order.status}
                              className="w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-white outline-none focus:border-orange-400/60"
                            >
                              {Object.values(OrderStatus).map((status) => (
                                <option key={status} value={status}>
                                  {orderStatusMeta[status].label}
                                </option>
                              ))}
                            </select>
                            <SubmitButton
                              label="Atualizar etapa"
                              pendingLabel="Movendo..."
                              className="w-full border-white/10 bg-white/8 text-white hover:bg-white/14"
                            />
                          </form>
                          {(orderHistoryById[order.id] ?? []).length ? (
                            <p className="mt-3 text-xs text-white/45">
                              Última ação: {(orderHistoryById[order.id] ?? [])[0]?.summary}
                            </p>
                          ) : null}
                        </article>
                      ))}

                      {showcaseCards.map((inquiry) => (
                        <article key={inquiry.id} className="rounded-[20px] border border-emerald-400/15 bg-black/25 p-4">
                          <p className="text-xs uppercase tracking-[0.18em] text-white/40">
                            {inquiry.orderNumber ?? "Pedido da vitrine"}
                          </p>
                          <p className="mt-2 font-semibold text-white">{inquiry.itemName}</p>
                          <p className="mt-1 text-sm text-white/60">
                            {inquiry.customerName} · {formatCurrency(
                              getShowcaseInquiryTotalValue(inquiry, showcaseItemPriceMap.get(inquiry.itemId) ?? 0),
                            )}
                          </p>
                          <div className="mt-3 flex flex-wrap gap-2">
                            <StatusPill {...showcaseOrderStageMeta[inquiry.orderStage ?? "RECEIVED"]} />
                            {inquiry.nextAction ? (
                              <span className="rounded-full border border-emerald-400/20 bg-emerald-500/10 px-3 py-1 text-xs text-emerald-100">
                                {inquiry.nextAction}
                              </span>
                            ) : null}
                          </div>
                          <form action={updateShowcaseInquiryOrderStageAction} className="mt-4 space-y-3">
                            <input type="hidden" name="inquiryId" value={inquiry.id} />
                            <select
                              name="orderStage"
                              defaultValue={inquiry.orderStage ?? "RECEIVED"}
                              className="w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-white outline-none focus:border-orange-400/60"
                            >
                              {showcaseOrderStageOptions.map((stage) => (
                                <option key={stage} value={stage}>
                                  {showcaseOrderStageMeta[stage].label}
                                </option>
                              ))}
                            </select>
                            <SubmitButton
                              label="Atualizar etapa"
                              pendingLabel="Movendo..."
                              className="w-full border-white/10 bg-white/8 text-white hover:bg-white/14"
                            />
                          </form>
                          <div className="mt-3 text-xs text-white/45">
                            {inquiry.shippingCarrier ?? getSuggestedCarrier(inquiry.deliveryMode ?? "PICKUP")}
                            {inquiry.trackingCode ? ` · ${inquiry.trackingCode}` : ""}
                          </div>
                          {(leadHistoryById[inquiry.id] ?? []).length ? (
                            <p className="mt-3 text-xs text-white/45">
                              Última ação: {(leadHistoryById[inquiry.id] ?? [])[0]?.summary}
                            </p>
                          ) : null}
                        </article>
                      ))}

                      {!internalCards.length && !showcaseCards.length ? (
                        <div className="rounded-[20px] border border-dashed border-white/15 bg-slate-950/40 p-4 text-sm text-white/50">
                          Nada nesta coluna agora.
                        </div>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          <section className="grid gap-6 xl:grid-cols-[0.82fr_1.18fr]">
            <div className="rounded-[28px] border border-white/10 bg-white/5 p-6">
              <p className="text-xs uppercase tracking-[0.24em] text-white/45">Funil operacional</p>
              <h3 className="mt-2 text-2xl font-semibold">Pedidos por etapa</h3>
              <div className="mt-6 space-y-3">
                {[
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
                  OrderStatus.COMPLETED,
                  OrderStatus.FAILED_REWORK,
                  OrderStatus.CANCELED,
                ].map((status) => (
                  <div key={status} className="flex items-center justify-between gap-4 rounded-[22px] border border-white/10 bg-slate-950/60 p-4">
                    <StatusPill {...orderStatusMeta[status]} />
                    <p className="text-lg font-semibold">
                      {(ordersByStatus[status]?.length ?? 0) + (showcaseCountsByOrderStatus[status] ?? 0)}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-[28px] border border-white/10 bg-white/5 p-6">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.24em] text-white/45">Pedidos recentes</p>
                  <h3 className="mt-2 text-2xl font-semibold">Acompanhe andamento e valor</h3>
                </div>
                <div className="flex flex-wrap gap-3">
                  <Link href="/producao" className="rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3 text-sm text-white/75 transition hover:bg-white/10 hover:text-white">
                    Ir para produção
                  </Link>
                  <Link href="/financeiro" className="rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3 text-sm text-white/75 transition hover:bg-white/10 hover:text-white">
                    Ir para financeiro
                  </Link>
                </div>
              </div>

              <div className="mt-6 space-y-4">
                {recentPedidos.length ? (
                  recentPedidos.map((entry) =>
                    entry.kind === "internal" ? (
                      <article key={entry.order.id} className="rounded-[24px] border border-white/10 bg-slate-950/60 p-5">
                        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                          <div>
                            <p className="text-sm text-white/45">{entry.order.orderNumber}</p>
                            <h4 className="mt-1 text-xl font-semibold">{entry.order.title}</h4>
                            <p className="mt-2 text-sm text-white/60">
                              {entry.order.customer?.company ?? entry.order.customer?.name} · {formatCurrency(entry.order.totalPrice)}
                            </p>
                            <p className="mt-2 text-sm text-white/65">
                              {formatWeight(entry.order.estimatedWeightGrams)} · {formatHours(entry.order.estimatedHours)} · {entry.order.materialName}
                            </p>
                          </div>
                          <div className="flex flex-col gap-3 lg:items-end">
                            <StatusPill {...orderStatusMeta[entry.order.status]} />
                            <p className="text-sm text-white/60">Criado em {formatDateTime(new Date(entry.order.createdAt))}</p>
                          </div>
                        </div>

                        <form action={advanceOrderStatusAction} className="mt-4 grid gap-3 lg:grid-cols-[1fr_auto]">
                          <input type="hidden" name="orderId" value={entry.order.id} />
                          <label className="block text-sm text-white/70">
                            Status do pedido
                            <select
                              name="nextStatus"
                              defaultValue={entry.order.status}
                              className="mt-2 w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 outline-none focus:border-orange-400/60"
                            >
                              {Object.values(OrderStatus).map((status) => (
                                <option key={status} value={status}>
                                  {orderStatusMeta[status].label}
                                </option>
                              ))}
                            </select>
                          </label>
                          <div className="flex items-end">
                            <SubmitButton
                              label="Atualizar status"
                              pendingLabel="Salvando..."
                              className="w-full bg-orange-500 text-slate-950 hover:bg-orange-400 lg:w-auto"
                            />
                          </div>
                        </form>
                      </article>
                    ) : (
                      <article key={entry.inquiry.id} className="rounded-[24px] border border-emerald-400/15 bg-slate-950/60 p-5">
                        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                          <div>
                            <p className="text-sm text-white/45">
                              {entry.inquiry.orderNumber
                                ? `${entry.inquiry.orderNumber} · ${entry.inquiry.source === "MANUAL" ? "Manual" : "Catálogo"}`
                                : `Pedido WhatsApp · ${entry.inquiry.source === "MANUAL" ? "Manual" : "Catálogo"}`}
                            </p>
                            <h4 className="mt-1 text-xl font-semibold">{entry.inquiry.itemName}</h4>
                            <p className="mt-2 text-sm text-white/60">
                              {entry.inquiry.customerName} · {entry.inquiry.customerPhone}
                            </p>
                            <p className="mt-2 text-sm text-white/65">
                              Quantidade: {entry.inquiry.quantity}
                              {" · "}Total com entrega: {formatCurrency(
                                getShowcaseInquiryTotalValue(
                                  entry.inquiry,
                                  showcaseItemPriceMap.get(entry.inquiry.itemId) ?? 0,
                                ),
                              )}
                            </p>
                            {entry.inquiry.dueDate ? (
                              <p className="mt-1 text-sm text-white/55">
                                Prazo estimado: {formatDateTime(new Date(entry.inquiry.dueDate))}
                              </p>
                            ) : null}
                            {entry.inquiry.notes ? (
                              <p className="mt-2 text-sm text-white/55">{entry.inquiry.notes}</p>
                            ) : null}
                          </div>
                          <div className="flex flex-col gap-3 lg:items-end">
                            <StatusPill {...showcaseOrderStageMeta[entry.inquiry.orderStage ?? "RECEIVED"]} />
                            <p className="text-sm text-white/60">
                              Fechado em {formatDateTime(new Date(entry.inquiry.closedAt ?? entry.inquiry.updatedAt))}
                            </p>
                            <a
                              href={entry.inquiry.whatsappUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="rounded-2xl border border-emerald-400/30 bg-emerald-500/15 px-4 py-3 text-sm font-semibold text-emerald-100 transition hover:bg-emerald-500/25"
                            >
                              Abrir conversa
                            </a>
                          </div>
                        </div>

                        <form action={updateShowcaseInquiryOrderStageAction} className="mt-4 grid gap-3 lg:grid-cols-[1fr_auto]">
                          <input type="hidden" name="inquiryId" value={entry.inquiry.id} />
                          <label className="block text-sm text-white/70">
                            Status do pedido
                            <select
                              name="orderStage"
                              defaultValue={entry.inquiry.orderStage ?? "RECEIVED"}
                              className="mt-2 w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 outline-none focus:border-orange-400/60"
                            >
                              {showcaseOrderStageOptions.map((stage) => (
                                <option key={stage} value={stage}>
                                  {showcaseOrderStageMeta[stage].label}
                                </option>
                              ))}
                            </select>
                          </label>
                          <div className="flex items-end">
                            <SubmitButton
                              label="Atualizar status"
                              pendingLabel="Salvando..."
                              className="w-full bg-orange-500 text-slate-950 hover:bg-orange-400 lg:w-auto"
                            />
                          </div>
                        </form>
                        <div className="mt-4">
                          <ShowcaseDeliveryManager inquiry={entry.inquiry} compact />
                        </div>
                      </article>
                    ),
                  )
                ) : (
                  <div className="rounded-[22px] border border-dashed border-white/15 bg-slate-950/40 p-5 text-sm text-white/60">
                    Ainda não há pedidos para acompanhar.
                  </div>
                )}
              </div>
            </div>
          </section>
        </>
      ) : null}

      {activeSection === "clientes" ? (
        <>
          <section className="grid gap-4 xl:grid-cols-4">
            <MetricCard label="Clientes cadastrados" value={String(customers.length)} caption="Contas do tipo cliente." accent="orange" />
            <MetricCard label="Com pedidos" value={String(customers.filter((item) => item.orderCount > 0).length)} caption="Clientes que já compraram." accent="mint" />
            <MetricCard label="Sem pedidos" value={String(customers.filter((item) => item.orderCount === 0).length)} caption="Cadastros sem movimentação." accent="blue" />
            <MetricCard label="Carteira total" value={formatCurrency(customers.reduce((sum, item) => sum + item.totalRevenue, 0))} caption="Soma dos pedidos dos clientes." accent="rose" />
          </section>

          <section className="rounded-[28px] border border-white/10 bg-white/5 p-6">
            <p className="text-xs uppercase tracking-[0.24em] text-white/45">Base de clientes</p>
            <h3 className="mt-2 text-2xl font-semibold">Cada cliente em um cartão separado</h3>
            <div className="mt-6 grid gap-4 xl:grid-cols-2">
              {customers.length ? (
                customers.map(
                  ({
                    customer,
                    orderCount,
                    internalOrderCount,
                    showcaseOrderCount,
                    totalRevenue,
                    lastOrder,
                    lastShowcaseOrder,
                    hasLatestShowcaseOrder,
                  }) => (
                  <article id={`cliente-${customer.id}`} key={customer.id} className="rounded-[24px] border border-white/10 bg-slate-950/60 p-5">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="text-xl font-semibold">{customer.company ?? customer.name}</p>
                        <p className="mt-1 text-sm text-white/60">{customer.name}</p>
                        <p className="mt-1 text-sm text-white/55">
                          {isGeneratedCustomerEmail(customer.email)
                            ? "Sem e-mail informado"
                            : customer.email}
                        </p>
                        {customer.phone ? <p className="mt-1 text-sm text-white/55">{customer.phone}</p> : null}
                      </div>
                      <div className="rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-right">
                        <p className="text-xs uppercase tracking-[0.18em] text-white/45">Pedidos</p>
                        <p className="mt-2 text-2xl font-semibold">{orderCount}</p>
                      </div>
                    </div>

                    <div className="mt-5 grid gap-3 md:grid-cols-2">
                      <div className="rounded-2xl border border-white/10 bg-black/30 p-3">
                        <p className="text-xs uppercase tracking-[0.18em] text-white/45">Total faturado</p>
                        <p className="mt-2 text-lg font-semibold">{formatCurrency(totalRevenue)}</p>
                        <p className="mt-2 text-sm text-white/60">
                          {internalOrderCount} internos · {showcaseOrderCount} da vitrine
                        </p>
                      </div>
                      <div className="rounded-2xl border border-white/10 bg-black/30 p-3">
                        <p className="text-xs uppercase tracking-[0.18em] text-white/45">Último pedido</p>
                        <p className="mt-2 text-sm text-white/70">
                          {hasLatestShowcaseOrder && lastShowcaseOrder
                            ? `WhatsApp · ${formatDateTime(new Date(lastShowcaseOrder.createdAt))}`
                            : lastOrder
                              ? `${lastOrder.orderNumber} · ${formatDateTime(new Date(lastOrder.createdAt))}`
                              : "Sem pedidos ainda"}
                        </p>
                      </div>
                    </div>
                  </article>
                ))
              ) : (
                <div className="rounded-[22px] border border-dashed border-white/15 bg-slate-950/40 p-5 text-sm text-white/60 xl:col-span-2">
                  Ainda não há clientes cadastrados.
                </div>
              )}
            </div>
          </section>
        </>
      ) : null}

      {activeSection === "materiais" ? (
        <>
          <section className="grid gap-4 xl:grid-cols-4">
            <MetricCard label="Materiais" value={String(materials.length)} caption="Filamentos e resinas cadastrados." accent="orange" />
            <MetricCard label="Estoque baixo" value={String(overview.lowStockMaterials)} caption="Abaixo do mínimo configurado." accent="rose" />
            <MetricCard label="Vinculações" value={String(materialLinksCount)} caption="Pedidos e produtos da vitrine usando materiais." accent="blue" />
            <MetricCard label="Compra registrada" value={formatCurrency(materials.reduce((sum, material) => sum + material.purchasePrice, 0))} caption="Soma dos valores pagos nos insumos." accent="mint" />
          </section>

          <section id="novo-material">
            <MaterialForm redirectTo="/admin?section=materiais" />
          </section>

          <section className="rounded-[28px] border border-white/10 bg-white/5 p-6">
            <p className="text-xs uppercase tracking-[0.24em] text-white/45">Materiais cadastrados</p>
            <h3 className="mt-2 text-2xl font-semibold">Edite um material por vez</h3>
            <div className="mt-6 space-y-4">
              {materials.length ? (
                materials.map((material) => {
                  const linkedCount =
                    orders.filter((order) => order.materialId === material.id).length +
                    showcaseItems.filter((item) => item.materialId === material.id).length;

                  return (
                    <details
                      key={material.id}
                      id={`material-${material.id}`}
                      className="overflow-hidden rounded-[24px] border border-white/10 bg-slate-950/45"
                    >
                      <summary className="list-none cursor-pointer p-4 transition hover:bg-white/5 [&::-webkit-details-marker]:hidden">
                        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="text-lg font-semibold text-white">{material.name}</p>
                              <span className="rounded-full border border-white/10 bg-black/25 px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-white/65">
                                {technologyLabels[material.technology]}
                              </span>
                            </div>
                            <p className="mt-2 text-sm text-white/60">
                              {material.brand} · {material.color} · {material.stockAmount.toFixed(0)} {material.unit}
                            </p>
                          </div>
                          <div className="grid gap-3 sm:grid-cols-3 lg:min-w-[320px]">
                            <div className="rounded-2xl border border-white/10 bg-black/25 px-4 py-3">
                              <p className="text-[11px] uppercase tracking-[0.18em] text-white/45">Valor pago</p>
                              <p className="mt-2 text-base font-semibold text-white">{formatCurrency(material.purchasePrice)}</p>
                            </div>
                            <div className="rounded-2xl border border-white/10 bg-black/25 px-4 py-3">
                              <p className="text-[11px] uppercase tracking-[0.18em] text-white/45">Vínculos</p>
                              <p className="mt-2 text-base font-semibold text-white">{linkedCount}</p>
                            </div>
                            <div className="rounded-2xl border border-white/10 bg-black/25 px-4 py-3">
                              <p className="text-[11px] uppercase tracking-[0.18em] text-white/45">Abrir edição</p>
                              <p className="mt-2 text-sm font-semibold text-orange-200">Clique para editar</p>
                            </div>
                          </div>
                        </div>
                      </summary>

                      <div className="border-t border-white/10 p-4 pt-5">
                        <MaterialEditor
                          material={material}
                          linkedOrderCount={linkedCount}
                          redirectTo="/admin?section=materiais"
                        />
                      </div>
                    </details>
                  );
                })
              ) : (
                <div className="rounded-[22px] border border-dashed border-white/15 bg-slate-950/40 p-5 text-sm text-white/60">
                  Nenhum material cadastrado ainda.
                </div>
              )}
            </div>
          </section>
        </>
      ) : null}

      {activeSection === "maquinas" ? (
        <>
          <section className="grid gap-4 xl:grid-cols-4">
            <MetricCard label="Máquinas" value={String(machines.length)} caption="Impressoras cadastradas." accent="orange" />
            <MetricCard label="Disponíveis" value={String(machines.filter((machine) => machine.status === MachineStatus.AVAILABLE).length)} caption="Livres para receber novos trabalhos." accent="mint" />
            <MetricCard label="Em manutenção" value={String(machines.filter((machine) => machine.status === MachineStatus.MAINTENANCE).length)} caption="Bloqueadas para revisão." accent="rose" />
            <MetricCard label="Com atenção" value={String(machineAttentionCount)} caption="Erro, manutenção ou offline." accent="blue" />
          </section>

          <section id="nova-maquina">
            <MachineForm />
          </section>

          <section className="rounded-[28px] border border-white/10 bg-white/5 p-6">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.24em] text-white/45">Impressoras cadastradas</p>
                <h3 className="mt-2 text-2xl font-semibold">Controle cada máquina separadamente</h3>
              </div>
              <Link href="/maquinas" className="text-sm text-sky-200 transition hover:text-sky-100">
                Abrir módulo completo de máquinas
              </Link>
            </div>

            <div className="mt-6 space-y-4">
              {machines.length ? (
                machines.map((machine) => {
                  const activeOrders = orders.filter(
                    (order) =>
                      order.assignedMachineId === machine.id &&
                      order.status !== OrderStatus.COMPLETED &&
                      order.status !== OrderStatus.CANCELED,
                  );

                  return (
                    <details
                      key={machine.id}
                      id={`maquina-${machine.id}`}
                      className="overflow-hidden rounded-[24px] border border-white/10 bg-slate-950/45"
                    >
                      <summary className="list-none cursor-pointer p-4 transition hover:bg-white/5 [&::-webkit-details-marker]:hidden">
                        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="text-lg font-semibold text-white">{machine.name}</p>
                              <StatusPill {...machineStatusMeta[machine.status]} />
                            </div>
                            <p className="mt-2 text-sm text-white/60">
                              {machine.model} · {machine.location ?? "Sem localização"} · {technologyLabels[machine.technology]}
                            </p>
                          </div>

                          <div className="grid gap-3 sm:grid-cols-4 lg:min-w-[420px]">
                            <div className="rounded-2xl border border-white/10 bg-black/25 px-4 py-3">
                              <p className="text-[11px] uppercase tracking-[0.18em] text-white/45">Progresso</p>
                              <p className="mt-2 text-base font-semibold text-white">{machine.progressPercent}%</p>
                            </div>
                            <div className="rounded-2xl border border-white/10 bg-black/25 px-4 py-3">
                              <p className="text-[11px] uppercase tracking-[0.18em] text-white/45">Pedidos</p>
                              <p className="mt-2 text-base font-semibold text-white">{activeOrders.length}</p>
                            </div>
                            <div className="rounded-2xl border border-white/10 bg-black/25 px-4 py-3">
                              <p className="text-[11px] uppercase tracking-[0.18em] text-white/45">Restante</p>
                              <p className="mt-2 text-base font-semibold text-white">{machine.timeRemainingMinutes} min</p>
                            </div>
                            <div className="rounded-2xl border border-white/10 bg-black/25 px-4 py-3">
                              <p className="text-[11px] uppercase tracking-[0.18em] text-white/45">Abrir edição</p>
                              <p className="mt-2 text-sm font-semibold text-orange-200">Clique para editar</p>
                            </div>
                          </div>
                        </div>
                      </summary>

                      <div className="border-t border-white/10 p-5">
                        <div className="grid gap-3 md:grid-cols-4">
                          <div className="rounded-2xl border border-white/10 bg-black/30 p-3">
                            <p className="text-xs uppercase tracking-[0.18em] text-white/45">Bico</p>
                            <p className="mt-2 text-lg font-semibold">{machine.nozzleTemp ?? 0}°C</p>
                          </div>
                          <div className="rounded-2xl border border-white/10 bg-black/30 p-3">
                            <p className="text-xs uppercase tracking-[0.18em] text-white/45">Mesa</p>
                            <p className="mt-2 text-lg font-semibold">{machine.bedTemp ?? 0}°C</p>
                          </div>
                          <div className="rounded-2xl border border-white/10 bg-black/30 p-3">
                            <p className="text-xs uppercase tracking-[0.18em] text-white/45">Valor</p>
                            <p className="mt-2 text-lg font-semibold">{formatCurrency(machine.purchasePrice)}</p>
                          </div>
                          <div className="rounded-2xl border border-white/10 bg-black/30 p-3">
                            <p className="text-xs uppercase tracking-[0.18em] text-white/45">Já pago</p>
                            <p className="mt-2 text-lg font-semibold">{formatCurrency(machine.amountPaid)}</p>
                          </div>
                        </div>

                        <div className="mt-5 flex flex-wrap gap-3">
                          {[MachineStatus.AVAILABLE, MachineStatus.BUSY, MachineStatus.PAUSED, MachineStatus.MAINTENANCE, MachineStatus.OFFLINE].map((status) => (
                            <form key={status} action={updateMachineStatusAction}>
                              <input type="hidden" name="machineId" value={machine.id} />
                              <input type="hidden" name="status" value={status} />
                              <SubmitButton label={machineStatusMeta[status].label} pendingLabel="Atualizando..." />
                            </form>
                          ))}
                        </div>

                        <div className="mt-5 rounded-[22px] border border-white/10 bg-black/20 p-4">
                          <p className="text-xs uppercase tracking-[0.18em] text-white/45">Ordens vinculadas</p>
                          <div className="mt-4 space-y-3">
                            {activeOrders.length ? (
                              activeOrders.map((order) => (
                                <div key={order.id} className="rounded-2xl border border-white/10 bg-black/30 p-3">
                                  <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                                    <div>
                                      <p className="font-semibold">{order.orderNumber}</p>
                                      <p className="mt-1 text-sm text-white/60">{order.title}</p>
                                    </div>
                                    <StatusPill {...orderStatusMeta[order.status]} />
                                  </div>
                                </div>
                              ))
                            ) : (
                              <p className="text-sm text-white/60">Nenhum pedido ativo vinculado neste momento.</p>
                            )}
                          </div>
                        </div>

                        <MachineEditor machine={machine} activeOrderCount={activeOrders.length} />
                      </div>
                    </details>
                  );
                })
              ) : (
                <div className="rounded-[22px] border border-dashed border-white/15 bg-slate-950/40 p-5 text-sm text-white/60">
                  Nenhuma máquina cadastrada ainda.
                </div>
              )}
            </div>
          </section>
        </>
      ) : null}
    </AppShell>
  );
}
