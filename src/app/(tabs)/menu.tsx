import { useFocusEffect } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    FlatList,
    Pressable,
    RefreshControl,
    SafeAreaView,
    StyleSheet,
    Text,
    View,
} from "react-native";

import { getActiveGroupOrder } from "@/lib/activeGroupOrder";
import { supabase } from "@/lib/supabase";

type MenuItemRow = {
  id: string;
  name: string;
  description?: string | null;
  category?: string | null;
  price_cents: number;
  image_emoji?: string | null;
  is_available?: boolean | null;
  created_at?: string | null;
};

type CartItemRow = {
  id: string;
  group_order_id: string;
  user_id: string;
  menu_item_id: string;
  quantity: number;
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

export default function MenuScreen() {
  const [menuItems, setMenuItems] = useState<MenuItemRow[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [addingItemId, setAddingItemId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const groupedMenuItems = useMemo(() => {
    return menuItems.reduce<Record<string, MenuItemRow[]>>((acc, item) => {
      const category = item.category?.trim() || "Menu";

      if (!acc[category]) {
        acc[category] = [];
      }

      acc[category].push(item);
      return acc;
    }, {});
  }, [menuItems]);

  const menuSections = useMemo(() => {
    return Object.entries(groupedMenuItems).map(([category, items]) => ({
      category,
      items,
    }));
  }, [groupedMenuItems]);

  const loadMenu = useCallback(async (options?: { showLoading?: boolean }) => {
    console.log("Menu load started");

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

      console.log("Auth loaded");

      if (authResult.error) {
        throw authResult.error;
      }

      const menuResult = await withTimeout(
        supabase
          .from("menu_items")
          .select("*")
          .order("category", { ascending: true })
          .order("name", { ascending: true }),
        8000,
        "Menu items lookup",
      );

      console.log("Menu loaded", menuResult.data?.length ?? 0);

      if (menuResult.error) {
        throw menuResult.error;
      }

      const availableItems = ((menuResult.data ?? []) as MenuItemRow[]).filter(
        (item) => item.is_available !== false,
      );

      setCurrentUserId(authResult.data.user?.id ?? null);
      setMenuItems(availableItems);

      if (!authResult.data.user) {
        setErrorMessage("You need to be signed in to add items.");
      }
    } catch (error) {
      console.error("Failed to load menu:", error);

      setErrorMessage(
        error instanceof Error ? error.message : "Could not load the menu.",
      );
    } finally {
      console.log("Menu load finished");
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadMenu({ showLoading: true });
    }, [loadMenu]),
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadMenu({ showLoading: false });
  }, [loadMenu]);

  const handleAddToCart = useCallback(
    async (item: MenuItemRow) => {
      if (!currentUserId) {
        Alert.alert("Sign in required", "Please sign in before adding items.");
        return;
      }

      try {
        setAddingItemId(item.id);
        setErrorMessage(null);

        const activeGroupOrder = await getActiveGroupOrder();

        if (!activeGroupOrder) {
          Alert.alert(
            "No active group order",
            "Create or join a group order before adding items.",
          );
          return;
        }

        const { data: existingCartItem, error: existingError } = await supabase
          .from("cart_items")
          .select("id, quantity")
          .eq("group_order_id", activeGroupOrder.id)
          .eq("user_id", currentUserId)
          .eq("menu_item_id", item.id)
          .maybeSingle();

        if (existingError) {
          throw existingError;
        }

        if (existingCartItem) {
          const { error: updateError } = await supabase
            .from("cart_items")
            .update({
              quantity: (existingCartItem.quantity ?? 1) + 1,
            })
            .eq("id", existingCartItem.id);

          if (updateError) {
            throw updateError;
          }
        } else {
          const { error: insertError } = await supabase
            .from("cart_items")
            .insert({
              group_order_id: activeGroupOrder.id,
              user_id: currentUserId,
              menu_item_id: item.id,
              quantity: 1,
            });

          if (insertError) {
            throw insertError;
          }
        }
      } catch (error) {
        console.error("Failed to add item to cart:", error);
        Alert.alert(
          "Could not add item",
          error instanceof Error ? error.message : "Please try again.",
        );
      } finally {
        setAddingItemId(null);
      }
    },
    [currentUserId],
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.screen}>
        <View style={styles.centered}>
          <ActivityIndicator />
          <Text style={styles.loadingText}>Loading menu...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.screen}>
      <FlatList
        data={menuSections}
        keyExtractor={(section) => section.category}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        contentContainerStyle={
          menuSections.length === 0 ? styles.emptyList : styles.list
        }
        ListHeaderComponent={
          <View>
            <View style={styles.header}>
              <Text style={styles.title}>Menu</Text>
              <Text style={styles.subtitle}>
                Choose items for your group order.
              </Text>
            </View>

            <View style={styles.bannerContainer}></View>

            {errorMessage ? (
              <View style={styles.messageCard}>
                <Text style={styles.errorText}>{errorMessage}</Text>
              </View>
            ) : null}
          </View>
        }
        ListEmptyComponent={
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>No menu items yet</Text>
            <Text style={styles.emptyText}>
              Add menu items in Supabase and they will appear here.
            </Text>
          </View>
        }
        renderItem={({ item: section }) => (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{section.category}</Text>

            <View style={styles.sectionItems}>
              {section.items.map((item) => (
                <MenuItemCard
                  key={item.id}
                  item={item}
                  disabled={!currentUserId}
                  adding={addingItemId === item.id}
                  onAdd={() => {
                    void handleAddToCart(item);
                  }}
                />
              ))}
            </View>
          </View>
        )}
      />
    </SafeAreaView>
  );
}

