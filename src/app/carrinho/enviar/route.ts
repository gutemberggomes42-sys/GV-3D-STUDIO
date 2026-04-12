import { revalidatePath } from "next/cache";
import { NextRequest, NextResponse } from "next/server";
import { ownerEmail, ownerWhatsAppNumber } from "@/lib/constants";
import { ensureCustomerRecord, isGeneratedCustomerEmail } from "@/lib/customer-records";
import {
  estimateFreightCost,
  getAvailableDeliveryModes,
  getSuggestedCarrier,
  normalizeStateCode,
  sanitizePostalCode,
} from "@/lib/shipping";
import { isShowcaseItemVisible } from "@/lib/showcase";
import { createId, updateDb } from "@/lib/store";
import type { ShowcaseCartEntry } from "@/lib/showcase-cart";

function sanitizePhone(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function sanitizeField(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function parseCartPayload(value: string) {
  try {
    const parsed = JSON.parse(value);

    if (!Array.isArray(parsed)) {
      return [] as ShowcaseCartEntry[];
    }

    return parsed.flatMap((entry) => {
      if (!entry || typeof entry !== "object") {
        return [];
      }

      const itemId = sanitizeField(String(entry.itemId ?? ""));
      const quantity = Number(entry.quantity ?? 1);

      if (!itemId || !Number.isFinite(quantity) || quantity <= 0) {
        return [];
      }

      return [
        {
          key: sanitizeField(String(entry.key ?? `${itemId}-${quantity}`)),
          itemId,
          quantity: Math.max(1, Math.min(999, Math.round(quantity))),
          selectedVariantId: sanitizeField(String(entry.selectedVariantId ?? "")) || undefined,
          desiredColor: sanitizeField(String(entry.desiredColor ?? "")) || undefined,
          desiredSize: sanitizeField(String(entry.desiredSize ?? "")) || undefined,
          desiredFinish: sanitizeField(String(entry.desiredFinish ?? "")) || undefined,
          couponCode: sanitizeField(String(entry.couponCode ?? "")) || undefined,
        } satisfies ShowcaseCartEntry,
      ];
    });
  } catch {
    return [] as ShowcaseCartEntry[];
  }
}

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const customerName = sanitizeField(String(formData.get("customerName") ?? ""));
  const customerPhone = sanitizePhone(String(formData.get("customerPhone") ?? ""));
  const notes = sanitizeField(String(formData.get("notes") ?? ""));
  const deliveryMode = sanitizeField(String(formData.get("deliveryMode") ?? "PICKUP"));
  const deliveryPostalCode = sanitizePostalCode(String(formData.get("deliveryPostalCode") ?? ""));
  const deliveryAddress = sanitizeField(String(formData.get("deliveryAddress") ?? ""));
  const deliveryNeighborhood = sanitizeField(String(formData.get("deliveryNeighborhood") ?? ""));
  const deliveryCity = sanitizeField(String(formData.get("deliveryCity") ?? ""));
  const deliveryState = normalizeStateCode(String(formData.get("deliveryState") ?? ""));
  const cartEntries = parseCartPayload(String(formData.get("cartJson") ?? "[]"));

  if (cartEntries.length === 0) {
    return NextResponse.json(
      { ok: false, message: "Seu carrinho esta vazio." },
      { status: 400 },
    );
  }

  if (customerName.length < 2) {
    return NextResponse.json(
      { ok: false, message: "Informe o nome para continuar." },
      { status: 400 },
    );
  }

  if (customerPhone.length < 8) {
    return NextResponse.json(
      { ok: false, message: "Informe um telefone ou WhatsApp valido." },
      { status: 400 },
    );
  }

  try {
    const result = await updateDb(async (db) => {
      const now = new Date().toISOString();
      const customer = await ensureCustomerRecord(db, {
        name: customerName,
        phone: customerPhone,
      });

      const reservedByItem = new Map<string, number>();
      const normalizedEntries = cartEntries.map((entry, index) => {
        const item = db.showcaseItems.find(
          (candidate) => candidate.id === entry.itemId && isShowcaseItemVisible(candidate),
        );

        if (!item) {
          throw new Error("Um dos produtos do carrinho nao esta mais disponivel na vitrine.");
        }

        const selectedVariant = item.variants.find(
          (variant) => variant.id === entry.selectedVariantId && variant.active,
        );

        const variantStock = selectedVariant?.stockQuantity;
        const availableForEntry =
          item.fulfillmentType === "STOCK"
            ? variantStock == null
              ? item.stockQuantity
              : Math.min(item.stockQuantity, variantStock)
            : 999;

        const reservedBefore = reservedByItem.get(item.id) ?? 0;
        const remainingStock = item.fulfillmentType === "STOCK"
          ? Math.max(availableForEntry - reservedBefore, 0)
          : 999;

        if (item.fulfillmentType === "STOCK" && remainingStock <= 0) {
          throw new Error(`O item "${item.name}" esta sem estoque no momento.`);
        }

        if (item.fulfillmentType === "STOCK" && entry.quantity > remainingStock) {
          throw new Error(`Ajuste a quantidade de "${item.name}". Estoque disponivel: ${remainingStock}.`);
        }

        const unitPrice = item.price + (selectedVariant?.priceAdjustment ?? 0);
        const couponDiscount =
          entry.couponCode &&
          item.couponCode &&
          entry.couponCode.toLowerCase() === item.couponCode.toLowerCase()
            ? item.couponDiscountPercent ?? 0
            : 0;
        const estimatedTotal = unitPrice * entry.quantity * (1 - couponDiscount / 100);

        reservedByItem.set(item.id, reservedBefore + entry.quantity);

        return {
          index,
          entry,
          item,
          selectedVariant,
          unitPrice,
          couponDiscount,
          estimatedTotal,
        };
      });

      const grandTotal = normalizedEntries.reduce(
        (sum, currentEntry) => sum + currentEntry.estimatedTotal,
        0,
      );
      const totalMaterialGrams = normalizedEntries.reduce(
        (sum, currentEntry) => sum + (currentEntry.item.estimatedMaterialGrams ?? 0) * currentEntry.entry.quantity,
        0,
      );
      const totalPrintHours = normalizedEntries.reduce(
        (sum, currentEntry) => sum + (currentEntry.item.estimatedPrintHours ?? 0) * currentEntry.entry.quantity,
        0,
      );

      if (!["PICKUP", "LOCAL_DELIVERY", "SHIPPING"].includes(deliveryMode)) {
        throw new Error("Escolha uma forma de entrega valida.");
      }

      if (
        normalizedEntries.some(
          (currentEntry) =>
            !getAvailableDeliveryModes(currentEntry.item).includes(
              deliveryMode as "PICKUP" | "LOCAL_DELIVERY" | "SHIPPING",
            ),
        )
      ) {
        throw new Error("Um dos produtos do carrinho não aceita essa forma de entrega.");
      }

      if (deliveryMode !== "PICKUP" && (!deliveryAddress || !deliveryCity)) {
        throw new Error("Informe endereco e cidade para calcular a entrega do carrinho.");
      }

      if (deliveryMode === "SHIPPING" && (!deliveryPostalCode || !deliveryState)) {
        throw new Error("Para envio, informe CEP e UF.");
      }

      const freight = estimateFreightCost({
        deliveryMode: deliveryMode as "PICKUP" | "LOCAL_DELIVERY" | "SHIPPING",
        quantity: normalizedEntries.reduce((sum, currentEntry) => sum + currentEntry.entry.quantity, 0),
        estimatedMaterialGrams: totalMaterialGrams,
        estimatedPrintHours: totalPrintHours,
        postalCode: deliveryPostalCode,
        city: deliveryCity,
        state: deliveryState,
      });
      const messageLines = [
        "Olá! Quero escolher estes itens da biblioteca.",
        "",
        "Itens do carrinho:",
        ...normalizedEntries.flatMap((currentEntry) => [
          `${currentEntry.index + 1}. ${currentEntry.item.name}`,
          `Quantidade: ${currentEntry.entry.quantity}`,
          `Disponibilidade: ${currentEntry.item.fulfillmentType === "MADE_TO_ORDER" ? "Sob encomenda" : "Pronta entrega"}`,
          currentEntry.selectedVariant ? `Variacao: ${currentEntry.selectedVariant.label}` : null,
          currentEntry.entry.desiredColor ? `Cor desejada: ${currentEntry.entry.desiredColor}` : null,
          currentEntry.entry.desiredSize ? `Tamanho desejado: ${currentEntry.entry.desiredSize}` : null,
          currentEntry.entry.desiredFinish ? `Acabamento: ${currentEntry.entry.desiredFinish}` : null,
          currentEntry.couponDiscount ? `Cupom aplicado: ${currentEntry.entry.couponCode}` : null,
          "",
        ]),
        `Forma de entrega: ${deliveryMode === "PICKUP" ? "Retirada" : deliveryMode === "LOCAL_DELIVERY" ? "Entrega local" : "Envio"}`,
        `Frete: ${freight.label}`,
        deliveryAddress ? `Endereco: ${deliveryAddress}` : null,
        deliveryNeighborhood ? `Bairro: ${deliveryNeighborhood}` : null,
        deliveryCity ? `Cidade: ${deliveryCity}` : null,
        deliveryState ? `UF: ${deliveryState}` : null,
        deliveryPostalCode ? `CEP: ${deliveryPostalCode}` : null,
        `Cliente: ${customerName}`,
        `Telefone: ${customerPhone}`,
        ...(notes ? [`Observacao geral: ${notes}`] : []),
      ].filter(Boolean);

      const whatsappUrl = `https://api.whatsapp.com/send?phone=${ownerWhatsAppNumber}&text=${encodeURIComponent(messageLines.join("\n"))}`;

      normalizedEntries.forEach((currentEntry) => {
        const freightShare =
          grandTotal > 0
            ? Number(((freight.amount * currentEntry.estimatedTotal) / grandTotal).toFixed(2))
            : Number((freight.amount / normalizedEntries.length).toFixed(2));
        currentEntry.item.whatsappClickCount += 1;
        currentEntry.item.updatedAt = now;

        db.showcaseInquiries.unshift({
          id: createId("ldw"),
          itemId: currentEntry.item.id,
          itemName: currentEntry.item.name,
          quantity: currentEntry.entry.quantity,
          customerId: customer.id,
          customerName,
          customerEmail: isGeneratedCustomerEmail(customer.email) ? "" : customer.email,
          customerPhone,
          source: "CATALOG",
          notes: notes || undefined,
          ownerEmail,
          whatsappNumber: ownerWhatsAppNumber,
          whatsappUrl,
          estimatedTotal: currentEntry.estimatedTotal,
          deliveryMode: deliveryMode as "PICKUP" | "LOCAL_DELIVERY" | "SHIPPING",
          freightEstimate: freightShare,
          deliveryPostalCode: deliveryPostalCode || undefined,
          deliveryAddress: deliveryAddress || undefined,
          deliveryNeighborhood: deliveryNeighborhood || undefined,
          deliveryCity: deliveryCity || undefined,
          deliveryState: deliveryState || undefined,
          shippingCarrier: getSuggestedCarrier(deliveryMode as "PICKUP" | "LOCAL_DELIVERY" | "SHIPPING"),
          selectedVariantLabel: currentEntry.selectedVariant?.label,
          desiredColor: currentEntry.entry.desiredColor,
          desiredSize: currentEntry.entry.desiredSize,
          desiredFinish: currentEntry.entry.desiredFinish,
          couponCode: currentEntry.couponDiscount ? currentEntry.entry.couponCode : undefined,
          status: "PENDING",
          tags: ["Carrinho"],
          leadTemperature: normalizedEntries.length >= 2 ? "HOT" : "WARM",
          followUpAt: undefined,
          lastContactAt: undefined,
          createdAt: now,
          updatedAt: now,
        });
      });

      return {
        whatsappUrl,
      };
    });

    revalidatePath("/");
    revalidatePath("/portal");
    revalidatePath("/carrinho");
    revalidatePath("/admin");

    return NextResponse.json({
      ok: true,
      url: result.whatsappUrl,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        message:
          error instanceof Error
            ? error.message
            : "Nao foi possivel enviar o carrinho para o WhatsApp.",
      },
      { status: 400 },
    );
  }
}
