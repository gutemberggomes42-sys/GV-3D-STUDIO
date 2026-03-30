"use client";

import { useState } from "react";
import type { DbMaterial } from "@/lib/db-types";
import { formatCurrency, formatNumber } from "@/lib/format";

type CalculatorMaterialEntryState = {
  key: string;
  materialId: string;
  pricePerKilo: string;
  gramsUsed: string;
};

type CalculatorMaterialEntryInitial = {
  materialId?: string;
  pricePerKilo?: number;
  gramsUsed?: number;
};

type ShowcasePriceCalculatorProps = {
  onApplyPrice: (price: string) => void;
  materials?: Array<
    Pick<DbMaterial, "id" | "name" | "brand" | "color" | "technology" | "purchasePrice" | "spoolWeightGrams">
  >;
  fieldNames?: {
    materialsJson?: string;
    packagingCost?: string;
    printDurationHours?: string;
    energyRate?: string;
    printerPowerWatts?: string;
    marginPercent?: string;
  };
  initialValues?: {
    materialEntries?: CalculatorMaterialEntryInitial[];
    packagingCost?: number;
    printDurationHours?: number;
    energyRate?: number;
    printerPowerWatts?: number;
    marginPercent?: number;
  };
};

let calculatorMaterialEntryCounter = 0;

function roundCurrency(value: number) {
  return Number(value.toFixed(2));
}

function parseNumber(value: string) {
  const parsedValue = Number(value);
  return Number.isFinite(parsedValue) ? parsedValue : 0;
}

function getMaterialPricePerKilo(
  material: Pick<DbMaterial, "purchasePrice" | "spoolWeightGrams">,
) {
  if (material.spoolWeightGrams <= 0) {
    return 0;
  }

  return (material.purchasePrice / material.spoolWeightGrams) * 1000;
}

function createMaterialEntryState(initial?: CalculatorMaterialEntryInitial): CalculatorMaterialEntryState {
  calculatorMaterialEntryCounter += 1;

  return {
    key: `calculator-material-${calculatorMaterialEntryCounter}`,
    materialId: initial?.materialId ?? "",
    pricePerKilo:
      initial?.pricePerKilo != null && Number.isFinite(initial.pricePerKilo)
        ? String(initial.pricePerKilo)
        : "",
    gramsUsed:
      initial?.gramsUsed != null && Number.isFinite(initial.gramsUsed)
        ? String(initial.gramsUsed)
        : "",
  };
}

function buildInitialEntries(
  materials: Array<
    Pick<DbMaterial, "id" | "name" | "brand" | "color" | "technology" | "purchasePrice" | "spoolWeightGrams">
  >,
  initialEntries?: CalculatorMaterialEntryInitial[],
) {
  if (initialEntries?.length) {
    return initialEntries.map((entry) => {
      const matchedMaterial = materials.find((material) => material.id === entry.materialId);
      return createMaterialEntryState({
        materialId: entry.materialId,
        pricePerKilo:
          entry.pricePerKilo != null
            ? entry.pricePerKilo
            : matchedMaterial
              ? roundCurrency(getMaterialPricePerKilo(matchedMaterial))
              : undefined,
        gramsUsed: entry.gramsUsed,
      });
    });
  }

  const firstMaterial = materials[0];
  return [
    createMaterialEntryState({
      materialId: firstMaterial?.id ?? "",
      pricePerKilo: firstMaterial ? roundCurrency(getMaterialPricePerKilo(firstMaterial)) : undefined,
      gramsUsed: 30,
    }),
  ];
}

function serializeMaterialEntries(entries: CalculatorMaterialEntryState[]) {
  return JSON.stringify(
    entries
      .map((entry) => ({
        materialId: entry.materialId.trim(),
        pricePerKilo: parseNumber(entry.pricePerKilo),
        gramsUsed: parseNumber(entry.gramsUsed),
      }))
      .filter((entry) => entry.materialId || entry.pricePerKilo > 0 || entry.gramsUsed > 0),
  );
}