function MenuItemCard({
  item,
  adding,
  disabled,
  onAdd,
}: {
  item: MenuItemRow;
  adding: boolean;
  disabled: boolean;
  onAdd: () => void;
}) {
  return (
    <View style={styles.card}>
      <View style={styles.itemInfo}>
        <Text style={styles.itemName}>
          {item.image_emoji ? `${item.image_emoji} ` : ""}
          {item.name}
        </Text>

        {item.description ? (
          <Text style={styles.itemDescription}>{item.description}</Text>
        ) : null}

        <Text style={styles.itemPrice}>{formatMenuItemPrice(item)}</Text>
      </View>

      <Pressable
        disabled={disabled || adding}
        onPress={onAdd}
        style={({ pressed }) => [
          styles.addButton,
          (disabled || adding) && styles.addButtonDisabled,
          pressed && !disabled && !adding && styles.addButtonPressed,
        ]}
      >
        {adding ? (
          <ActivityIndicator color="#FFFFFF" size="small" />
        ) : (
          <Text style={styles.addButtonText}>Add</Text>
        )}
      </Pressable>
    </View>
  );
}

function formatMenuItemPrice(item: MenuItemRow) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format((item.price_cents ?? 0) / 100);
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#F8FAFC",
  },
  list: {
    paddingBottom: 32,
  },
  emptyList: {
    flexGrow: 1,
    paddingBottom: 32,
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
  bannerContainer: {
    paddingHorizontal: 20,
    marginBottom: 12,
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
  section: {
    paddingHorizontal: 20,
    marginTop: 16,
  },
  sectionTitle: {
    color: "#111827",
    fontSize: 20,
    fontWeight: "800",
    marginBottom: 10,
  },
  sectionItems: {
    gap: 12,
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    flexDirection: "row",
    alignItems: "center",
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
  itemInfo: {
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
    color: "#111827",
    fontSize: 15,
    fontWeight: "800",
    marginTop: 8,
  },
  addButton: {
    minWidth: 72,
    minHeight: 44,
    borderRadius: 14,
    backgroundColor: "#2563EB",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 14,
  },
  addButtonPressed: {
    opacity: 0.75,
    transform: [{ scale: 0.98 }],
  },
  addButtonDisabled: {
    backgroundColor: "#9CA3AF",
  },
  addButtonText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "800",
  },
  emptyCard: {
    marginHorizontal: 20,
    marginTop: 32,
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
});
