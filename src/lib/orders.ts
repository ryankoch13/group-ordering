import type { RealtimeChannel } from "@supabase/supabase-js";

import { supabase } from "@/lib/supabase";

export enum OrderStatus {
  Placed = "placed",
  Completed = "completed",
  Cancelled = "cancelled",
}

export type OrderRow = {
  id: string;
  group_order_id?: string | null;
  host_user_id?: string | null;
  host_id?: string | null;
  user_id?: string | null;
  status: OrderStatus;
  total_cents?: number | null;
  total_amount?: number | null;
  created_at: string;
};

export type OrderItemRow = {
  id: string;
  order_id: string;
  menu_item_id?: string | null;
  name?: string | null;
  item_name?: string | null;
  quantity?: number | null;
  price?: number | null;
  price_cents?: number | null;
  unit_price_cents?: number | null;
  created_at?: string | null;
};

export type OrderWithItems = OrderRow & {
  items: OrderItemRow[];
  host_id?: string | null;
};

type GroupOrderHostRow = {
  host_id?: string | null;
  user_id?: string | null;
  created_by?: string | null;
};

export const statusLabels: Record<OrderStatus, string> = {
  [OrderStatus.Placed]: "Placed",
  [OrderStatus.Completed]: "Completed",
  [OrderStatus.Cancelled]: "Cancelled",
};

export async function getCurrentUserId() {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error) {
    throw error;
  }

  return user?.id ?? null;
}

export async function getOrders(): Promise<OrderWithItems[]> {
  const { data: orderRows, error: ordersError } = await supabase
    .from("orders")
    .select("*")
    .order("created_at", { ascending: false });

  if (ordersError) {
    throw ordersError;
  }

  return hydrateOrders((orderRows ?? []) as OrderRow[]);
}

export async function getOrderById(orderId: string): Promise<OrderWithItems> {
  const { data: orderRow, error: orderError } = await supabase
    .from("orders")
    .select("*")
    .eq("id", orderId)
    .single();

  if (orderError) {
    throw orderError;
  }

  const [hydratedOrder] = await hydrateOrders([orderRow as OrderRow]);

  if (!hydratedOrder) {
    throw new Error("Order not found.");
  }

  return hydratedOrder;
}

async function hydrateOrders(orderRows: OrderRow[]): Promise<OrderWithItems[]> {
  const orderIds = orderRows.map((order) => order.id);

  let itemRows: OrderItemRow[] = [];

  if (orderIds.length > 0) {
    const { data, error: itemsError } = await supabase
      .from("order_items")
      .select("*")
      .in("order_id", orderIds)
      .order("created_at", { ascending: true });

    if (itemsError) {
      throw itemsError;
    }

    itemRows = (data ?? []) as OrderItemRow[];

    return orderRows.map((order) => {
      const groupOrderHostId = order.group_order_id
        ? hostIdsByGroupOrderId[order.group_order_id]
        : null;

      return {
        ...order,
        status: order.status as OrderStatus,
        host_id:
          order.host_user_id ??
          order.host_id ??
          groupOrderHostId ??
          order.user_id ??
          null,
        items: itemsByOrderId[order.id] ?? [],
      };
    });
  }

  const itemsByOrderId = itemRows.reduce<Record<string, OrderItemRow[]>>(
    (acc, item) => {
      if (!acc[item.order_id]) {
        acc[item.order_id] = [];
      }

      acc[item.order_id].push(item);
      return acc;
    },
    {},
  );

  const hostIdsByGroupOrderId = await getHostIdsByGroupOrderId(orderRows);

  return orderRows.map((order) => {
    const groupOrderHostId = order.group_order_id
      ? hostIdsByGroupOrderId[order.group_order_id]
      : null;

    return {
      ...order,
      status: order.status as OrderStatus,
      host_id: order.host_id ?? groupOrderHostId ?? order.user_id ?? null,
      items: itemsByOrderId[order.id] ?? [],
    };
  });
}

async function getHostIdsByGroupOrderId(orderRows: OrderRow[]) {
  const groupOrderIds = Array.from(
    new Set(
      orderRows
        .map((order) => order.group_order_id)
        .filter((id): id is string => Boolean(id)),
    ),
  );

  if (groupOrderIds.length === 0) {
    return {};
  }

  /*
    This tries to support a few common column names:
    - host_id
    - user_id
    - created_by

    If your group_orders table does not exist, or RLS blocks this read,
    the app will still work. It just will not show host-only controls unless
    orders.host_id or orders.user_id is available.
  */
  const { data, error } = await supabase
    .from("group_orders")
    .select("id, host_id, user_id, created_by")
    .in("id", groupOrderIds);

  if (error || !data) {
    return {};
  }

  return data.reduce<Record<string, string | null>>((acc, row) => {
    const groupOrder = row as GroupOrderHostRow & { id: string };

    acc[groupOrder.id] =
      groupOrder.host_id ?? groupOrder.user_id ?? groupOrder.created_by ?? null;

    return acc;
  }, {});
}

export async function updateOrderStatus(
  orderId: string,
  status: OrderStatus.Completed | OrderStatus.Cancelled,
) {
  const currentUserId = await getCurrentUserId();

  if (!currentUserId) {
    throw new Error("You need to be signed in to update an order.");
  }

  const order = await getOrderById(orderId);

  if (!canManageOrder(order, currentUserId)) {
    throw new Error("Only the host can update this order.");
  }

  const { error } = await supabase
    .from("orders")
    .update({
      status,
    })
    .eq("id", orderId);

  if (error) {
    throw error;
  }
}

export function canManageOrder(
  order: OrderWithItems | null,
  userId: string | null,
) {
  if (!order || !userId) {
    return false;
  }

  return order.host_id === userId;
}

export function getItemName(item: OrderItemRow) {
  return item.name ?? item.item_name ?? "Menu item";
}

export function getItemUnitPriceCents(item: OrderItemRow) {
  if (typeof item.price_cents === "number") {
    return item.price_cents;
  }

  if (typeof item.unit_price_cents === "number") {
    return item.unit_price_cents;
  }

  if (typeof item.price === "number") {
    return Math.round(item.price * 100);
  }

  return 0;
}

export function getItemTotalCents(item: OrderItemRow) {
  const quantity = item.quantity ?? 1;
  return getItemUnitPriceCents(item) * quantity;
}

export function getOrderTotalCents(order: OrderWithItems) {
  if (typeof order.total_cents === "number") {
    return order.total_cents;
  }

  if (typeof order.total_amount === "number") {
    return Math.round(order.total_amount * 100);
  }

  return order.items.reduce((sum, item) => sum + getItemTotalCents(item), 0);
}

export function formatCurrency(cents: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(cents / 100);
}

export function formatDate(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Unknown date";
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

export function subscribeToOrders(onChange: () => void) {
  return supabase
    .channel(`orders-list-${Date.now()}`)
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "orders",
      },
      onChange,
    )
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "order_items",
      },
      onChange,
    )
    .subscribe();
}

export function subscribeToOrder(orderId: string, onChange: () => void) {
  return supabase
    .channel(`order-detail-${orderId}-${Date.now()}`)
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "orders",
        filter: `id=eq.${orderId}`,
      },
      onChange,
    )
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "order_items",
        filter: `order_id=eq.${orderId}`,
      },
      onChange,
    )
    .subscribe();
}

export function unsubscribeFromOrders(channel: RealtimeChannel) {
  supabase.removeChannel(channel);
}
