import { updateShowcaseInquiryShippingAction } from "@/lib/actions";
import type { DbShowcaseInquiry } from "@/lib/db-types";
import { formatCurrency } from "@/lib/format";
import { buildDeliveryAddressSummary, deliveryModeLabels } from "@/lib/shipping";
import { SubmitButton } from "@/components/submit-button";

type ShowcaseDeliveryManagerProps = {
  inquiry: DbShowcaseInquiry;
  compact?: boolean;
};

const deliveryModeOptions = ["PICKUP", "LOCAL_DELIVERY", "SHIPPING"] as const;

export function ShowcaseDeliveryManager({
  inquiry,
  compact = false,
}: ShowcaseDeliveryManagerProps) {
  const currentDeliveryMode = inquiry.deliveryMode ?? "PICKUP";
  const labelUrl = `/documentos/${inquiry.id}?kind=showcase&type=label`;
  const proofUrl = `/documentos/${inquiry.id}?kind=showcase&type=proof`;
  const historyUrl = `/documentos/${inquiry.id}?kind=showcase&type=history`;

  return (
    <div className="rounded-[22px] border border-white/10 bg-black/20 p-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-white/45">Entrega e frete</p>
          <p className="mt-2 text-sm leading-6 text-white/60">
            Calcule o envio, salve o endereço e mantenha rastreio e comprovante no mesmo pedido.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <a
            href={labelUrl}
            target="_blank"
            rel="noreferrer"
            className="rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/80 transition hover:bg-white/10 hover:text-white"
          >
            Etiqueta
          </a>
          <a
            href={proofUrl}
            target="_blank"
            rel="noreferrer"
            className="rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/80 transition hover:bg-white/10 hover:text-white"
          >
            Comprovante
          </a>
          <a
            href={historyUrl}
            target="_blank"
            rel="noreferrer"
            className="rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/80 transition hover:bg-white/10 hover:text-white"
          >
            Histórico
          </a>
        </div>
      </div>

      <div className={`mt-4 grid gap-3 ${compact ? "md:grid-cols-3" : "md:grid-cols-4"}`}>
        <div className="rounded-2xl border border-white/10 bg-slate-950/55 px-4 py-3">
          <p className="text-[11px] uppercase tracking-[0.18em] text-white/45">Forma</p>
          <p className="mt-2 text-sm font-semibold text-white">{deliveryModeLabels[currentDeliveryMode]}</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-slate-950/55 px-4 py-3">
          <p className="text-[11px] uppercase tracking-[0.18em] text-white/45">Frete</p>
          <p className="mt-2 text-sm font-semibold text-white">{formatCurrency(inquiry.freightEstimate ?? 0)}</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-slate-950/55 px-4 py-3">
          <p className="text-[11px] uppercase tracking-[0.18em] text-white/45">Rastreio</p>
          <p className="mt-2 text-sm font-semibold text-white">{inquiry.trackingCode ?? "Ainda não definido"}</p>
        </div>
        {!compact ? (
          <div className="rounded-2xl border border-white/10 bg-slate-950/55 px-4 py-3">
            <p className="text-[11px] uppercase tracking-[0.18em] text-white/45">Entrega</p>
            <p className="mt-2 text-sm font-semibold text-white">
              {inquiry.deliveredAt ? "Comprovada" : inquiry.shippedAt ? "Em trânsito" : "Pendente"}
            </p>
          </div>
        ) : null}
      </div>

      <p className="mt-4 text-sm text-white/60">
        {buildDeliveryAddressSummary(inquiry)}
      </p>

      <form action={updateShowcaseInquiryShippingAction} className="mt-4 space-y-4">
        <input type="hidden" name="inquiryId" value={inquiry.id} />

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          <label className="block text-sm text-white/70">
            Forma de entrega
            <select
              name="deliveryMode"
              defaultValue={currentDeliveryMode}
              className="mt-2 w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 outline-none focus:border-orange-400/60"
            >
              {deliveryModeOptions.map((mode) => (
                <option key={mode} value={mode}>
                  {deliveryModeLabels[mode]}
                </option>
              ))}
            </select>
          </label>

          <label className="block text-sm text-white/70">
            CEP
            <input
              name="deliveryPostalCode"
              defaultValue={inquiry.deliveryPostalCode ?? ""}
              placeholder="75900-000"
              className="mt-2 w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 outline-none focus:border-orange-400/60"
            />
          </label>

          <label className="block text-sm text-white/70">
            Transportadora / entrega
            <input
              name="shippingCarrier"
              defaultValue={inquiry.shippingCarrier ?? ""}
              placeholder="Correios, entrega local, retirada..."
              className="mt-2 w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 outline-none focus:border-orange-400/60"
            />
          </label>

          <label className="block text-sm text-white/70 md:col-span-2 xl:col-span-3">
            Endereço
            <input
              name="deliveryAddress"
              defaultValue={inquiry.deliveryAddress ?? ""}
              placeholder="Rua, número, complemento"
              className="mt-2 w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 outline-none focus:border-orange-400/60"
            />
          </label>

          <label className="block text-sm text-white/70">
            Bairro
            <input
              name="deliveryNeighborhood"
              defaultValue={inquiry.deliveryNeighborhood ?? ""}
              className="mt-2 w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 outline-none focus:border-orange-400/60"
            />
          </label>

          <label className="block text-sm text-white/70">
            Cidade
            <input
              name="deliveryCity"
              defaultValue={inquiry.deliveryCity ?? ""}
              className="mt-2 w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 outline-none focus:border-orange-400/60"
            />
          </label>

          <label className="block text-sm text-white/70">
            UF
            <input
              name="deliveryState"
              defaultValue={inquiry.deliveryState ?? ""}
              maxLength={2}
              className="mt-2 w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 uppercase outline-none focus:border-orange-400/60"
            />
          </label>

          <label className="block text-sm text-white/70">
            Código de rastreio
            <input
              name="trackingCode"
              defaultValue={inquiry.trackingCode ?? ""}
              placeholder="TRK123..."
              className="mt-2 w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 outline-none focus:border-orange-400/60"
            />
          </label>

          <label className="block text-sm text-white/70">
            Recebedor
            <input
              name="deliveryRecipient"
              defaultValue={inquiry.deliveryRecipient ?? inquiry.customerName}
              className="mt-2 w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 outline-none focus:border-orange-400/60"
            />
          </label>
        </div>

        <label className="block text-sm text-white/70">
          Comprovante / observações da entrega
          <textarea
            name="proofOfDeliveryNotes"
            rows={compact ? 3 : 4}
            defaultValue={inquiry.proofOfDeliveryNotes ?? ""}
            placeholder="Ex.: entregue para João na portaria, retirada confirmada, caixa sem avarias..."
            className="mt-2 w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 outline-none focus:border-orange-400/60"
          />
        </label>

        <SubmitButton
          label="Salvar entrega e frete"
          pendingLabel="Salvando entrega..."
          className="w-full bg-orange-500 text-slate-950 hover:bg-orange-400 md:w-auto"
        />
      </form>
    </div>
  );
}
