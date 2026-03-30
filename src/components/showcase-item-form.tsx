"use client";

import { useActionState, useState } from "react";
import { SubmitButton } from "@/components/submit-button";
import { createShowcaseItemAction, type ActionState } from "@/lib/actions";
import { ShowcasePriceCalculator } from "@/components/showcase-price-calculator";
import type { DbMaterial } from "@/lib/db-types";
import { showcaseCategorySuggestions } from "@/lib/showcase";

const initialState: ActionState = { ok: false };

type ShowcaseItemFormProps = {
  materials: DbMaterial[];
};

function getOptionalNumber(value?: string) {
  if (!value?.trim()) {
    return undefined;
  }

  const parsedValue = Number(value);
  return Number.isFinite(parsedValue) ? parsedValue : undefined;
}

export function ShowcaseItemForm({ materials }: ShowcaseItemFormProps) {
  const [state, formAction] = useActionState(createShowcaseItemAction, initialState);
  const formKey = JSON.stringify(state.fields ?? {});

  return (
    <ShowcaseItemFormContent
      key={formKey}
      state={state}
      formAction={formAction}
      materials={materials}
    />
  );
}

type ShowcaseItemFormContentProps = {
  state: ActionState;
  formAction: (payload: FormData) => void;
  materials: DbMaterial[];
};

