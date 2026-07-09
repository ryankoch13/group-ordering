import { router } from "expo-router";
import {
    Alert,
    FlatList,
    Pressable,
    StyleSheet,
    Text,
    View,
} from "react-native";

import { useCartSync } from "@/hooks/useCartSync";
import { useGroupOrderStore } from "@/store/groupOrderStore";
import type { CartItem } from "@/types/shop";
import { formatCurrency } from "@/utils/money";

export default function CartScreen() {
  const cart = useGroupOrderStore((state) => state.cart);
  const isHost = useGroupOrderStore((state) => state.isHost);
  const {
    loadingCart,
    updatingCart,
    increaseCartItem,
    decreaseCartItem,
    removeCartItem,
    clearCart,
  } = useCartSync();

  const totalCents = cart.reduce(
    (total, item) => total + item.menuItem.priceCents * item.quantity,
    0,
  );

  const handleCheckout = () => {
    if (cart.length === 0) {
      return;
    }

    if (!isHost) {
      Alert.alert(
        "Host checkout only",
        "Only the person who created this group order can checkout.",
      );
      return;
    }

    router.push("/checkout");
  };

  const renderCartItem = ({ item }: { item: CartItem }) => {
    return (
      <View style={styles.cartCard}>
        <View style={styles.bannerContainer}></View>
        <View style={styles.itemTopRow}>
          <View style={styles.itemEmojiBox}>
            <Text style={styles.itemEmoji}>{item.menuItem.imageEmoji}</Text>
          </View>

          <View style={styles.itemContent}>
            <Text style={styles.itemName}>{item.menuItem.name}</Text>
            <Text style={styles.itemPrice}>
              {formatCurrency(item.menuItem.priceCents)}
            </Text>
          </View>
        </View>

        <View style={styles.itemBottomRow}>
          <View style={styles.quantityRow}>
            <Pressable
              style={styles.quantityButton}
              onPress={() => decreaseCartItem(item.menuItem.id)}
            >
              <Text style={styles.quantityButtonText}>−</Text>
            </Pressable>

            <Text style={styles.quantityText}>{item.quantity}</Text>

            <Pressable
              style={styles.quantityButton}
              onPress={() => increaseCartItem(item.menuItem.id)}
            >
              <Text style={styles.quantityButtonText}>+</Text>
            </Pressable>
          </View>

          <Pressable onPress={() => removeCartItem(item.menuItem.id)}>
            <Text style={styles.removeText}>Remove</Text>
          </Pressable>
        </View>
      </View>
    );
  };

  if (cart.length === 0) {
    return (
      <View style={styles.emptyScreen}>
        <Text style={styles.emptyTitle}>Your cart is empty</Text>
        <Text style={styles.emptyText}>
          Add items from the menu before checking out.
        </Text>

        <Pressable
          style={styles.primaryButton}
          onPress={() => router.push("/(tabs)/menu")}
        >
          <Text style={styles.primaryButtonText}>Go to Menu</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <FlatList
        data={cart}
        keyExtractor={(item) => item.menuItem.id}
        renderItem={renderCartItem}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={
          <View style={styles.topRow}>
            <Text style={styles.title}>Cart</Text>

            <Pressable onPress={clearCart}>
              <Text style={styles.clearText}>Clear</Text>
            </Pressable>
          </View>
        }
      />

      <View style={styles.footer}>
        <View>
          <Text style={styles.totalLabel}>Total</Text>
          <Text style={styles.totalValue}>{formatCurrency(totalCents)}</Text>
        </View>

        <Pressable
          style={[
            styles.checkoutButton,
            !isHost && styles.checkoutButtonDisabled,
          ]}
          onPress={handleCheckout}
        >
          <Text style={styles.checkoutButtonText}>
            {isHost ? "Checkout" : "Host Only"}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#F6F7FB",
  },
  bannerContainer: {
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  listContent: {
    padding: 16,
    paddingBottom: 120,
  },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 14,
  },
  title: {
    fontSize: 28,
    fontWeight: "900",
    color: "#111827",
  },
  clearText: {
    color: "#EF4444",
    fontWeight: "800",
  },
  cartCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    marginBottom: 12,
  },
  itemTopRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  itemEmojiBox: {
    width: 52,
    height: 52,
    borderRadius: 14,
    backgroundColor: "#F3F4F6",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  itemEmoji: {
    fontSize: 28,
  },
  itemContent: {
    flex: 1,
  },
  itemName: {
    fontSize: 16,
    color: "#111827",
    fontWeight: "800",
  },
  itemPrice: {
    marginTop: 4,
    color: "#2563EB",
    fontWeight: "800",
  },
  itemBottomRow: {
    marginTop: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  quantityRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  quantityButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "#EFF6FF",
    alignItems: "center",
    justifyContent: "center",
  },
  quantityButtonText: {
    color: "#2563EB",
    fontSize: 20,
    fontWeight: "900",
  },
  quantityText: {
    width: 34,
    textAlign: "center",
    fontWeight: "900",
    color: "#111827",
  },
  removeText: {
    color: "#EF4444",
    fontWeight: "800",
  },
  footer: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    padding: 16,
    backgroundColor: "#FFFFFF",
    borderTopWidth: 1,
    borderTopColor: "#E5E7EB",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  totalLabel: {
    color: "#6B7280",
    fontWeight: "700",
  },
  totalValue: {
    marginTop: 2,
    color: "#111827",
    fontSize: 24,
    fontWeight: "900",
  },
  checkoutButton: {
    backgroundColor: "#2563EB",
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 14,
  },
  checkoutButtonDisabled: {
    backgroundColor: "#9CA3AF",
  },
  checkoutButtonText: {
    color: "#FFFFFF",
    fontWeight: "900",
    fontSize: 16,
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
