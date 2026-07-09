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

export enum OrderStatus {
  Placed = "placed",
  Completed = "completed",
  Cancelled = "cancelled",
}

export type Order = {
  id: string;
  createdAt: string;
  status: OrderStatus;
  totalCents: number;
  items: CartItem[];
};
