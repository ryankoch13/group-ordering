import { router, Stack } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from "react-native";

import { checkoutGroupOrder, getCheckoutCartItems } from "@/lib/orders";
import { useGroupOrderStore } from "@/store/groupOrderStore";
import type { CheckoutCartItem } from "@/types/shop";
import { formatCurrency } from "@/utils/money";

export default function CheckoutScreen() {
  const activeGroupOrderId = useGroupOrderStore(
    (state) => state.activeGroupOrderId,
  );
  const isHost = useGroupOrderStore((state) => state.isHost);
  const setCart = useGroupOrderStore((state) => state.setCart);
  const clearActiveGroup = useGroupOrderStore(
    (state) => state.clearActiveGroup,
  );

  const [checkoutItems, setCheckoutItems] = useState<CheckoutCartItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [placingOrder, setPlacingOrder] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const totalCents = useMemo(() => {
    return checkoutItems.reduce(
      (total, item) => total + item.menuItem.priceCents * item.quantity,
      0,
    );
  }, [checkoutItems]);

  const loadCheckoutItems = useCallback(async () => {
    if (!activeGroupOrderId) {
      setCheckoutItems([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setErrorMessage(null);

    try {
      const items = await getCheckoutCartItems(activeGroupOrderId);
      setCheckoutItems(items);
    } catch (error) {
      console.log("LOAD CHECKOUT ITEMS ERROR:", error);

      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Could not load checkout items.",
      );
    } finally {
      setLoading(false);
    }
  }, [activeGroupOrderId]);

  useEffect(() => {
    loadCheckoutItems();
  }, [loadCheckoutItems]);

  const handlePlaceOrder = async () => {
    if (!activeGroupOrderId) {
      Alert.alert("No active group order", "Create a group order first.");
      return;
    }

    if (!isHost) {
      Alert.alert(
        "Host checkout only",
        "Only the host can place the final order.",
      );
      return;
    }

    if (checkoutItems.length === 0) {
      Alert.alert("No items", "There are no items to checkout.");
      return;
    }

    setPlacingOrder(true);

    try {
      await checkoutGroupOrder(activeGroupOrderId);

      setCart([]);
      clearActiveGroup();

      Alert.alert("Order placed", "Your group order has been submitted.", [
        {
          text: "View Orders",
          onPress: () => router.replace("/(tabs)/orders"),
        },
      ]);
    } catch (error) {
      Alert.alert(
        "Could not place order",
        error instanceof Error ? error.message : "Something went wrong.",
      );
    } finally {
      setPlacingOrder(false);
    }
  };

  return (
    <>
      <Stack.Screen options={{ title: "Checkout" }} />

      <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
        <Text style={styles.title}>Checkout</Text>

        {!isHost && (
          <View style={styles.warningCard}>
            <Text style={styles.warningTitle}>Host checkout only</Text>
            <Text style={styles.warningText}>
              You can view the summary, but only the host can place the final
              order.
            </Text>
          </View>
        )}

        {loading ? (
          <View style={styles.centerBox}>
            <ActivityIndicator color="#2563EB" />
            <Text style={styles.loadingText}>Loading checkout...</Text>
          </View>
        ) : errorMessage ? (
          <View style={styles.centerBox}>
            <Text style={styles.errorTitle}>Could not load checkout</Text>
            <Text style={styles.errorText}>{errorMessage}</Text>

            <Pressable
              style={styles.secondaryButton}
              onPress={loadCheckoutItems}
            >
              <Text style={styles.secondaryButtonText}>Try Again</Text>
            </Pressable>
          </View>
        ) : (
          <>
            <View style={styles.card}>
              <Text style={styles.sectionTitle}>Group Order Summary</Text>

              {checkoutItems.length === 0 ? (
                <Text style={styles.placeholderText}>
                  No one has added items to this group order yet.
                </Text>
              ) : (
                checkoutItems.map((item) => (
                  <View
                    key={`${item.userId}-${item.menuItem.id}`}
                    style={styles.summaryRow}
                  >
                    <View style={styles.summaryLeft}>
                      <Text style={styles.itemName}>{item.menuItem.name}</Text>
                      <Text style={styles.itemMeta}>
                        Qty {item.quantity} · User {item.userId.slice(0, 8)}
                      </Text>
                    </View>

                    <Text style={styles.itemTotal}>
                      {formatCurrency(item.menuItem.priceCents * item.quantity)}
                    </Text>
                  </View>
                ))
              )}

              <View style={styles.divider} />

              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>Total</Text>
                <Text style={styles.totalValue}>
                  {formatCurrency(totalCents)}
                </Text>
              </View>
            </View>

            <View style={styles.card}>
              <Text style={styles.sectionTitle}>Payment</Text>
              <Text style={styles.placeholderText}>
                Payment is mocked for now. Later, this can become a Stripe or
                restaurant checkout step.
              </Text>
            </View>

            <Pressable
              style={[
                styles.placeOrderButton,
                (!isHost || checkoutItems.length === 0 || placingOrder) &&
                  styles.placeOrderButtonDisabled,
              ]}
              onPress={handlePlaceOrder}
              disabled={!isHost || checkoutItems.length === 0 || placingOrder}
            >
              {placingOrder ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.placeOrderButtonText}>
                  {isHost ? "Place Order" : "Only Host Can Checkout"}
                </Text>
              )}
            </Pressable>
          </>
        )}
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#F6F7FB",
  },
  content: {
    padding: 16,
    paddingBottom: 32,
  },
  title: {
    fontSize: 30,
    fontWeight: "900",
    color: "#111827",
    marginBottom: 16,
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    marginBottom: 14,
  },
  warningCard: {
    backgroundColor: "#FFFBEB",
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: "#FDE68A",
    marginBottom: 14,
  },
  warningTitle: {
    color: "#92400E",
    fontWeight: "900",
    marginBottom: 4,
  },
  warningText: {
    color: "#92400E",
    lineHeight: 20,
  },
  centerBox: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    padding: 24,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    alignItems: "center",
  },
  loadingText: {
    color: "#6B7280",
    fontWeight: "700",
    marginTop: 10,
  },
  errorTitle: {
    color: "#111827",
    fontWeight: "900",
    fontSize: 18,
    marginBottom: 6,
  },
  errorText: {
    color: "#6B7280",
    textAlign: "center",
    lineHeight: 22,
    marginBottom: 14,
  },
  secondaryButton: {
    backgroundColor: "#EFF6FF",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
  },
  secondaryButtonText: {
    color: "#2563EB",
    fontWeight: "900",
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "900",
    color: "#111827",
    marginBottom: 12,
  },
  summaryRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 10,
  },
  summaryLeft: {
    flex: 1,
    marginRight: 12,
  },
  itemName: {
    color: "#111827",
    fontWeight: "800",
    fontSize: 15,
  },
  itemMeta: {
    color: "#6B7280",
    marginTop: 3,
  },
  itemTotal: {
    color: "#111827",
    fontWeight: "900",
  },
  divider: {
    height: 1,
    backgroundColor: "#E5E7EB",
    marginVertical: 10,
  },
  totalRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  totalLabel: {
    fontSize: 18,
    color: "#111827",
    fontWeight: "900",
  },
  totalValue: {
    fontSize: 24,
    color: "#2563EB",
    fontWeight: "900",
  },
  placeholderText: {
    color: "#6B7280",
    lineHeight: 22,
  },
  placeOrderButton: {
    backgroundColor: "#2563EB",
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: "center",
  },
  placeOrderButtonDisabled: {
    backgroundColor: "#9CA3AF",
  },
  placeOrderButtonText: {
    color: "#FFFFFF",
    fontSize: 17,
    fontWeight: "900",
  },
});
