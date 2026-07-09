import { useCallback, useEffect, useState } from "react";

import { getOrdersForCurrentUser } from "@/lib/orders";
import { useGroupOrderStore } from "@/store/groupOrderStore";

export function useOrdersSync() {
  const setOrders = useGroupOrderStore((state) => state.setOrders);

  const [loadingOrders, setLoadingOrders] = useState(false);
  const [ordersErrorMessage, setOrdersErrorMessage] = useState<string | null>(
    null,
  );

  const refreshOrders = useCallback(async () => {
    setLoadingOrders(true);
    setOrdersErrorMessage(null);

    try {
      const orders = await getOrdersForCurrentUser();
      setOrders(orders);
    } catch (error) {
      console.log("LOAD ORDERS ERROR:", error);

      setOrdersErrorMessage(
        error instanceof Error ? error.message : "Could not load orders.",
      );
    } finally {
      setLoadingOrders(false);
    }
  }, [setOrders]);

  useEffect(() => {
    refreshOrders();
  }, [refreshOrders]);

  return {
    loadingOrders,
    ordersErrorMessage,
    refreshOrders,
  };
}
