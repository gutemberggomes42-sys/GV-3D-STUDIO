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

function buildBuyPageRedirect(
  request: NextRequest,
  itemId: string,
  quantity: number,
  message: string,
) {
  const url = new URL(`/comprar/${itemId}`, request.url);
  url.searchParams.set("quantity", String(quantity));
  url.searchParams.set("message", message);
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

  if (customerName.length < 2) {
    return buildBuyPageRedirect(
      request,
      itemId,
      quantity,
      "Informe o nome para continuar.",
    );
  }

  if (customerPhone.length < 8) {
    return buildBuyPageRedirect(
      request,
      itemId,
      quantity,
      "Informe um telefone ou WhatsApp valido.",
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

      const message = [
        "Olá! Quero comprar este item da vitrine.",
        `Item: ${item.name}`,
        `Quantidade: ${quantity}`,
        `Disponibilidade: ${item.fulfillmentType === "MADE_TO_ORDER" ? "Sob encomenda" : "Pronta entrega"}`,
        `Cliente: ${customerName}`,
        `Telefone: ${customerPhone}`,
      ].join("\n");
      const url = `https://api.whatsapp.com/send?phone=${ownerWhatsAppNumber}&text=${encodeURIComponent(message)}`;
      const now = new Date().toISOString();
      const customer = await ensureCustomerRecord(db, {
        name: customerName,
        phone: customerPhone,
      });

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
        notes: undefined,
        ownerEmail,
        whatsappNumber: ownerWhatsAppNumber,
        whatsappUrl: url,
        status: "PENDING",
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
    );
  }
}