export function ShowcasePriceCalculator({
  onApplyPrice,
  materials = [],
  fieldNames,
  initialValues,
}: ShowcasePriceCalculatorProps) {
  const filamentMaterials = materials.filter((material) => material.technology === "FDM");
  const [materialEntries, setMaterialEntries] = useState(() =>
    buildInitialEntries(filamentMaterials, initialValues?.materialEntries),
  );
  const [packagingCost, setPackagingCost] = useState(String(initialValues?.packagingCost ?? 0));
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

  const durationHours = parseNumber(printDurationHours);
  const rate = parseNumber(energyRate);
  const powerWatts = parseNumber(printerPowerWatts);
  const margin = parseNumber(marginPercent);
  const packaging = parseNumber(packagingCost);
  const totalGrams = roundCurrency(
    materialEntries.reduce((total, entry) => total + parseNumber(entry.gramsUsed), 0),
  );
  const materialCost = roundCurrency(
    materialEntries.reduce(
      (total, entry) => total + (parseNumber(entry.pricePerKilo) / 1000) * parseNumber(entry.gramsUsed),
      0,
    ),
  );
  const energyCost = roundCurrency(rate * (powerWatts / 1000) * durationHours);
  const totalCost = roundCurrency(materialCost + energyCost + packaging);
  const costPerGram = totalGrams > 0 ? roundCurrency(totalCost / totalGrams) : 0;
  const suggestedPrice = roundCurrency(totalCost * (1 + margin / 100));

  function updateEntry(
    entryKey: string,
    updater: (entry: CalculatorMaterialEntryState) => CalculatorMaterialEntryState,
  ) {
    setMaterialEntries((currentEntries) =>
      currentEntries.map((entry) => (entry.key === entryKey ? updater(entry) : entry)),
    );
  }

  function addMaterialEntry() {
    const nextMaterial = filamentMaterials[0];
    setMaterialEntries((currentEntries) => [
      ...currentEntries,
      createMaterialEntryState({
        materialId: nextMaterial?.id ?? "",
        pricePerKilo: nextMaterial ? roundCurrency(getMaterialPricePerKilo(nextMaterial)) : undefined,
      }),
    ]);
  }

  function removeMaterialEntry(entryKey: string) {
    setMaterialEntries((currentEntries) => {
      if (currentEntries.length <= 1) {
        return currentEntries;
      }

      return currentEntries.filter((entry) => entry.key !== entryKey);
    });
  }

  return (
    <section className="rounded-[28px] border border-sky-400/20 bg-sky-500/5 p-6">
      <div>
        <p className="text-xs uppercase tracking-[0.24em] text-sky-100/55">Calculadora</p>
        <h3 className="mt-2 text-2xl font-semibold">Calculo do valor do produto</h3>
        <p className="mt-2 text-sm leading-6 text-white/65">
          Some mais de um filamento, inclua o custo da embalagem e aplique o valor sugerido direto no produto.
        </p>
      </div>

      {fieldNames?.materialsJson ? (
        <input
          type="hidden"
          name={fieldNames.materialsJson}
          value={serializeMaterialEntries(materialEntries)}
        />
      ) : null}

      <div className="mt-6 grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <div className="space-y-4">
          <div className="rounded-[24px] border border-white/10 bg-slate-950/60 p-4">
            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.18em] text-sky-100/70">Filamentos</p>
                <p className="mt-2 text-sm text-white/60">
                  Use um ou varios filamentos quando a peca mistura cores, materiais ou acabamentos.
                </p>
              </div>
              <button
                type="button"
                onClick={addMaterialEntry}
                className="inline-flex items-center justify-center rounded-2xl border border-sky-300/30 bg-sky-400/10 px-4 py-2 text-sm font-semibold text-sky-100 transition hover:bg-sky-400/20"
              >
                Adicionar outro filamento
              </button>
            </div>

            <div className="mt-4 space-y-3">
              {materialEntries.map((entry, index) => {
                const selectedMaterial = filamentMaterials.find((material) => material.id === entry.materialId);

                return (
                  <div
                    key={entry.key}
                    className="rounded-[22px] border border-white/10 bg-black/30 p-4"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-semibold text-white/85">Filamento {index + 1}</p>
                      {materialEntries.length > 1 ? (
                        <button
                          type="button"
                          onClick={() => removeMaterialEntry(entry.key)}
                          className="text-sm text-rose-200 transition hover:text-rose-100"
                        >
                          Remover
                        </button>
                      ) : null}
                    </div>

                    <div className="mt-4 grid gap-4 xl:grid-cols-[1.5fr_0.8fr_0.7fr]">
                      <label className="block text-sm text-white/70">
                        Filamento cadastrado
                        <select
                          value={entry.materialId}
                          onChange={(event) => {
                            const nextMaterialId = event.target.value;
                            const nextMaterial = filamentMaterials.find(
                              (material) => material.id === nextMaterialId,
                            );

                            updateEntry(entry.key, (currentEntry) => ({
                              ...currentEntry,
                              materialId: nextMaterialId,
                              pricePerKilo: nextMaterial
                                ? roundCurrency(getMaterialPricePerKilo(nextMaterial)).toFixed(2)
                                : currentEntry.pricePerKilo,
                            }));
                          }}
                          className="mt-2 w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 outline-none focus:border-sky-400/60"
                        >
                          <option value="">Informar manualmente</option>
                          {filamentMaterials.map((material) => (
                            <option key={material.id} value={material.id}>
                              {material.name} · {material.brand} · {material.color} ·{" "}
                              {formatCurrency(getMaterialPricePerKilo(material))}/kg
                            </option>
                          ))}
                        </select>
                      </label>

                      <label className="block text-sm text-white/70">
                        Preco por kg
                        <input
                          value={entry.pricePerKilo}
                          onChange={(event) =>
                            updateEntry(entry.key, (currentEntry) => ({
                              ...currentEntry,
                              pricePerKilo: event.target.value,
                            }))
                          }
                          type="number"
                          min="0"
                          step="0.01"
                          className="mt-2 w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 outline-none focus:border-sky-400/60"
                        />
                      </label>

                      <label className="block text-sm text-white/70">
                        Material usado (g)
                        <input
                          value={entry.gramsUsed}
                          onChange={(event) =>
                            updateEntry(entry.key, (currentEntry) => ({
                              ...currentEntry,
                              gramsUsed: event.target.value,
                            }))
                          }
                          type="number"
                          min="0"
                          step="0.01"
                          className="mt-2 w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 outline-none focus:border-sky-400/60"
                        />
                      </label>
                    </div>

                    {selectedMaterial ? (
                      <p className="mt-3 text-xs text-white/45">
                        Valor puxado de {selectedMaterial.name} {selectedMaterial.brand} na cor {selectedMaterial.color}.
                      </p>
                    ) : (
                      <p className="mt-3 text-xs text-white/45">
                        Sem filamento vinculado, o valor por kg pode ser preenchido manualmente.
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="rounded-[24px] border border-white/10 bg-slate-950/60 p-4">
            <p className="text-xs uppercase tracking-[0.18em] text-sky-100/70">Fatiador</p>
            <label className="mt-4 block text-sm text-white/70">
              Duracao da impressao (h)
              <input
                name={fieldNames?.printDurationHours}
                value={printDurationHours}
                onChange={(event) => setPrintDurationHours(event.target.value)}
                type="number"
                min="0"
                step="0.01"
                className="mt-2 w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 outline-none focus:border-sky-400/60"
              />
            </label>
            <p className="mt-3 text-xs text-white/45">
              Total de material somado: {formatNumber(totalGrams, 2)} g
            </p>
          </div>

          <div className="rounded-[24px] border border-white/10 bg-slate-950/60 p-4">
            <p className="text-xs uppercase tracking-[0.18em] text-sky-100/70">Energia</p>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <label className="block text-sm text-white/70">
                Taxa de energia da distribuidora
                <input
                  name={fieldNames?.energyRate}
                  value={energyRate}
                  onChange={(event) => setEnergyRate(event.target.value)}
                  type="number"
                  min="0"
                  step="0.01"
                  className="mt-2 w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 outline-none focus:border-sky-400/60"
                />
              </label>
              <label className="block text-sm text-white/70">
                Consumo medio da impressora (W)
                <input
                  name={fieldNames?.printerPowerWatts}
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
            <p className="text-xs uppercase tracking-[0.18em] text-sky-100/70">Embalagem</p>
            <label className="mt-4 block text-sm text-white/70">
              Custo da embalagem (R$)
              <input
                name={fieldNames?.packagingCost}
                value={packagingCost}
                onChange={(event) => setPackagingCost(event.target.value)}
                type="number"
                min="0"
                step="0.01"
                className="mt-2 w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 outline-none focus:border-sky-400/60"
              />
            </label>
          </div>

          <div className="rounded-[24px] border border-white/10 bg-slate-950/60 p-4">
            <p className="text-xs uppercase tracking-[0.18em] text-sky-100/70">Lucro</p>
            <label className="mt-4 block text-sm text-white/70">
              Margem de lucro (%)
              <input
                name={fieldNames?.marginPercent}
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
            <p>
              Filamentos e materiais:{" "}
              <span className="font-semibold text-white">{formatCurrency(materialCost)}</span>
            </p>
            <p>
              Energia eletrica:{" "}
              <span className="font-semibold text-white">{formatCurrency(energyCost)}</span>
            </p>
            <p>
              Embalagem: <span className="font-semibold text-white">{formatCurrency(packaging)}</span>
            </p>
            <p>
              Material total usado:{" "}
              <span className="font-semibold text-white">{formatNumber(totalGrams, 2)} g</span>
            </p>
            <p className="pt-2">
              Cada grama da sua peca custara:{" "}
              <span className="font-semibold text-white">{formatCurrency(costPerGram)}</span>
            </p>
            <p>
              Custo total: <span className="font-semibold text-white">{formatCurrency(totalCost)}</span>
            </p>
            <p className="pt-2 text-base leading-7 text-white/90">
              Considerando material, energia, embalagem e margem, voce devera cobrar:{" "}
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
