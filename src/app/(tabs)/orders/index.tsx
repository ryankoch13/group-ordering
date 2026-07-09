import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import {
  formatCurrency,
  formatDate,
  getCurrentUserId,
  getItemName,
  getItemTotalCents,
  getOrders,
  getOrderStatusLabel,
  getOrderTotalCents,
  OrderStatus,
  OrderWithItems,
  subscribeToOrders,
  unsubscribeFromOrders,
} from "@/lib/orders";

export default function OrdersScreen() {
  const [orders, setOrders] = useState<OrderWithItems[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const loadOrders = useCallback(
    async (options?: { showLoading?: boolean }) => {
      try {
        if (options?.showLoading ?? true) {
          setLoading(true);
        }

        setErrorMessage(null);

        const [userId, orderRows] = await Promise.all([
          getCurrentUserId(),
          getOrders(),
        ]);

        setCurrentUserId(userId);
        setOrders(orderRows);

        if (!userId) {
          setErrorMessage("You need to be signed in to view orders.");
        }
      } catch (error) {
        console.error("Failed to load orders:", error);
        setErrorMessage("Could not load orders.");
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [],
  );

  useFocusEffect(
    useCallback(() => {
      loadOrders({ showLoading: true });

      const channel = subscribeToOrders(() => {
        loadOrders({ showLoading: false });
      });

      return () => {
        unsubscribeFromOrders(channel);
      };
    }, [loadOrders]),
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadOrders({ showLoading: false });
  }, [loadOrders]);

  if (loading) {
    return (
      <SafeAreaView style={styles.screen}>
        <View style={styles.centered}>
          <ActivityIndicator />
          <Text style={styles.loadingText}>Loading orders...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.header}>
        <Text style={styles.title}>Orders</Text>
        <Text style={styles.subtitle}>
          Tap an order to view details and host actions.
        </Text>
      </View>

      {errorMessage ? (
        <View style={styles.messageCard}>
          <Text style={styles.errorText}>{errorMessage}</Text>
        </View>
      ) : null}

      <FlatList
        data={orders}
        keyExtractor={(item) => item.id}
        contentContainerStyle={
          orders.length === 0 ? styles.emptyList : styles.list
        }
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        ListEmptyComponent={
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>No orders yet</Text>
            <Text style={styles.emptyText}>
              Once the host checks out a group order, it will show up here.
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <OrderCard
            order={item}
            isHost={item.host_id === currentUserId}
            onPress={() =>
              router.push({
                pathname: "/(tabs)/orders/[orderId]",
                params: { orderId: item.id },
              })
            }
          />
        )}
      />
    </SafeAreaView>
  );
}

function OrderCard({
  order,
  isHost,
  onPress,
}: {
  order: OrderWithItems;
  isHost: boolean;
  onPress: () => void;
}) {
  const totalCents = getOrderTotalCents(order);
  const date = formatDate(order.created_at);
  const previewItems = order.items.slice(0, 3);
  const hiddenItemCount = Math.max(order.items.length - previewItems.length, 0);

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
    >
      <View style={styles.cardHeader}>
        <View style={styles.orderHeaderText}>
          <Text style={styles.orderTitle}>Order #{order.id.slice(0, 8)}</Text>
          <Text style={styles.orderDate}>{date}</Text>
        </View>

        <View style={styles.badgeColumn}>
          {isHost ? (
            <View style={styles.hostBadge}>
              <Text style={styles.hostBadgeText}>Host</Text>
            </View>
          ) : null}

          <View style={[styles.statusBadge, getStatusBadgeStyle(order.status)]}>
            <Text style={styles.statusText}>
              {getOrderStatusLabel(order.status) ?? order.status}
            </Text>
          </View>
        </View>
      </View>

      <View style={styles.divider} />

      {previewItems.length > 0 ? (
        <View style={styles.itemsContainer}>
          {previewItems.map((item) => (
            <View key={item.id} style={styles.itemRow}>
              <View style={styles.itemInfo}>
                <Text style={styles.itemName}>{getItemName(item)}</Text>
                <Text style={styles.itemQuantity}>
                  Qty: {item.quantity ?? 1}
                </Text>
              </View>

              <Text style={styles.itemPrice}>
                {formatCurrency(getItemTotalCents(item))}
              </Text>
            </View>
          ))}

          {hiddenItemCount > 0 ? (
            <Text style={styles.moreItemsText}>
              +{hiddenItemCount} more item{hiddenItemCount === 1 ? "" : "s"}
            </Text>
          ) : null}
        </View>
      ) : (
        <Text style={styles.noItemsText}>No items found for this order.</Text>
      )}

      <View style={styles.totalRow}>
        <Text style={styles.totalLabel}>Total</Text>
        <Text style={styles.totalValue}>{formatCurrency(totalCents)}</Text>
      </View>
    </Pressable>
  );
}

