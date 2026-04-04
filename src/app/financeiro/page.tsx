import { PaymentStatus, UserRole } from "@prisma/client";
import {
  deleteExpenseAction,
  deletePayableAction,
  updatePayableStatusAction,
} from "@/lib/actions";
import { AppShell } from "@/components/app-shell";
import { ExpenseForm } from "@/components/expense-form";
import { MetricCard } from "@/components/metric-card";
import { PayableForm } from "@/components/payable-form";
import { SubmitButton } from "@/components/submit-button";
import { requireRoles } from "@/lib/auth";
import {
  expenseCategoryLabels,
  paymentMethodLabels,
  paymentStatusLabels,
  payableStatusLabels,
  showcaseOrderStageMeta,
} from "@/lib/constants";
import type { DbPayableStatus, ShowcaseOrderStage } from "@/lib/db-types";
import { formatCurrency, formatDateOnly, formatMonthYear, formatWeight } from "@/lib/format";
import { getHydratedData } from "@/lib/view-data";

type RevenueEntry = {
  id: string;
  orderLabel: string;
  customerLabel: string;
  methodLabel: string;
  statusLabel: string;
  value: number;
  date: string;
};

type ExpenseEntry = {
  id: string;
  title: string;
  categoryLabel: string;
  sourceLabel: string;
  value: number;
  date: string;
  notes?: string;
  deletable: boolean;
};

function getMonthKey(date: string) {
  return date.slice(0, 7);
}

function getMonthLabel(monthKey: string) {
  return formatMonthYear(new Date(`${monthKey}-01T12:00:00`));
}

function getShowcaseInquiryTotalValue(
  inquiry: { quantity: number; estimatedTotal?: number; freightEstimate?: number },
  itemPrice: number,
) {
  return (inquiry.estimatedTotal ?? itemPrice * inquiry.quantity) + (inquiry.freightEstimate ?? 0);
}

