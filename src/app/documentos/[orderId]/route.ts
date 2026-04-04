import { NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { readDb } from "@/lib/store";

function slugify(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ orderId: string }> },
) {
  const user = await getCurrentUser();

  if (!user) {
    return new Response("Acesso não autorizado.", { status: 401 });
  }

  const { orderId } = await params;
  const type = request.nextUrl.searchParams.get("type") ?? "history";
  const kind = request.nextUrl.searchParams.get("kind") ?? "internal";
  const db = await readDb();
  const order = kind === "showcase" ? undefined : db.orders.find((item) => item.id === orderId);

  if (kind === "showcase") {
    const inquiry = db.showcaseInquiries.find((item) => item.id === orderId);

    if (!inquiry) {
      return new Response("Pedido não encontrado.", { status: 404 });
    }

    if (user.role === "CLIENT" && inquiry.customerId !== user.id) {
      return new Response("Acesso não autorizado.", { status: 403 });
    }

    const historyEntries = db.auditLogs
      .filter((entry) => entry.entityType === "showcase_inquiry" && entry.entityId === inquiry.id)
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
    const orderLabel = inquiry.orderNumber ?? inquiry.itemName;
    const baseFileName = slugify(orderLabel || inquiry.id);
    const deliveryLabel =
      inquiry.deliveryMode === "LOCAL_DELIVERY"
        ? "Entrega local"
        : inquiry.deliveryMode === "SHIPPING"
          ? "Envio"
          : "Retirada";
    const addressBlock =
      inquiry.deliveryMode === "PICKUP"
        ? "Retirada combinada no studio."
        : [
            inquiry.deliveryAddress,
            inquiry.deliveryNeighborhood,
            [inquiry.deliveryCity, inquiry.deliveryState].filter(Boolean).join(" / "),
            inquiry.deliveryPostalCode ? `CEP ${inquiry.deliveryPostalCode}` : "",
          ]
            .filter(Boolean)
            .join("\n");

    const content =
      type === "label"
        ? `Etiqueta de envio\nPedido: ${orderLabel}\nCliente: ${inquiry.customerName}\nTelefone: ${inquiry.customerPhone ?? "Não informado"}\nForma de entrega: ${deliveryLabel}\nTransportadora: ${inquiry.shippingCarrier ?? "A definir"}\nRastreio: ${inquiry.trackingCode ?? "A definir"}\nFrete estimado: ${(inquiry.freightEstimate ?? 0).toFixed(2)}\n\nDestino:\n${addressBlock || "Endereço pendente"}\n`
        : type === "proof"
          ? `Comprovante de entrega\nPedido: ${orderLabel}\nCliente: ${inquiry.customerName}\nRecebedor: ${inquiry.deliveryRecipient ?? inquiry.customerName}\nForma de entrega: ${deliveryLabel}\nTransportadora: ${inquiry.shippingCarrier ?? "A definir"}\nRastreio: ${inquiry.trackingCode ?? "A definir"}\nEnviado em: ${inquiry.shippedAt ?? "Pendente"}\nEntregue em: ${inquiry.deliveredAt ?? "Pendente"}\nObservações: ${inquiry.proofOfDeliveryNotes ?? "Sem observações"}\n`
          : `Historico do pedido ${orderLabel}\n\n${historyEntries.length ? historyEntries.map((item) => `${item.createdAt} - ${item.summary}${item.details ? ` (${item.details})` : ""}`).join("\n") : "Sem histórico detalhado ainda."}`;

    return new Response(content, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Content-Disposition": `attachment; filename="${baseFileName}-${type}.txt"`,
      },
    });
  }

  if (!order) {
    return new Response("Pedido não encontrado.", { status: 404 });
  }

  if (user.role === "CLIENT" && order.customerId !== user.id) {
    return new Response("Acesso não autorizado.", { status: 403 });
  }

  const customer = db.users.find((item) => item.id === order.customerId);

  const content =
    type === "invoice"
      ? `Nota fiscal\nPedido: ${order.orderNumber}\nValor: ${order.totalPrice.toFixed(2)}\nCliente: ${order.customerId}\nStatus: ${order.status}\n`
      : type === "receipt"
        ? `Comprovante\nPedido: ${order.orderNumber}\nPagamento: ${order.paymentStatus}\nValor: ${order.totalPrice.toFixed(2)}\n`
        : type === "label"
          ? `Etiqueta de envio\nPedido: ${order.orderNumber}\nCliente: ${customer?.company ?? customer?.name ?? order.customerId}\nTransportadora: ${order.shippingCarrier ?? "A definir"}\nRastreio: ${order.trackingCode ?? "A definir"}\nStatus: ${order.status}\n`
          : type === "proof"
            ? `Comprovante de entrega\nPedido: ${order.orderNumber}\nCliente: ${customer?.company ?? customer?.name ?? order.customerId}\nTransportadora: ${order.shippingCarrier ?? "A definir"}\nRastreio: ${order.trackingCode ?? "A definir"}\nEnviado em: ${order.shippedAt ?? "Pendente"}\nEntregue em: ${order.deliveredAt ?? "Pendente"}\n`
            : `Historico do pedido ${order.orderNumber}\n\n${order.timeline
                .map((item) => `${item.createdAt} - ${item.label}: ${item.details}`)
                .join("\n")}`;

  return new Response(content, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Content-Disposition": `attachment; filename="${order.orderNumber.toLowerCase()}-${type}.txt"`,
    },
  });
}
