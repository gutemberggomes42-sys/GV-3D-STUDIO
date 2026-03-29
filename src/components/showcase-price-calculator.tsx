"use client";

import { useMemo, useState } from "react";
import type { DbMaterial } from "@/lib/db-types";
import { formatCurrency } from "@/lib/format";

type ShowcasePriceCalculatorProps = {
  onApplyPrice: (price: string) => void;
  materials?: Array<
    Pick<DbMaterial, "id" | "name" | "brand" | "color" | "technology" | "purchasePrice" | "spoolWeightGrams">
  >;
  initialValues?: {
    filamentPricePerKilo?: number;
    materialUsedGrams?: number;
    printDurationHours?: number;
    energyRate?: number;
    printerPowerWatts?: number;
    marginPercent?: number;
  };
};

function round(value: number) {
  return Number(value.toFixed(2));
}

function getMaterialPricePerKilo(
  material: Pick<DbMaterial, "purchasePrice" | "spoolWeightGrams">,
) {
  if (material.spoolWeightGrams <= 0) {
    return 0;
  }

  return (material.purchasePrice / material.spoolWeightGrams) * 1000;
}

export function ShowcasePriceCalculator({
  onApplyPrice,
  materials = [],
  initialValues,
}: ShowcasePriceCalculatorProps) {
  const filamentMaterials = useMemo(
    () => materials.filter((material) => material.technology === "FDM"),
    [materials],
  );
  const [selectedMaterialId, setSelectedMaterialId] = useState(filamentMaterials[0]?.id ?? "");
  const [filamentPricePerKilo, setFilamentPricePerKilo] = useState(
    () => {
      if (initialValues?.filamentPricePerKilo != null) {
        return String(initialValues.filamentPricePerKilo);
      }

      const firstMaterial = filamentMaterials[0];
      if (firstMaterial) {
        return getMaterialPricePerKilo(firstMaterial).toFixed(2);
      }

      return "100";
    },
  );
  const [materialUsedGrams, setMaterialUsedGrams] = useState(
    String(initialValues?.materialUsedGrams ?? 30),
  );
  const [printDurationHours, setPrintDurationHours] = useState(
    String(initialValues?.printDurationHours ?? 1),
  );
  const [energyRate, setEnergyRate] = useState(String(initialValues?.energyRate ?? 0.9));
  const [printerPowerWatts, setPrinterPowerWatts] = useState(
    String(initialValues?.printerPowerWatts ?? 95),
  );
  const [marginPercent, setMarginPercent] = useState(
    String(initialValues?.marginPercent ?? 10),
  );

  const filamentPrice = Number(filamentPricePerKilo) || 0;
  const gramsUsed = Number(materialUsedGrams) || 0;
  const durationHours = Number(printDurationHours) || 0;
  const rate = Number(energyRate) || 0;
  const powerWatts = Number(printerPowerWatts) || 0;
  const margin = Number(marginPercent) || 0;

  const filamentCost = round((filamentPrice / 1000) * gramsUsed);
  const energyCost = round(rate * (powerWatts / 1000) * durationHours);
  const totalCost = round(filamentCost + energyCost);
  const costPerGram = gramsUsed > 0 ? round(totalCost / gramsUsed) : 0;
  const suggestedPrice = round(totalCost * (1 + margin / 100));

  return (
    <section className="rounded-[28px] border border-sky-400/20 bg-sky-500/5 p-6">
      <div>
        <p className="text-xs uppercase tracking-[0.24em] text-sky-100/55">Calculadora</p>
        <h3 className="mt-2 text-2xl font-semibold">Cálculo do valor do produto</h3>
        <p className="mt-2 text-sm leading-6 text-white/65">
          Preencha os custos da peça para calcular o valor sugerido de venda e aplicar direto no produto.
        </p>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <div className="space-y-4">
          <div className="rounded-[24px] border border-white/10 bg-slate-950/60 p-4">
            <p className="text-xs uppercase tracking-[0.18em] text-sky-100/70">Filamento</p>
            {filamentMaterials.length ? (
              <label className="mt-4 block text-sm text-white/70">
                Puxar dos filamentos cadastrados
                <select
                  value={selectedMaterialId}
                  onChange={(event) => {
                    const nextMaterialId = event.target.value;
                    const selectedMaterial = filamentMaterials.find(
                      (material) => material.id === nextMaterialId,
                    );

                    setSelectedMaterialId(nextMaterialId);
                    if (selectedMaterial) {
                      setFilamentPricePerKilo(
                        getMaterialPricePerKilo(selectedMaterial).toFixed(2),
                      );
                    }
                  }}
                  className="mt-2 w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 outline-none focus:border-sky-400/60"
                >
                  {filamentMaterials.map((material) => {
                    const materialPricePerKilo = getMaterialPricePerKilo(material);

                    return (
                      <option key={material.id} value={material.id}>
                        {material.name} · {material.brand} · {material.color} · {formatCurrency(materialPricePerKilo)}/kg
                      </option>
                    );
                  })}
                </select>
              </label>
            ) : (
              <p className="mt-4 text-sm text-white/55">
                Nenhum filamento FDM cadastrado. Você ainda pode informar o valor manualmente.
              </p>
            )}
            <label className="mt-4 block text-sm text-white/70">
              Preço do quilo do filamento
              <input
                value={filamentPricePerKilo}
                onChange={(event) => setFilamentPricePerKilo(event.target.value)}
                type="number"
                min="0"
                step="0.01"
                className="mt-2 w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 outline-none focus:border-sky-400/60"
              />
            </label>
          </div>

          <div className="rounded-[24px] border border-white/10 bg-slate-950/60 p-4">
            <p className="text-xs uppercase tracking-[0.18em] text-sky-100/70">Fatiador</p>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <label className="block text-sm text-white/70">
                Material usado na impressão (g)
                <input
                  value={materialUsedGrams}
                  onChange={(event) => setMaterialUsedGrams(event.target.value)}
                  type="number"
                  min="0"
                  step="0.01"
                  className="mt-2 w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 outline-none focus:border-sky-400/60"
                />
              </label>
              <label className="block text-sm text-white/70">
                Duração da impressão (h)
                <input
                  value={printDurationHours}
                  onChange={(event) => setPrintDurationHours(event.target.value)}
                  type="number"
                  min="0"
                  step="0.01"
                  className="mt-2 w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 outline-none focus:border-sky-400/60"
                />
              </label>
            </div>
          </div>

          <div className="rounded-[24px] border border-white/10 bg-slate-950/60 p-4">
            <p className="text-xs uppercase tracking-[0.18em] text-sky-100/70">Energia</p>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <label className="block text-sm text-white/70">
                Taxa de energia da distribuidora
                <input
                  value={energyRate}
                  onChange={(event) => setEnergyRate(event.target.value)}
                  type="number"
                  min="0"
                  step="0.01"
                  className="mt-2 w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 outline-none focus:border-sky-400/60"
                />
              </label>
              <label className="block text-sm text-white/70">
                Consumo médio da impressora (W)
                <input
                  value={printerPowerWatts}
                  onChange={(event) => setPrinterPowerWatts(event.target.value)}
                  type="number"
                  min="0"
                  step="0.01"
                  className="mt-2 w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 outline-none focus:border-sky-400/60"
                />
              </label>
            </div>
          </div>

          <div className="rounded-[24px] border border-white/10 bg-slate-950/60 p-4">
            <p className="text-xs uppercase tracking-[0.18em] text-sky-100/70">Lucro</p>
            <label className="mt-4 block text-sm text-white/70">
              Margem de lucro (%)
              <input
                value={marginPercent}
                onChange={(event) => setMarginPercent(event.target.value)}
                type="number"
                min="0"
                step="0.01"
                className="mt-2 w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 outline-none focus:border-sky-400/60"
              />
            </label>
          </div>
        </div>

        <div className="rounded-[24px] border border-white/10 bg-slate-950/60 p-5">
          <p className="text-xs uppercase tracking-[0.18em] text-sky-100/70">Resultados</p>
          <div className="mt-5 space-y-3 text-sm text-white/75">
            <p>Consumo de filamento: <span className="font-semibold text-white">{formatCurrency(filamentCost)}</span></p>
            <p>Consumo de energia elétrica: <span className="font-semibold text-white">{formatCurrency(energyCost)}</span></p>
            <p className="pt-2">Cada grama da sua peça custará: <span className="font-semibold text-white">{formatCurrency(costPerGram)}</span></p>
            <p>Custo total: <span className="font-semibold text-white">{formatCurrency(totalCost)}</span></p>
            <p className="pt-2 text-base leading-7 text-white/90">
              Considerando suas despesas e margem de lucro você deverá cobrar:{" "}
              <span className="font-semibold text-emerald-300">{formatCurrency(suggestedPrice)}</span>
            </p>
          </div>

          <button
            type="button"
            onClick={() => onApplyPrice(suggestedPrice.toFixed(2))}
            className="mt-6 inline-flex w-full items-center justify-center rounded-2xl bg-sky-400 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-sky-300"
          >
            Usar valor calculado
          </button>
        </div>
      </div>
    </section>
  );
}
