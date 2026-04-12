/* eslint-disable @next/next/no-img-element */
"use client";

import { useActionState, useMemo, useState } from "react";
import { ShowcasePriceCalculator } from "@/components/showcase-price-calculator";
import { SubmitButton } from "@/components/submit-button";
import { ThreeFileViewer } from "@/components/three-file-viewer";
import {
  deleteShowcaseItemAction,
  type ActionState,
  updateShowcaseItemAction,
} from "@/lib/actions";
import type { DbMaterial, DbShowcaseItem, DbShowcaseLibrary } from "@/lib/db-types";
import {
  getShowcaseDeliverySummary,
  getShowcaseGallery,
  getShowcasePrimaryImage,
  getShowcasePrimaryVideo,
  getShowcaseVariantGallery,
  serializeShowcaseVariants,
  showcaseCategorySuggestions,
} from "@/lib/showcase";

const initialState: ActionState = { ok: false };

type ShowcaseItemEditorProps = {
  item: DbShowcaseItem;
  interestCount: number;
  materials: DbMaterial[];
  libraries: DbShowcaseLibrary[];
};

type CalculatorMaterialEntryInitial = {
  materialId?: string;
  pricePerKilo?: number;
  gramsUsed?: number;
};

function getOptionalNumber(value?: string) {
  if (!value?.trim()) {
    return undefined;
  }

  const parsedValue = Number(value);
  return Number.isFinite(parsedValue) ? parsedValue : undefined;
}

function parseCalculatorMaterialsJson(value?: string): CalculatorMaterialEntryInitial[] {
  if (!value?.trim()) {
    return [];
  }

  try {
    const parsedValue = JSON.parse(value);

    if (!Array.isArray(parsedValue)) {
      return [];
    }

    return parsedValue.flatMap((entry) => {
      if (!entry || typeof entry !== "object") {
        return [];
      }

      const materialId = typeof entry.materialId === "string" ? entry.materialId : undefined;
      const pricePerKilo = getOptionalNumber(String(entry.pricePerKilo ?? ""));
      const gramsUsed = getOptionalNumber(String(entry.gramsUsed ?? ""));

      if (!materialId && pricePerKilo == null && gramsUsed == null) {
        return [];
      }

      return [{ materialId, pricePerKilo, gramsUsed }];
    });
  } catch {
    return [];
  }
}

function parseDeliveryModes(value?: string) {
  return new Set(
    (value ?? "")
      .split(",")
      .map((entry) => entry.trim())
      .filter(Boolean),
  );
}

export function ShowcaseItemEditor({ item, interestCount, materials, libraries }: ShowcaseItemEditorProps) {
  const [updateState, updateAction] = useActionState(updateShowcaseItemAction, initialState);
  const [deleteState, deleteAction] = useActionState(deleteShowcaseItemAction, initialState);
  const formKey = JSON.stringify(updateState.fields ?? {});

  return (
    <ShowcaseItemEditorContent
      key={formKey}
      item={item}
      interestCount={interestCount}
      materials={materials}
      libraries={libraries}
      updateState={updateState}
      updateAction={updateAction}
      deleteState={deleteState}
      deleteAction={deleteAction}
    />
  );
}

type ShowcaseItemEditorContentProps = ShowcaseItemEditorProps & {
  updateState: ActionState;
  updateAction: (payload: FormData) => void;
  deleteState: ActionState;
  deleteAction: (payload: FormData) => void;
};

