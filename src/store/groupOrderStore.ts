import { create } from "zustand";

import { CartItem, MenuItem, Order, OrderStatus } from "@/types/shop";

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
  setCart: (cart) => {
    set({ cart });
  },
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
    });
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

    if (cart.length === 0) {
      return null;
    }

    const order: Order = {
      id: `order-${Date.now()}`,
      createdAt: new Date().toISOString(),
      status: OrderStatus.Placed,
      totalCents: getCartTotalCents(cart),
      items: cart.map((item) => ({ ...item })),
    };

    set((state) => ({
      orders: [order, ...state.orders],
      cart: [],
    }));

    return order.id;
  },
}));
