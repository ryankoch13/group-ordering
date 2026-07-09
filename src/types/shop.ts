export type MenuItem = {
  id: string;
  name: string;
  description: string;
  priceCents: number;
  category: string;
  imageEmoji: string;
};

export type CartItem = {
  menuItem: MenuItem;
  quantity: number;
};

export type CheckoutCartItem = {
  userId: string;
  menuItem: MenuItem;
  quantity: number;
};

export enum OrderStatus {
  Placed = "placed",
  Completed = "completed",
  Cancelled = "cancelled",
}

export type OrderItem = {
  id: string;
  menuItemId: string | null;
  userId: string | null;
  itemName: string;
  priceCents: number;
  quantity: number;
};

export type Order = {
  id: string;
  groupOrderId: string;
  hostUserId: string;
  createdAt: string;
  status: OrderStatus;
  totalCents: number;
  items: OrderItem[];
};