function ShowcaseItemEditorContent({
  item,
  interestCount,
  materials,
  libraries,
  updateState,
  updateAction,
  deleteState,
  deleteAction,
}: ShowcaseItemEditorContentProps) {
  const fields = updateState.fields ?? {};
  const isFilesystemSynced = item.syncSource?.mode === "FILESYSTEM";
  const [price, setPrice] = useState(fields.price ?? item.price.toFixed(2));
  const [estimatedPrintHours, setEstimatedPrintHours] = useState(
    fields.estimatedPrintHours ?? String(item.estimatedPrintHours),
  );
  const [estimatedMaterialGrams, setEstimatedMaterialGrams] = useState(
    fields.estimatedMaterialGrams ?? String(item.estimatedMaterialGrams),
  );
  const [fulfillmentType, setFulfillmentType] = useState<"STOCK" | "MADE_TO_ORDER">(
    fields.fulfillmentType === "MADE_TO_ORDER"
      ? "MADE_TO_ORDER"
      : fields.fulfillmentType === "STOCK"
        ? "STOCK"
        : item.fulfillmentType,
  );
  const selectedDeliveryModes = parseDeliveryModes(fields.deliveryModes);
  const initialCalculatorMaterials = parseCalculatorMaterialsJson(fields.calculatorMaterialsJson);
  const calculatorMaterialEntries =
    initialCalculatorMaterials.length > 0
      ? initialCalculatorMaterials
      : [
          {
            materialId: fields.calculatorMaterialId ?? fields.materialId ?? item.materialId ?? "",
            pricePerKilo: getOptionalNumber(fields.calculatorFilamentPricePerKilo),
            gramsUsed:
              getOptionalNumber(fields.calculatorMaterialUsedGrams) ??
              getOptionalNumber(fields.estimatedMaterialGrams) ??
              item.estimatedMaterialGrams,
          },
        ];
  const gallery = useMemo(() => getShowcaseGallery(item), [item]);
  const variantGallery = useMemo(() => getShowcaseVariantGallery(item), [item]);
  const primaryImage = getShowcasePrimaryImage(item);
  const primaryVideo = getShowcasePrimaryVideo(item);
  const currentLibrary = libraries.find((library) => library.id === item.libraryId);
  const stockRatio =
    item.fulfillmentType === "STOCK" ? Math.min(100, Math.max(0, item.stockQuantity * 20)) : 100;

  return (
    <article className="overflow-hidden rounded-[24px] border border-white/10 bg-slate-950/60">
      <div className="grid gap-0 lg:grid-cols-[320px_minmax(0,1fr)]">
        <div className="border-b border-white/10 bg-black/30 lg:border-b-0 lg:border-r">
          <div className="relative h-72 overflow-hidden">
            {primaryVideo ? (
              <video
                src={primaryVideo}
                className="h-full w-full object-cover"
                autoPlay
                muted
                loop
                playsInline
                preload="metadata"
                poster={primaryImage}
              />
            ) : primaryImage ? (
              <img src={primaryImage} alt={item.name} className="h-full w-full object-cover" />
            ) : (
              <div className="h-full bg-[radial-gradient(circle_at_top_left,_rgba(255,122,24,0.35),_transparent_28%),radial-gradient(circle_at_bottom_right,_rgba(89,185,255,0.22),_transparent_32%),linear-gradient(135deg,_rgba(255,255,255,0.08),_rgba(15,23,42,0.95))]" />
            )}

            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-slate-950 to-transparent p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-white/50">{item.category}</p>
              {currentLibrary ? (
                <p className="mt-2 text-sm font-medium text-cyan-100/85">{currentLibrary.name}</p>
              ) : null}
              <h4 className="mt-2 text-2xl font-semibold">{item.name}</h4>
              <div className="mt-3 flex flex-wrap gap-2">
                {(item.badges ?? []).slice(0, 3).map((badge) => (
                  <span key={badge} className="rounded-full border border-white/10 bg-black/35 px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-white/80">
                    {badge}
                  </span>
                ))}
              </div>
            </div>
          </div>

          <div className="space-y-3 p-4">
            <div className="rounded-2xl border border-white/10 bg-black/30 px-4 py-3">
              <div className="flex items-center justify-between gap-4">
                <p className="text-[11px] uppercase tracking-[0.18em] text-white/45">Estoque visual</p>
                <p className="text-sm font-semibold text-white/85">
                  {item.fulfillmentType === "STOCK" ? `${item.stockQuantity} unidades` : "Sob encomenda"}
                </p>
              </div>
              <div className="mt-3 h-2 rounded-full bg-white/10">
                <div className="h-2 rounded-full bg-gradient-to-r from-orange-400 via-emerald-300 to-cyan-300" style={{ width: `${stockRatio}%` }} />
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-white/10 bg-black/30 px-4 py-3">
                <p className="text-[11px] uppercase tracking-[0.18em] text-white/45">Leads</p>
                <p className="mt-2 text-sm font-semibold text-white/85">{interestCount} contatos</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-black/30 px-4 py-3">
                <p className="text-[11px] uppercase tracking-[0.18em] text-white/45">Visualizações</p>
                <p className="mt-2 text-sm font-semibold text-white/85">{item.viewCount}</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-black/30 px-4 py-3">
                <p className="text-[11px] uppercase tracking-[0.18em] text-white/45">Cliques no WhatsApp</p>
                <p className="mt-2 text-sm font-semibold text-white/85">{item.whatsappClickCount}</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-black/30 px-4 py-3">
                <p className="text-[11px] uppercase tracking-[0.18em] text-white/45">Entrega</p>
                <p className="mt-2 text-sm font-semibold text-white/85">{getShowcaseDeliverySummary(item)}</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-black/30 px-4 py-3 sm:col-span-2">
                <p className="text-[11px] uppercase tracking-[0.18em] text-white/45">Checklist</p>
                <p className="mt-2 text-sm font-semibold text-white/85">
                  {item.productionChecklist ? "Checklist de produção configurado" : "Sem checklist definido"}
                </p>
              </div>
            </div>

            {(gallery.length || variantGallery.length) ? (
              <div>
                <p className="text-[11px] uppercase tracking-[0.18em] text-white/45">Galeria atual</p>
                <div className="mt-3 grid grid-cols-3 gap-2">
                  {[...gallery, ...variantGallery].slice(0, 6).map((imageUrl) => (
                    <div key={imageUrl} className="overflow-hidden rounded-2xl border border-white/10 bg-black/20">
                      <img src={imageUrl} alt={item.name} className="h-20 w-full object-cover" />
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            {item.syncSource?.fileUrl && item.syncSource.fileFormat ? (
              <div className="rounded-2xl border border-cyan-400/20 bg-cyan-500/5 p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.18em] text-cyan-100/70">
                      Arquivo 3D do admin
                    </p>
                    <p className="mt-2 text-base font-semibold text-white/92">
                      {item.syncSource.fileName ?? item.name}
                    </p>
                    <p className="mt-2 text-sm text-white/68">
                      Esse arquivo aparece só no painel administrativo. Na vitrine pública o cliente vê apenas as fotos.
                    </p>
                  </div>
                  <a
                    href={item.syncSource.fileUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center justify-center rounded-2xl border border-cyan-400/20 bg-cyan-500/10 px-4 py-3 text-sm font-semibold text-cyan-100 transition hover:bg-cyan-500/15"
                  >
                    Abrir arquivo 3D
                  </a>
                </div>

                <div className="mt-4">
                  <ThreeFileViewer
                    fileUrl={item.syncSource.fileUrl}
                    fileFormat={item.syncSource.fileFormat}
                  />
                </div>
              </div>
            ) : null}
          </div>
        </div>

        <div className="p-5">
          <datalist id={`showcase-category-options-${item.id}`}>
            {showcaseCategorySuggestions.map((category) => (
              <option key={category} value={category} />
            ))}
          </datalist>

          <form action={updateAction} encType="multipart/form-data" className="space-y-5">
            <input type="hidden" name="itemId" value={item.id} />

            {isFilesystemSynced ? (
              <div className="rounded-2xl border border-cyan-400/20 bg-cyan-500/10 px-4 py-3 text-sm text-cyan-50">
                Sincronizado da pasta `{item.syncSource?.relativePath}`.
                {item.syncSource?.missing
                  ? " O arquivo de origem não foi encontrado agora, então o item saiu da vitrine pública até voltar."
                  : ` ${item.syncSource?.fileCount ?? 0} arquivo${item.syncSource?.fileCount === 1 ? "" : "s"} 3D e ${item.syncSource?.imageCount ?? 0} imagem${item.syncSource?.imageCount === 1 ? "" : "ns"} estão sendo puxados automaticamente do computador. Em servidores externos como o Render, a vitrine usa o cache das fotos; os arquivos 3D completos continuam locais, a menos que o servidor também tenha acesso à pasta sincronizada.`}
              </div>
            ) : null}

            <section className="space-y-4 rounded-[24px] border border-white/10 bg-black/20 p-4">
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <label className="block text-sm text-white/70">
                  Nome do item
                  <input name="name" defaultValue={fields.name ?? item.name} className="mt-2 w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 outline-none focus:border-orange-400/60" />
                </label>
                <label className="block text-sm text-white/70">
                  Categoria
                  <input name="category" list={`showcase-category-options-${item.id}`} defaultValue={fields.category ?? item.category} className="mt-2 w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 outline-none focus:border-orange-400/60" />
                </label>
                <label className="block text-sm text-white/70">
                  Biblioteca
                  <select
                    name="libraryId"
                    defaultValue={fields.libraryId ?? item.libraryId ?? ""}
                    className="mt-2 w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 outline-none focus:border-orange-400/60"
                  >
                    <option value="">Sem vinculo</option>
                    {libraries.map((library) => (
                      <option key={library.id} value={library.id}>
                        {library.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block text-sm text-white/70">
                  Valor (R$)
                  <input name="price" value={price} onChange={(event) => setPrice(event.target.value)} type="number" step="0.01" min="0.01" className="mt-2 w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 outline-none focus:border-orange-400/60" />
                </label>
              </div>

              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <label className="block text-sm text-white/70">
                  Tempo de impressão (h)
                  <input name="estimatedPrintHours" value={estimatedPrintHours} onChange={(event) => setEstimatedPrintHours(event.target.value)} type="number" step="0.1" min="0.1" className="mt-2 w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 outline-none focus:border-orange-400/60" />
                </label>
              </div>

              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <label className="block text-sm text-white/70">
                  Modalidade
                  <select name="fulfillmentType" value={fulfillmentType} onChange={(event) => setFulfillmentType(event.target.value as "STOCK" | "MADE_TO_ORDER")} className="mt-2 w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 outline-none focus:border-orange-400/60">
                    <option value="STOCK">Pronta entrega</option>
                    <option value="MADE_TO_ORDER">Sob encomenda</option>
                  </select>
                </label>

                {fulfillmentType === "STOCK" ? (
                  <>
                    <label className="block text-sm text-white/70">
                      Estoque disponivel
                      <input name="stockQuantity" type="number" min="0" step="1" defaultValue={fields.stockQuantity ?? String(item.stockQuantity)} className="mt-2 w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 outline-none focus:border-orange-400/60" />
                    </label>
                    <label className="block text-sm text-white/70">
                      Adicionar ao estoque
                      <input name="restockQuantity" type="number" min="0" step="1" defaultValue={fields.restockQuantity ?? "0"} className="mt-2 w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 outline-none focus:border-orange-400/60" />
                    </label>
                    <input type="hidden" name="leadTimeDays" value="0" />
                  </>
                ) : (
                  <>
                    <input type="hidden" name="stockQuantity" value="0" />
                    <input type="hidden" name="restockQuantity" value="0" />
                    <label className="block text-sm text-white/70">
                      Prazo estimado (dias uteis)
                      <input name="leadTimeDays" type="number" min="1" step="1" defaultValue={fields.leadTimeDays ?? String(item.leadTimeDays || 7)} className="mt-2 w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 outline-none focus:border-orange-400/60" />
                    </label>
                  </>
                )}

                <label className="block text-sm text-white/70">
                  Material principal
                  <input name="materialLabel" defaultValue={fields.materialLabel ?? item.materialLabel ?? ""} className="mt-2 w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 outline-none focus:border-orange-400/60" />
                </label>
              </div>

              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                <label className="block text-sm text-white/70">
                  Filamento / material vinculado
                  <select name="materialId" defaultValue={fields.materialId ?? item.materialId ?? ""} className="mt-2 w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 outline-none focus:border-orange-400/60">
                    <option value="">Selecionar depois</option>
                    {materials.map((material) => (
                      <option key={material.id} value={material.id}>
                        {material.name} · {material.brand} · {material.color}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block text-sm text-white/70">
                  Consumo estimado de material (g/ml)
                  <input name="estimatedMaterialGrams" value={estimatedMaterialGrams} onChange={(event) => setEstimatedMaterialGrams(event.target.value)} type="number" min="0" step="0.01" className="mt-2 w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 outline-none focus:border-orange-400/60" />
                </label>
                <label className="block text-sm text-white/70">
                  Medidas
                  <input name="dimensionSummary" defaultValue={fields.dimensionSummary ?? item.dimensionSummary ?? ""} className="mt-2 w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 outline-none focus:border-orange-400/60" />
                </label>
              </div>

              <label className="block text-sm text-white/70">
                Checklist de produção
                <textarea
                  name="productionChecklist"
                  rows={4}
                  defaultValue={fields.productionChecklist ?? item.productionChecklist ?? ""}
                  className="mt-2 w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 outline-none focus:border-orange-400/60"
                />
              </label>
            </section>

            <ShowcasePriceCalculator
              materials={materials}
              fieldNames={{
                materialsJson: "calculatorMaterialsJson",
                packagingCost: "calculatorPackagingCost",
                printDurationHours: "calculatorPrintDurationHours",
                energyRate: "calculatorEnergyRate",
                printerPowerWatts: "calculatorPrinterPowerWatts",
                laborRatePerHour: "calculatorLaborRatePerHour",
                laborHours: "calculatorLaborHours",
                marginPercent: "calculatorMarginPercent",
              }}
              initialValues={{
                materialEntries: calculatorMaterialEntries,
                packagingCost: getOptionalNumber(fields.calculatorPackagingCost),
                printDurationHours: getOptionalNumber(
                  fields.calculatorPrintDurationHours ?? estimatedPrintHours,
                ),
                energyRate: getOptionalNumber(fields.calculatorEnergyRate),
                printerPowerWatts: getOptionalNumber(fields.calculatorPrinterPowerWatts),
                laborRatePerHour: getOptionalNumber(fields.calculatorLaborRatePerHour),
                laborHours: getOptionalNumber(fields.calculatorLaborHours),
                marginPercent: getOptionalNumber(fields.calculatorMarginPercent),
              }}
              onApplyPrice={(value) => setPrice(value)}
              onSyncPrintDuration={(value) => setEstimatedPrintHours(value)}
              onSyncMaterialUsage={(value) => setEstimatedMaterialGrams(value)}
            />

            <section className="grid gap-4 xl:grid-cols-2">
              <div className="space-y-4 rounded-[24px] border border-white/10 bg-black/20 p-4">
                <label className="block text-sm text-white/70">
                  Resumo curto / chamada
                  <input name="tagline" defaultValue={fields.tagline ?? item.tagline ?? ""} className="mt-2 w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 outline-none focus:border-orange-400/60" />
                </label>
                <label className="block text-sm text-white/70">
                  Descricao completa
                  <textarea name="description" rows={5} defaultValue={fields.description ?? item.description} className="mt-2 w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 outline-none focus:border-orange-400/60" />
                </label>
                <label className="block text-sm text-white/70">
                  Selos
                  <textarea name="badges" rows={3} defaultValue={fields.badges ?? item.badges.join("\n")} className="mt-2 w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 outline-none focus:border-orange-400/60" />
                </label>
              </div>

              <div className="space-y-4 rounded-[24px] border border-white/10 bg-black/20 p-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <label className="block text-sm text-white/70">
                    Preço de comparação
                    <input name="compareAtPrice" type="number" step="0.01" min="0" defaultValue={fields.compareAtPrice ?? (item.compareAtPrice?.toFixed(2) ?? "")} className="mt-2 w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 outline-none focus:border-orange-400/60" />
                  </label>
                  <label className="block text-sm text-white/70">
                    Faixa promocional
                    <input name="promotionLabel" defaultValue={fields.promotionLabel ?? item.promotionLabel ?? ""} className="mt-2 w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 outline-none focus:border-orange-400/60" />
                  </label>
                  <label className="block text-sm text-white/70">
                    Cupom
                    <input name="couponCode" defaultValue={fields.couponCode ?? item.couponCode ?? ""} className="mt-2 w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 outline-none focus:border-orange-400/60" />
                  </label>
                  <label className="block text-sm text-white/70">
                    Desconto do cupom (%)
                    <input name="couponDiscountPercent" type="number" min="0" max="100" step="1" defaultValue={fields.couponDiscountPercent ?? (item.couponDiscountPercent?.toString() ?? "")} className="mt-2 w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 outline-none focus:border-orange-400/60" />
                  </label>
                </div>
                <label className="block text-sm text-white/70">
                  Resumo de entrega
                  <textarea name="shippingSummary" rows={3} defaultValue={fields.shippingSummary ?? item.shippingSummary ?? ""} className="mt-2 w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 outline-none focus:border-orange-400/60" />
                </label>
                <div className="grid gap-3 md:grid-cols-3">
                  {[
                    { value: "PICKUP", label: "Retirada" },
                    { value: "LOCAL_DELIVERY", label: "Entrega local" },
                    { value: "SHIPPING", label: "Envio" },
                  ].map((option) => {
                    const currentModes = selectedDeliveryModes.size
                      ? selectedDeliveryModes
                      : new Set(item.deliveryModes);

                    return (
                      <label key={option.value} className="inline-flex items-center gap-3 rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white/75">
                        <input type="checkbox" name="deliveryModes" value={option.value} defaultChecked={currentModes.has(option.value)} className="h-4 w-4 rounded border-white/20" />
                        {option.label}
                      </label>
                    );
                  })}
                </div>
              </div>
            </section>

            <section className="grid gap-4 xl:grid-cols-2">
              <div className="space-y-4 rounded-[24px] border border-white/10 bg-black/20 p-4">
                <label className="block text-sm text-white/70">
                  Cores
                  <textarea name="colorOptions" rows={3} defaultValue={fields.colorOptions ?? item.colorOptions.join("\n")} className="mt-2 w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 outline-none focus:border-orange-400/60" />
                </label>
                <label className="block text-sm text-white/70">
                  Tamanhos
                  <textarea name="sizeOptions" rows={3} defaultValue={fields.sizeOptions ?? item.sizeOptions.join("\n")} className="mt-2 w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 outline-none focus:border-orange-400/60" />
                </label>
                <label className="block text-sm text-white/70">
                  Acabamentos
                  <textarea name="finishOptions" rows={3} defaultValue={fields.finishOptions ?? item.finishOptions.join("\n")} className="mt-2 w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 outline-none focus:border-orange-400/60" />
                </label>
              </div>

              <div className="space-y-4 rounded-[24px] border border-white/10 bg-black/20 p-4">
                <label className="block text-sm text-white/70">
                  Variantes detalhadas
                  <textarea name="variantsText" rows={6} defaultValue={fields.variantsText ?? serializeShowcaseVariants(item.variants)} className="mt-2 w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 outline-none focus:border-orange-400/60" />
                </label>
                <p className="text-sm text-white/50">
                  Formato: Nome | Cor | Tamanho | Acabamento | Ajuste de preço | Estoque | URLs da galeria separadas por vírgula.
                </p>
              </div>
            </section>

            <section className="grid gap-4 xl:grid-cols-2">
              <div className="space-y-4 rounded-[24px] border border-white/10 bg-black/20 p-4">
                <label className="block text-sm text-white/70">
                  Título SEO
                  <input name="seoTitle" defaultValue={fields.seoTitle ?? item.seoTitle ?? ""} className="mt-2 w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 outline-none focus:border-orange-400/60" />
                </label>
                <label className="block text-sm text-white/70">
                  Descrição SEO
                  <textarea name="seoDescription" rows={3} defaultValue={fields.seoDescription ?? item.seoDescription ?? ""} className="mt-2 w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 outline-none focus:border-orange-400/60" />
                </label>
                <label className="block text-sm text-white/70">
                  Palavras-chave SEO
                  <textarea name="seoKeywords" rows={3} defaultValue={fields.seoKeywords ?? item.seoKeywords.join("\n")} className="mt-2 w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 outline-none focus:border-orange-400/60" />
                </label>
              </div>

              <div className="space-y-4 rounded-[24px] border border-white/10 bg-black/20 p-4">
                <p className="text-sm text-white/55">
                  O video continua opcional e funciona apenas como midia extra do produto.
                </p>
                <div className="grid gap-4 md:grid-cols-2">
                  <label className="block text-sm text-white/70">
                    Imagem principal por URL
                    <input name="imageUrl" defaultValue={fields.imageUrl ?? item.imageUrl ?? ""} className="mt-2 w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 outline-none focus:border-orange-400/60" />
                  </label>
                  <label className="block text-sm text-white/70">
                    Video por URL
                    <input name="videoUrl" defaultValue={fields.videoUrl ?? item.videoUrl ?? ""} className="mt-2 w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 outline-none focus:border-orange-400/60" />
                  </label>
                  <label className="block text-sm text-white/70">
                    Trocar foto principal
                    <input name="imageFile" type="file" accept="image/png,image/jpeg,image/webp,image/gif" className="mt-2 block w-full rounded-2xl border border-dashed border-white/15 bg-black/30 px-4 py-3 text-white/70 file:mr-4 file:rounded-xl file:border-0 file:bg-orange-500 file:px-4 file:py-2 file:font-semibold file:text-slate-950" />
                  </label>
                  <label className="block text-sm text-white/70">
                    Trocar video principal
                    <input name="videoFile" type="file" accept="video/mp4,video/webm,video/quicktime,.mp4,.webm,.mov,.m4v" className="mt-2 block w-full rounded-2xl border border-dashed border-white/15 bg-black/30 px-4 py-3 text-white/70 file:mr-4 file:rounded-xl file:border-0 file:bg-orange-500 file:px-4 file:py-2 file:font-semibold file:text-slate-950" />
                  </label>
                </div>
                <label className="block text-sm text-white/70">
                  URLs da galeria
                  <textarea name="galleryImageUrls" rows={4} defaultValue={fields.galleryImageUrls ?? item.galleryImageUrls.join("\n")} className="mt-2 w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 outline-none focus:border-orange-400/60" />
                </label>
                <label className="block text-sm text-white/70">
                  Fotos extras
                  <input name="galleryFiles" type="file" accept="image/png,image/jpeg,image/webp,image/gif" multiple className="mt-2 block w-full rounded-2xl border border-dashed border-white/15 bg-black/30 px-4 py-3 text-white/70 file:mr-4 file:rounded-xl file:border-0 file:bg-orange-500 file:px-4 file:py-2 file:font-semibold file:text-slate-950" />
                </label>
              </div>
            </section>

            <div className="grid gap-3 md:grid-cols-2">
              <label className="inline-flex items-center gap-3 rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white/75">
                <input type="checkbox" name="featured" defaultChecked={fields.featured ? fields.featured === "true" : item.featured} className="h-4 w-4 rounded border-white/20" />
                Destacar no topo da vitrine
              </label>
              <label className="inline-flex items-center gap-3 rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white/75">
                <input type="checkbox" name="active" defaultChecked={fields.active ? fields.active === "true" : item.active} className="h-4 w-4 rounded border-white/20" />
                Exibir na vitrine
              </label>
            </div>

            {updateState.error ? <p className="text-sm text-rose-300">{updateState.error}</p> : null}
            {updateState.message ? <p className="text-sm text-emerald-300">{updateState.message}</p> : null}

            <SubmitButton label="Salvar produto da vitrine" pendingLabel="Salvando..." className="w-full bg-orange-500 text-slate-950 hover:bg-orange-400" />
          </form>

          {isFilesystemSynced ? (
            <div className="mt-4 rounded-2xl border border-amber-400/20 bg-amber-500/5 p-4">
              <p className="font-semibold text-amber-100">Item protegido pela sincronização</p>
              <p className="mt-1 text-sm text-amber-100/75">
                Para remover este item da loja, apague ou mova o arquivo/pasta de origem em `D:\Impressoes 3D`. Se quiser apenas esconder da vitrine, desmarque a opção de exibição e salve.
              </p>
              {deleteState.error ? <p className="mt-3 text-sm text-rose-200">{deleteState.error}</p> : null}
            </div>
          ) : (
            <form
              action={deleteAction}
              onSubmit={(event) => {
                if (!window.confirm("Excluir este produto da vitrine?")) {
                  event.preventDefault();
                }
              }}
              className="mt-4 rounded-2xl border border-rose-400/20 bg-rose-500/5 p-4"
            >
              <input type="hidden" name="itemId" value={item.id} />
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="font-semibold text-rose-100">Excluir produto da vitrine</p>
                  <p className="mt-1 text-sm text-rose-100/75">
                    Use essa opção apenas quando esse item não deve mais fazer parte da loja.
                  </p>
                </div>
                <SubmitButton label="Excluir produto" pendingLabel="Excluindo..." className="bg-rose-500/90 text-white hover:bg-rose-400" />
              </div>
              {deleteState.error ? <p className="mt-3 text-sm text-rose-200">{deleteState.error}</p> : null}
            </form>
          )}
        </div>
      </div>
    </article>
  );
}
