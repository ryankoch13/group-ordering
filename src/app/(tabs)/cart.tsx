import { router, useFocusEffect } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    Pressable,
    RefreshControl,
    SafeAreaView,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from "react-native";

import { ActiveGroupOrder, getActiveGroupOrder } from "@/lib/activeGroupOrder";
import { supabase } from "@/lib/supabase";

type MenuItemRow = {
  id: string;
  name: string;
  description?: string | null;
  category?: string | null;
  price_cents: number;
  image_emoji?: string | null;
  is_available?: boolean | null;
};

type CartItemRow = {
  id: string;
  group_order_id: string;
  user_id: string;
  menu_item_id: string;
  quantity: number;
  created_at?: string | null;
};

type GroupMemberRow = {
  id: string;
  group_order_id: string;
  user_id: string | null;
  invited_email: string | null;
  role: string | null;
  status: string | null;
  created_at?: string | null;
};

type CartLine = CartItemRow & {
  menuItem: MenuItemRow | null;
  member: GroupMemberRow | null;
};

type CartOwnerGroup = {
  userId: string;
  label: string;
  isCurrentUser: boolean;
  lines: CartLine[];
  totalCents: number;
};

async function withTimeout<T>(
  promise: PromiseLike<T>,
  timeoutMs: number,
  label: string,
): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;

  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error(`${label} timed out`));
    }, timeoutMs);
  });

  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }
}

