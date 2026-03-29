import { NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { readDb } from "@/lib/store";

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
  const db = await readDb();
  const order = db.orders.find((item) => item.id === orderId);

  if (!order) {
    return new Response("Pedido não encontrado.", { status: 404 });
  }

  if (user.role === "CLIENT" && order.customerId !== user.id) {
    return new Response("Acesso não autorizado.", { status: 403 });
  }

  const content =
    type === "invoice"
      ? `Nota fiscal\nPedido: ${order.orderNumber}\nValor: ${order.totalPrice.toFixed(2)}\nCliente: ${order.customerId}\nStatus: ${order.status}\n`
      : type === "receipt"
        ? `Comprovante\nPedido: ${order.orderNumber}\nPagamento: ${order.paymentStatus}\nValor: ${order.totalPrice.toFixed(2)}\n`
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
