"use client";

import { useActionState, useState } from "react";
import { ShowcasePriceCalculator } from "@/components/showcase-price-calculator";
import { SubmitButton } from "@/components/submit-button";
import { createShowcaseItemAction, type ActionState } from "@/lib/actions";
import type { DbMaterial } from "@/lib/db-types";
import {
  showcaseBadgeSuggestions,
  showcaseCategorySuggestions,
} from "@/lib/showcase";

const initialState: ActionState = { ok: false };

type ShowcaseItemFormProps = {
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

function parseDeliveryModes(value?: string) {
  return new Set(
    (value ?? "")
      .split(",")
      .map((entry) => entry.trim())
      .filter(Boolean),
  );
}

export function ShowcaseItemForm({ materials }: ShowcaseItemFormProps) {
  const [state, formAction] = useActionState(createShowcaseItemAction, initialState);
  const formKey = JSON.stringify(state.fields ?? {});

  return <ShowcaseItemFormContent key={formKey} state={state} formAction={formAction} materials={materials} />;
}

type ShowcaseItemFormContentProps = {
  state: ActionState;
  formAction: (payload: FormData) => void;
  materials: DbMaterial[];
};

function ShowcaseItemFormContent({
  state,
  formAction,
  materials,
}: ShowcaseItemFormContentProps) {
  const fields = state.fields ?? {};
  const [price, setPrice] = useState(fields.price ?? "");
  const [estimatedPrintHours, setEstimatedPrintHours] = useState(fields.estimatedPrintHours ?? "1");
  const [fulfillmentType, setFulfillmentType] = useState<"STOCK" | "MADE_TO_ORDER">(
    fields.fulfillmentType === "MADE_TO_ORDER" ? "MADE_TO_ORDER" : "STOCK",
  );
  const managesStock = fulfillmentType === "STOCK";
  const selectedDeliveryModes = parseDeliveryModes(fields.deliveryModes);
  const initialCalculatorMaterials = parseCalculatorMaterialsJson(fields.calculatorMaterialsJson);
  const calculatorMaterialEntries =
    initialCalculatorMaterials.length > 0
      ? initialCalculatorMaterials
      : [
          {
            materialId: fields.calculatorMaterialId ?? fields.materialId ?? "",
            pricePerKilo: getOptionalNumber(fields.calculatorFilamentPricePerKilo),
            gramsUsed:
              getOptionalNumber(fields.calculatorMaterialUsedGrams) ??
              getOptionalNumber(fields.estimatedMaterialGrams),
          },
        ];
  const [estimatedMaterialGrams, setEstimatedMaterialGrams] = useState(
    fields.estimatedMaterialGrams ??
      (
        calculatorMaterialEntries.reduce((total, entry) => total + (entry.gramsUsed ?? 0), 0) || 0
      ).toFixed(2),
  );

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
          Cadastre fotos, vídeo, variações, promoção, entrega, SEO e tudo o que ajuda a peça a vender melhor.
        </p>
      </div>

      <datalist id="showcase-category-options">
        {showcaseCategorySuggestions.map((category) => (
          <option key={category} value={category} />
        ))}
      </datalist>

      <datalist id="showcase-badge-options">
        {showcaseBadgeSuggestions.map((badge) => (
          <option key={badge} value={badge} />
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
            <input name="name" defaultValue={fields.name ?? ""} placeholder="Fidget Ovo de Dragao" className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 outline-none focus:border-orange-400/60" />
          </label>
          <label className="block text-sm text-white/70">
            Categoria
            <input name="category" list="showcase-category-options" defaultValue={fields.category ?? ""} placeholder="Geek" className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 outline-none focus:border-orange-400/60" />
          </label>
          <label className="block text-sm text-white/70">
            Valor (R$)
            <input name="price" value={price} onChange={(event) => setPrice(event.target.value)} type="number" step="0.01" min="0.01" placeholder="39.90" className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 outline-none focus:border-orange-400/60" />
          </label>
          <label className="block text-sm text-white/70">
            Tempo de impressão (h)
            <input name="estimatedPrintHours" value={estimatedPrintHours} onChange={(event) => setEstimatedPrintHours(event.target.value)} type="number" step="0.1" min="0.1" className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 outline-none focus:border-orange-400/60" />
          </label>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <label className="block text-sm text-white/70">
            Modalidade
            <select name="fulfillmentType" value={fulfillmentType} onChange={(event) => setFulfillmentType(event.target.value as "STOCK" | "MADE_TO_ORDER")} className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 outline-none focus:border-orange-400/60">
              <option value="STOCK">Pronta entrega</option>
              <option value="MADE_TO_ORDER">Sob encomenda</option>
            </select>
          </label>

          {managesStock ? (
            <label className="block text-sm text-white/70">
              Estoque disponivel
              <input name="stockQuantity" type="number" min="0" step="1" defaultValue={fields.stockQuantity ?? "0"} className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 outline-none focus:border-orange-400/60" />
            </label>
          ) : (
            <>
              <input type="hidden" name="stockQuantity" value="0" />
              <label className="block text-sm text-white/70">
                Prazo estimado (dias uteis)
                <input name="leadTimeDays" type="number" min="1" step="1" defaultValue={fields.leadTimeDays ?? "7"} className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 outline-none focus:border-orange-400/60" />
              </label>
            </>
          )}

          {managesStock ? <input type="hidden" name="leadTimeDays" value="0" /> : null}

          <label className="block text-sm text-white/70">
            Material principal
            <input name="materialLabel" defaultValue={fields.materialLabel ?? ""} placeholder="PLA Premium" className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 outline-none focus:border-orange-400/60" />
          </label>

          <label className="block text-sm text-white/70">
            Medidas
            <input name="dimensionSummary" defaultValue={fields.dimensionSummary ?? ""} placeholder="18 x 12 x 8 cm" className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 outline-none focus:border-orange-400/60" />
          </label>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <label className="block text-sm text-white/70">
            Filamento / material vinculado
            <select name="materialId" defaultValue={fields.materialId ?? ""} className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 outline-none focus:border-orange-400/60">
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
            <input name="estimatedMaterialGrams" value={estimatedMaterialGrams} onChange={(event) => setEstimatedMaterialGrams(event.target.value)} type="number" min="0" step="0.01" className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 outline-none focus:border-orange-400/60" />
          </label>

          <div className="rounded-2xl border border-white/10 bg-slate-950/50 px-4 py-3 text-sm text-white/60">
            Ao vincular material e consumo estimado, o sistema já consegue calcular custo real e baixar o filamento automaticamente quando o pedido entrar em impressão.
          </div>
        </div>

        <label className="block text-sm text-white/70">
          Checklist de produção
          <textarea
            name="productionChecklist"
            rows={4}
            defaultValue={fields.productionChecklist ?? ""}
            placeholder="Ex.: confirmar cor, limpar mesa, conferir suporte, lixar base, embalar com etiqueta..."
            className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 outline-none focus:border-orange-400/60"
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
          printDurationHours: getOptionalNumber(fields.calculatorPrintDurationHours ?? estimatedPrintHours),
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

      <section className="space-y-4 rounded-[24px] border border-white/10 bg-black/20 p-5">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-white/45">Oferta e venda</p>
          <h4 className="mt-2 text-lg font-semibold text-white/92">Promoções, selos e entrega</h4>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <label className="block text-sm text-white/70">
            Preço de comparação
            <input name="compareAtPrice" type="number" step="0.01" min="0" defaultValue={fields.compareAtPrice ?? ""} placeholder="49.90" className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 outline-none focus:border-orange-400/60" />
          </label>
          <label className="block text-sm text-white/70">
            Faixa promocional
            <input name="promotionLabel" defaultValue={fields.promotionLabel ?? ""} placeholder="Oferta da semana" className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 outline-none focus:border-orange-400/60" />
          </label>
          <label className="block text-sm text-white/70">
            Cupom
            <input name="couponCode" defaultValue={fields.couponCode ?? ""} placeholder="GUTO10" className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 outline-none focus:border-orange-400/60" />
          </label>
          <label className="block text-sm text-white/70">
            Desconto do cupom (%)
            <input name="couponDiscountPercent" type="number" min="0" max="100" step="1" defaultValue={fields.couponDiscountPercent ?? ""} placeholder="10" className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 outline-none focus:border-orange-400/60" />
          </label>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <label className="block text-sm text-white/70">
            Selos do produto
            <textarea name="badges" rows={3} defaultValue={fields.badges ?? ""} placeholder={"Novo\nMais vendido\nExclusivo"} className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 outline-none focus:border-orange-400/60" />
          </label>
          <label className="block text-sm text-white/70">
            Resumo de entrega
            <textarea name="shippingSummary" rows={3} defaultValue={fields.shippingSummary ?? ""} placeholder="Retirada em Rio Verde, entrega local e envio sob consulta." className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 outline-none focus:border-orange-400/60" />
          </label>
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          {[
            { value: "PICKUP", label: "Retirada" },
            { value: "LOCAL_DELIVERY", label: "Entrega local" },
            { value: "SHIPPING", label: "Envio" },
          ].map((option) => (
            <label key={option.value} className="inline-flex items-center gap-3 rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3 text-sm text-white/75">
              <input type="checkbox" name="deliveryModes" value={option.value} defaultChecked={selectedDeliveryModes.size ? selectedDeliveryModes.has(option.value) : option.value !== "LOCAL_DELIVERY"} className="h-4 w-4 rounded border-white/20" />
              {option.label}
            </label>
          ))}
        </div>
      </section>

      <section className="space-y-4 rounded-[24px] border border-white/10 bg-black/20 p-5">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-white/45">Variacoes</p>
          <h4 className="mt-2 text-lg font-semibold text-white/92">Cores, tamanhos, acabamentos e variantes</h4>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <label className="block text-sm text-white/70">
            Cores disponiveis
            <textarea name="colorOptions" rows={3} defaultValue={fields.colorOptions ?? ""} placeholder={"Preto\nBranco\nDourado"} className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 outline-none focus:border-orange-400/60" />
          </label>
          <label className="block text-sm text-white/70">
            Tamanhos disponiveis
            <textarea name="sizeOptions" rows={3} defaultValue={fields.sizeOptions ?? ""} placeholder={"Pequeno\nMedio\nGrande"} className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 outline-none focus:border-orange-400/60" />
          </label>
          <label className="block text-sm text-white/70">
            Acabamentos
            <textarea name="finishOptions" rows={3} defaultValue={fields.finishOptions ?? ""} placeholder={"Fosco\nBrilhante\nPintado"} className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 outline-none focus:border-orange-400/60" />
          </label>
        </div>

        <label className="block text-sm text-white/70">
          Variantes detalhadas
          <textarea
            name="variantsText"
            rows={5}
            defaultValue={fields.variantsText ?? ""}
            placeholder={"Ovo Azul | Azul | Medio | Fosco | 0 | 2 | /uploads/ovo-azul-1.jpg, /uploads/ovo-azul-2.jpg\nOvo Dourado | Dourado | Grande | Pintado | 8 | 1 | /uploads/ovo-dourado.jpg"}
            className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 outline-none focus:border-orange-400/60"
          />
        </label>
        <p className="text-sm text-white/50">
          Use uma linha por variante no formato: Nome | Cor | Tamanho | Acabamento | Ajuste de preço | Estoque | URLs da galeria separadas por vírgula.
        </p>
      </section>

      <section className="space-y-4 rounded-[24px] border border-white/10 bg-black/20 p-5">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-white/45">Apresentacao</p>
          <h4 className="mt-2 text-lg font-semibold text-white/92">Texto que vende melhor</h4>
        </div>

        <label className="block text-sm text-white/70">
          Resumo curto / chamada
          <input name="tagline" defaultValue={fields.tagline ?? ""} placeholder="Peca decorativa impressa em 3D com acabamento elegante." className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 outline-none focus:border-orange-400/60" />
        </label>

        <label className="block text-sm text-white/70">
          Descricao completa
          <textarea name="description" rows={5} defaultValue={fields.description ?? ""} placeholder="Explique o item, o material, as aplicacoes, as possibilidades de cor e por que essa peca chama atencao." className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 outline-none focus:border-orange-400/60" />
        </label>
      </section>

      <section className="space-y-4 rounded-[24px] border border-white/10 bg-black/20 p-5">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-white/45">SEO</p>
          <h4 className="mt-2 text-lg font-semibold text-white/92">Google e compartilhamento</h4>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <label className="block text-sm text-white/70">
            Título SEO do produto
            <input name="seoTitle" defaultValue={fields.seoTitle ?? ""} placeholder="Nome do produto | GV 3D Studio" className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 outline-none focus:border-orange-400/60" />
          </label>
          <label className="block text-sm text-white/70">
            Descrição SEO do produto
            <input name="seoDescription" defaultValue={fields.seoDescription ?? ""} placeholder="Resumo do produto para Google e compartilhamento" className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 outline-none focus:border-orange-400/60" />
          </label>
        </div>

        <label className="block text-sm text-white/70">
          Palavras-chave SEO
          <textarea name="seoKeywords" rows={3} defaultValue={fields.seoKeywords ?? ""} placeholder={"decoracao geek\npresente criativo\nimpressao 3d"} className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 outline-none focus:border-orange-400/60" />
        </label>
      </section>

      <section className="space-y-4 rounded-[24px] border border-white/10 bg-black/20 p-5">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-white/45">Midia</p>
          <h4 className="mt-2 text-lg font-semibold text-white/92">Imagem, video e galeria</h4>
          <p className="mt-2 text-sm text-white/55">
            O video e opcional e serve apenas como adicional para destacar o produto.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <label className="block text-sm text-white/70">
            Imagem principal por URL
            <input name="imageUrl" defaultValue={fields.imageUrl ?? ""} placeholder="/uploads/minha-peca.jpg" className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 outline-none focus:border-orange-400/60" />
          </label>
          <label className="block text-sm text-white/70">
            Foto principal da galeria
            <input name="imageFile" type="file" accept="image/png,image/jpeg,image/webp,image/gif" className="mt-2 block w-full rounded-2xl border border-dashed border-white/15 bg-slate-950/70 px-4 py-3 text-white/70 file:mr-4 file:rounded-xl file:border-0 file:bg-orange-500 file:px-4 file:py-2 file:font-semibold file:text-slate-950" />
          </label>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <label className="block text-sm text-white/70">
            Video por URL (opcional)
            <input name="videoUrl" defaultValue={fields.videoUrl ?? ""} placeholder="/uploads/peca.mp4" className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 outline-none focus:border-orange-400/60" />
          </label>
          <label className="block text-sm text-white/70">
            Video da galeria (opcional)
            <input name="videoFile" type="file" accept="video/mp4,video/webm,video/quicktime,.mp4,.webm,.mov,.m4v" className="mt-2 block w-full rounded-2xl border border-dashed border-white/15 bg-slate-950/70 px-4 py-3 text-white/70 file:mr-4 file:rounded-xl file:border-0 file:bg-orange-500 file:px-4 file:py-2 file:font-semibold file:text-slate-950" />
          </label>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <label className="block text-sm text-white/70">
            URLs da galeria
            <textarea name="galleryImageUrls" rows={4} defaultValue={fields.galleryImageUrls ?? ""} placeholder={"/uploads/angulo-1.jpg\n/uploads/angulo-2.jpg"} className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 outline-none focus:border-orange-400/60" />
          </label>
          <label className="block text-sm text-white/70">
            Fotos extras da galeria
            <input name="galleryFiles" type="file" accept="image/png,image/jpeg,image/webp,image/gif" multiple className="mt-2 block w-full rounded-2xl border border-dashed border-white/15 bg-slate-950/70 px-4 py-3 text-white/70 file:mr-4 file:rounded-xl file:border-0 file:bg-orange-500 file:px-4 file:py-2 file:font-semibold file:text-slate-950" />
          </label>
        </div>
      </section>

      <div className="grid gap-3 md:grid-cols-2">
        <label className="inline-flex items-center gap-3 rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3 text-sm text-white/75">
          <input type="checkbox" name="featured" defaultChecked={fields.featured === "true"} className="h-4 w-4 rounded border-white/20" />
          Destacar no topo da vitrine
        </label>

        <label className="inline-flex items-center gap-3 rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3 text-sm text-white/75">
          <input type="checkbox" name="active" defaultChecked={fields.active !== "false"} className="h-4 w-4 rounded border-white/20" />
          Exibir na vitrine
        </label>
      </div>

      {state.error ? <p className="text-sm text-rose-300">{state.error}</p> : null}
      {state.message ? <p className="text-sm text-emerald-300">{state.message}</p> : null}

      <SubmitButton
        label="Salvar produto da vitrine"
        pendingLabel="Salvando produto..."
        className="w-full bg-orange-500 text-slate-950 hover:bg-orange-400"
      />
    </form>
  );
}
