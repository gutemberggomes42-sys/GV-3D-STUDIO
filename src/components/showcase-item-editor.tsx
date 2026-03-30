/* eslint-disable @next/next/no-img-element */
"use client";

import { useActionState, useState } from "react";
import { SubmitButton } from "@/components/submit-button";
import {
  deleteShowcaseItemAction,
  type ActionState,
  updateShowcaseItemAction,
} from "@/lib/actions";
import { ShowcasePriceCalculator } from "@/components/showcase-price-calculator";
import type { DbMaterial, DbShowcaseItem } from "@/lib/db-types";
import { formatCurrency } from "@/lib/format";
import {
  getShowcaseGallery,
  getShowcasePrimaryImage,
  getShowcasePrimaryVideo,
  serializeShowcaseList,
  showcaseCategorySuggestions,
} from "@/lib/showcase";

type ShowcaseItemEditorProps = {
  item: DbShowcaseItem;
  interestCount: number;
  materials: DbMaterial[];
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

const initialState: ActionState = { ok: false };

export function ShowcaseItemEditor({ item, interestCount, materials }: ShowcaseItemEditorProps) {
  const [updateState, updateAction] = useActionState(updateShowcaseItemAction, initialState);
  const [deleteState, deleteAction] = useActionState(deleteShowcaseItemAction, initialState);
  const formKey = JSON.stringify(updateState.fields ?? {});

  return (
    <ShowcaseItemEditorContent
      key={formKey}
      item={item}
      interestCount={interestCount}
      materials={materials}
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
  updateState,
  updateAction,
  deleteState,
  deleteAction,
}: ShowcaseItemEditorContentProps) {
  const fields = updateState.fields ?? {};
  const [price, setPrice] = useState(fields.price ?? item.price.toFixed(2));
  const [fulfillmentType, setFulfillmentType] = useState<"STOCK" | "MADE_TO_ORDER">(
    fields.fulfillmentType === "MADE_TO_ORDER"
      ? "MADE_TO_ORDER"
      : fields.fulfillmentType === "STOCK"
        ? "STOCK"
        : item.fulfillmentType,
  );
  const managesStock = fulfillmentType === "STOCK";
  const gallery = getShowcaseGallery(item);
  const primaryImage = getShowcasePrimaryImage(item);
  const primaryVideo = getShowcasePrimaryVideo(item);
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
              <h4 className="mt-2 text-2xl font-semibold">{item.name}</h4>
              <p className="mt-3 text-sm text-white/70">{formatCurrency(item.price)}</p>
            </div>
          </div>

          <div className="space-y-3 p-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-white/10 bg-black/30 px-4 py-3">
                <p className="text-[11px] uppercase tracking-[0.18em] text-white/45">Disponibilidade</p>
                <p className="mt-2 text-sm font-semibold text-white/85">
                  {item.fulfillmentType === "STOCK" ? `${item.stockQuantity} em estoque` : `${item.leadTimeDays} dias uteis`}
                </p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-black/30 px-4 py-3">
                <p className="text-[11px] uppercase tracking-[0.18em] text-white/45">Leads</p>
                <p className="mt-2 text-sm font-semibold text-white/85">{interestCount} contatos</p>
              </div>
            </div>

            {primaryVideo ? (
              <div className="rounded-2xl border border-white/10 bg-black/30 px-4 py-3">
                <p className="text-[11px] uppercase tracking-[0.18em] text-white/45">Video principal</p>
                <p className="mt-2 text-sm font-semibold text-white/85">Ativo na vitrine</p>
              </div>
            ) : null}

            {gallery.length ? (
              <div>
                <p className="text-[11px] uppercase tracking-[0.18em] text-white/45">Galeria atual</p>
                <div className="mt-3 grid grid-cols-3 gap-2">
                  {gallery.slice(0, 6).map((imageUrl) => (
                    <div key={imageUrl} className="overflow-hidden rounded-2xl border border-white/10 bg-black/20">
                      <img src={imageUrl} alt={item.name} className="h-20 w-full object-cover" />
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        </div>

        <div className="p-5">
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div>
              <p className="text-lg font-semibold">{item.name}</p>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-white/65">{item.tagline ?? item.description}</p>
              <p className="mt-2 text-sm text-white/50">
                {item.featured ? "Produto em destaque na vitrine" : "Produto exibido na grade principal"}
              </p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-right">
              <p className="text-[11px] uppercase tracking-[0.18em] text-white/45">
                {item.fulfillmentType === "STOCK" ? "Pronta entrega" : "Sob encomenda"}
              </p>
              <p className="mt-2 text-2xl font-semibold">{formatCurrency(item.price)}</p>
            </div>
          </div>

          <datalist id={`showcase-category-options-${item.id}`}>
            {showcaseCategorySuggestions.map((category) => (
              <option key={category} value={category} />
            ))}
          </datalist>

          <form action={updateAction} encType="multipart/form-data" className="mt-5 space-y-5">
            <input type="hidden" name="itemId" value={item.id} />

            <section className="space-y-4 rounded-[24px] border border-white/10 bg-black/20 p-4">
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <label className="block text-sm text-white/70">
                  Nome do item
                  <input
                    name="name"
                    defaultValue={fields.name ?? item.name}
                    className="mt-2 w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 outline-none focus:border-orange-400/60"
                  />
                </label>
                <label className="block text-sm text-white/70">
                  Categoria
                  <input
                    name="category"
                    list={`showcase-category-options-${item.id}`}
                    defaultValue={fields.category ?? item.category}
                    className="mt-2 w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 outline-none focus:border-orange-400/60"
                  />
                </label>
                <label className="block text-sm text-white/70">
                  Valor (R$)
                  <input
                    name="price"
                    value={price}
                    onChange={(event) => setPrice(event.target.value)}
                    type="number"
                    step="0.01"
                    min="0.01"
                    className="mt-2 w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 outline-none focus:border-orange-400/60"
                  />
                </label>
                <label className="block text-sm text-white/70">
                  Tempo de impressão (h)
                  <input
                    name="estimatedPrintHours"
                    type="number"
                    step="0.1"
                    min="0.1"
                    defaultValue={fields.estimatedPrintHours ?? String(item.estimatedPrintHours)}
                    className="mt-2 w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 outline-none focus:border-orange-400/60"
                  />
                </label>
              </div>

              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <label className="block text-sm text-white/70">
                  Modalidade
                  <select
                    name="fulfillmentType"
                    value={fulfillmentType}
                    onChange={(event) => setFulfillmentType(event.target.value as "STOCK" | "MADE_TO_ORDER")}
                    className="mt-2 w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 outline-none focus:border-orange-400/60"
                  >
                    <option value="STOCK">Pronta entrega</option>
                    <option value="MADE_TO_ORDER">Sob encomenda</option>
                  </select>
                </label>

                {managesStock ? (
                  <>
                    <label className="block text-sm text-white/70">
                      Estoque disponivel
                      <input
                        name="stockQuantity"
                        type="number"
                        min="0"
                        step="1"
                        defaultValue={fields.stockQuantity ?? String(item.stockQuantity)}
                        className="mt-2 w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 outline-none focus:border-orange-400/60"
                      />
                    </label>
                    <label className="block text-sm text-white/70">
                      Adicionar ao estoque
                      <input
                        name="restockQuantity"
                        type="number"
                        min="0"
                        step="1"
                        defaultValue={fields.restockQuantity ?? "0"}
                        className="mt-2 w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 outline-none focus:border-orange-400/60"
                      />
                    </label>
                    <input type="hidden" name="leadTimeDays" value="0" />
                  </>
                ) : (
                  <>
                    <input type="hidden" name="stockQuantity" value="0" />
                    <input type="hidden" name="restockQuantity" value="0" />
                    <label className="block text-sm text-white/70">
                      Prazo estimado (dias uteis)
                      <input
                        name="leadTimeDays"
                        type="number"
                        min="1"
                        step="1"
                        defaultValue={fields.leadTimeDays ?? String(item.leadTimeDays || 7)}
                        className="mt-2 w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 outline-none focus:border-orange-400/60"
                      />
                    </label>
                  </>
                )}

                <label className="block text-sm text-white/70">
                  Material principal
                  <input
                    name="materialLabel"
                    defaultValue={fields.materialLabel ?? item.materialLabel ?? ""}
                    className="mt-2 w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 outline-none focus:border-orange-400/60"
                  />
                </label>

                <label className="block text-sm text-white/70">
                  Medidas
                  <input
                    name="dimensionSummary"
                    defaultValue={fields.dimensionSummary ?? item.dimensionSummary ?? ""}
                    className="mt-2 w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 outline-none focus:border-orange-400/60"
                  />
                </label>
              </div>

              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                <label className="block text-sm text-white/70">
                  Filamento / material vinculado
                  <select
                    name="materialId"
                    defaultValue={fields.materialId ?? item.materialId ?? ""}
                    className="mt-2 w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 outline-none focus:border-orange-400/60"
                  >
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
                  <input
                    name="estimatedMaterialGrams"
                    type="number"
                    min="0"
                    step="0.01"
                    defaultValue={fields.estimatedMaterialGrams ?? String(item.estimatedMaterialGrams)}
                    className="mt-2 w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 outline-none focus:border-orange-400/60"
                  />
                </label>

                <div className="rounded-2xl border border-white/10 bg-black/25 px-4 py-3 text-sm text-white/60">
                  A baixa automática usa este valor quando o pedido sair da fila e entrar em impressão.
                </div>
              </div>
            </section>

            <section className="space-y-4 rounded-[24px] border border-white/10 bg-black/20 p-4">
              <div className="grid gap-4 md:grid-cols-2">
                <label className="block text-sm text-white/70">
                  Resumo curto / chamada
                  <input
                    name="tagline"
                    defaultValue={fields.tagline ?? item.tagline ?? ""}
                    className="mt-2 w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 outline-none focus:border-orange-400/60"
                  />
                </label>
                <label className="block text-sm text-white/70">
                  Cores disponiveis
                  <input
                    name="colorOptions"
                    defaultValue={fields.colorOptions ?? item.colorOptions.join(", ")}
                    className="mt-2 w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 outline-none focus:border-orange-400/60"
                  />
                </label>
              </div>

              <label className="block text-sm text-white/70">
                Descricao completa
                <textarea
                  name="description"
                  rows={5}
                  defaultValue={fields.description ?? item.description}
                  className="mt-2 w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 outline-none focus:border-orange-400/60"
                />
              </label>
            </section>

            <section className="space-y-4 rounded-[24px] border border-white/10 bg-black/20 p-4">
              <div className="grid gap-4 md:grid-cols-2">
                <label className="block text-sm text-white/70">
                  Imagem principal por URL
                  <input
                    name="imageUrl"
                    defaultValue={fields.imageUrl ?? item.imageUrl ?? ""}
                    className="mt-2 w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 outline-none focus:border-orange-400/60"
                  />
                </label>
                <label className="block text-sm text-white/70">
                  Video principal por URL (opcional)
                  <input
                    name="videoUrl"
                    defaultValue={fields.videoUrl ?? item.videoUrl ?? ""}
                    className="mt-2 w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 outline-none focus:border-orange-400/60"
                  />
                </label>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <label className="block text-sm text-white/70">
                  Trocar foto principal
                  <input
                    name="imageFile"
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/gif"
                    className="mt-2 block w-full rounded-2xl border border-dashed border-white/15 bg-black/30 px-4 py-3 text-white/70 file:mr-4 file:rounded-xl file:border-0 file:bg-orange-500 file:px-4 file:py-2 file:font-semibold file:text-slate-950"
                  />
                </label>
                <label className="block text-sm text-white/70">
                  Trocar video principal (opcional)
                  <input
                    name="videoFile"
                    type="file"
                    accept="video/mp4,video/webm,video/quicktime,.mp4,.webm,.mov,.m4v"
                    className="mt-2 block w-full rounded-2xl border border-dashed border-white/15 bg-black/30 px-4 py-3 text-white/70 file:mr-4 file:rounded-xl file:border-0 file:bg-orange-500 file:px-4 file:py-2 file:font-semibold file:text-slate-950"
                  />
                </label>
              </div>

              <p className="text-sm text-white/50">
                O video e opcional. Se houver erro em outro campo, o navegador pode pedir para selecionar arquivos novamente.
              </p>

              <div className="grid gap-4 md:grid-cols-2">
                <label className="block text-sm text-white/70">
                  URLs da galeria
                  <textarea
                    name="galleryImageUrls"
                    rows={4}
                    defaultValue={fields.galleryImageUrls ?? serializeShowcaseList(item.galleryImageUrls)}
                    className="mt-2 w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 outline-none focus:border-orange-400/60"
                  />
                </label>
                <label className="block text-sm text-white/70">
                  Enviar novas fotos da galeria
                  <input
                    name="galleryFiles"
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/gif"
                    multiple
                    className="mt-2 block w-full rounded-2xl border border-dashed border-white/15 bg-black/30 px-4 py-3 text-white/70 file:mr-4 file:rounded-xl file:border-0 file:bg-orange-500 file:px-4 file:py-2 file:font-semibold file:text-slate-950"
                  />
                </label>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <label className="inline-flex items-center gap-3 rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white/75">
                  <input
                    type="checkbox"
                    name="featured"
                    defaultChecked={fields.featured ? fields.featured === "true" : item.featured}
                    className="h-4 w-4 rounded border-white/20"
                  />
                  Destacar no topo da vitrine
                </label>

                <label className="inline-flex items-center gap-3 rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white/75">
                  <input
                    type="checkbox"
                    name="active"
                    defaultChecked={fields.active ? fields.active === "true" : item.active}
                    className="h-4 w-4 rounded border-white/20"
                  />
                  Exibir na vitrine
                </label>
              </div>
            </section>

            {updateState.error ? <p className="text-sm text-rose-300">{updateState.error}</p> : null}
            {updateState.message ? <p className="text-sm text-emerald-300">{updateState.message}</p> : null}

            <ShowcasePriceCalculator
              onApplyPrice={setPrice}
              materials={materials}
              fieldNames={{
                materialsJson: "calculatorMaterialsJson",
                packagingCost: "calculatorPackagingCost",
                printDurationHours: "calculatorPrintDurationHours",
                energyRate: "calculatorEnergyRate",
                printerPowerWatts: "calculatorPrinterPowerWatts",
                marginPercent: "calculatorMarginPercent",
              }}
              initialValues={{
                materialEntries: calculatorMaterialEntries,
                packagingCost: getOptionalNumber(fields.calculatorPackagingCost) ?? 0,
                printDurationHours:
                  getOptionalNumber(fields.calculatorPrintDurationHours) ??
                  getOptionalNumber(fields.estimatedPrintHours) ??
                  item.estimatedPrintHours,
                energyRate: getOptionalNumber(fields.calculatorEnergyRate) ?? 0.9,
                printerPowerWatts: getOptionalNumber(fields.calculatorPrinterPowerWatts) ?? 95,
                marginPercent: getOptionalNumber(fields.calculatorMarginPercent) ?? 10,
              }}
            />

            <SubmitButton
              label="Atualizar item"
              pendingLabel="Salvando alteracoes..."
              className="w-full bg-orange-500 text-slate-950 hover:bg-orange-400"
            />
          </form>

          <form action={deleteAction} className="mt-4 rounded-2xl border border-rose-400/20 bg-rose-500/5 p-4">
            <input type="hidden" name="itemId" value={item.id} />
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <p className="text-sm text-rose-100/80">
                Excluir remove o item da vitrine, mas preserva o historico de contatos ja registrados.
              </p>
              <SubmitButton
                label="Excluir item"
                pendingLabel="Excluindo..."
                className="bg-rose-500/90 text-white hover:bg-rose-400"
              />
            </div>
            {deleteState.error ? <p className="mt-3 text-sm text-rose-200">{deleteState.error}</p> : null}
          </form>
        </div>
      </div>
    </article>
  );
}
