import { OrderStatus, PaymentStatus, UserRole } from "@prisma/client";
import type { DbMachine, DbMaterial, DbOrder, DbUser } from "@/lib/db-types";
import { readDb } from "@/lib/store";

export type HydratedOrder = DbOrder & {
  customer?: DbUser;
  assignedOperator?: DbUser;
  assignedMachine?: DbMachine;
  material?: DbMaterial;
};

export async function getHydratedData() {
  const db = await readDb();

  const orders: HydratedOrder[] = [...db.orders]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map((order) => ({
      ...order,
      customer: db.users.find((user) => user.id === order.customerId),
      assignedOperator: db.users.find((user) => user.id === order.assignedOperatorId),
      assignedMachine: db.machines.find((machine) => machine.id === order.assignedMachineId),
      material: db.materials.find((material) => material.id === order.materialId),
    }));

  return {
    users: db.users,
    materials: db.materials,
    machines: db.machines,
    expenses: db.expenses,
    payables: db.payables,
    auditLogs: db.auditLogs,
    orders,
    showcaseItems: [...db.showcaseItems].sort(
      (a, b) =>
        Number(b.featured) - Number(a.featured) ||
        b.updatedAt.localeCompare(a.updatedAt),
    ),
    showcaseInquiries: [...db.showcaseInquiries].sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
  };
}

export function getVisibleOrders(orders: HydratedOrder[], userId: string, role: UserRole) {
  if (role === UserRole.CLIENT) {
    return orders.filter((order) => order.customerId === userId);
  }

  return orders;
}

export function getOverviewMetrics(orders: HydratedOrder[], machines: DbMachine[], materials: DbMaterial[]) {
  const inactiveStatuses = new Set<OrderStatus>([OrderStatus.COMPLETED, OrderStatus.CANCELED]);
  const revenue = orders.reduce((sum, order) => sum + (order.paymentStatus === PaymentStatus.PAID ? order.totalPrice : 0), 0);
  const pendingRevenue = orders.reduce(
    (sum, order) => sum + (order.paymentStatus !== PaymentStatus.PAID ? order.totalPrice : 0),
    0,
  );
  const activeOrders = orders.filter((order) => !inactiveStatuses.has(order.status)).length;
  const machinesBusy = machines.filter((machine) => machine.status === "BUSY").length;
  const lowStockMaterials = materials.filter((material) => material.stockAmount <= material.minimumStock).length;

  return {
    revenue,
    pendingRevenue,
    activeOrders,
    machinesBusy,
    lowStockMaterials,
  };
}

export function groupOrdersByStatus(orders: HydratedOrder[]) {
  return orders.reduce<Record<OrderStatus, HydratedOrder[]>>((accumulator, order) => {
    accumulator[order.status] ??= [];
    accumulator[order.status].push(order);
    return accumulator;
  }, {} as Record<OrderStatus, HydratedOrder[]>);
}
