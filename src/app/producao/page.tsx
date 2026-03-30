import { OrderStatus, UserRole } from "@prisma/client";
import { AppShell } from "@/components/app-shell";
import { PrintingTimer } from "@/components/printing-timer";
import { StatusPill } from "@/components/status-pill";
import { SubmitButton } from "@/components/submit-button";
import {
  advanceOrderStatusAction,
  approveQualityAction,
  assignMachineAction,
  assignShowcaseInquiryMachineAction,
  updateShowcaseInquiryOrderStageAction,
} from "@/lib/actions";
import { requireRoles } from "@/lib/auth";
import {
  machineStatusMeta,
  orderStatusMeta,
  showcaseOrderStageMeta,
  showcaseOrderStageOptions,
} from "@/lib/constants";
import type { ShowcaseOrderStage } from "@/lib/db-types";
import { formatDateOnly, formatHours, formatWeight } from "@/lib/format";
import { getHydratedData } from "@/lib/view-data";

export default async function ProductionPage() {
  const user = await requireRoles([UserRole.OPERATOR, UserRole.SUPERVISOR, UserRole.ADMIN]);
  const { orders, machines, showcaseItems, showcaseInquiries } = await getHydratedData();
  const activeProductionStatuses = new Set<OrderStatus>([
    OrderStatus.QUEUED,
    OrderStatus.PRINTING,
    OrderStatus.POST_PROCESSING,
    OrderStatus.FAILED_REWORK,
    OrderStatus.QUALITY,
  ]);
  const queueStatuses = new Set<OrderStatus>([OrderStatus.QUEUED, OrderStatus.PRINTING]);
  const finishingStatuses = new Set<OrderStatus>([
    OrderStatus.POST_PROCESSING,
    OrderStatus.QUALITY,
    OrderStatus.FAILED_REWORK,
  ]);
  const relevantOrders = orders.filter((order) => activeProductionStatuses.has(order.status));
  const showcaseItemMap = new Map(showcaseItems.map((item) => [item.id, item]));
  const showcaseActiveProductionStages = new Set<ShowcaseOrderStage>([
    "QUEUED",
    "PRINTING",
    "POST_PROCESSING",
    "FAILED_REWORK",
    "QUALITY",
  ]);
  const showcaseQueueStages = new Set<ShowcaseOrderStage>(["QUEUED", "PRINTING"]);
  const showcaseFinishingStages = new Set<ShowcaseOrderStage>([
    "POST_PROCESSING",
    "QUALITY",
    "FAILED_REWORK",
  ]);
  const relevantShowcaseOrders = showcaseInquiries
    .filter(
      (inquiry) =>
        inquiry.status === "CLOSED" &&
        showcaseActiveProductionStages.has(inquiry.orderStage ?? "RECEIVED"),
    )
    .map((inquiry) => ({
      ...inquiry,
      item: showcaseItemMap.get(inquiry.itemId),
      stage: inquiry.orderStage ?? "RECEIVED",
    }));

  return (
    <AppShell
      user={user}
      pathname="/producao"
      title="Módulo de produção"
      subtitle="Gerencie a fila inteligente, distribua trabalhos para as impressoras, acompanhe falhas e avance cada etapa até a expedição, incluindo os pedidos fechados da vitrine."
    >
      <section className="grid gap-6 xl:grid-cols-[1fr_1fr]">
        <div className="rounded-[28px] border border-white/10 bg-white/5 p-6">
          <p className="text-xs uppercase tracking-[0.24em] text-white/45">Fila inteligente</p>
          <h3 className="mt-2 text-2xl font-semibold">Pedidos aguardando máquina ou impressão</h3>
          <div className="mt-6 space-y-4">
            {relevantOrders
              .filter((order) => queueStatuses.has(order.status))
              .map((order) => (
                <article key={order.id} className="rounded-[24px] border border-white/10 bg-slate-950/60 p-4">
                  <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div>
                      <p className="text-sm text-white/45">{order.orderNumber}</p>
                      <h4 className="text-xl font-semibold">{order.title}</h4>
                      <p className="mt-1 text-sm text-white/60">
                        {order.customer?.company ?? order.customer?.name} · {formatWeight(order.estimatedWeightGrams)} · {formatHours(order.estimatedHours)}
                      </p>
                    </div>
                    <StatusPill {...orderStatusMeta[order.status]} />
                  </div>

                  <form action={assignMachineAction} className="mt-4 grid gap-3 md:grid-cols-[1fr_auto]">
                    <input type="hidden" name="orderId" value={order.id} />
                    <input type="hidden" name="nextStatus" value={OrderStatus.PRINTING} />
                    <select name="machineId" defaultValue={order.assignedMachineId} className="rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm outline-none">
                      {machines
                        .filter((machine) => machine.technology === order.technology)
                        .map((machine) => (
                          <option key={machine.id} value={machine.id}>
                            {machine.name} · {machineStatusMeta[machine.status].label}
                          </option>
                        ))}
                    </select>
                    <SubmitButton label={order.status === OrderStatus.PRINTING ? "Reatribuir" : "Iniciar impressão"} pendingLabel="Atualizando..." className="bg-orange-500 text-slate-950 hover:bg-orange-400" />
                  </form>

                  {order.status === OrderStatus.PRINTING ? (
                    <PrintingTimer
                      startedAt={order.printingStartedAt}
                      completedAt={order.printingCompletedAt}
                      plannedMinutes={order.plannedPrintMinutes}
                    />
                  ) : null}
                </article>
              ))}

            {relevantShowcaseOrders
              .filter((inquiry) => showcaseQueueStages.has(inquiry.stage))
              .map((inquiry) => (
                <article key={inquiry.id} className="rounded-[24px] border border-emerald-400/15 bg-slate-950/60 p-4">
                  <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div>
                      <p className="text-sm text-white/45">{inquiry.orderNumber ?? "Pedido WhatsApp"}</p>
                      <h4 className="text-xl font-semibold">{inquiry.itemName}</h4>
                      <p className="mt-1 text-sm text-white/60">
                        {inquiry.customerName} · Quantidade {inquiry.quantity}
                      </p>
                      {inquiry.dueDate ? (
                        <p className="mt-1 text-sm text-white/55">
                          Prazo {formatDateOnly(new Date(inquiry.dueDate))}
                        </p>
                      ) : null}
                    </div>
                    <StatusPill {...showcaseOrderStageMeta[inquiry.stage]} />
                  </div>

                  <form action={assignShowcaseInquiryMachineAction} className="mt-4 grid gap-3 md:grid-cols-[1fr_auto]">
                    <input type="hidden" name="inquiryId" value={inquiry.id} />
                    <input type="hidden" name="orderStage" value="PRINTING" />
                    <select
                      name="machineId"
                      defaultValue={inquiry.assignedMachineId}
                      className="rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm outline-none"
                    >
                      {machines.map((machine) => (
                        <option key={machine.id} value={machine.id}>
                          {machine.name} · {machineStatusMeta[machine.status].label}
                        </option>
                      ))}
                    </select>
                    <SubmitButton
                      label={inquiry.stage === "PRINTING" ? "Reatribuir" : "Iniciar impressão"}
                      pendingLabel="Atualizando..."
                      className="bg-orange-500 text-slate-950 hover:bg-orange-400"
                    />
                  </form>

                  {inquiry.stage === "PRINTING" ? (
                    <PrintingTimer
                      startedAt={inquiry.printingStartedAt}
                      completedAt={inquiry.printingCompletedAt}
                      plannedMinutes={inquiry.plannedPrintMinutes}
                    />
                  ) : null}

                  <form action={updateShowcaseInquiryOrderStageAction} className="mt-3 grid gap-3 md:grid-cols-[1fr_auto]">
                    <input type="hidden" name="inquiryId" value={inquiry.id} />
                    <select
                      name="orderStage"
                      defaultValue={inquiry.stage}
                      className="rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm outline-none"
                    >
                      {showcaseOrderStageOptions.map((stage) => (
                        <option key={stage} value={stage}>
                          {showcaseOrderStageMeta[stage].label}
                        </option>
                      ))}
                    </select>
                    <SubmitButton
                      label="Atualizar etapa"
                      pendingLabel="Atualizando..."
                      className="bg-orange-500 text-slate-950 hover:bg-orange-400"
                    />
                  </form>
                </article>
              ))}

            {relevantOrders.filter((order) => queueStatuses.has(order.status)).length === 0 &&
            relevantShowcaseOrders.filter((inquiry) => showcaseQueueStages.has(inquiry.stage)).length === 0 ? (
              <div className="rounded-[22px] border border-dashed border-white/15 bg-slate-950/40 p-4 text-sm text-white/60">
                Ainda não há pedidos em fila ou impressão.
              </div>
            ) : null}
          </div>
        </div>

        <div className="rounded-[28px] border border-white/10 bg-white/5 p-6">
          <p className="text-xs uppercase tracking-[0.24em] text-white/45">Pós-processamento e qualidade</p>
          <h3 className="mt-2 text-2xl font-semibold">Pedidos próximos da expedição</h3>
          <div className="mt-6 space-y-4">
            {relevantOrders
              .filter((order) => finishingStatuses.has(order.status))
              .map((order) => (
                <article key={order.id} className="rounded-[24px] border border-white/10 bg-slate-950/60 p-4">
                  <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div>
                      <p className="text-sm text-white/45">{order.orderNumber}</p>
                      <h4 className="text-xl font-semibold">{order.title}</h4>
                      <p className="mt-1 text-sm text-white/60">
                        Prazo {formatDateOnly(order.dueDate ? new Date(order.dueDate) : null)} · Risco {order.failureRisk}%
                      </p>
                    </div>
                    <StatusPill {...orderStatusMeta[order.status]} />
                  </div>

                  <div className="mt-4 flex flex-wrap gap-3">
                    {order.status === OrderStatus.POST_PROCESSING ? (
                      <form action={approveQualityAction}>
                        <input type="hidden" name="orderId" value={order.id} />
                        <SubmitButton label="Aprovar qualidade" pendingLabel="Checklist..." className="bg-emerald-400 text-slate-950 hover:bg-emerald-300" />
                      </form>
                    ) : null}

                    {order.status !== OrderStatus.READY_TO_SHIP ? (
                      <form action={advanceOrderStatusAction}>
                        <input type="hidden" name="orderId" value={order.id} />
                        <input type="hidden" name="nextStatus" value={OrderStatus.SHIPPED} />
                        <SubmitButton label="Liberar expedição" pendingLabel="Movendo..." />
                      </form>
                    ) : null}

                    {order.status === OrderStatus.FAILED_REWORK ? (
                      <form action={advanceOrderStatusAction}>
                        <input type="hidden" name="orderId" value={order.id} />
                        <input type="hidden" name="nextStatus" value={OrderStatus.QUEUED} />
                        <SubmitButton label="Retornar para fila" pendingLabel="Retornando..." className="bg-sky-400 text-slate-950 hover:bg-sky-300" />
                      </form>
                    ) : null}
                  </div>
                </article>
              ))}

            {relevantShowcaseOrders
              .filter((inquiry) => showcaseFinishingStages.has(inquiry.stage))
              .map((inquiry) => (
                <article key={inquiry.id} className="rounded-[24px] border border-emerald-400/15 bg-slate-950/60 p-4">
                  <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div>
                      <p className="text-sm text-white/45">{inquiry.orderNumber ?? "Pedido WhatsApp"}</p>
                      <h4 className="text-xl font-semibold">{inquiry.itemName}</h4>
                      <p className="mt-1 text-sm text-white/60">
                        {inquiry.customerName} · Quantidade {inquiry.quantity}
                      </p>
                      {inquiry.dueDate ? (
                        <p className="mt-1 text-sm text-white/55">
                          Prazo {formatDateOnly(new Date(inquiry.dueDate))}
                        </p>
                      ) : null}
                    </div>
                    <StatusPill {...showcaseOrderStageMeta[inquiry.stage]} />
                  </div>

                  <div className="mt-4 flex flex-wrap gap-3">
                    <form action={updateShowcaseInquiryOrderStageAction}>
                      <input type="hidden" name="inquiryId" value={inquiry.id} />
                      <input type="hidden" name="orderStage" value="READY_TO_SHIP" />
                      <SubmitButton
                        label="Liberar expedição"
                        pendingLabel="Movendo..."
                        className="bg-emerald-400 text-slate-950 hover:bg-emerald-300"
                      />
                    </form>

                    {inquiry.stage === "FAILED_REWORK" ? (
                      <form action={updateShowcaseInquiryOrderStageAction}>
                        <input type="hidden" name="inquiryId" value={inquiry.id} />
                        <input type="hidden" name="orderStage" value="QUEUED" />
                        <SubmitButton
                          label="Retornar para fila"
                          pendingLabel="Retornando..."
                          className="bg-sky-400 text-slate-950 hover:bg-sky-300"
                        />
                      </form>
                    ) : null}
                  </div>

                  <form action={updateShowcaseInquiryOrderStageAction} className="mt-4 grid gap-3 md:grid-cols-[1fr_auto]">
                    <input type="hidden" name="inquiryId" value={inquiry.id} />
                    <select
                      name="orderStage"
                      defaultValue={inquiry.stage}
                      className="rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm outline-none"
                    >
                      {showcaseOrderStageOptions.map((stage) => (
                        <option key={stage} value={stage}>
                          {showcaseOrderStageMeta[stage].label}
                        </option>
                      ))}
                    </select>
                    <SubmitButton label="Atualizar etapa" pendingLabel="Atualizando..." />
                  </form>
                </article>
              ))}

            {relevantOrders.filter((order) => finishingStatuses.has(order.status)).length === 0 &&
            relevantShowcaseOrders.filter((inquiry) => showcaseFinishingStages.has(inquiry.stage)).length === 0 ? (
              <div className="rounded-[22px] border border-dashed border-white/15 bg-slate-950/40 p-4 text-sm text-white/60">
                Ainda não há pedidos em acabamento ou qualidade.
              </div>
            ) : null}
          </div>
        </div>
      </section>
    </AppShell>
  );
}
