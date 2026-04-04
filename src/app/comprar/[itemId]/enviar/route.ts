import { revalidatePath } from "next/cache";
import { NextRequest, NextResponse } from "next/server";
import { ownerEmail, ownerWhatsAppNumber } from "@/lib/constants";
import { ensureCustomerRecord, isGeneratedCustomerEmail } from "@/lib/customer-records";
import { estimateFreightCost, getAvailableDeliveryModes, normalizeStateCode, sanitizePostalCode } from "@/lib/shipping";
import { createId, updateDb } from "@/lib/store";

function parseQuantity(value: FormDataEntryValue | null) {
  const parsed = Number(value?.toString() ?? "1");

  if (!Number.isFinite(parsed)) {
    return 1;
  }

  return Math.max(1, Math.min(999, Math.round(parsed)));
}

function sanitizePhone(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function sanitizeNotes(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function sanitizeField(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function buildBuyPageRedirect(
  request: NextRequest,
  itemId: string,
  quantity: number,
  message: string,
  notes?: string,
  options?: {
    selectedVariantId?: string;
    desiredColor?: string;
    desiredSize?: string;
    desiredFinish?: string;
    couponCode?: string;
    deliveryMode?: string;
    deliveryPostalCode?: string;
    deliveryAddress?: string;
    deliveryNeighborhood?: string;
    deliveryCity?: string;
    deliveryState?: string;
  },
) {
  const url = new URL(`/comprar/${itemId}`, request.url);
  url.searchParams.set("quantity", String(quantity));
  url.searchParams.set("message", message);
  if (notes) {
    url.searchParams.set("notes", notes);
  }
  if (options?.selectedVariantId) {
    url.searchParams.set("selectedVariantId", options.selectedVariantId);
  }
  if (options?.desiredColor) {
    url.searchParams.set("desiredColor", options.desiredColor);
  }
  if (options?.desiredSize) {
    url.searchParams.set("desiredSize", options.desiredSize);
  }
  if (options?.desiredFinish) {
    url.searchParams.set("desiredFinish", options.desiredFinish);
  }
  if (options?.couponCode) {
    url.searchParams.set("couponCode", options.couponCode);
  }
  if (options?.deliveryMode) {
    url.searchParams.set("deliveryMode", options.deliveryMode);
  }
  if (options?.deliveryPostalCode) {
    url.searchParams.set("deliveryPostalCode", options.deliveryPostalCode);
  }
  if (options?.deliveryAddress) {
    url.searchParams.set("deliveryAddress", options.deliveryAddress);
  }
  if (options?.deliveryNeighborhood) {
    url.searchParams.set("deliveryNeighborhood", options.deliveryNeighborhood);
  }
  if (options?.deliveryCity) {
    url.searchParams.set("deliveryCity", options.deliveryCity);
  }
  if (options?.deliveryState) {
    url.searchParams.set("deliveryState", options.deliveryState);
  }
  return new NextResponse(null, {
    status: 303,
    headers: {
      Location: url.toString(),
    },
  });
}

function buildExternalRedirect(url: string) {
  return new NextResponse(null, {
    status: 303,
    headers: {
      Location: url,
    },
  });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ itemId: string }> },
) {
  const { itemId } = await params;
  const formData = await request.formData();
  const quantity = parseQuantity(formData.get("quantity"));
  const customerName = String(formData.get("customerName") ?? "").trim();
  const customerPhone = sanitizePhone(String(formData.get("customerPhone") ?? ""));
  const notes = sanitizeNotes(String(formData.get("notes") ?? ""));
  const selectedVariantId = sanitizeField(String(formData.get("selectedVariantId") ?? ""));
  const desiredColor = sanitizeField(String(formData.get("desiredColor") ?? ""));
  const desiredSize = sanitizeField(String(formData.get("desiredSize") ?? ""));
  const desiredFinish = sanitizeField(String(formData.get("desiredFinish") ?? ""));
  const couponCode = sanitizeField(String(formData.get("couponCode") ?? ""));
  const deliveryMode = sanitizeField(String(formData.get("deliveryMode") ?? "PICKUP"));
  const deliveryPostalCode = sanitizePostalCode(String(formData.get("deliveryPostalCode") ?? ""));
  const deliveryAddress = sanitizeField(String(formData.get("deliveryAddress") ?? ""));
  const deliveryNeighborhood = sanitizeField(String(formData.get("deliveryNeighborhood") ?? ""));
  const deliveryCity = sanitizeField(String(formData.get("deliveryCity") ?? ""));
  const deliveryState = normalizeStateCode(String(formData.get("deliveryState") ?? ""));

  if (customerName.length < 2) {
    return buildBuyPageRedirect(
      request,
      itemId,
      quantity,
      "Informe o nome para continuar.",
      notes,
      {
        selectedVariantId,
        desiredColor,
        desiredSize,
        desiredFinish,
        couponCode,
        deliveryMode,
        deliveryPostalCode,
        deliveryAddress,
        deliveryNeighborhood,
        deliveryCity,
        deliveryState,
      },
    );
  }

  if (customerPhone.length < 8) {
    return buildBuyPageRedirect(
      request,
      itemId,
      quantity,
      "Informe um telefone ou WhatsApp valido.",
      notes,
      {
        selectedVariantId,
        desiredColor,
        desiredSize,
        desiredFinish,
        couponCode,
        deliveryMode,
        deliveryPostalCode,
        deliveryAddress,
        deliveryNeighborhood,
        deliveryCity,
        deliveryState,
      },
    );
  }

  try {
    const whatsappUrl = await updateDb(async (db) => {
      const item = db.showcaseItems.find(
        (candidate) => candidate.id === itemId && candidate.active,
      );

      if (!item) {
        throw new Error("Item da vitrine nao encontrado.");
      }

      const managesStock = item.fulfillmentType === "STOCK";

      if (managesStock && item.stockQuantity <= 0) {
        throw new Error("Este produto esta sem estoque no momento.");
      }

      if (managesStock && quantity > item.stockQuantity) {
        throw new Error(`Quantidade indisponivel. Estoque atual: ${item.stockQuantity}.`);
      }

      const selectedVariant = item.variants.find(
        (variant) => variant.id === selectedVariantId && variant.active,
      );
      const availableDeliveryModes = getAvailableDeliveryModes(item);

      if (!availableDeliveryModes.includes(deliveryMode as (typeof availableDeliveryModes)[number])) {
        throw new Error("Escolha uma forma de entrega valida para este produto.");
      }

      if (deliveryMode !== "PICKUP" && (!deliveryAddress || !deliveryCity)) {
        throw new Error("Informe endereco e cidade para calcular a entrega.");
      }

      if (deliveryMode === "SHIPPING" && (!deliveryPostalCode || !deliveryState)) {
        throw new Error("Para envio, informe CEP e UF.");
      }

      const unitPrice = item.price + (selectedVariant?.priceAdjustment ?? 0);
      const couponDiscount =
        couponCode && item.couponCode && couponCode.toLowerCase() === item.couponCode.toLowerCase()
          ? item.couponDiscountPercent ?? 0
          : 0;
      const estimatedTotal = unitPrice * quantity * (1 - couponDiscount / 100);
      const freight = estimateFreightCost({
        deliveryMode: deliveryMode as "PICKUP" | "LOCAL_DELIVERY" | "SHIPPING",
        quantity,
        estimatedMaterialGrams: (item.estimatedMaterialGrams ?? 0) * quantity,
        estimatedPrintHours: (item.estimatedPrintHours ?? 0) * quantity,
        postalCode: deliveryPostalCode,
        city: deliveryCity,
        state: deliveryState,
      });
      const grandTotal = estimatedTotal + freight.amount;

      const message = [
        "Olá! Quero comprar este item da vitrine.",
        `Item: ${item.name}`,
        `Quantidade: ${quantity}`,
        `Disponibilidade: ${item.fulfillmentType === "MADE_TO_ORDER" ? "Sob encomenda" : "Pronta entrega"}`,
        `Valor estimado: ${new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(estimatedTotal)}`,
        `Forma de entrega: ${deliveryMode === "PICKUP" ? "Retirada" : deliveryMode === "LOCAL_DELIVERY" ? "Entrega local" : "Envio"}`,
        `Frete estimado: ${new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(freight.amount)}`,
        `Total com entrega: ${new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(grandTotal)}`,
        selectedVariant ? `Variacao: ${selectedVariant.label}` : null,
        desiredColor ? `Cor desejada: ${desiredColor}` : null,
        desiredSize ? `Tamanho desejado: ${desiredSize}` : null,
        desiredFinish ? `Acabamento: ${desiredFinish}` : null,
        couponDiscount ? `Cupom aplicado: ${couponCode}` : null,
        deliveryAddress ? `Endereco: ${deliveryAddress}` : null,
        deliveryNeighborhood ? `Bairro: ${deliveryNeighborhood}` : null,
        deliveryCity ? `Cidade: ${deliveryCity}` : null,
        deliveryState ? `UF: ${deliveryState}` : null,
        deliveryPostalCode ? `CEP: ${deliveryPostalCode}` : null,
        `Cliente: ${customerName}`,
        `Telefone: ${customerPhone}`,
        ...(notes ? [`Observacao: ${notes}`] : []),
      ]
        .filter(Boolean)
        .join("\n");
      const url = `https://api.whatsapp.com/send?phone=${ownerWhatsAppNumber}&text=${encodeURIComponent(message)}`;
      const now = new Date().toISOString();
      const customer = await ensureCustomerRecord(db, {
        name: customerName,
        phone: customerPhone,
      });

      item.whatsappClickCount += 1;
      item.updatedAt = now;

      db.showcaseInquiries.unshift({
        id: createId("ldw"),
        itemId: item.id,
        itemName: item.name,
        quantity,
        customerId: customer.id,
        customerName,
        customerEmail: isGeneratedCustomerEmail(customer.email) ? "" : customer.email,
        customerPhone,
        source: "CATALOG",
        notes: notes || undefined,
        ownerEmail,
        whatsappNumber: ownerWhatsAppNumber,
        whatsappUrl: url,
        estimatedTotal,
        deliveryMode: deliveryMode as "PICKUP" | "LOCAL_DELIVERY" | "SHIPPING",
        freightEstimate: freight.amount,
        deliveryPostalCode: deliveryPostalCode || undefined,
        deliveryAddress: deliveryAddress || undefined,
        deliveryNeighborhood: deliveryNeighborhood || undefined,
        deliveryCity: deliveryCity || undefined,
        deliveryState: deliveryState || undefined,
        shippingCarrier: freight.carrier,
        selectedVariantLabel: selectedVariant?.label,
        desiredColor: desiredColor || undefined,
        desiredSize: desiredSize || undefined,
        desiredFinish: desiredFinish || undefined,
        couponCode: couponDiscount ? couponCode : undefined,
        status: "PENDING",
        tags: [],
        leadTemperature: "WARM",
        followUpAt: undefined,
        lastContactAt: undefined,
        createdAt: now,
        updatedAt: now,
      });

      return url;
    });

    revalidatePath("/");
    revalidatePath("/portal");
    revalidatePath("/admin");
    return buildExternalRedirect(whatsappUrl);
  } catch (error) {
    return buildBuyPageRedirect(
      request,
      itemId,
      quantity,
      error instanceof Error ? error.message : "Nao foi possivel abrir o WhatsApp.",
      notes,
      {
        selectedVariantId,
        desiredColor,
        desiredSize,
        desiredFinish,
        couponCode,
        deliveryMode,
        deliveryPostalCode,
        deliveryAddress,
        deliveryNeighborhood,
        deliveryCity,
        deliveryState,
      },
    );
  }
}
