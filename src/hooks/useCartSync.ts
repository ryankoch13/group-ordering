import { useCallback, useEffect, useState } from "react";
import { Alert } from "react-native";

import {
    addMenuItemToCart,
    clearCartForCurrentUser,
    decreaseMenuItemCartQuantity,
    getCartItemsForCurrentUser,
    increaseMenuItemCartQuantity,
    removeMenuItemFromCart,
} from "@/lib/cart";
import { useGroupOrderStore } from "@/store/groupOrderStore";

export function useCartSync() {
  const activeGroupOrderId = useGroupOrderStore(
    (state) => state.activeGroupOrderId,
  );
  const setCart = useGroupOrderStore((state) => state.setCart);

  const [loadingCart, setLoadingCart] = useState(false);
  const [updatingCart, setUpdatingCart] = useState(false);
  const [cartErrorMessage, setCartErrorMessage] = useState<string | null>(null);

  const refreshCart = useCallback(async () => {
    if (!activeGroupOrderId) {
      setCart([]);
      return;
    }

    setLoadingCart(true);
    setCartErrorMessage(null);

    try {
      const cartItems = await getCartItemsForCurrentUser(activeGroupOrderId);
      setCart(cartItems);
    } catch (error) {
      console.log("REFRESH CART ERROR:", error);

      setCartErrorMessage(
        error instanceof Error ? error.message : "Could not load cart.",
      );
    } finally {
      setLoadingCart(false);
    }
  }, [activeGroupOrderId, setCart]);

  const addItemToCart = useCallback(
    async (menuItemId: string) => {
      if (!activeGroupOrderId) {
        Alert.alert(
          "No active group order",
          "Create or join a group order before adding items.",
        );
        return;
      }

      setUpdatingCart(true);
      setCartErrorMessage(null);

      try {
        const cartItems = await addMenuItemToCart(
          activeGroupOrderId,
          menuItemId,
        );

        setCart(cartItems);
      } catch (error) {
        console.log("ADD CART ITEM ERROR:", error);

        Alert.alert(
          "Could not add item",
          error instanceof Error ? error.message : "Something went wrong.",
        );
      } finally {
        setUpdatingCart(false);
      }
    },
    [activeGroupOrderId, setCart],
  );

  const increaseCartItem = useCallback(
    async (menuItemId: string) => {
      if (!activeGroupOrderId) {
        return;
      }

      setUpdatingCart(true);
      setCartErrorMessage(null);

      try {
        const cartItems = await increaseMenuItemCartQuantity(
          activeGroupOrderId,
          menuItemId,
        );

        setCart(cartItems);
      } catch (error) {
        console.log("INCREASE CART ITEM ERROR:", error);

        Alert.alert(
          "Could not update cart",
          error instanceof Error ? error.message : "Something went wrong.",
        );
      } finally {
        setUpdatingCart(false);
      }
    },
    [activeGroupOrderId, setCart],
  );

  const decreaseCartItem = useCallback(
    async (menuItemId: string) => {
      if (!activeGroupOrderId) {
        return;
      }

      setUpdatingCart(true);
      setCartErrorMessage(null);

      try {
        const cartItems = await decreaseMenuItemCartQuantity(
          activeGroupOrderId,
          menuItemId,
        );

        setCart(cartItems);
      } catch (error) {
        console.log("DECREASE CART ITEM ERROR:", error);

        Alert.alert(
          "Could not update cart",
          error instanceof Error ? error.message : "Something went wrong.",
        );
      } finally {
        setUpdatingCart(false);
      }
    },
    [activeGroupOrderId, setCart],
  );

  const removeCartItem = useCallback(
    async (menuItemId: string) => {
      if (!activeGroupOrderId) {
        return;
      }

      setUpdatingCart(true);
      setCartErrorMessage(null);

      try {
        const cartItems = await removeMenuItemFromCart(
          activeGroupOrderId,
          menuItemId,
        );

        setCart(cartItems);
      } catch (error) {
        console.log("REMOVE CART ITEM ERROR:", error);

        Alert.alert(
          "Could not remove item",
          error instanceof Error ? error.message : "Something went wrong.",
        );
      } finally {
        setUpdatingCart(false);
      }
    },
    [activeGroupOrderId, setCart],
  );

  const clearCart = useCallback(async () => {
    if (!activeGroupOrderId) {
      setCart([]);
      return;
    }

    setUpdatingCart(true);
    setCartErrorMessage(null);

    try {
      await clearCartForCurrentUser(activeGroupOrderId);
      setCart([]);
    } catch (error) {
      console.log("CLEAR CART ERROR:", error);

      Alert.alert(
        "Could not clear cart",
        error instanceof Error ? error.message : "Something went wrong.",
      );
    } finally {
      setUpdatingCart(false);
    }
  }, [activeGroupOrderId, setCart]);

  useEffect(() => {
    refreshCart();
  }, [refreshCart]);

  return {
    loadingCart,
    updatingCart,
    cartErrorMessage,
    refreshCart,
    addItemToCart,
    increaseCartItem,
    decreaseCartItem,
    removeCartItem,
    clearCart,
  };
}
