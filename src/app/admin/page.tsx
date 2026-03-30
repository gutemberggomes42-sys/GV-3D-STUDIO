import Link from "next/link";
import { MachineStatus, OrderStatus, UserRole } from "@prisma/client";
import { AccountSecurityForm } from "@/components/account-security-form";
import { AppShell } from "@/components/app-shell";
import { MachineEditor } from "@/components/machine-editor";
import { MachineForm } from "@/components/machine-form";
import { MaterialEditor } from "@/components/material-editor";
import { MaterialForm } from "@/components/material-form";
import { MetricCard } from "@/components/metric-card";
import { ShowcaseInquiryEditor } from "@/components/showcase-inquiry-editor";
import { ShowcaseInquiryForm } from "@/components/showcase-inquiry-form";
import { ShowcaseItemEditor } from "@/components/showcase-item-editor";
import { ShowcaseItemForm } from "@/components/showcase-item-form";
import { StatusPill } from "@/components/status-pill";
import { SubmitButton } from "@/components/submit-button";
import {
  updateMachineStatusAction,
  updateShowcaseInquiryOrderStageAction,
} from "@/lib/actions";
import { requireRoles } from "@/lib/auth";
import {
  machineStatusMeta,
  orderStatusMeta,
  showcaseOrderStageMeta,
  showcaseOrderStageOptions,
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
import { listBackupSnapshots } from "@/lib/store";
import { cn } from "@/lib/utils";

type AdminSection =
  | "summary"
  | "vitrine"
  | "leads"
  | "pedidos"
  | "clientes"
  | "materiais"
  | "maquinas";

type AdminPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

const adminSections: Array<{
  key: AdminSection;
  label: string;
  description: string;
}> = [
  { key: "summary", label: "Resumo", description: "Visão geral e atalhos do dono" },
  { key: "vitrine", label: "Vitrine", description: "Cadastrar e editar produtos expostos" },
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

export default async function AdminPage({ searchParams }: AdminPageProps) {
  const user = await requireRoles([UserRole.SUPERVISOR, UserRole.ADMIN]);
  const params = searchParams ? await searchParams : {};
  const rawSection = typeof params.section === "string" ? params.section : undefined;
  const activeSection = isAdminSection(rawSection) ? rawSection : "summary";
  const { orders, materials, machines, users, showcaseItems, showcaseInquiries, auditLogs } =
    await getHydratedData();
  const backupSnapshots = await listBackupSnapshots();
  const now = new Date().getTime();
  const dayInMs = 24 * 60 * 60 * 1000;
  const overview = getOverviewMetrics(orders, machines, materials);
  const ordersByStatus = groupOrdersByStatus(orders);

  const showcaseActiveCount = showcaseItems.filter((item) => item.active).length;
  const showcaseOutOfStockCount = showcaseItems.filter(
    (item) => item.fulfillmentType === "STOCK" && item.stockQuantity <= 0,
  ).length;
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
  const showcaseRevenueValue = closedShowcaseOrders
    .filter((item) => (item.orderStage ?? "RECEIVED") === "COMPLETED")
    .reduce(
      (sum, item) => sum + (showcaseItemPriceMap.get(item.itemId) ?? 0) * item.quantity,
      0,
    );
  const showcasePendingRevenue = closedShowcaseOrders
    .filter((item) => {
      const stage = item.orderStage ?? "RECEIVED";
      return stage !== "COMPLETED" && stage !== "CANCELED";
    })
    .reduce(
      (sum, item) => sum + (showcaseItemPriceMap.get(item.itemId) ?? 0) * item.quantity,
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
            sum + (showcaseItemPriceMap.get(inquiry.itemId) ?? 0) * inquiry.quantity,
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

  const sectionCounts: Record<AdminSection, string> = {
    summary: "7 areas",
    vitrine: `${showcaseItems.length} itens`,
    leads: `${showcaseInquiries.length} contatos`,
    pedidos: `${orders.length + closedShowcaseOrders.length} pedidos`,
    clientes: `${customers.length} clientes`,
    materiais: `${materials.length} materiais`,
    maquinas: `${machines.length} máquinas`,
  };

  return (
    <AppShell
      user={user}
      pathname="/admin"
      title="Painel administrativo"
      subtitle="Separei o administrativo em áreas com botões próprios para você abrir só o que precisa, sem deixar tudo misturado no mesmo lugar."
    >
      <section className="grid gap-4 xl:grid-cols-4">
        <MetricCard label="Receita da operação" value={formatCurrency(summaryRevenue)} caption="Pedidos pagos e pedidos da vitrine já finalizados." accent="orange" />
        <MetricCard label="Pedidos ativos" value={String(summaryActiveOrders)} caption="Pedidos internos e da vitrine ainda não encerrados." accent="mint" />
        <MetricCard label="Leads pendentes" value={String(leadsPendingCount)} caption="Clientes aguardando retorno no WhatsApp." accent="blue" />
        <MetricCard label="Máquinas ocupadas" value={String(summaryMachinesBusy)} caption="Impressoras em uso em pedidos internos e da vitrine." accent="rose" />
      </section>

      <section className="rounded-[28px] border border-white/10 bg-white/5 p-6">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.24em] text-white/45">Botões por área</p>
            <h3 className="mt-2 text-2xl font-semibold">Abra só a parte que você quer mexer</h3>
            <p className="mt-2 text-sm text-white/65">
              Cada botão leva para uma área separada dentro do admin, sem juntar vitrine, leads, materiais e máquinas no mesmo bloco.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Link href="/producao" className="rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3 text-sm text-white/75 transition hover:bg-white/10 hover:text-white">
              Abrir produção
            </Link>
            <Link href="/maquinas" className="rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3 text-sm text-white/75 transition hover:bg-white/10 hover:text-white">
              Abrir máquinas
            </Link>
            <Link href="/financeiro" className="rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3 text-sm text-white/75 transition hover:bg-white/10 hover:text-white">
              Abrir financeiro
            </Link>
          </div>
        </div>

        <div className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {adminSections.map((section) => {
            const active = activeSection === section.key;

            return (
              <Link
                key={section.key}
                href={getSectionHref(section.key)}
                className={cn(
                  "rounded-[24px] border px-5 py-4 transition",
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
                  <a
                    href={`/backups/${snapshot.fileName}`}
                    className="rounded-2xl border border-sky-400/25 bg-sky-500/10 px-4 py-3 text-sm font-semibold text-sky-100 transition hover:bg-sky-500/20"
                  >
                    Baixar backup
                  </a>
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
            <MetricCard label="Contatos gerados" value={String(showcaseInquiries.length)} caption="Cliques enviados para o WhatsApp." accent="blue" />
            <MetricCard label="Negócios fechados" value={String(leadsClosedCount)} caption="Leads marcados como fechados." accent="mint" />
          </section>

          <ShowcaseItemForm materials={materials} />

          <section className="rounded-[28px] border border-white/10 bg-white/5 p-6">
            <p className="text-xs uppercase tracking-[0.24em] text-white/45">Produtos cadastrados</p>
            <h3 className="mt-2 text-2xl font-semibold">Edite cada item separadamente</h3>
            <div className="mt-6 space-y-4">
              {showcaseItems.length ? (
                showcaseItems.map((item) => (
                  <ShowcaseItemEditor
                    key={item.id}
                    item={item}
                    interestCount={showcaseInquiries.filter((inquiry) => inquiry.itemId === item.id).length}
                    materials={materials}
                  />
                ))
              ) : (
                <div className="rounded-[22px] border border-dashed border-white/15 bg-slate-950/40 p-5 text-sm text-white/60">
                  Nenhum item cadastrado ainda. Use o formulário acima para subir a primeira peça da vitrine.
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

          <ShowcaseInquiryForm items={showcaseItems} />

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

            <div className="mt-6 space-y-4">
              {crmQueue.length ? (
                crmQueue.map((inquiry) => (
                  <ShowcaseInquiryEditor
                    key={inquiry.id}
                    inquiry={inquiry}
                    items={showcaseItems}
                  />
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
                  </article>
                ))
              ) : (
                <div className="rounded-[22px] border border-dashed border-white/15 bg-slate-950/40 p-5 text-sm text-white/60">
                  Ainda não há pedidos fechados vindos do WhatsApp.
                </div>
              )}
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
                              {" · "}Total estimado: {formatCurrency((showcaseItems.find((item) => item.id === entry.inquiry.itemId)?.price ?? 0) * entry.inquiry.quantity)}
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
                  <article key={customer.id} className="rounded-[24px] border border-white/10 bg-slate-950/60 p-5">
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

          <MaterialForm redirectTo="/admin?section=materiais" />

          <section className="rounded-[28px] border border-white/10 bg-white/5 p-6">
            <p className="text-xs uppercase tracking-[0.24em] text-white/45">Materiais cadastrados</p>
            <h3 className="mt-2 text-2xl font-semibold">Edite um material por vez</h3>
            <div className="mt-6 space-y-4">
              {materials.length ? (
                materials.map((material) => (
                  <MaterialEditor
                    key={material.id}
                    material={material}
                    linkedOrderCount={
                      orders.filter((order) => order.materialId === material.id).length +
                      showcaseItems.filter((item) => item.materialId === material.id).length
                    }
                    redirectTo="/admin?section=materiais"
                  />
                ))
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

          <MachineForm />

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
                    <article key={machine.id} className="rounded-[24px] border border-white/10 bg-slate-950/60 p-5">
                      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                        <div>
                          <p className="text-sm text-white/45">{machine.model}</p>
                          <h4 className="mt-1 text-2xl font-semibold">{machine.name}</h4>
                          <p className="mt-2 text-sm text-white/60">
                            {machine.location ?? "Sem localização definida"} · {machine.supportedMaterialNames}
                          </p>
                          {machine.notes ? <p className="mt-2 text-sm text-white/60">{machine.notes}</p> : null}
                        </div>
                        <StatusPill {...machineStatusMeta[machine.status]} />
                      </div>

                      <div className="mt-5 grid gap-3 md:grid-cols-4">
                        <div className="rounded-2xl border border-white/10 bg-black/30 p-3">
                          <p className="text-xs uppercase tracking-[0.18em] text-white/45">Bico</p>
                          <p className="mt-2 text-lg font-semibold">{machine.nozzleTemp ?? 0}°C</p>
                        </div>
                        <div className="rounded-2xl border border-white/10 bg-black/30 p-3">
                          <p className="text-xs uppercase tracking-[0.18em] text-white/45">Mesa</p>
                          <p className="mt-2 text-lg font-semibold">{machine.bedTemp ?? 0}°C</p>
                        </div>
                        <div className="rounded-2xl border border-white/10 bg-black/30 p-3">
                          <p className="text-xs uppercase tracking-[0.18em] text-white/45">Progresso</p>
                          <p className="mt-2 text-lg font-semibold">{machine.progressPercent}%</p>
                        </div>
                        <div className="rounded-2xl border border-white/10 bg-black/30 p-3">
                          <p className="text-xs uppercase tracking-[0.18em] text-white/45">Restante</p>
                          <p className="mt-2 text-lg font-semibold">{machine.timeRemainingMinutes} min</p>
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
                    </article>
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
