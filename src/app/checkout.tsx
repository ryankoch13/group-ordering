import { router, Stack } from "expo-router";
import {
    Alert,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from "react-native";

import { useGroupOrderStore } from "@/store/groupOrderStore";
import { formatCurrency } from "@/utils/money";

export default function CheckoutScreen() {
  const cart = useGroupOrderStore((state) => state.cart);
  const isHost = useGroupOrderStore((state) => state.isHost);
  const placeOrder = useGroupOrderStore((state) => state.placeOrder);

  const totalCents = cart.reduce(
    (total, item) => total + item.menuItem.priceCents * item.quantity,
    0,
  );

  const handlePlaceOrder = () => {
    if (!isHost) {
      Alert.alert(
        "Host checkout only",
        "Only the host can place the final order.",
      );
      return;
    }

    const orderId = placeOrder();

    if (!orderId) {
      Alert.alert("Cart empty", "Add items before placing an order.");
      return;
    }

    Alert.alert("Order placed", "Your group order has been submitted.", [
      {
        text: "View Orders",
        onPress: () => router.replace("/(tabs)/orders"),
      },
    ]);
  };

  return (
    <>
      <Stack.Screen options={{ title: "Checkout" }} />

      <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
        <Text style={styles.title}>Checkout</Text>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Order Summary</Text>

          {cart.map((item) => (
            <View key={item.menuItem.id} style={styles.summaryRow}>
              <View style={styles.summaryLeft}>
                <Text style={styles.itemName}>{item.menuItem.name}</Text>
                <Text style={styles.itemMeta}>Qty {item.quantity}</Text>
              </View>

              <Text style={styles.itemTotal}>
                {formatCurrency(item.menuItem.priceCents * item.quantity)}
              </Text>
            </View>
          ))}

          <View style={styles.divider} />

          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Total</Text>
            <Text style={styles.totalValue}>{formatCurrency(totalCents)}</Text>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Payment</Text>
          <Text style={styles.placeholderText}>
            Payment is mocked for now. The host will eventually complete payment
            here after reviewing everyone’s items.
          </Text>
        </View>

        <Pressable
          style={[
            styles.placeOrderButton,
            !isHost && styles.placeOrderButtonDisabled,
          ]}
          onPress={handlePlaceOrder}
        >
          <Text style={styles.placeOrderButtonText}>
            {isHost ? "Place Order" : "Only Host Can Checkout"}
          </Text>
        </Pressable>
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
