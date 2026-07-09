import { router } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
    ActivityIndicator,
    FlatList,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from "react-native";

import { useActiveGroupOrderSync } from "@/hooks/useActiveGroupOrderSync";
import { useCartSync } from "@/hooks/useCartSync";
import { getMenuItems } from "@/lib/items";
import { useGroupOrderStore } from "@/store/groupOrderStore";
import type { MenuItem } from "@/types/shop";
import { formatCurrency } from "@/utils/money";

export default function MenuScreen() {
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [addingItemId, setAddingItemId] = useState<string | null>(null);

  const { addItemToCart } = useCartSync();
  const cart = useGroupOrderStore((state) => state.cart);
  const groupName = useGroupOrderStore((state) => state.groupName);
  useActiveGroupOrderSync();

  const handleAddToCart = async (menuItemId: string) => {
    setAddingItemId(menuItemId);

    try {
      await addItemToCart(menuItemId);
    } finally {
      setAddingItemId(null);
    }
  };

  const cartCount = cart.reduce((total, item) => total + item.quantity, 0);

  const loadMenu = useCallback(async () => {
    try {
      setErrorMessage(null);

      const items = await getMenuItems();

      setMenuItems(items);
    } catch (error) {
      console.log("LOAD MENU ERROR:", error);

      setErrorMessage(
        error instanceof Error ? error.message : "Could not load menu items.",
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadMenu();
  }, [loadMenu]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadMenu();
  };

  const categories = useMemo(() => {
    return [
      "All",
      ...Array.from(new Set(menuItems.map((item) => item.category))),
    ];
  }, [menuItems]);

  const visibleItems = useMemo(() => {
    if (selectedCategory === "All") {
      return menuItems;
    }

    return menuItems.filter((item) => item.category === selectedCategory);
  }, [menuItems, selectedCategory]);

  const renderMenuItem = ({ item }: { item: MenuItem }) => {
    return (
      <View style={styles.menuCard}>
        <View style={styles.itemEmojiBox}>
          <Text style={styles.itemEmoji}>{item.imageEmoji}</Text>
        </View>

        <View style={styles.itemContent}>
          <View style={styles.itemHeader}>
            <Text style={styles.itemName}>{item.name}</Text>
            <Text style={styles.itemPrice}>
              {formatCurrency(item.priceCents)}
            </Text>
          </View>

          <Text style={styles.itemDescription}>{item.description}</Text>

          <Pressable
            style={[
              styles.addButton,
              addingItemId === item.id && styles.buttonDisabled,
            ]}
            onPress={() => handleAddToCart(item.id)}
            disabled={addingItemId === item.id}
          >
            <Text style={styles.addButtonText}>
              {addingItemId === item.id ? "Adding..." : "Add to Cart"}
            </Text>
          </Pressable>
        </View>
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.centerScreen}>
        <ActivityIndicator size="large" color="#2563EB" />
        <Text style={styles.loadingText}>Loading menu...</Text>
      </View>
    );
  }

  if (errorMessage) {
    return (
      <View style={styles.centerScreen}>
        <Text style={styles.errorTitle}>Could not load menu</Text>
        <Text style={styles.errorText}>{errorMessage}</Text>

        <Pressable style={styles.primaryButton} onPress={loadMenu}>
          <Text style={styles.primaryButtonText}>Try Again</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <View style={styles.headerCard}>
        <View style={styles.headerTextBlock}>
          <Text style={styles.eyebrow}>Current group order</Text>
          <Text style={styles.groupName}>{groupName}</Text>
        </View>

        <Pressable
          style={styles.cartButton}
          onPress={() => router.push("/(tabs)/cart")}
        >
          <Text style={styles.cartButtonText}>Cart {cartCount}</Text>
        </Pressable>
      </View>

      <FlatList
        data={visibleItems}
        keyExtractor={(item) => item.id}
        renderItem={renderMenuItem}
        refreshing={refreshing}
        onRefresh={handleRefresh}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.categoryRow}
          >
            {categories.map((category) => {
              const selected = category === selectedCategory;

              return (
                <Pressable
                  key={category}
                  onPress={() => setSelectedCategory(category)}
                  style={[
                    styles.categoryChip,
                    selected && styles.categoryChipSelected,
                  ]}
                >
                  <Text
                    style={[
                      styles.categoryChipText,
                      selected && styles.categoryChipTextSelected,
                    ]}
                  >
                    {category}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        }
        ListEmptyComponent={
          <View style={styles.emptyBox}>
            <Text style={styles.emptyTitle}>No menu items yet</Text>
            <Text style={styles.emptyText}>
              Add items to the menu_items table in Supabase.
            </Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#F6F7FB",
  },
  centerScreen: {
    flex: 1,
    backgroundColor: "#F6F7FB",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  loadingText: {
    marginTop: 12,
    color: "#6B7280",
    fontWeight: "700",
  },
  errorTitle: {
    fontSize: 22,
    fontWeight: "900",
    color: "#111827",
    marginBottom: 8,
    textAlign: "center",
  },
  errorText: {
    color: "#6B7280",
    textAlign: "center",
    lineHeight: 22,
    marginBottom: 18,
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
  buttonDisabled: {
    opacity: 0.6,
  },
  headerCard: {
    margin: 16,
    padding: 16,
    borderRadius: 18,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  headerTextBlock: {
    flex: 1,
    marginRight: 12,
  },
  eyebrow: {
    fontSize: 12,
    color: "#6B7280",
    fontWeight: "700",
    textTransform: "uppercase",
    marginBottom: 4,
  },
  groupName: {
    fontSize: 20,
    color: "#111827",
    fontWeight: "800",
  },
  cartButton: {
    backgroundColor: "#2563EB",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
  },
  cartButtonText: {
    color: "#FFFFFF",
    fontWeight: "800",
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  categoryRow: {
    paddingBottom: 14,
  },
  categoryChip: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 999,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    marginRight: 10,
  },
  categoryChipSelected: {
    backgroundColor: "#2563EB",
    borderColor: "#2563EB",
  },
  categoryChipText: {
    color: "#374151",
    fontWeight: "700",
  },
  categoryChipTextSelected: {
    color: "#FFFFFF",
  },
  menuCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    marginBottom: 12,
    flexDirection: "row",
  },
  itemEmojiBox: {
    width: 58,
    height: 58,
    borderRadius: 16,
    backgroundColor: "#F3F4F6",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  itemEmoji: {
    fontSize: 30,
  },
  itemContent: {
    flex: 1,
  },
  itemHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  itemName: {
    flex: 1,
    fontSize: 16,
    fontWeight: "800",
    color: "#111827",
    marginRight: 10,
  },
  itemPrice: {
    fontSize: 15,
    fontWeight: "800",
    color: "#2563EB",
  },
  itemDescription: {
    color: "#6B7280",
    lineHeight: 20,
    marginTop: 6,
    marginBottom: 12,
  },
  addButton: {
    alignSelf: "flex-start",
    backgroundColor: "#EFF6FF",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
  },
  addButtonText: {
    color: "#2563EB",
    fontWeight: "800",
  },
  emptyBox: {
    paddingVertical: 60,
    alignItems: "center",
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: "900",
    color: "#111827",
    marginBottom: 6,
  },
  emptyText: {
    color: "#6B7280",
    textAlign: "center",
  },
});
