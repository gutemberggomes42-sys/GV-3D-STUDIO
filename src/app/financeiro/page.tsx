import { PaymentStatus, UserRole } from "@prisma/client";
import { deleteExpenseAction } from "@/lib/actions";
import { AppShell } from "@/components/app-shell";
import { ExpenseForm } from "@/components/expense-form";
import { MetricCard } from "@/components/metric-card";
import { requireRoles } from "@/lib/auth";
import {
  expenseCategoryLabels,
  paymentMethodLabels,
  paymentStatusLabels,
  showcaseOrderStageMeta,
} from "@/lib/constants";
import type { ShowcaseOrderStage } from "@/lib/db-types";
import { formatCurrency, formatDateOnly, formatMonthYear } from "@/lib/format";
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

export default async function FinancePage() {
  const user = await requireRoles([UserRole.SUPERVISOR, UserRole.ADMIN]);
  const { orders, showcaseItems, showcaseInquiries, materials, machines, expenses } =
    await getHydratedData();
  const showcaseItemMap = new Map(showcaseItems.map((item) => [item.id, item]));
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
        totalValue: Number((((item?.price ?? 0) * inquiry.quantity) || 0).toFixed(2)),
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
        orderLabel: `WhatsApp · ${inquiry.itemName}`,
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
      orderLabel: `WhatsApp · ${inquiry.itemName}`,
      customerLabel: inquiry.customerName,
      methodLabel: "WhatsApp",
      statusLabel: showcaseOrderStageMeta[inquiry.stage].label,
      value: inquiry.totalValue,
      date: inquiry.financialDate,
    })),
  ].sort((left, right) => right.date.localeCompare(left.date));

  const monthlyMap = new Map<
    string,
    { monthKey: string; revenue: number; expenses: number; result: number }
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
  });

  const monthlyPerformance = [...monthlyMap.values()].sort((left, right) =>
    right.monthKey.localeCompare(left.monthKey),
  );
  const monthsWithLoss = monthlyPerformance.filter((month) => month.result < 0).length;

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
      </section>

      <section className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
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
    </AppShell>
  );
}