function ShowcaseItemFormContent({ state, formAction, materials }: ShowcaseItemFormContentProps) {
  const fields = state.fields ?? {};
  const [price, setPrice] = useState(fields.price ?? "");
  const [fulfillmentType, setFulfillmentType] = useState<"STOCK" | "MADE_TO_ORDER">(
    fields.fulfillmentType === "MADE_TO_ORDER" ? "MADE_TO_ORDER" : "STOCK",
  );
  const managesStock = fulfillmentType === "STOCK";

  return (
    <form
      action={formAction}
      encType="multipart/form-data"
      className="space-y-5 rounded-[28px] border border-white/10 bg-white/5 p-6"
    >
      <div>
        <p className="text-xs uppercase tracking-[0.24em] text-white/45">Itens de exposição</p>
        <h3 className="mt-2 text-2xl font-semibold">Cadastrar produto da vitrine</h3>
        <p className="mt-2 text-sm leading-6 text-white/65">
          Monte um produto de loja de verdade, com categoria, material, prazo, medidas e galeria de imagens.
        </p>
      </div>

      <datalist id="showcase-category-options">
        {showcaseCategorySuggestions.map((category) => (
          <option key={category} value={category} />
        ))}
      </datalist>

      <section className="space-y-4 rounded-[24px] border border-white/10 bg-black/20 p-5">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-white/45">Essencial</p>
          <h4 className="mt-2 text-lg font-semibold text-white/92">Base do produto</h4>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <label className="block text-sm text-white/70">
            Nome do item
            <input
              name="name"
              defaultValue={fields.name ?? ""}
              placeholder="Fidget Ovo de Dragao"
              className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 outline-none focus:border-orange-400/60"
            />
          </label>
          <label className="block text-sm text-white/70">
            Categoria
            <input
              name="category"
              list="showcase-category-options"
              defaultValue={fields.category ?? ""}
              placeholder="Geek"
              className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 outline-none focus:border-orange-400/60"
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
              placeholder="39.90"
              className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 outline-none focus:border-orange-400/60"
            />
          </label>
          <label className="block text-sm text-white/70">
            Tempo de impressão (h)
            <input
              name="estimatedPrintHours"
              type="number"
              step="0.1"
              min="0.1"
              defaultValue={fields.estimatedPrintHours ?? "1"}
              className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 outline-none focus:border-orange-400/60"
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
              className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 outline-none focus:border-orange-400/60"
            >
              <option value="STOCK">Pronta entrega</option>
              <option value="MADE_TO_ORDER">Sob encomenda</option>
            </select>
          </label>

          {managesStock ? (
            <label className="block text-sm text-white/70">
              Estoque disponivel
              <input
                name="stockQuantity"
                type="number"
                min="0"
                step="1"
                defaultValue={fields.stockQuantity ?? "0"}
                className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 outline-none focus:border-orange-400/60"
              />
            </label>
          ) : (
            <>
              <input type="hidden" name="stockQuantity" value="0" />
              <label className="block text-sm text-white/70">
                Prazo estimado (dias uteis)
                <input
                  name="leadTimeDays"
                  type="number"
                  min="1"
                  step="1"
                  defaultValue={fields.leadTimeDays ?? "7"}
                  className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 outline-none focus:border-orange-400/60"
                />
              </label>
            </>
          )}

          {managesStock ? <input type="hidden" name="leadTimeDays" value="0" /> : null}

          <label className="block text-sm text-white/70">
            Material principal
            <input
              name="materialLabel"
              defaultValue={fields.materialLabel ?? ""}
              placeholder="PLA Premium"
              className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 outline-none focus:border-orange-400/60"
            />
          </label>

          <label className="block text-sm text-white/70">
            Medidas
            <input
              name="dimensionSummary"
              defaultValue={fields.dimensionSummary ?? ""}
              placeholder="18 x 12 x 8 cm"
              className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 outline-none focus:border-orange-400/60"
            />
          </label>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <label className="block text-sm text-white/70">
            Filamento / material vinculado
            <select
              name="materialId"
              defaultValue={fields.materialId ?? ""}
              className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 outline-none focus:border-orange-400/60"
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
              defaultValue={fields.estimatedMaterialGrams ?? "0"}
              className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 outline-none focus:border-orange-400/60"
            />
          </label>

          <div className="rounded-2xl border border-white/10 bg-slate-950/50 px-4 py-3 text-sm text-white/60">
            Quando você escolher o material e informar o consumo estimado, o sistema baixa esse filamento automaticamente assim que o pedido entrar em impressão.
          </div>
        </div>
      </section>

      <section className="space-y-4 rounded-[24px] border border-white/10 bg-black/20 p-5">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-white/45">Apresentacao</p>
          <h4 className="mt-2 text-lg font-semibold text-white/92">Texto que vende melhor</h4>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <label className="block text-sm text-white/70">
            Resumo curto / chamada
            <input
              name="tagline"
              defaultValue={fields.tagline ?? ""}
              placeholder="Peca decorativa impressa em 3D com acabamento elegante."
              className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 outline-none focus:border-orange-400/60"
            />
          </label>
          <label className="block text-sm text-white/70">
            Cores disponiveis
            <input
              name="colorOptions"
              defaultValue={fields.colorOptions ?? ""}
              placeholder="Preto, Branco, Dourado"
              className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 outline-none focus:border-orange-400/60"
            />
          </label>
        </div>

        <label className="block text-sm text-white/70">
          Descricao completa
          <textarea
            name="description"
            rows={5}
            defaultValue={fields.description ?? ""}
            placeholder="Explique o item, o material, as aplicacoes, as possibilidades de cor e por que essa peca chama atencao."
            className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 outline-none focus:border-orange-400/60"
          />
        </label>
      </section>

      <section className="space-y-4 rounded-[24px] border border-white/10 bg-black/20 p-5">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-white/45">Midia</p>
          <h4 className="mt-2 text-lg font-semibold text-white/92">Imagem, video e galeria</h4>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <label className="block text-sm text-white/70">
            Imagem principal por URL
            <input
              name="imageUrl"
              defaultValue={fields.imageUrl ?? ""}
              placeholder="/uploads/minha-peca.jpg"
              className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 outline-none focus:border-orange-400/60"
            />
          </label>
          <label className="block text-sm text-white/70">
            Foto principal da galeria
            <input
              name="imageFile"
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif"
              className="mt-2 block w-full rounded-2xl border border-dashed border-white/15 bg-slate-950/70 px-4 py-3 text-white/70 file:mr-4 file:rounded-xl file:border-0 file:bg-orange-500 file:px-4 file:py-2 file:font-semibold file:text-slate-950"
            />
          </label>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <label className="block text-sm text-white/70">
            Video por URL (opcional)
            <input
              name="videoUrl"
              defaultValue={fields.videoUrl ?? ""}
              placeholder="/uploads/peca.mp4"
              className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 outline-none focus:border-orange-400/60"
            />
          </label>
          <label className="block text-sm text-white/70">
            Video da galeria (opcional)
            <input
              name="videoFile"
              type="file"
              accept="video/mp4,video/webm,video/quicktime,.mp4,.webm,.mov,.m4v"
              className="mt-2 block w-full rounded-2xl border border-dashed border-white/15 bg-slate-950/70 px-4 py-3 text-white/70 file:mr-4 file:rounded-xl file:border-0 file:bg-orange-500 file:px-4 file:py-2 file:font-semibold file:text-slate-950"
            />
          </label>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <label className="block text-sm text-white/70">
            URLs da galeria
            <textarea
              name="galleryImageUrls"
              rows={4}
              defaultValue={fields.galleryImageUrls ?? ""}
              placeholder={"/uploads/angulo-1.jpg\n/uploads/angulo-2.jpg"}
              className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 outline-none focus:border-orange-400/60"
            />
          </label>
          <label className="block text-sm text-white/70">
            Fotos extras da galeria
            <input
              name="galleryFiles"
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif"
              multiple
              className="mt-2 block w-full rounded-2xl border border-dashed border-white/15 bg-slate-950/70 px-4 py-3 text-white/70 file:mr-4 file:rounded-xl file:border-0 file:bg-orange-500 file:px-4 file:py-2 file:font-semibold file:text-slate-950"
            />
          </label>
        </div>

        <p className="text-sm text-white/50">
          O video e opcional. A foto enviada da galeria vira a imagem principal. Se enviar um video, ele aparece primeiro na vitrine. Nas URLs da galeria, use uma linha por imagem. Se houver erro em outro campo, o navegador pode pedir para selecionar arquivos novamente.
        </p>
      </section>

      <div className="grid gap-3 md:grid-cols-2">
        <label className="inline-flex items-center gap-3 rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3 text-sm text-white/75">
          <input
            type="checkbox"
            name="featured"
            defaultChecked={fields.featured === "true"}
            className="h-4 w-4 rounded border-white/20"
          />
          Destacar no topo da vitrine
        </label>

        <label className="inline-flex items-center gap-3 rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3 text-sm text-white/75">
          <input
            type="checkbox"
            name="active"
            defaultChecked={fields.active ? fields.active === "true" : true}
            className="h-4 w-4 rounded border-white/20"
          />
          Exibir na vitrine
        </label>
      </div>

      {state.error ? <p className="text-sm text-rose-300">{state.error}</p> : null}
      {state.message ? <p className="text-sm text-emerald-300">{state.message}</p> : null}

      <ShowcasePriceCalculator
        onApplyPrice={setPrice}
        materials={materials}
        fieldNames={{
          selectedMaterialId: "calculatorMaterialId",
          filamentPricePerKilo: "calculatorFilamentPricePerKilo",
          materialUsedGrams: "calculatorMaterialUsedGrams",
          printDurationHours: "calculatorPrintDurationHours",
          energyRate: "calculatorEnergyRate",
          printerPowerWatts: "calculatorPrinterPowerWatts",
          marginPercent: "calculatorMarginPercent",
        }}
        initialValues={{
          selectedMaterialId: fields.calculatorMaterialId ?? fields.materialId ?? "",
          filamentPricePerKilo: getOptionalNumber(fields.calculatorFilamentPricePerKilo),
          materialUsedGrams:
            getOptionalNumber(fields.calculatorMaterialUsedGrams) ??
            getOptionalNumber(fields.estimatedMaterialGrams),
          printDurationHours:
            getOptionalNumber(fields.calculatorPrintDurationHours) ??
            getOptionalNumber(fields.estimatedPrintHours),
          energyRate: getOptionalNumber(fields.calculatorEnergyRate) ?? 0.9,
          printerPowerWatts: getOptionalNumber(fields.calculatorPrinterPowerWatts) ?? 95,
          marginPercent: getOptionalNumber(fields.calculatorMarginPercent) ?? 10,
        }}
      />

      <SubmitButton
        label="Salvar item da vitrine"
        pendingLabel="Salvando item..."
        className="w-full bg-orange-500 text-slate-950 hover:bg-orange-400"
      />
    </form>
  );
}