export default async function FinancePage() {
  const user = await requireRoles([UserRole.SUPERVISOR, UserRole.ADMIN]);
  const { orders, showcaseItems, showcaseInquiries, materials, machines, expenses, payables } =
    await getHydratedData();
  const nowIso = new Date().toISOString();
  const nowTime = new Date(nowIso).getTime();
  const showcaseItemMap = new Map(showcaseItems.map((item) => [item.id, item]));
  const materialMap = new Map(materials.map((material) => [material.id, material]));
  const showcaseReceivableStages = new Set<ShowcaseOrderStage>([
    "QUEUED",
    "PRINTING",
    "POST_PROCESSING",
    "QUALITY",
    "READY_TO_SHIP",
    "SHIPPED",
    "FAILED_REWORK",
  ]);
  const showcaseRevenueStages = new Set<ShowcaseOrderStage>(["COMPLETED"]);
  const showcaseFinancialOrders = showcaseInquiries
    .filter(
      (inquiry) =>
        inquiry.status === "CLOSED" &&
        (showcaseReceivableStages.has(inquiry.orderStage ?? "RECEIVED") ||
          showcaseRevenueStages.has(inquiry.orderStage ?? "RECEIVED")),
    )
    .map((inquiry) => {
      const item = showcaseItemMap.get(inquiry.itemId);
      const stage = inquiry.orderStage ?? "RECEIVED";
      return {
        ...inquiry,
        item,
        totalValue: Number(
          getShowcaseInquiryTotalValue(inquiry, item?.price ?? 0).toFixed(2),
        ),
        financialDate: inquiry.closedAt ?? inquiry.updatedAt,
        stage,
      };
    })
    .sort((left, right) => right.financialDate.localeCompare(left.financialDate));

  const payments = orders.flatMap((order) =>
    order.payments.map((payment) => ({
      ...payment,
      order,
    })),
  );

  const revenueEntries: RevenueEntry[] = [
    ...payments
      .filter((payment) => payment.status === PaymentStatus.PAID)
      .map((payment) => ({
        id: payment.id,
        orderLabel: payment.order.orderNumber,
        customerLabel:
          payment.order.customer?.company ?? payment.order.customer?.name ?? "Cliente sem cadastro",
        methodLabel: paymentMethodLabels[payment.method],
        statusLabel: paymentStatusLabels[payment.status],
        value: payment.amount,
        date: payment.paidAt ?? payment.createdAt,
      })),
    ...showcaseFinancialOrders
      .filter((inquiry) => showcaseRevenueStages.has(inquiry.stage))
      .map((inquiry) => ({
        id: inquiry.id,
        orderLabel: inquiry.orderNumber ? `${inquiry.orderNumber} · ${inquiry.itemName}` : `WhatsApp · ${inquiry.itemName}`,
        customerLabel: inquiry.customerName,
        methodLabel: "WhatsApp",
        statusLabel: showcaseOrderStageMeta[inquiry.stage].label,
        value: inquiry.totalValue,
        date: inquiry.financialDate,
      })),
  ].sort((left, right) => right.date.localeCompare(left.date));

  const revenue = revenueEntries.reduce((sum, entry) => sum + entry.value, 0);
  const receivableFromOrders = orders
    .filter((order) => order.paymentStatus !== PaymentStatus.PAID)
    .reduce((sum, order) => sum + order.totalPrice, 0);
  const receivableFromShowcase = showcaseFinancialOrders.reduce(
    (sum, inquiry) => sum + (showcaseReceivableStages.has(inquiry.stage) ? inquiry.totalValue : 0),
    0,
  );
  const receivable = receivableFromOrders + receivableFromShowcase;
  const accountsPayable = payables
    .map((payable) => {
      const status: DbPayableStatus =
        payable.status === "PAID"
          ? "PAID"
          : new Date(payable.dueDate).getTime() < nowTime
            ? "OVERDUE"
            : "PENDING";

      return {
        ...payable,
        status,
      };
    })
    .sort((left, right) => left.dueDate.localeCompare(right.dueDate));
  const payableTotal = accountsPayable
    .filter((entry) => entry.status !== "PAID")
    .reduce((sum, entry) => sum + entry.amount, 0);
  const overduePayables = accountsPayable.filter((entry) => entry.status === "OVERDUE");

  const machineInvestmentTotal = machines.reduce((sum, machine) => sum + machine.purchasePrice, 0);
  const machinePaidTotal = machines.reduce((sum, machine) => sum + machine.amountPaid, 0);
  const machineOutstandingTotal = machines.reduce(
    (sum, machine) => sum + Math.max(machine.purchasePrice - machine.amountPaid, 0),
    0,
  );

  const expenseEntries: ExpenseEntry[] = [
    ...materials
      .filter((material) => material.purchasePrice > 0)
      .map((material) => ({
        id: `material-${material.id}`,
        title: `Compra de material · ${material.name}`,
        categoryLabel: "Material",
        sourceLabel: `${material.brand} · ${material.color}`,
        value: material.purchasePrice,
        date: material.createdAt,
        notes: material.lot ? `Lote ${material.lot}` : undefined,
        deletable: false,
      })),
    ...machines
      .filter((machine) => machine.amountPaid > 0)
      .map((machine) => ({
        id: `machine-${machine.id}`,
        title: `Investimento em impressora · ${machine.name}`,
        categoryLabel: "Impressora",
        sourceLabel: machine.model,
        value: machine.amountPaid,
        date: machine.purchasedAt ?? machine.createdAt,
        notes:
          machine.purchasePrice > machine.amountPaid
            ? `Falta pagar ${formatCurrency(Math.max(machine.purchasePrice - machine.amountPaid, 0))}.`
            : "Impressora quitada.",
        deletable: false,
      })),
    ...machines.flatMap((machine) =>
      machine.maintenanceRecords
        .filter((record) => (record.cost ?? 0) > 0)
        .map((record) => ({
          id: `maintenance-${machine.id}-${record.id}`,
          title: `Manutenção · ${machine.name}`,
          categoryLabel: "Manutenção",
          sourceLabel: record.type,
          value: record.cost ?? 0,
          date: record.completedAt ?? record.scheduledAt,
          notes: record.summary,
          deletable: false,
        })),
    ),
    ...expenses.map((expense) => ({
      id: expense.id,
      title: expense.title,
      categoryLabel: expenseCategoryLabels[expense.category],
      sourceLabel: "Lançamento manual",
      value: expense.amount,
      date: expense.paidAt,
      notes: expense.notes,
      deletable: true,
    })),
  ].sort((left, right) => right.date.localeCompare(left.date));

  const totalExpenses = expenseEntries.reduce((sum, expense) => sum + expense.value, 0);
  const netResult = revenue - totalExpenses;
  const totalGrossMargin = orders.reduce((sum, order) => sum + (order.grossMargin ?? 0), 0);
  const materialConsumptionValue =
    orders.reduce((sum, order) => sum + (order.materialConsumptionValue ?? 0), 0) +
    showcaseFinancialOrders.reduce(
      (sum, inquiry) => sum + (inquiry.materialConsumptionValue ?? 0),
      0,
    );

  const recurringCustomersMap = new Map<
    string,
    { label: string; orderCount: number; total: number }
  >();

  orders.forEach((order) => {
    const key = order.customer?.id ?? order.customerId;
    const label = order.customer?.company ?? order.customer?.name ?? "Cliente sem cadastro";
    const current = recurringCustomersMap.get(key) ?? {
      label,
      orderCount: 0,
      total: 0,
    };

    current.orderCount += 1;
    current.total += order.totalPrice;
    recurringCustomersMap.set(key, current);
  });

  showcaseFinancialOrders.forEach((inquiry) => {
    const key = `showcase:${inquiry.customerEmail || inquiry.customerPhone || inquiry.customerName}`;
    const current = recurringCustomersMap.get(key) ?? {
      label: inquiry.customerName,
      orderCount: 0,
      total: 0,
    };

    current.orderCount += 1;
    current.total += inquiry.totalValue;
    recurringCustomersMap.set(key, current);
  });

  const recurringCustomers = [...recurringCustomersMap.values()].sort((left, right) => {
    if (right.total !== left.total) {
      return right.total - left.total;
    }

    return right.orderCount - left.orderCount;
  });

  const movementEntries = [
    ...payments.map((payment) => ({
      id: payment.id,
      orderLabel: payment.order.orderNumber,
      customerLabel:
        payment.order.customer?.company ?? payment.order.customer?.name ?? "Cliente sem cadastro",
      methodLabel: paymentMethodLabels[payment.method],
      statusLabel: paymentStatusLabels[payment.status],
      value: payment.amount,
      date: payment.paidAt ?? payment.createdAt,
    })),
    ...showcaseFinancialOrders.map((inquiry) => ({
      id: inquiry.id,
      orderLabel: inquiry.orderNumber ? `${inquiry.orderNumber} · ${inquiry.itemName}` : `WhatsApp · ${inquiry.itemName}`,
      customerLabel: inquiry.customerName,
      methodLabel: "WhatsApp",
      statusLabel: showcaseOrderStageMeta[inquiry.stage].label,
      value: inquiry.totalValue,
      date: inquiry.financialDate,
    })),
  ].sort((left, right) => right.date.localeCompare(left.date));
  const cashFlowMap = new Map<string, { date: string; inflow: number; outflow: number; balance: number }>();

  revenueEntries.forEach((entry) => {
    const date = entry.date.slice(0, 10);
    const current = cashFlowMap.get(date) ?? { date, inflow: 0, outflow: 0, balance: 0 };
    current.inflow += entry.value;
    current.balance = current.inflow - current.outflow;
    cashFlowMap.set(date, current);
  });

  expenseEntries.forEach((entry) => {
    const date = entry.date.slice(0, 10);
    const current = cashFlowMap.get(date) ?? { date, inflow: 0, outflow: 0, balance: 0 };
    current.outflow += entry.value;
    current.balance = current.inflow - current.outflow;
    cashFlowMap.set(date, current);
  });

  const cashFlowDays = [...cashFlowMap.values()]
    .sort((left, right) => right.date.localeCompare(left.date))
    .slice(0, 15);

  const monthlyMap = new Map<
    string,
    { monthKey: string; revenue: number; expenses: number; result: number }
  >();
  const dreMap = new Map<
    string,
    {
      monthKey: string;
      revenue: number;
      materialCost: number;
      operatingExpenses: number;
      operatingProfit: number;
    }
  >();

  revenueEntries.forEach((entry) => {
    const monthKey = getMonthKey(entry.date);
    const current = monthlyMap.get(monthKey) ?? {
      monthKey,
      revenue: 0,
      expenses: 0,
      result: 0,
    };
    current.revenue += entry.value;
    current.result = current.revenue - current.expenses;
    monthlyMap.set(monthKey, current);

    const dreCurrent = dreMap.get(monthKey) ?? {
      monthKey,
      revenue: 0,
      materialCost: 0,
      operatingExpenses: 0,
      operatingProfit: 0,
    };
    dreCurrent.revenue += entry.value;
    dreCurrent.operatingProfit =
      dreCurrent.revenue - dreCurrent.materialCost - dreCurrent.operatingExpenses;
    dreMap.set(monthKey, dreCurrent);
  });

  expenseEntries.forEach((entry) => {
    const monthKey = getMonthKey(entry.date);
    const current = monthlyMap.get(monthKey) ?? {
      monthKey,
      revenue: 0,
      expenses: 0,
      result: 0,
    };
    current.expenses += entry.value;
    current.result = current.revenue - current.expenses;
    monthlyMap.set(monthKey, current);

    const dreCurrent = dreMap.get(monthKey) ?? {
      monthKey,
      revenue: 0,
      materialCost: 0,
      operatingExpenses: 0,
      operatingProfit: 0,
    };
    dreCurrent.operatingExpenses += entry.value;
    dreCurrent.operatingProfit =
      dreCurrent.revenue - dreCurrent.materialCost - dreCurrent.operatingExpenses;
    dreMap.set(monthKey, dreCurrent);
  });

  orders.forEach((order) => {
    const date = order.paidAt ?? order.updatedAt;
    const monthKey = getMonthKey(date);
    const dreCurrent = dreMap.get(monthKey) ?? {
      monthKey,
      revenue: 0,
      materialCost: 0,
      operatingExpenses: 0,
      operatingProfit: 0,
    };
    dreCurrent.materialCost += order.materialConsumptionValue ?? 0;
    dreCurrent.operatingProfit =
      dreCurrent.revenue - dreCurrent.materialCost - dreCurrent.operatingExpenses;
    dreMap.set(monthKey, dreCurrent);
  });

  showcaseFinancialOrders.forEach((inquiry) => {
    const monthKey = getMonthKey(inquiry.financialDate);
    const dreCurrent = dreMap.get(monthKey) ?? {
      monthKey,
      revenue: 0,
      materialCost: 0,
      operatingExpenses: 0,
      operatingProfit: 0,
    };
    dreCurrent.materialCost += inquiry.materialConsumptionValue ?? 0;
    dreCurrent.operatingProfit =
      dreCurrent.revenue - dreCurrent.materialCost - dreCurrent.operatingExpenses;
    dreMap.set(monthKey, dreCurrent);
  });

  const monthlyPerformance = [...monthlyMap.values()].sort((left, right) =>
    right.monthKey.localeCompare(left.monthKey),
  );
  const monthsWithLoss = monthlyPerformance.filter((month) => month.result < 0).length;
  const drePerformance = [...dreMap.values()].sort((left, right) =>
    right.monthKey.localeCompare(left.monthKey),
  );
  const productProfitabilityMap = new Map<
    string,
    {
      label: string;
      units: number;
      revenue: number;
      cost: number;
      profit: number;
      materialConsumed: number;
    }
  >();

  orders.forEach((order) => {
    const label = order.title;
    const current = productProfitabilityMap.get(label) ?? {
      label,
      units: 0,
      revenue: 0,
      cost: 0,
      profit: 0,
      materialConsumed: 0,
    };
    const cost = order.realCost ?? order.subtotal;
    current.units += order.quantity;
    current.revenue += order.totalPrice;
    current.cost += cost;
    current.profit += order.totalPrice - cost;
    current.materialConsumed += order.materialConsumptionGrams ?? order.estimatedWeightGrams;
    productProfitabilityMap.set(label, current);
  });

  showcaseFinancialOrders.forEach((inquiry) => {
    const item = showcaseItemMap.get(inquiry.itemId);
    if (!item) {
      return;
    }

    const material = item.materialId ? materialMap.get(item.materialId) : undefined;
    const estimatedConsumption =
      inquiry.materialConsumptionGrams ??
      Number(((item.estimatedMaterialGrams || 0) * inquiry.quantity).toFixed(2));
    const estimatedCost =
      inquiry.materialConsumptionValue ??
      Number((estimatedConsumption * (material?.costPerUnit ?? 0)).toFixed(2));
    const current = productProfitabilityMap.get(item.name) ?? {
      label: item.name,
      units: 0,
      revenue: 0,
      cost: 0,
      profit: 0,
      materialConsumed: 0,
    };

    current.units += inquiry.quantity;
    current.revenue += inquiry.totalValue;
    current.cost += estimatedCost;
    current.profit += inquiry.totalValue - estimatedCost;
    current.materialConsumed += estimatedConsumption;
    productProfitabilityMap.set(item.name, current);
  });

  const productProfitability = [...productProfitabilityMap.values()]
    .sort((left, right) => right.profit - left.profit)
    .slice(0, 10);

  return (
    <AppShell
      user={user}
      pathname="/financeiro"
      title="Financeiro e relatórios"
      subtitle="Acompanhe receita, gastos, lucro, prejuízo mensal, investimento em impressoras e tudo o que ainda falta receber ou pagar."
    >
      <section className="grid gap-4 xl:grid-cols-4">
        <MetricCard
          label="Receita recebida"
          value={formatCurrency(revenue)}
          caption="Entradas já compensadas no sistema."
          accent="orange"
        />
        <MetricCard
          label="Contas a receber"
          value={formatCurrency(receivable)}
          caption="Pedidos internos e da vitrine aguardando pagamento."
          accent="blue"
        />
        <MetricCard
          label="Contas a pagar"
          value={formatCurrency(payableTotal)}
          caption="Compromissos ainda não pagos."
          accent="orange"
        />
        <MetricCard
          label="Vencidas"
          value={String(overduePayables.length)}
          caption="Contas a pagar já vencidas."
          accent="rose"
        />
        <MetricCard
          label="Gastos totais"
          value={formatCurrency(totalExpenses)}
          caption="Materiais, impressoras, manutenções e despesas manuais."
          accent="rose"
        />
        <MetricCard
          label={netResult >= 0 ? "Lucro líquido" : "Prejuízo acumulado"}
          value={formatCurrency(Math.abs(netResult))}
          caption={
            netResult >= 0
              ? "Receita menos gastos totais lançados."
              : "Saídas acima da receita recebida até agora."
          }
          accent={netResult >= 0 ? "mint" : "rose"}
        />
        <MetricCard
          label="Valor das impressoras"
          value={formatCurrency(machineInvestmentTotal)}
          caption="Soma do valor total cadastrado nas máquinas."
          accent="blue"
        />
        <MetricCard
          label="Já pago nas impressoras"
          value={formatCurrency(machinePaidTotal)}
          caption="Quanto já saiu do caixa para aquisição das máquinas."
          accent="mint"
        />
        <MetricCard
          label="Falta pagar máquinas"
          value={formatCurrency(machineOutstandingTotal)}
          caption="Saldo em aberto nas impressoras cadastradas."
          accent="rose"
        />
        <MetricCard
          label="Meses com prejuízo"
          value={String(monthsWithLoss)}
          caption="Quantidade de meses em que os gastos passaram a receita."
          accent="orange"
        />
        <MetricCard
          label="Material consumido"
          value={formatCurrency(materialConsumptionValue)}
          caption="Custo já baixado nos pedidos que entraram em impressão."
          accent="blue"
        />
      </section>

      <section className="grid gap-6 xl:grid-cols-[0.85fr_0.85fr_1.3fr]">
        <PayableForm />
        <ExpenseForm />

        <div className="rounded-[28px] border border-white/10 bg-white/5 p-6">
          <p className="text-xs uppercase tracking-[0.24em] text-white/45">Resultado por mês</p>
          <h3 className="mt-2 text-2xl font-semibold">Lucro e prejuízo mensal</h3>
          <p className="mt-2 text-sm text-white/60">
            Cada mês compara entradas recebidas com gastos registrados, incluindo materiais, máquinas e despesas manuais.
          </p>

          <div className="mt-6 overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="text-white/45">
                <tr>
                  <th className="pb-3 pr-4 font-medium">Mês</th>
                  <th className="pb-3 pr-4 font-medium">Receita</th>
                  <th className="pb-3 pr-4 font-medium">Gastos</th>
                  <th className="pb-3 pr-4 font-medium">Resultado</th>
                  <th className="pb-3 font-medium">Situação</th>
                </tr>
              </thead>
              <tbody>
                {monthlyPerformance.length ? (
                  monthlyPerformance.map((month) => (
                    <tr key={month.monthKey} className="border-t border-white/10">
                      <td className="py-3 pr-4 text-white capitalize">
                        {getMonthLabel(month.monthKey)}
                      </td>
                      <td className="py-3 pr-4 text-emerald-100">
                        {formatCurrency(month.revenue)}
                      </td>
                      <td className="py-3 pr-4 text-rose-100">
                        {formatCurrency(month.expenses)}
                      </td>
                      <td
                        className={`py-3 pr-4 font-semibold ${
                          month.result >= 0 ? "text-emerald-100" : "text-rose-100"
                        }`}
                      >
                        {formatCurrency(month.result)}
                      </td>
                      <td className="py-3">
                        <span
                          className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] ${
                            month.result >= 0
                              ? "border-emerald-400/30 bg-emerald-500/15 text-emerald-50"
                              : "border-rose-400/30 bg-rose-500/15 text-rose-50"
                          }`}
                        >
                          {month.result >= 0 ? "Lucro" : "Prejuízo"}
                        </span>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr className="border-t border-white/10">
                    <td colSpan={5} className="py-6 text-center text-white/60">
                      Ainda não há movimentações suficientes para calcular o resultado mensal.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[0.85fr_1.15fr]">
        <div className="rounded-[28px] border border-white/10 bg-white/5 p-6">
          <p className="text-xs uppercase tracking-[0.24em] text-white/45">DRE mensal</p>
          <h3 className="mt-2 text-2xl font-semibold">Receita, custo e operação</h3>
          <div className="mt-6 overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="text-white/45">
                <tr>
                  <th className="pb-3 pr-4 font-medium">Mês</th>
                  <th className="pb-3 pr-4 font-medium">Receita</th>
                  <th className="pb-3 pr-4 font-medium">Material consumido</th>
                  <th className="pb-3 pr-4 font-medium">Despesas</th>
                  <th className="pb-3 font-medium">Resultado operacional</th>
                </tr>
              </thead>
              <tbody>
                {drePerformance.length ? (
                  drePerformance.map((entry) => (
                    <tr key={entry.monthKey} className="border-t border-white/10">
                      <td className="py-3 pr-4 text-white capitalize">
                        {getMonthLabel(entry.monthKey)}
                      </td>
                      <td className="py-3 pr-4 text-emerald-100">{formatCurrency(entry.revenue)}</td>
                      <td className="py-3 pr-4 text-amber-100">{formatCurrency(entry.materialCost)}</td>
                      <td className="py-3 pr-4 text-rose-100">{formatCurrency(entry.operatingExpenses)}</td>
                      <td className={`py-3 font-semibold ${entry.operatingProfit >= 0 ? "text-emerald-100" : "text-rose-100"}`}>
                        {formatCurrency(entry.operatingProfit)}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr className="border-t border-white/10">
                    <td colSpan={5} className="py-6 text-center text-white/60">
                      Ainda não há dados suficientes para montar a DRE mensal.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="rounded-[28px] border border-white/10 bg-white/5 p-6">
          <p className="text-xs uppercase tracking-[0.24em] text-white/45">Impressoras</p>
          <h3 className="mt-2 text-2xl font-semibold">Investimento em máquinas</h3>
          <div className="mt-6 overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="text-white/45">
                <tr>
                  <th className="pb-3 pr-4 font-medium">Impressora</th>
                  <th className="pb-3 pr-4 font-medium">Valor</th>
                  <th className="pb-3 pr-4 font-medium">Pago</th>
                  <th className="pb-3 pr-4 font-medium">Falta pagar</th>
                  <th className="pb-3 font-medium">Compra</th>
                </tr>
              </thead>
              <tbody>
                {machines.length ? (
                  machines.map((machine) => (
                    <tr key={machine.id} className="border-t border-white/10">
                      <td className="py-3 pr-4">
                        <p className="text-white">{machine.name}</p>
                        <p className="mt-1 text-xs uppercase tracking-[0.18em] text-white/45">
                          {machine.model}
                        </p>
                      </td>
                      <td className="py-3 pr-4 text-white">
                        {formatCurrency(machine.purchasePrice)}
                      </td>
                      <td className="py-3 pr-4 text-emerald-100">
                        {formatCurrency(machine.amountPaid)}
                      </td>
                      <td className="py-3 pr-4 text-rose-100">
                        {formatCurrency(Math.max(machine.purchasePrice - machine.amountPaid, 0))}
                      </td>
                      <td className="py-3 text-white/70">
                        {machine.purchasedAt
                          ? formatDateOnly(new Date(machine.purchasedAt))
                          : "Sem data"}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr className="border-t border-white/10">
                    <td colSpan={5} className="py-6 text-center text-white/60">
                      Nenhuma impressora cadastrada ainda.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="rounded-[28px] border border-white/10 bg-white/5 p-6">
          <p className="text-xs uppercase tracking-[0.24em] text-white/45">Contas a pagar</p>
          <h3 className="mt-2 text-2xl font-semibold">Agenda financeira</h3>
          <p className="mt-2 text-sm text-white/60">
            Controle o que ainda vai vencer, marque como pago e acompanhe o que está atrasado.
          </p>
          <div className="mt-6 overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="text-white/45">
                <tr>
                  <th className="pb-3 pr-4 font-medium">Conta</th>
                  <th className="pb-3 pr-4 font-medium">Categoria</th>
                  <th className="pb-3 pr-4 font-medium">Vencimento</th>
                  <th className="pb-3 pr-4 font-medium">Valor</th>
                  <th className="pb-3 pr-4 font-medium">Status</th>
                  <th className="pb-3 font-medium">Ações</th>
                </tr>
              </thead>
              <tbody>
                {accountsPayable.length ? (
                  accountsPayable.map((entry) => (
                    <tr key={entry.id} className="border-t border-white/10 align-top">
                      <td className="py-3 pr-4">
                        <p className="text-white">{entry.title}</p>
                        {entry.vendor ? <p className="mt-1 text-xs text-white/55">{entry.vendor}</p> : null}
                        {entry.notes ? <p className="mt-1 text-xs text-white/45">{entry.notes}</p> : null}
                      </td>
                      <td className="py-3 pr-4 text-white/70">{expenseCategoryLabels[entry.category]}</td>
                      <td className="py-3 pr-4 text-white/70">{formatDateOnly(new Date(entry.dueDate))}</td>
                      <td className="py-3 pr-4 text-white">{formatCurrency(entry.amount)}</td>
                      <td className="py-3 pr-4">
                        <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] ${
                          entry.status === "PAID"
                            ? "border-emerald-400/25 bg-emerald-500/15 text-emerald-100"
                            : entry.status === "OVERDUE"
                              ? "border-rose-400/25 bg-rose-500/15 text-rose-100"
                              : "border-amber-400/25 bg-amber-500/15 text-amber-100"
                        }`}>
                          {payableStatusLabels[entry.status]}
                        </span>
                      </td>
                      <td className="py-3">
                        <div className="flex flex-wrap gap-2">
                          {entry.status !== "PAID" ? (
                            <form action={updatePayableStatusAction}>
                              <input type="hidden" name="payableId" value={entry.id} />
                              <input type="hidden" name="status" value="PAID" />
                              <SubmitButton
                                label="Marcar pago"
                                pendingLabel="Salvando..."
                                className="bg-emerald-500/85 text-white hover:bg-emerald-400"
                              />
                            </form>
                          ) : (
                            <form action={updatePayableStatusAction}>
                              <input type="hidden" name="payableId" value={entry.id} />
                              <input type="hidden" name="status" value="PENDING" />
                              <SubmitButton
                                label="Reabrir"
                                pendingLabel="Salvando..."
                                className="bg-white/10 text-white hover:bg-white/15"
                              />
                            </form>
                          )}
                          <form action={deletePayableAction}>
                            <input type="hidden" name="payableId" value={entry.id} />
                            <button
                              type="submit"
                              className="rounded-full border border-rose-400/25 bg-rose-500/10 px-3 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-rose-100 transition hover:bg-rose-500/20"
                            >
                              Excluir
                            </button>
                          </form>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr className="border-t border-white/10">
                    <td colSpan={6} className="py-6 text-center text-white/60">
                      Ainda não há contas a pagar lançadas.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="rounded-[28px] border border-white/10 bg-white/5 p-6">
          <p className="text-xs uppercase tracking-[0.24em] text-white/45">Todos os gastos</p>
          <h3 className="mt-2 text-2xl font-semibold">Saídas da operação</h3>
          <p className="mt-2 text-sm text-white/60">
            Aqui entram materiais, impressoras, manutenções e lançamentos manuais do financeiro.
          </p>

          <div className="mt-6 overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="text-white/45">
                <tr>
                  <th className="pb-3 pr-4 font-medium">Gasto</th>
                  <th className="pb-3 pr-4 font-medium">Categoria</th>
                  <th className="pb-3 pr-4 font-medium">Origem</th>
                  <th className="pb-3 pr-4 font-medium">Valor</th>
                  <th className="pb-3 pr-4 font-medium">Data</th>
                  <th className="pb-3 font-medium">Ação</th>
                </tr>
              </thead>
              <tbody>
                {expenseEntries.length ? (
                  expenseEntries.map((entry) => (
                    <tr key={entry.id} className="border-t border-white/10 align-top">
                      <td className="py-3 pr-4">
                        <p className="text-white">{entry.title}</p>
                        {entry.notes ? (
                          <p className="mt-1 text-xs leading-5 text-white/50">{entry.notes}</p>
                        ) : null}
                      </td>
                      <td className="py-3 pr-4 text-white/70">{entry.categoryLabel}</td>
                      <td className="py-3 pr-4 text-white/70">{entry.sourceLabel}</td>
                      <td className="py-3 pr-4 text-rose-100">{formatCurrency(entry.value)}</td>
                      <td className="py-3 pr-4 text-white/70">
                        {formatDateOnly(new Date(entry.date))}
                      </td>
                      <td className="py-3">
                        {entry.deletable ? (
                          <form action={deleteExpenseAction}>
                            <input type="hidden" name="expenseId" value={entry.id} />
                            <button
                              type="submit"
                              className="rounded-full border border-rose-400/25 bg-rose-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-rose-100 transition hover:bg-rose-500/20"
                            >
                              Excluir
                            </button>
                          </form>
                        ) : (
                          <span className="text-xs uppercase tracking-[0.16em] text-white/35">
                            Automático
                          </span>
                        )}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr className="border-t border-white/10">
                    <td colSpan={6} className="py-6 text-center text-white/60">
                      Ainda não há gastos registrados.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[0.8fr_1.2fr]">
        <div className="rounded-[28px] border border-white/10 bg-white/5 p-6">
          <p className="text-xs uppercase tracking-[0.24em] text-white/45">Clientes mais recorrentes</p>
          <h3 className="mt-2 text-2xl font-semibold">Ranking por faturamento</h3>
          <div className="mt-6 space-y-3">
            {recurringCustomers.length ? (
              recurringCustomers.map((customer) => (
                <div
                  key={`${customer.label}-${customer.orderCount}-${customer.total}`}
                  className="rounded-[22px] border border-white/10 bg-slate-950/60 p-4"
                >
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="text-lg font-semibold">{customer.label}</p>
                      <p className="mt-1 text-sm text-white/60">{customer.orderCount} pedidos</p>
                    </div>
                    <p className="text-lg font-semibold">{formatCurrency(customer.total)}</p>
                  </div>
                </div>
              ))
            ) : (
              <div className="rounded-[22px] border border-dashed border-white/15 bg-slate-950/40 p-4 text-sm text-white/60">
                Ainda não há pedidos suficientes para montar o ranking.
              </div>
            )}
          </div>
        </div>

        <div className="rounded-[28px] border border-white/10 bg-white/5 p-6">
          <p className="text-xs uppercase tracking-[0.24em] text-white/45">Entradas e recebimentos</p>
          <h3 className="mt-2 text-2xl font-semibold">Lançamentos financeiros</h3>
          <p className="mt-2 text-sm text-white/60">
            Pedidos da vitrine entram aqui a partir de `Em fila` e seguem aparecendo nas etapas seguintes.
          </p>
          <div className="mt-6 overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="text-white/45">
                <tr>
                  <th className="pb-3 pr-4 font-medium">Pedido</th>
                  <th className="pb-3 pr-4 font-medium">Cliente</th>
                  <th className="pb-3 pr-4 font-medium">Método</th>
                  <th className="pb-3 pr-4 font-medium">Status</th>
                  <th className="pb-3 pr-4 font-medium">Valor</th>
                  <th className="pb-3 font-medium">Data</th>
                </tr>
              </thead>
              <tbody>
                {movementEntries.length ? (
                  movementEntries.map((entry) => (
                    <tr key={entry.id} className="border-t border-white/10">
                      <td className="py-3 pr-4 text-white">{entry.orderLabel}</td>
                      <td className="py-3 pr-4 text-white/70">{entry.customerLabel}</td>
                      <td className="py-3 pr-4 text-white/70">{entry.methodLabel}</td>
                      <td className="py-3 pr-4 text-white/70">{entry.statusLabel}</td>
                      <td className="py-3 pr-4 text-white">{formatCurrency(entry.value)}</td>
                      <td className="py-3 text-white/70">
                        {formatDateOnly(new Date(entry.date))}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr className="border-t border-white/10">
                    <td colSpan={6} className="py-6 text-center text-white/60">
                      Ainda não há lançamentos financeiros para mostrar.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="mt-6 rounded-[22px] border border-white/10 bg-slate-950/60 p-4">
            <p className="text-xs uppercase tracking-[0.18em] text-white/45">Lucro bruto dos pedidos internos</p>
            <p className="mt-3 text-3xl font-semibold text-white">{formatCurrency(totalGrossMargin)}</p>
            <p className="mt-2 text-sm text-white/60">
              Soma da margem bruta calculada nos pedidos internos já cadastrados no sistema.
            </p>
          </div>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <div className="rounded-[28px] border border-white/10 bg-white/5 p-6">
          <p className="text-xs uppercase tracking-[0.24em] text-white/45">Fluxo de caixa</p>
          <h3 className="mt-2 text-2xl font-semibold">Entradas e saídas por dia</h3>
          <div className="mt-6 overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="text-white/45">
                <tr>
                  <th className="pb-3 pr-4 font-medium">Data</th>
                  <th className="pb-3 pr-4 font-medium">Entradas</th>
                  <th className="pb-3 pr-4 font-medium">Saídas</th>
                  <th className="pb-3 font-medium">Saldo</th>
                </tr>
              </thead>
              <tbody>
                {cashFlowDays.length ? (
                  cashFlowDays.map((entry) => (
                    <tr key={entry.date} className="border-t border-white/10">
                      <td className="py-3 pr-4 text-white">
                        {formatDateOnly(new Date(`${entry.date}T12:00:00`))}
                      </td>
                      <td className="py-3 pr-4 text-emerald-100">
                        {formatCurrency(entry.inflow)}
                      </td>
                      <td className="py-3 pr-4 text-rose-100">
                        {formatCurrency(entry.outflow)}
                      </td>
                      <td
                        className={`py-3 font-semibold ${
                          entry.balance >= 0 ? "text-emerald-100" : "text-rose-100"
                        }`}
                      >
                        {formatCurrency(entry.balance)}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr className="border-t border-white/10">
                    <td colSpan={4} className="py-6 text-center text-white/60">
                      Ainda não há movimentação diária suficiente para montar o fluxo de caixa.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="rounded-[28px] border border-white/10 bg-white/5 p-6">
          <p className="text-xs uppercase tracking-[0.24em] text-white/45">Lucro por produto</p>
          <h3 className="mt-2 text-2xl font-semibold">Peças mais lucrativas</h3>
          <div className="mt-6 overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="text-white/45">
                <tr>
                  <th className="pb-3 pr-4 font-medium">Produto</th>
                  <th className="pb-3 pr-4 font-medium">Unidades</th>
                  <th className="pb-3 pr-4 font-medium">Receita</th>
                  <th className="pb-3 pr-4 font-medium">Custo</th>
                  <th className="pb-3 pr-4 font-medium">Lucro</th>
                  <th className="pb-3 font-medium">Material</th>
                </tr>
              </thead>
              <tbody>
                {productProfitability.length ? (
                  productProfitability.map((entry) => (
                    <tr key={entry.label} className="border-t border-white/10">
                      <td className="py-3 pr-4 text-white">{entry.label}</td>
                      <td className="py-3 pr-4 text-white/70">{entry.units}</td>
                      <td className="py-3 pr-4 text-emerald-100">{formatCurrency(entry.revenue)}</td>
                      <td className="py-3 pr-4 text-rose-100">{formatCurrency(entry.cost)}</td>
                      <td className="py-3 pr-4 font-semibold text-white">{formatCurrency(entry.profit)}</td>
                      <td className="py-3 text-white/70">{formatWeight(entry.materialConsumed)}</td>
                    </tr>
                  ))
                ) : (
                  <tr className="border-t border-white/10">
                    <td colSpan={6} className="py-6 text-center text-white/60">
                      Ainda não há dados suficientes para calcular lucro por produto.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </AppShell>
  );
}
