import { revalidatePath } from "next/cache";
import { NextRequest, NextResponse } from "next/server";
import { ownerEmail, ownerWhatsAppNumber } from "@/lib/constants";
import { ensureCustomerRecord, isGeneratedCustomerEmail } from "@/lib/customer-records";
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

  if (customerName.length < 2) {
    return buildBuyPageRedirect(
      request,
      itemId,
      quantity,
      "Informe o nome para continuar.",
      notes,
      { selectedVariantId, desiredColor, desiredSize, desiredFinish, couponCode },
    );
  }

  if (customerPhone.length < 8) {
    return buildBuyPageRedirect(
      request,
      itemId,
      quantity,
      "Informe um telefone ou WhatsApp valido.",
      notes,
      { selectedVariantId, desiredColor, desiredSize, desiredFinish, couponCode },
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
      const unitPrice = item.price + (selectedVariant?.priceAdjustment ?? 0);
      const couponDiscount =
        couponCode && item.couponCode && couponCode.toLowerCase() === item.couponCode.toLowerCase()
          ? item.couponDiscountPercent ?? 0
          : 0;
      const estimatedTotal = unitPrice * quantity * (1 - couponDiscount / 100);

      const message = [
        "Olá! Quero comprar este item da vitrine.",
        `Item: ${item.name}`,
        `Quantidade: ${quantity}`,
        `Disponibilidade: ${item.fulfillmentType === "MADE_TO_ORDER" ? "Sob encomenda" : "Pronta entrega"}`,
        `Valor estimado: ${new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(estimatedTotal)}`,
        selectedVariant ? `Variacao: ${selectedVariant.label}` : null,
        desiredColor ? `Cor desejada: ${desiredColor}` : null,
        desiredSize ? `Tamanho desejado: ${desiredSize}` : null,
        desiredFinish ? `Acabamento: ${desiredFinish}` : null,
        couponDiscount ? `Cupom aplicado: ${couponCode}` : null,
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
      { selectedVariantId, desiredColor, desiredSize, desiredFinish, couponCode },
    );
  }
}