export default function CartScreen() {
  const [activeGroupOrder, setActiveGroupOrder] =
    useState<ActiveGroupOrder | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [cartLines, setCartLines] = useState<CartLine[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [updatingLineId, setUpdatingLineId] = useState<string | null>(null);
  const [checkingOut, setCheckingOut] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const isHost = Boolean(
    activeGroupOrder &&
    currentUserId &&
    (activeGroupOrder.isHost || activeGroupOrder.hostUserId === currentUserId),
  );

  const groupedCart = useMemo(() => {
    const groupsByUserId = cartLines.reduce<Record<string, CartOwnerGroup>>(
      (acc, line) => {
        const userId = line.user_id;
        const label = getCartOwnerLabel(line, currentUserId);

        if (!acc[userId]) {
          acc[userId] = {
            userId,
            label,
            isCurrentUser: userId === currentUserId,
            lines: [],
            totalCents: 0,
          };
        }

        acc[userId].lines.push(line);
        acc[userId].totalCents += getCartLineTotalCents(line);

        return acc;
      },
      {},
    );

    return Object.values(groupsByUserId).sort((a, b) => {
      if (a.isCurrentUser && !b.isCurrentUser) {
        return -1;
      }

      if (!a.isCurrentUser && b.isCurrentUser) {
        return 1;
      }

      return a.label.localeCompare(b.label);
    });
  }, [cartLines, currentUserId]);

  const groupTotalCents = useMemo(() => {
    return cartLines.reduce(
      (sum, line) => sum + getCartLineTotalCents(line),
      0,
    );
  }, [cartLines]);

  const itemCount = useMemo(() => {
    return cartLines.reduce((sum, line) => sum + (line.quantity ?? 0), 0);
  }, [cartLines]);

  const loadCart = useCallback(async (options?: { showLoading?: boolean }) => {
    try {
      if (options?.showLoading ?? true) {
        setLoading(true);
      }

      setErrorMessage(null);

      const authResult = await withTimeout(
        supabase.auth.getUser(),
        8000,
        "Auth lookup",
      );

      if (authResult.error) {
        throw authResult.error;
      }

      const userId = authResult.data.user?.id ?? null;

      setCurrentUserId(userId);

      if (!userId) {
        setActiveGroupOrder(null);
        setCartLines([]);
        setErrorMessage("You need to be signed in to view your cart.");
        return;
      }

      const groupOrder = await withTimeout(
        getActiveGroupOrder(),
        8000,
        "Active group order lookup",
      );

      setActiveGroupOrder(groupOrder);

      if (!groupOrder) {
        setCartLines([]);
        return;
      }

      const cartResult = await withTimeout(
        supabase
          .from("cart_items")
          .select("*")
          .eq("group_order_id", groupOrder.id)
          .order("created_at", { ascending: true }),
        8000,
        "Cart lookup",
      );

      if (cartResult.error) {
        throw cartResult.error;
      }

      const cartItems = (cartResult.data ?? []) as CartItemRow[];

      const menuItemIds = Array.from(
        new Set(cartItems.map((item) => item.menu_item_id)),
      );

      let menuItems: MenuItemRow[] = [];

      if (menuItemIds.length > 0) {
        const menuResult = await withTimeout(
          supabase.from("menu_items").select("*").in("id", menuItemIds),
          8000,
          "Menu items lookup",
        );

        if (menuResult.error) {
          throw menuResult.error;
        }

        menuItems = (menuResult.data ?? []) as MenuItemRow[];
      }

      let members: GroupMemberRow[] = [];

      const membersResult = await withTimeout(
        supabase
          .from("group_members")
          .select("*")
          .eq("group_order_id", groupOrder.id),
        8000,
        "Group members lookup",
      );

      if (!membersResult.error && membersResult.data) {
        members = membersResult.data as GroupMemberRow[];
      } else {
        console.warn("Could not load group members:", membersResult.error);
      }

      const menuItemsById = menuItems.reduce<Record<string, MenuItemRow>>(
        (acc, item) => {
          acc[item.id] = item;
          return acc;
        },
        {},
      );

      const membersByUserId = members.reduce<Record<string, GroupMemberRow>>(
        (acc, member) => {
          if (member.user_id) {
            acc[member.user_id] = member;
          }

          return acc;
        },
        {},
      );

      const hydratedLines: CartLine[] = cartItems.map((cartItem) => ({
        ...cartItem,
        menuItem: menuItemsById[cartItem.menu_item_id] ?? null,
        member: membersByUserId[cartItem.user_id] ?? null,
      }));

      hydratedLines.sort((a, b) => {
        const ownerA = getCartOwnerLabel(a, userId);
        const ownerB = getCartOwnerLabel(b, userId);

        if (ownerA !== ownerB) {
          return ownerA.localeCompare(ownerB);
        }

        return getMenuItemName(a).localeCompare(getMenuItemName(b));
      });

      setCartLines(hydratedLines);
    } catch (error) {
      console.error("Failed to load cart:", error);
      setErrorMessage(
        error instanceof Error ? error.message : "Could not load your cart.",
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadCart({ showLoading: true });
    }, [loadCart]),
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadCart({ showLoading: false });
  }, [loadCart]);

  const removeCartLine = useCallback(
    async (line: CartLine) => {
      try {
        setUpdatingLineId(line.id);
        setErrorMessage(null);

        const { error } = await supabase
          .from("cart_items")
          .delete()
          .eq("id", line.id);

        if (error) {
          throw error;
        }

        await loadCart({ showLoading: false });
      } catch (error) {
        console.error("Failed to remove item:", error);
        Alert.alert(
          "Could not remove item",
          error instanceof Error ? error.message : "Please try again.",
        );
      } finally {
        setUpdatingLineId(null);
      }
    },
    [loadCart],
  );

  const updateQuantity = useCallback(
    async (line: CartLine, nextQuantity: number) => {
      if (nextQuantity <= 0) {
        await removeCartLine(line);
        return;
      }

      try {
        setUpdatingLineId(line.id);
        setErrorMessage(null);

        const { error } = await supabase
          .from("cart_items")
          .update({
            quantity: nextQuantity,
          })
          .eq("id", line.id);

        if (error) {
          throw error;
        }

        await loadCart({ showLoading: false });
      } catch (error) {
        console.error("Failed to update quantity:", error);
        Alert.alert(
          "Could not update item",
          error instanceof Error ? error.message : "Please try again.",
        );
      } finally {
        setUpdatingLineId(null);
      }
    },
    [loadCart, removeCartLine],
  );

  const confirmRemoveCartLine = useCallback(
    (line: CartLine) => {
      Alert.alert(
        "Remove item?",
        `Remove ${getMenuItemName(line)} from the cart?`,
        [
          {
            text: "Keep item",
            style: "cancel",
          },
          {
            text: "Remove",
            style: "destructive",
            onPress: () => {
              void removeCartLine(line);
            },
          },
        ],
      );
    },
    [removeCartLine],
  );

  const checkoutGroupOrder = useCallback(async () => {
    if (!activeGroupOrder) {
      return;
    }

    try {
      setCheckingOut(true);
      setErrorMessage(null);

      const { error } = await supabase.rpc("checkout_group_order", {
        p_group_order_id: activeGroupOrder.id,
      });

      if (error) {
        throw error;
      }

      Alert.alert("Order placed", "The group order has been checked out.", [
        {
          text: "View orders",
          onPress: () => {
            router.replace("/(tabs)/orders");
          },
        },
      ]);

      await loadCart({ showLoading: false });
    } catch (error) {
      console.error("Failed to checkout group order:", error);
      Alert.alert(
        "Could not checkout",
        error instanceof Error ? error.message : "Please try again.",
      );
    } finally {
      setCheckingOut(false);
    }
  }, [activeGroupOrder, loadCart]);

  const confirmCheckout = useCallback(() => {
    if (!activeGroupOrder) {
      Alert.alert(
        "No active group order",
        "Create or join a group order before checking out.",
      );
      return;
    }

    if (!isHost) {
      Alert.alert("Host only", "Only the host can checkout this group order.");
      return;
    }

    if (cartLines.length === 0) {
      Alert.alert("Cart is empty", "Add items before checking out.");
      return;
    }

    Alert.alert(
      "Checkout group order?",
      `This will place the group order for ${formatCurrency(groupTotalCents)}.`,
      [
        {
          text: "Not yet",
          style: "cancel",
        },
        {
          text: "Checkout",
          onPress: () => {
            void checkoutGroupOrder();
          },
        },
      ],
    );
  }, [
    activeGroupOrder,
    cartLines.length,
    checkoutGroupOrder,
    groupTotalCents,
    isHost,
  ]);

  if (loading) {
    return (
      <SafeAreaView style={styles.screen}>
        <View style={styles.centered}>
          <ActivityIndicator />
          <Text style={styles.loadingText}>Loading cart...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        <View style={styles.header}>
          <Text style={styles.title}>Cart</Text>
          <Text style={styles.subtitle}>
            Review everyone’s items before checkout.
          </Text>
        </View>

        {errorMessage ? (
          <View style={styles.messageCard}>
            <Text style={styles.errorText}>{errorMessage}</Text>
          </View>
        ) : null}

        {!activeGroupOrder ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>No active group order</Text>
            <Text style={styles.emptyText}>
              Create or join a group order before adding items to your cart.
            </Text>

            <Pressable
              onPress={() => {
                router.push("/(tabs)/profile");
              }}
              style={({ pressed }) => [
                styles.primaryButton,
                pressed && styles.buttonPressed,
              ]}
            >
              <Text style={styles.primaryButtonText}>Go to profile</Text>
            </Pressable>
          </View>
        ) : (
          <>
            <View style={styles.groupCard}>
              <View style={styles.groupHeaderRow}>
                <View style={styles.groupHeaderText}>
                  <Text style={styles.eyebrow}>Active group order</Text>
                  <Text style={styles.groupName}>
                    {activeGroupOrder.name ?? "Group order"}
                  </Text>
                </View>

                <View style={isHost ? styles.hostBadge : styles.guestBadge}>
                  <Text style={styles.badgeText}>
                    {isHost ? "Host" : "Guest"}
                  </Text>
                </View>
              </View>

              <View style={styles.groupMetaRow}>
                <Text style={styles.groupMetaText}>
                  {itemCount} item{itemCount === 1 ? "" : "s"}
                </Text>
                <Text style={styles.groupMetaText}>
                  {formatCurrency(groupTotalCents)}
                </Text>
              </View>
            </View>

            {cartLines.length === 0 ? (
              <View style={styles.emptyCard}>
                <Text style={styles.emptyTitle}>Your cart is empty</Text>
                <Text style={styles.emptyText}>
                  Add items from the menu before checking out.
                </Text>

                <Pressable
                  onPress={() => {
                    router.push("/(tabs)/menu");
                  }}
                  style={({ pressed }) => [
                    styles.primaryButton,
                    pressed && styles.buttonPressed,
                  ]}
                >
                  <Text style={styles.primaryButtonText}>Go to menu</Text>
                </Pressable>
              </View>
            ) : (
              <>
                {groupedCart.map((ownerGroup) => (
                  <View key={ownerGroup.userId} style={styles.ownerSection}>
                    <View style={styles.ownerHeader}>
                      <Text style={styles.ownerTitle}>{ownerGroup.label}</Text>
                      <Text style={styles.ownerTotal}>
                        {formatCurrency(ownerGroup.totalCents)}
                      </Text>
                    </View>

                    <View style={styles.ownerItems}>
                      {ownerGroup.lines.map((line) => (
                        <CartLineCard
                          key={line.id}
                          line={line}
                          canEdit={
                            line.user_id === currentUserId && !checkingOut
                          }
                          updating={updatingLineId === line.id}
                          onDecrease={() => {
                            void updateQuantity(line, (line.quantity ?? 1) - 1);
                          }}
                          onIncrease={() => {
                            void updateQuantity(line, (line.quantity ?? 1) + 1);
                          }}
                          onRemove={() => {
                            confirmRemoveCartLine(line);
                          }}
                        />
                      ))}
                    </View>
                  </View>
                ))}

                <View style={styles.summaryCard}>
                  <View style={styles.summaryRow}>
                    <Text style={styles.summaryLabel}>Group total</Text>
                    <Text style={styles.summaryValue}>
                      {formatCurrency(groupTotalCents)}
                    </Text>
                  </View>

                  <View style={styles.summaryRow}>
                    <Text style={styles.summaryMutedLabel}>Items</Text>
                    <Text style={styles.summaryMutedValue}>{itemCount}</Text>
                  </View>

                  {isHost ? (
                    <Pressable
                      disabled={checkingOut || cartLines.length === 0}
                      onPress={confirmCheckout}
                      style={({ pressed }) => [
                        styles.checkoutButton,
                        (pressed || checkingOut || cartLines.length === 0) &&
                          styles.buttonPressed,
                      ]}
                    >
                      {checkingOut ? (
                        <ActivityIndicator color="#FFFFFF" />
                      ) : (
                        <Text style={styles.checkoutButtonText}>
                          Checkout group order
                        </Text>
                      )}
                    </Pressable>
                  ) : (
                    <View style={styles.guestNotice}>
                      <Text style={styles.guestNoticeTitle}>
                        Waiting for host checkout
                      </Text>
                      <Text style={styles.guestNoticeText}>
                        Only the host can place the final group order.
                      </Text>
                    </View>
                  )}
                </View>
              </>
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function CartLineCard({
  line,
  canEdit,
  updating,
  onDecrease,
  onIncrease,
  onRemove,
}: {
  line: CartLine;
  canEdit: boolean;
  updating: boolean;
  onDecrease: () => void;
  onIncrease: () => void;
  onRemove: () => void;
}) {
  const quantity = line.quantity ?? 1;

  return (
    <View style={styles.cartLineCard}>
      <View style={styles.cartLineInfo}>
        <Text style={styles.itemName}>
          {line.menuItem?.image_emoji ? `${line.menuItem.image_emoji} ` : ""}
          {getMenuItemName(line)}
        </Text>

        {line.menuItem?.description ? (
          <Text style={styles.itemDescription}>
            {line.menuItem.description}
          </Text>
        ) : null}

        <Text style={styles.itemPrice}>
          {formatCurrency(getMenuItemPriceCents(line.menuItem))} each
        </Text>
      </View>

      <View style={styles.cartLineRight}>
        <Text style={styles.lineTotal}>
          {formatCurrency(getCartLineTotalCents(line))}
        </Text>

        {canEdit ? (
          <View style={styles.quantityControls}>
            <Pressable
              disabled={updating}
              onPress={onDecrease}
              style={({ pressed }) => [
                styles.quantityButton,
                pressed && styles.buttonPressed,
              ]}
            >
              <Text style={styles.quantityButtonText}>−</Text>
            </Pressable>

            <View style={styles.quantityValue}>
              {updating ? (
                <ActivityIndicator size="small" />
              ) : (
                <Text style={styles.quantityText}>{quantity}</Text>
              )}
            </View>

            <Pressable
              disabled={updating}
              onPress={onIncrease}
              style={({ pressed }) => [
                styles.quantityButton,
                pressed && styles.buttonPressed,
              ]}
            >
              <Text style={styles.quantityButtonText}>+</Text>
            </Pressable>
          </View>
        ) : (
          <Text style={styles.quantityReadOnly}>Qty: {quantity}</Text>
        )}

        {canEdit ? (
          <Pressable disabled={updating} onPress={onRemove}>
            <Text style={styles.removeText}>Remove</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

function getCartOwnerLabel(line: CartLine, currentUserId: string | null) {
  if (line.user_id === currentUserId) {
    return "You";
  }

  if (line.member?.invited_email) {
    return line.member.invited_email;
  }

  return `Guest ${line.user_id.slice(0, 8)}`;
}

function getMenuItemName(line: CartLine) {
  return line.menuItem?.name ?? "Menu item";
}

function getMenuItemPriceCents(menuItem: MenuItemRow | null) {
  return menuItem?.price_cents ?? 0;
}

function getCartLineTotalCents(line: CartLine) {
  return getMenuItemPriceCents(line.menuItem) * (line.quantity ?? 1);
}

function formatCurrency(cents: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(cents / 100);
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
  groupCard: {
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
  groupHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
  },
  groupHeaderText: {
    flex: 1,
  },
  eyebrow: {
    color: "#6B7280",
    fontSize: 12,
    fontWeight: "800",
    textTransform: "uppercase",
    marginBottom: 4,
  },
  groupName: {
    color: "#111827",
    fontSize: 18,
    fontWeight: "800",
  },
  groupMetaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    borderTopWidth: 1,
    borderTopColor: "#E5E7EB",
    marginTop: 14,
    paddingTop: 14,
  },
  groupMetaText: {
    color: "#111827",
    fontSize: 15,
    fontWeight: "800",
  },
  hostBadge: {
    backgroundColor: "#F3E8FF",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    alignSelf: "flex-start",
  },
  guestBadge: {
    backgroundColor: "#DBEAFE",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    alignSelf: "flex-start",
  },
  badgeText: {
    color: "#111827",
    fontSize: 12,
    fontWeight: "800",
    textTransform: "uppercase",
  },
  emptyCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    padding: 24,
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
  },
  ownerSection: {
    gap: 10,
  },
  ownerHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  ownerTitle: {
    color: "#111827",
    fontSize: 20,
    fontWeight: "800",
  },
  ownerTotal: {
    color: "#111827",
    fontSize: 16,
    fontWeight: "800",
  },
  ownerItems: {
    gap: 12,
  },
  cartLineCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    flexDirection: "row",
    gap: 14,
    shadowColor: "#000000",
    shadowOpacity: 0.05,
    shadowRadius: 10,
    shadowOffset: {
      width: 0,
      height: 4,
    },
    elevation: 2,
  },
  cartLineInfo: {
    flex: 1,
  },
  itemName: {
    color: "#111827",
    fontSize: 17,
    fontWeight: "800",
  },
  itemDescription: {
    color: "#6B7280",
    fontSize: 14,
    lineHeight: 20,
    marginTop: 4,
  },
  itemPrice: {
    color: "#6B7280",
    fontSize: 13,
    fontWeight: "700",
    marginTop: 8,
  },
  cartLineRight: {
    alignItems: "flex-end",
    gap: 8,
  },
  lineTotal: {
    color: "#111827",
    fontSize: 15,
    fontWeight: "800",
  },
  quantityControls: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  quantityButton: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: "#EFF6FF",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#BFDBFE",
  },
  quantityButtonText: {
    color: "#2563EB",
    fontSize: 18,
    fontWeight: "900",
  },
  quantityValue: {
    minWidth: 28,
    alignItems: "center",
  },
  quantityText: {
    color: "#111827",
    fontSize: 15,
    fontWeight: "800",
  },
  quantityReadOnly: {
    color: "#6B7280",
    fontSize: 13,
    fontWeight: "700",
  },
  removeText: {
    color: "#B91C1C",
    fontSize: 13,
    fontWeight: "800",
  },
  summaryCard: {
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
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
  },
  summaryLabel: {
    color: "#111827",
    fontSize: 18,
    fontWeight: "800",
  },
  summaryValue: {
    color: "#111827",
    fontSize: 18,
    fontWeight: "800",
  },
  summaryMutedLabel: {
    color: "#6B7280",
    fontSize: 14,
    fontWeight: "700",
  },
  summaryMutedValue: {
    color: "#6B7280",
    fontSize: 14,
    fontWeight: "800",
  },
  checkoutButton: {
    backgroundColor: "#2563EB",
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 50,
    marginTop: 4,
  },
  checkoutButtonText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "800",
  },
  primaryButton: {
    backgroundColor: "#2563EB",
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 50,
  },
  primaryButtonText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "800",
  },
  buttonPressed: {
    opacity: 0.65,
  },
  guestNotice: {
    backgroundColor: "#EFF6FF",
    borderColor: "#BFDBFE",
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
  },
  guestNoticeTitle: {
    color: "#1D4ED8",
    fontSize: 14,
    fontWeight: "800",
  },
  guestNoticeText: {
    color: "#1E40AF",
    fontSize: 13,
    lineHeight: 19,
    marginTop: 2,
  },
});
