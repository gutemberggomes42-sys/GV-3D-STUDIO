import { UserRole } from "@prisma/client";
import { AppShell } from "@/components/app-shell";
import { MaterialEditor } from "@/components/material-editor";
import { MaterialForm } from "@/components/material-form";
import { MetricCard } from "@/components/metric-card";
import { requireRoles } from "@/lib/auth";
import { formatCurrency, formatMeters } from "@/lib/format";
import { getMaterialDerivedMetrics } from "@/lib/pricing";
import { getHydratedData } from "@/lib/view-data";

export default async function FilamentsPage() {
  const user = await requireRoles([UserRole.OPERATOR, UserRole.SUPERVISOR, UserRole.ADMIN]);
  const { materials, orders } = await getHydratedData();
  const canManageRegistry = user.role === UserRole.ADMIN || user.role === UserRole.SUPERVISOR;
  const lowStockCount = materials.filter(
    (material) => material.stockAmount <= material.minimumStock,
  ).length;
  const totalInvestment = materials.reduce(
    (sum, material) => sum + material.purchasePrice,
    0,
  );
  const totalStock = materials.reduce((sum, material) => sum + material.stockAmount, 0);
  const totalMetersRemaining = materials.reduce((sum, material) => {
    const derived = getMaterialDerivedMetrics(material);
    return sum + (derived.stockMetersRemaining || 0);
  }, 0);

  return (
    <AppShell
      user={user}
      pathname="/filamentos"
      title="Controle de filamento"
      subtitle="Acompanhe estoque, custo real por grama e por metro, reposição e consumo dos filamentos e resinas em uma área própria."
    >
      <section className="grid gap-4 xl:grid-cols-4">
        <MetricCard label="Materiais" value={String(materials.length)} caption="Filamentos e resinas cadastrados." accent="orange" />
        <MetricCard label="Estoque baixo" value={String(lowStockCount)} caption="Abaixo do mínimo configurado." accent="rose" />
        <MetricCard label="Compra registrada" value={formatCurrency(totalInvestment)} caption="Soma dos valores pagos nos rolos e frascos." accent="mint" />
        <MetricCard label="Metragem restante" value={formatMeters(totalMetersRemaining)} caption="Estimativa total restante nos materiais FDM." accent="blue" />
      </section>

      {canManageRegistry ? (
        <MaterialForm redirectTo="/filamentos" />
      ) : (
        <section className="rounded-[28px] border border-white/10 bg-white/5 p-6 text-sm text-white/65">
          Como operador, você pode acompanhar o estoque e os custos do filamento. O cadastro, a edição e a exclusão ficam liberados para supervisor e administrador.
        </section>
      )}

      <section className="rounded-[28px] border border-white/10 bg-white/5 p-6">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.24em] text-white/45">Estoque de filamento</p>
            <h3 className="mt-2 text-2xl font-semibold">Materiais cadastrados</h3>
            <p className="mt-2 text-sm leading-6 text-white/65">
              Cada material mostra estoque atual, custo real e quantos pedidos internos ja usam esse item.
            </p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3 text-sm text-white/70">
            Estoque total atual: {totalStock.toFixed(0)}
          </div>
        </div>

        <div className="mt-6 space-y-4">
          {materials.length ? (
            canManageRegistry ? (
              materials.map((material) => (
                <MaterialEditor
                  key={material.id}
                  material={material}
                  linkedOrderCount={orders.filter((order) => order.materialId === material.id).length}
                  redirectTo="/filamentos"
                />
              ))
            ) : (
              materials.map((material) => {
                const derived = getMaterialDerivedMetrics(material);
                return (
                  <article key={material.id} className="rounded-[22px] border border-white/10 bg-slate-950/60 p-4">
                    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                      <div>
                        <p className="text-lg font-semibold">{material.name}</p>
                        <p className="mt-1 text-sm text-white/60">
                          {material.brand} · {material.color} · Lote {material.lot}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-semibold">
                          {material.stockAmount.toFixed(0)} {material.unit}
                        </p>
                        <p className="text-sm text-white/60">
                          Minimo: {material.minimumStock.toFixed(0)} {material.unit}
                        </p>
                      </div>
                    </div>

                    <div className="mt-4 grid gap-3 md:grid-cols-4">
                      <div className="rounded-2xl border border-white/10 bg-black/30 p-3">
                        <p className="text-xs uppercase tracking-[0.18em] text-white/45">Valor pago</p>
                        <p className="mt-2 text-lg font-semibold">{formatCurrency(material.purchasePrice)}</p>
                      </div>
                      <div className="rounded-2xl border border-white/10 bg-black/30 p-3">
                        <p className="text-xs uppercase tracking-[0.18em] text-white/45">Custo por grama</p>
                        <p className="mt-2 text-lg font-semibold">{formatCurrency(derived.costPerGram)}</p>
                      </div>
                      <div className="rounded-2xl border border-white/10 bg-black/30 p-3">
                        <p className="text-xs uppercase tracking-[0.18em] text-white/45">Custo por metro</p>
                        <p className="mt-2 text-lg font-semibold">{formatCurrency(derived.costPerMeter)}</p>
                      </div>
                      <div className="rounded-2xl border border-white/10 bg-black/30 p-3">
                        <p className="text-xs uppercase tracking-[0.18em] text-white/45">Metragem restante</p>
                        <p className="mt-2 text-lg font-semibold">{formatMeters(derived.stockMetersRemaining)}</p>
                      </div>
                    </div>
                  </article>
                );
              })
            )
          ) : (
            <div className="rounded-[22px] border border-dashed border-white/15 bg-slate-950/40 p-5 text-sm text-white/60">
              Nenhum filamento cadastrado ainda.
            </div>
          )}
        </div>
      </section>
    </AppShell>
  );
}
