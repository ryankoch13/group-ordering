import { router } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { useGroupOrderStore } from "@/store/groupOrderStore";
import { formatCurrency } from "@/utils/money";

export default function OrdersScreen() {
  const orders = useGroupOrderStore((state) => state.orders);

  if (orders.length === 0) {
    return (
      <View style={styles.emptyScreen}>
        <Text style={styles.emptyTitle}>No orders yet</Text>
        <Text style={styles.emptyText}>
          Once the host checks out, completed group orders will appear here.
        </Text>

        <Pressable
          style={styles.primaryButton}
          onPress={() => router.push("/(tabs)/menu")}
        >
          <Text style={styles.primaryButtonText}>Browse Menu</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Orders</Text>

      {orders.map((order) => (
        <View key={order.id} style={styles.orderCard}>
          <View style={styles.orderHeader}>
            <View>
              <Text style={styles.orderTitle}>Group Order</Text>
              <Text style={styles.orderDate}>
                {new Date(order.createdAt).toLocaleString()}
              </Text>
            </View>

            <View style={styles.statusPill}>
              <Text style={styles.statusText}>{order.status}</Text>
            </View>
          </View>

          <View style={styles.divider} />

          {order.items.map((item) => (
            <View key={item.menuItem.id} style={styles.itemRow}>
              <Text style={styles.itemName}>
                {item.quantity}× {item.menuItem.name}
              </Text>

              <Text style={styles.itemPrice}>
                {formatCurrency(item.menuItem.priceCents * item.quantity)}
              </Text>
            </View>
          ))}

          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Total</Text>
            <Text style={styles.totalValue}>
              {formatCurrency(order.totalCents)}
            </Text>
          </View>
        </View>
      ))}
    </ScrollView>
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
  orderCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    marginBottom: 14,
  },
  orderHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
  },
  orderTitle: {
    fontSize: 17,
    color: "#111827",
    fontWeight: "900",
  },
  orderDate: {
    color: "#6B7280",
    marginTop: 4,
  },
  statusPill: {
    backgroundColor: "#ECFDF5",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  statusText: {
    color: "#047857",
    fontWeight: "900",
    textTransform: "capitalize",
  },
  divider: {
    height: 1,
    backgroundColor: "#E5E7EB",
    marginVertical: 12,
  },
  itemRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 5,
  },
  itemName: {
    flex: 1,
    color: "#374151",
    marginRight: 12,
  },
  itemPrice: {
    color: "#111827",
    fontWeight: "800",
  },
  totalRow: {
    borderTopWidth: 1,
    borderTopColor: "#E5E7EB",
    marginTop: 12,
    paddingTop: 12,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  totalLabel: {
    color: "#111827",
    fontWeight: "900",
    fontSize: 16,
  },
  totalValue: {
    color: "#2563EB",
    fontWeight: "900",
    fontSize: 18,
  },
  emptyScreen: {
    flex: 1,
    backgroundColor: "#F6F7FB",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  emptyTitle: {
    fontSize: 24,
    fontWeight: "900",
    color: "#111827",
    marginBottom: 8,
  },
  emptyText: {
    color: "#6B7280",
    textAlign: "center",
    lineHeight: 22,
    marginBottom: 20,
  },
  primaryButton: {
    backgroundColor: "#2563EB",
    paddingHorizontal: 18,
    paddingVertical: 13,
    borderRadius: 14,
  },
  primaryButtonText: {
    color: "#FFFFFF",
    fontWeight: "900",
  },
});
