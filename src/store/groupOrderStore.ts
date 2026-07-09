import { create } from "zustand";

import {
  OrderStatus,
  type CartItem,
  type MenuItem,
  type Order,
} from "@/types/shop";

type ActiveGroup = {
  id: string;
  name: string;
  hostUserId: string;
  inviteCode: string;
};

function getCartTotalCents(cart: CartItem[]) {
  return cart.reduce(
    (total, item) => total + item.menuItem.priceCents * item.quantity,
    0,
  );
}

type GroupOrderStore = {
  activeGroupOrderId: string | null;
  groupName: string;
  inviteCode: string | null;
  isHost: boolean;

  cart: CartItem[];
  orders: Order[];

  setActiveGroup: (group: ActiveGroup, currentUserId: string) => void;
  clearActiveGroup: () => void;

  setCart: (cart: CartItem[]) => void;
  setOrders: (orders: Order[]) => void;

  addToCart: (menuItem: MenuItem) => void;
  increaseQuantity: (menuItemId: string) => void;
  decreaseQuantity: (menuItemId: string) => void;
  removeFromCart: (menuItemId: string) => void;
  clearCart: () => void;
  placeOrder: () => string | null;
};

export const useGroupOrderStore = create<GroupOrderStore>((set, get) => ({
  activeGroupOrderId: null,
  groupName: "No active group order",
  inviteCode: null,
  isHost: false,

  cart: [],
  orders: [],

  setActiveGroup: (group, currentUserId) => {
    set((state) => {
      const isSameGroup = state.activeGroupOrderId === group.id;

      return {
        activeGroupOrderId: group.id,
        groupName: group.name,
        inviteCode: group.inviteCode,
        isHost: group.hostUserId === currentUserId,
        cart: isSameGroup ? state.cart : [],
      };
    });
  },

  clearActiveGroup: () => {
    set({
      activeGroupOrderId: null,
      groupName: "No active group order",
      inviteCode: null,
      isHost: false,
      cart: [],
      orders: [],
    });
  },

  setCart: (cart) => {
    set({ cart });
  },

  setOrders: (orders) => {
    set({ orders });
  },

  addToCart: (menuItem) => {
    set((state) => {
      const existingItem = state.cart.find(
        (item) => item.menuItem.id === menuItem.id,
      );

      if (existingItem) {
        return {
          cart: state.cart.map((item) =>
            item.menuItem.id === menuItem.id
              ? { ...item, quantity: item.quantity + 1 }
              : item,
          ),
        };
      }

      return {
        cart: [...state.cart, { menuItem, quantity: 1 }],
      };
    });
  },

  increaseQuantity: (menuItemId) => {
    set((state) => ({
      cart: state.cart.map((item) =>
        item.menuItem.id === menuItemId
          ? { ...item, quantity: item.quantity + 1 }
          : item,
      ),
    }));
  },

  decreaseQuantity: (menuItemId) => {
    set((state) => ({
      cart: state.cart
        .map((item) =>
          item.menuItem.id === menuItemId
            ? { ...item, quantity: item.quantity - 1 }
            : item,
        )
        .filter((item) => item.quantity > 0),
    }));
  },

  removeFromCart: (menuItemId) => {
    set((state) => ({
      cart: state.cart.filter((item) => item.menuItem.id !== menuItemId),
    }));
  },

  clearCart: () => {
    set({ cart: [] });
  },

  placeOrder: () => {
    const cart = get().cart;
    const activeGroupOrderId = get().activeGroupOrderId;

    if (cart.length === 0 || !activeGroupOrderId) {
      return null;
    }

    const orderId = `order-${Date.now()}`;

    const order: Order = {
      id: orderId,
      groupOrderId: activeGroupOrderId,
      hostUserId: "local",
      createdAt: new Date().toISOString(),
      status: OrderStatus.Placed,
      totalCents: getCartTotalCents(cart),
      items: cart.map((item) => ({
        id: `${orderId}-${item.menuItem.id}`,
        menuItemId: item.menuItem.id,
        userId: null,
        itemName: item.menuItem.name,
        priceCents: item.menuItem.priceCents,
        quantity: item.quantity,
      })),
    };

    set((state) => ({
      orders: [order, ...state.orders],
      cart: [],
    }));

    return order.id;
  },
}));