function getStatusBadgeStyle(status: OrderStatus) {
  switch (status) {
    case OrderStatus.Completed:
      return styles.completedBadge;
    case OrderStatus.Cancelled:
      return styles.cancelledBadge;
    case OrderStatus.Placed:
    default:
      return styles.placedBadge;
  }
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#F8FAFC",
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 12,
  },
  title: {
    color: "#111827",
    fontSize: 32,
    fontWeight: "800",
  },
  subtitle: {
    color: "#6B7280",
    fontSize: 15,
    marginTop: 4,
  },
  list: {
    padding: 20,
    paddingTop: 8,
    gap: 14,
  },
  emptyList: {
    flexGrow: 1,
    padding: 20,
    justifyContent: "center",
  },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  loadingText: {
    color: "#6B7280",
    marginTop: 12,
    fontSize: 15,
  },
  messageCard: {
    marginHorizontal: 20,
    marginBottom: 12,
    backgroundColor: "#FEF2F2",
    borderColor: "#FCA5A5",
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
  },
  errorText: {
    color: "#B91C1C",
    fontSize: 14,
    fontWeight: "600",
  },
  emptyCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    padding: 24,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    shadowColor: "#000000",
    shadowOpacity: 0.05,
    shadowRadius: 10,
    shadowOffset: {
      width: 0,
      height: 4,
    },
    elevation: 2,
  },
  emptyTitle: {
    color: "#111827",
    fontSize: 20,
    fontWeight: "800",
    textAlign: "center",
  },
  emptyText: {
    color: "#6B7280",
    fontSize: 15,
    lineHeight: 22,
    textAlign: "center",
    marginTop: 8,
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    shadowColor: "#000000",
    shadowOpacity: 0.05,
    shadowRadius: 10,
    shadowOffset: {
      width: 0,
      height: 4,
    },
    elevation: 2,
  },
  cardPressed: {
    opacity: 0.75,
    transform: [{ scale: 0.995 }],
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
  },
  orderHeaderText: {
    flex: 1,
  },
  orderTitle: {
    color: "#111827",
    fontSize: 17,
    fontWeight: "800",
  },
  orderDate: {
    color: "#6B7280",
    fontSize: 13,
    marginTop: 4,
  },
  badgeColumn: {
    alignItems: "flex-end",
    gap: 6,
  },
  hostBadge: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: "#F3E8FF",
  },
  hostBadgeText: {
    color: "#6D28D9",
    fontSize: 12,
    fontWeight: "800",
    textTransform: "uppercase",
  },
  statusBadge: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    alignSelf: "flex-start",
  },
  placedBadge: {
    backgroundColor: "#DBEAFE",
  },
  completedBadge: {
    backgroundColor: "#DCFCE7",
  },
  cancelledBadge: {
    backgroundColor: "#FEE2E2",
  },
  statusText: {
    color: "#111827",
    fontSize: 12,
    fontWeight: "800",
    textTransform: "uppercase",
  },
  divider: {
    height: 1,
    backgroundColor: "#E5E7EB",
    marginVertical: 14,
  },
  itemsContainer: {
    gap: 12,
  },
  itemRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
  },
  itemInfo: {
    flex: 1,
  },
  itemName: {
    color: "#111827",
    fontSize: 15,
    fontWeight: "700",
  },
  itemQuantity: {
    color: "#6B7280",
    fontSize: 13,
    marginTop: 2,
  },
  itemPrice: {
    color: "#111827",
    fontSize: 15,
    fontWeight: "700",
  },
  moreItemsText: {
    color: "#6B7280",
    fontSize: 13,
    fontWeight: "700",
  },
  noItemsText: {
    color: "#6B7280",
    fontSize: 14,
  },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    borderTopWidth: 1,
    borderTopColor: "#E5E7EB",
    marginTop: 14,
    paddingTop: 14,
  },
  totalLabel: {
    color: "#111827",
    fontSize: 17,
    fontWeight: "800",
  },
  totalValue: {
    color: "#111827",
    fontSize: 17,
    fontWeight: "800",
  },
});
