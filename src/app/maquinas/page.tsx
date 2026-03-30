import { MachineStatus, UserRole } from "@prisma/client";
import Image from "next/image";
import { AppShell } from "@/components/app-shell";
import { MachineEditor } from "@/components/machine-editor";
import { MachineForm } from "@/components/machine-form";
import { MetricCard } from "@/components/metric-card";
import { StatusPill } from "@/components/status-pill";
import { SubmitButton } from "@/components/submit-button";
import { requireRoles } from "@/lib/auth";
import { machineStatusMeta, showcaseOrderStageMeta } from "@/lib/constants";
import { formatCurrency, formatDateOnly, formatDateTime } from "@/lib/format";
import { updateMachineStatusAction } from "@/lib/actions";
import { getHydratedData } from "@/lib/view-data";

export default async function MachinesPage() {
  const user = await requireRoles([UserRole.OPERATOR, UserRole.SUPERVISOR, UserRole.ADMIN]);
  const { machines, orders, showcaseInquiries, showcaseItems } = await getHydratedData();
  const showcaseItemMap = new Map(showcaseItems.map((item) => [item.id, item]));
  const canManageRegistry = user.role === UserRole.ADMIN || user.role === UserRole.SUPERVISOR;
  const nowIso = new Date().toISOString();
  const now = new Date(nowIso).getTime();
  const dayInMs = 24 * 60 * 60 * 1000;
  const printingShowcaseOrders = showcaseInquiries.filter(
    (inquiry) => inquiry.status === "CLOSED" && inquiry.orderStage === "PRINTING",
  );
  const unassignedPrintingShowcaseOrders = printingShowcaseOrders.filter(
    (inquiry) => !inquiry.assignedMachineId,
  );
  const maintenanceDueMachines = machines.filter((machine) => {
    const referenceDate = machine.lastMaintenanceAt ?? machine.createdAt;
    return now - new Date(referenceDate).getTime() >= machine.preventiveMaintenanceDays * dayInMs;
  });
  const maintenanceSoonMachines = machines.filter((machine) => {
    const referenceDate = machine.lastMaintenanceAt ?? machine.createdAt;
    const nextMaintenanceTime =
      new Date(referenceDate).getTime() + machine.preventiveMaintenanceDays * dayInMs;
    return nextMaintenanceTime > now && nextMaintenanceTime - now <= 7 * dayInMs;
  });
  const busyMachines = machines.filter((machine) => machine.status === MachineStatus.BUSY).length;

  return (
    <AppShell
      user={user}
      pathname="/maquinas"
      title="Máquinas e IoT"
      subtitle="Monitore telemetria, disponibilidade, progresso, temperatura, webcam e manutenção preventiva das impressoras 3D."
    >
      <section className="grid gap-4 xl:grid-cols-4">
        <MetricCard label="Máquinas ocupadas" value={String(busyMachines)} caption="Impressoras rodando agora." accent="blue" />
        <MetricCard label="Manutenção vencida" value={String(maintenanceDueMachines.length)} caption="Já passou do ciclo preventivo." accent="rose" />
        <MetricCard label="Manutenção em breve" value={String(maintenanceSoonMachines.length)} caption="Vence nos próximos 7 dias." accent="orange" />
        <MetricCard label="Sem vínculo na impressão" value={String(unassignedPrintingShowcaseOrders.length)} caption="Pedidos imprimindo sem máquina definida." accent="mint" />
      </section>

      {canManageRegistry ? (
        <MachineForm />
      ) : (
        <section className="rounded-[28px] border border-white/10 bg-white/5 p-6 text-sm text-white/65">
          O cadastro, a edição e a exclusão de impressoras ficam disponíveis para supervisor e administrador. Como operador, você pode acompanhar telemetria, ordens e status da produção.
        </section>
      )}

      {(maintenanceDueMachines.length || maintenanceSoonMachines.length) ? (
        <section className="rounded-[28px] border border-white/10 bg-white/5 p-6">
          <p className="text-xs uppercase tracking-[0.24em] text-white/45">Calendário de manutenção</p>
          <h3 className="mt-2 text-2xl font-semibold">Preventiva por máquina</h3>
          <div className="mt-6 grid gap-4 xl:grid-cols-2">
            {maintenanceDueMachines.map((machine) => {
              const referenceDate = machine.lastMaintenanceAt ?? machine.createdAt;
              const nextDate = new Date(new Date(referenceDate).getTime() + machine.preventiveMaintenanceDays * dayInMs);
              return (
                <div key={`due-${machine.id}`} className="rounded-[22px] border border-rose-400/25 bg-rose-500/10 p-4">
                  <p className="font-semibold text-white">{machine.name}</p>
                  <p className="mt-1 text-sm text-white/70">Manutenção vencida desde {formatDateOnly(nextDate)}</p>
                </div>
              );
            })}
            {maintenanceSoonMachines.map((machine) => {
              const referenceDate = machine.lastMaintenanceAt ?? machine.createdAt;
              const nextDate = new Date(new Date(referenceDate).getTime() + machine.preventiveMaintenanceDays * dayInMs);
              return (
                <div key={`soon-${machine.id}`} className="rounded-[22px] border border-amber-400/25 bg-amber-500/10 p-4">
                  <p className="font-semibold text-white">{machine.name}</p>
                  <p className="mt-1 text-sm text-white/70">Próxima preventiva em {formatDateOnly(nextDate)}</p>
                </div>
              );
            })}
          </div>
        </section>
      ) : null}

      {unassignedPrintingShowcaseOrders.length ? (
        <section className="rounded-[28px] border border-amber-400/25 bg-amber-500/10 p-6">
          <p className="text-xs uppercase tracking-[0.24em] text-amber-100/70">Pedidos sem máquina</p>
          <h3 className="mt-2 text-2xl font-semibold text-white">Existem pedidos da vitrine imprimindo sem impressora vinculada</h3>
          <div className="mt-5 space-y-3">
            {unassignedPrintingShowcaseOrders.map((inquiry) => (
              <div key={inquiry.id} className="rounded-[22px] border border-white/10 bg-black/25 p-4">
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div>
                    <p className="font-semibold">{inquiry.orderNumber ?? inquiry.itemName}</p>
                    <p className="mt-1 text-sm text-white/60">{inquiry.itemName}</p>
                    <p className="mt-1 text-sm text-white/70">
                      {inquiry.customerName} · Quantidade {inquiry.quantity}
                    </p>
                  </div>
                  <StatusPill {...showcaseOrderStageMeta.PRINTING} />
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <section className="grid gap-6 xl:grid-cols-2">
        {machines.length ? machines.map((machine) => {
          const outstandingMachineBalance = Math.max(machine.purchasePrice - machine.amountPaid, 0);
          const activeOrders = orders.filter(
            (order) =>
              order.assignedMachineId === machine.id &&
              order.status !== "COMPLETED" &&
              order.status !== "CANCELED",
          );
          const activeShowcaseOrders = printingShowcaseOrders.filter(
            (inquiry) => inquiry.assignedMachineId === machine.id,
          );
          const internalRevenue = orders
            .filter((order) => order.assignedMachineId === machine.id && order.paymentStatus === "PAID")
            .reduce((sum, order) => sum + order.totalPrice, 0);
          const showcaseRevenue = showcaseInquiries
            .filter((inquiry) => inquiry.assignedMachineId === machine.id && inquiry.status === "CLOSED")
            .reduce(
              (sum, inquiry) =>
                sum + (showcaseItemMap.get(inquiry.itemId)?.price ?? 0) * inquiry.quantity,
              0,
            );
          const machineMaterialCost = orders
            .filter((order) => order.assignedMachineId === machine.id)
            .reduce((sum, order) => sum + (order.materialConsumptionValue ?? 0), 0) +
            showcaseInquiries
              .filter((inquiry) => inquiry.assignedMachineId === machine.id)
              .reduce((sum, inquiry) => sum + (inquiry.materialConsumptionValue ?? 0), 0);
          const nextMaintenanceDate = new Date(
            new Date(machine.lastMaintenanceAt ?? machine.createdAt).getTime() +
              machine.preventiveMaintenanceDays * dayInMs,
          );
          return (
            <article key={machine.id} className="rounded-[28px] border border-white/10 bg-white/5 p-6">
              <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                <div>
                  <p className="text-sm text-white/45">{machine.model}</p>
                  <h3 className="mt-1 text-2xl font-semibold">{machine.name}</h3>
                  <p className="mt-2 text-sm text-white/65">{machine.notes}</p>
                </div>
                <StatusPill {...machineStatusMeta[machine.status]} />
              </div>

              <div className="mt-5 overflow-hidden rounded-[24px] border border-white/10">
                <Image src={machine.webcamUrl ?? "/printer-cam.svg"} alt={`Webcam ${machine.name}`} width={800} height={500} className="h-auto w-full object-cover" />
              </div>

              <div className="mt-5 grid gap-3 md:grid-cols-4">
                <div className="rounded-2xl border border-white/10 bg-slate-950/60 p-3">
                  <p className="text-xs uppercase tracking-[0.18em] text-white/45">Bico</p>
                  <p className="mt-2 text-lg font-semibold">{machine.nozzleTemp ?? 0}°C</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-slate-950/60 p-3">
                  <p className="text-xs uppercase tracking-[0.18em] text-white/45">Mesa</p>
                  <p className="mt-2 text-lg font-semibold">{machine.bedTemp ?? 0}°C</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-slate-950/60 p-3">
                  <p className="text-xs uppercase tracking-[0.18em] text-white/45">Progresso</p>
                  <p className="mt-2 text-lg font-semibold">{machine.progressPercent}%</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-slate-950/60 p-3">
                  <p className="text-xs uppercase tracking-[0.18em] text-white/45">Restante</p>
                  <p className="mt-2 text-lg font-semibold">{machine.timeRemainingMinutes} min</p>
                </div>
              </div>

              <div className="mt-5 grid gap-3 md:grid-cols-3">
                <div className="rounded-2xl border border-white/10 bg-slate-950/60 p-3">
                  <p className="text-xs uppercase tracking-[0.18em] text-white/45">Receita vinculada</p>
                  <p className="mt-2 text-lg font-semibold">{formatCurrency(internalRevenue + showcaseRevenue)}</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-slate-950/60 p-3">
                  <p className="text-xs uppercase tracking-[0.18em] text-white/45">Material consumido</p>
                  <p className="mt-2 text-lg font-semibold">{formatCurrency(machineMaterialCost)}</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-slate-950/60 p-3">
                  <p className="text-xs uppercase tracking-[0.18em] text-white/45">Próxima preventiva</p>
                  <p className="mt-2 text-lg font-semibold">{formatDateOnly(nextMaintenanceDate)}</p>
                </div>
              </div>

              <div className="mt-5 grid gap-3 md:grid-cols-4">
                <div className="rounded-2xl border border-white/10 bg-slate-950/60 p-3">
                  <p className="text-xs uppercase tracking-[0.18em] text-white/45">Valor da máquina</p>
                  <p className="mt-2 text-lg font-semibold">{formatCurrency(machine.purchasePrice)}</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-slate-950/60 p-3">
                  <p className="text-xs uppercase tracking-[0.18em] text-white/45">Valor pago</p>
                  <p className="mt-2 text-lg font-semibold">{formatCurrency(machine.amountPaid)}</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-slate-950/60 p-3">
                  <p className="text-xs uppercase tracking-[0.18em] text-white/45">Falta pagar</p>
                  <p className="mt-2 text-lg font-semibold">{formatCurrency(outstandingMachineBalance)}</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-slate-950/60 p-3">
                  <p className="text-xs uppercase tracking-[0.18em] text-white/45">Compra</p>
                  <p className="mt-2 text-lg font-semibold">
                    {machine.purchasedAt ? formatDateOnly(new Date(machine.purchasedAt)) : "Sem data"}
                  </p>
                </div>
              </div>

              <div className="mt-5 flex flex-wrap gap-3">
                {[MachineStatus.AVAILABLE, MachineStatus.BUSY, MachineStatus.PAUSED, MachineStatus.MAINTENANCE].map((status) => (
                  <form key={status} action={updateMachineStatusAction}>
                    <input type="hidden" name="machineId" value={machine.id} />
                    <input type="hidden" name="status" value={status} />
                    <SubmitButton label={machineStatusMeta[status].label} pendingLabel="Atualizando..." />
                  </form>
                ))}
              </div>

              {canManageRegistry ? (
                <MachineEditor machine={machine} activeOrderCount={activeOrders.length + activeShowcaseOrders.length} />
              ) : null}

              <div className="mt-5 rounded-[22px] border border-white/10 bg-slate-950/60 p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-white/45">Ordens vinculadas</p>
                <div className="mt-4 space-y-3">
                  {activeOrders.length || activeShowcaseOrders.length ? (
                    <>
                      {activeOrders.map((order) => (
                      <div key={order.id} className="rounded-2xl border border-white/10 bg-black/30 p-3">
                        <p className="font-semibold">{order.orderNumber}</p>
                        <p className="mt-1 text-sm text-white/60">{order.title}</p>
                      </div>
                      ))}
                      {activeShowcaseOrders.map((inquiry) => (
                        <div key={inquiry.id} className="rounded-2xl border border-emerald-400/15 bg-black/30 p-3">
                          <p className="font-semibold">{inquiry.orderNumber ?? "Pedido WhatsApp"}</p>
                          <p className="mt-1 text-sm text-white/60">{inquiry.itemName}</p>
                          <p className="mt-2 text-xs uppercase tracking-[0.18em] text-white/45">
                            {inquiry.customerName} · Quantidade {inquiry.quantity}
                          </p>
                        </div>
                      ))}
                    </>
                  ) : (
                    <p className="text-sm text-white/60">Nenhuma ordem vinculada neste momento.</p>
                  )}
                </div>
              </div>

              <div className="mt-5 rounded-[22px] border border-white/10 bg-slate-950/60 p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-white/45">Manutenções</p>
                <div className="mt-4 space-y-3">
                  {machine.maintenanceRecords.map((record) => (
                    <div key={record.id} className="rounded-2xl border border-white/10 bg-black/30 p-3">
                      <div className="flex items-center justify-between gap-3">
                        <p className="font-semibold">{record.type}</p>
                        <span className="text-sm text-white/60">{record.status}</span>
                      </div>
                      <p className="mt-1 text-sm text-white/65">{record.summary}</p>
                      <p className="mt-2 text-xs uppercase tracking-[0.18em] text-white/40">
                        {formatDateOnly(new Date(record.scheduledAt))}
                        {record.completedAt ? ` · concluída em ${formatDateTime(new Date(record.completedAt))}` : ""}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </article>
          );
        }) : (
          <div className="rounded-[28px] border border-dashed border-white/15 bg-slate-950/50 p-6 text-sm text-white/60">
            {canManageRegistry
              ? "Nenhuma impressora cadastrada ainda. Use o formulário acima para registrar a primeira máquina."
              : "Nenhuma impressora cadastrada ainda. Peça a um supervisor ou administrador para registrar a primeira máquina."}
          </div>
        )}
      </section>
    </AppShell>
  );
}
