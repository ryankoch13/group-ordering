import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import {
  canManageOrder,
  formatCurrency,
  formatDate,
  getCurrentUserId,
  getItemName,
  getItemTotalCents,
  getOrderById,
  getOrderStatusLabel,
  getOrderTotalCents,
  OrderStatus,
  OrderWithItems,
  subscribeToOrder,
  unsubscribeFromOrders,
  updateOrderStatus,
} from "@/lib/orders";

export default function OrderDetailsScreen() {
  const params = useLocalSearchParams<{ orderId?: string | string[] }>();

  const orderId = Array.isArray(params.orderId)
    ? params.orderId[0]
    : params.orderId;

  const [order, setOrder] = useState<OrderWithItems | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingStatus, setSavingStatus] = useState<OrderStatus | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const isHost = useMemo(
    () => canManageOrder(order, currentUserId),
    [order, currentUserId],
  );

  const canUpdateStatus =
    Boolean(isHost) && order?.status === OrderStatus.Placed && !savingStatus;

  const loadOrder = useCallback(
    async (options?: { showLoading?: boolean }) => {
      if (!orderId) {
        setErrorMessage("Missing order id.");
        setLoading(false);
        return;
      }

      try {
        if (options?.showLoading ?? true) {
          setLoading(true);
        }

        setErrorMessage(null);

        const [userId, orderRow] = await Promise.all([
          getCurrentUserId(),
          getOrderById(orderId),
        ]);

        setCurrentUserId(userId);
        setOrder(orderRow);
      } catch (error) {
        console.error("Failed to load order:", error);
        setErrorMessage("Could not load this order.");
      } finally {
        setLoading(false);
      }
    },
    [orderId],
  );

  useFocusEffect(
    useCallback(() => {
      loadOrder({ showLoading: true });

      if (!orderId) {
        return undefined;
      }

      const channel = subscribeToOrder(orderId, () => {
        loadOrder({ showLoading: false });
      });

      return () => {
        unsubscribeFromOrders(channel);
      };
    }, [loadOrder, orderId]),
  );

  const handleStatusChange = useCallback(
    async (status: OrderStatus.Completed | OrderStatus.Cancelled) => {
      if (!orderId) {
        return;
      }

      try {
        setSavingStatus(status);
        setErrorMessage(null);

        await updateOrderStatus(orderId, status);
        await loadOrder({ showLoading: false });
      } catch (error) {
        console.error("Failed to update order:", error);

        const fallbackMessage =
          status === OrderStatus.Completed
            ? "Could not mark this order as completed."
            : "Could not cancel this order.";

        setErrorMessage(
          error instanceof Error ? error.message : fallbackMessage,
        );
      } finally {
        setSavingStatus(null);
      }
    },
    [loadOrder, orderId],
  );

  const confirmStatusChange = useCallback(
    (status: OrderStatus.Completed | OrderStatus.Cancelled) => {
      const title =
        status === OrderStatus.Completed
          ? "Mark order completed?"
          : "Cancel order?";

      const message =
        status === OrderStatus.Completed
          ? "This will mark the group order as completed."
          : "This will cancel the group order.";

      Alert.alert(title, message, [
        {
          text: "Not yet",
          style: "cancel",
        },
        {
          text: status === OrderStatus.Completed ? "Complete" : "Cancel order",
          style: status === OrderStatus.Cancelled ? "destructive" : "default",
          onPress: () => {
            void handleStatusChange(status);
          },
        },
      ]);
    },
    [handleStatusChange],
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.screen}>
        <View style={styles.centered}>
          <ActivityIndicator />
          <Text style={styles.loadingText}>Loading order...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!order) {
    return (
      <SafeAreaView style={styles.screen}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.backButton}>
            <Text style={styles.backButtonText}>Back</Text>
          </Pressable>

          <Text style={styles.title}>Order not found</Text>
          <Text style={styles.subtitle}>
            This order may have been deleted or you may not have access to it.
          </Text>
        </View>

        {errorMessage ? (
          <View style={styles.messageCard}>
            <Text style={styles.errorText}>{errorMessage}</Text>
          </View>
        ) : null}
      </SafeAreaView>
    );
  }

  const totalCents = getOrderTotalCents(order);

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.headerRow}>
          <Pressable onPress={() => router.back()} style={styles.backButton}>
            <Text style={styles.backButtonText}>Back</Text>
          </Pressable>

          <View style={[styles.statusBadge, getStatusBadgeStyle(order.status)]}>
            <Text style={styles.statusText}>
              {getOrderStatusLabel(order.status) ?? order.status}
            </Text>
          </View>
        </View>

        <View style={styles.titleBlock}>
          <Text style={styles.title}>Order #{order.id.slice(0, 8)}</Text>
          <Text style={styles.subtitle}>{formatDate(order.created_at)}</Text>
        </View>

        {isHost ? (
          <View style={styles.hostNotice}>
            <Text style={styles.hostNoticeTitle}>Host controls enabled</Text>
            <Text style={styles.hostNoticeText}>
              You can update this order because you are the host.
            </Text>
          </View>
        ) : null}

        {errorMessage ? (
          <View style={styles.messageCard}>
            <Text style={styles.errorText}>{errorMessage}</Text>
          </View>
        ) : null}

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Items</Text>

          {order.items.length > 0 ? (
            <View style={styles.itemsContainer}>
              {order.items.map((item) => (
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
            </View>
          ) : (
            <Text style={styles.emptyText}>No items found for this order.</Text>
          )}

          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Total</Text>
            <Text style={styles.totalValue}>{formatCurrency(totalCents)}</Text>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Order details</Text>

          <DetailRow label="Status" value={getOrderStatusLabel(order.status)} />
          <DetailRow label="Created" value={formatDate(order.created_at)} />
          <DetailRow label="Items" value={String(order.items.length)} />
          <DetailRow label="Total" value={formatCurrency(totalCents)} />
        </View>

        {isHost ? (
          <View style={styles.actionsCard}>
            <Text style={styles.sectionTitle}>Host actions</Text>

            {order.status === OrderStatus.Placed ? (
              <>
                <Pressable
                  disabled={!canUpdateStatus}
                  onPress={() => confirmStatusChange(OrderStatus.Completed)}
                  style={({ pressed }) => [
                    styles.primaryButton,
                    (!canUpdateStatus || pressed) && styles.buttonPressed,
                  ]}
                >
                  <Text style={styles.primaryButtonText}>
                    {savingStatus === OrderStatus.Completed
                      ? "Completing..."
                      : "Mark as completed"}
                  </Text>
                </Pressable>

                <Pressable
                  disabled={!canUpdateStatus}
                  onPress={() => confirmStatusChange(OrderStatus.Cancelled)}
                  style={({ pressed }) => [
                    styles.dangerButton,
                    (!canUpdateStatus || pressed) && styles.buttonPressed,
                  ]}
                >
                  <Text style={styles.dangerButtonText}>
                    {savingStatus === OrderStatus.Cancelled
                      ? "Cancelling..."
                      : "Cancel order"}
                  </Text>
                </Pressable>
              </>
            ) : (
              <Text style={styles.emptyText}>
                This order is already{" "}
                {getOrderStatusLabel(order.status).toLowerCase()}.
              </Text>
            )}
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value}</Text>
    </View>
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
  content: {
    padding: 20,
    paddingBottom: 40,
    gap: 14,
  },
  header: {
    padding: 20,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  titleBlock: {
    gap: 4,
  },
  title: {
    color: "#111827",
    fontSize: 32,
    fontWeight: "800",
  },
  subtitle: {
    color: "#6B7280",
    fontSize: 15,
  },
  backButton: {
    alignSelf: "flex-start",
    borderRadius: 999,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  backButtonText: {
    color: "#111827",
    fontSize: 14,
    fontWeight: "800",
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
  actionsCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    gap: 12,
    shadowColor: "#000000",
    shadowOpacity: 0.05,
    shadowRadius: 10,
    shadowOffset: {
      width: 0,
      height: 4,
    },
    elevation: 2,
  },
  hostNotice: {
    backgroundColor: "#F3E8FF",
    borderColor: "#E9D5FF",
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
  },
  hostNoticeTitle: {
    color: "#6D28D9",
    fontSize: 14,
    fontWeight: "800",
  },
  hostNoticeText: {
    color: "#7E22CE",
    fontSize: 13,
    lineHeight: 19,
    marginTop: 2,
  },
  sectionTitle: {
    color: "#111827",
    fontSize: 18,
    fontWeight: "800",
    marginBottom: 14,
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
  emptyText: {
    color: "#6B7280",
    fontSize: 14,
    lineHeight: 20,
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
  detailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: "#F3F4F6",
  },
  detailLabel: {
    color: "#6B7280",
    fontSize: 14,
    fontWeight: "700",
  },
  detailValue: {
    color: "#111827",
    fontSize: 14,
    fontWeight: "800",
    flex: 1,
    textAlign: "right",
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
  primaryButton: {
    backgroundColor: "#2563EB",
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
  },
  primaryButtonText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "800",
  },
  dangerButton: {
    backgroundColor: "#FEF2F2",
    borderColor: "#FCA5A5",
    borderWidth: 1,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
  },
  dangerButtonText: {
    color: "#B91C1C",
    fontSize: 15,
    fontWeight: "800",
  },
  buttonPressed: {
    opacity: 0.65,
  },
});
