import { useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import {
    ActivityIndicator,
    Pressable,
    StyleSheet,
    Text,
    View,
} from "react-native";

import { ActiveGroupOrder, getActiveGroupOrder } from "@/lib/activeGroupOrder";

type ActiveGroupOrderBannerProps = {
  onPress?: () => void;
  showEmptyState?: boolean;
};

export function ActiveGroupOrderBanner({
  onPress,
  showEmptyState = true,
}: ActiveGroupOrderBannerProps) {
  const [groupOrder, setGroupOrder] = useState<ActiveGroupOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const loadActiveGroupOrder = useCallback(async () => {
    try {
      setErrorMessage(null);

      const activeGroupOrder = await getActiveGroupOrder();

      setGroupOrder(activeGroupOrder);
    } catch (error) {
      console.error("Failed to load active group order:", error);
      setErrorMessage("Could not load active group order.");
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      loadActiveGroupOrder();
    }, [loadActiveGroupOrder]),
  );

  if (loading) {
    return (
      <View style={styles.card}>
        <View style={styles.loadingRow}>
          <ActivityIndicator />
          <Text style={styles.mutedText}>Checking active group order...</Text>
        </View>
      </View>
    );
  }

  if (errorMessage) {
    return (
      <View style={[styles.card, styles.errorCard]}>
        <Text style={styles.errorTitle}>Group order unavailable</Text>
        <Text style={styles.errorText}>{errorMessage}</Text>
      </View>
    );
  }

  if (!groupOrder) {
    if (!showEmptyState) {
      return null;
    }

    return (
      <View style={styles.card}>
        <Text style={styles.title}>No active group order</Text>
        <Text style={styles.mutedText}>
          Create or join a group order before adding items.
        </Text>
      </View>
    );
  }

  const participantLabel =
    typeof groupOrder.participantCount === "number"
      ? `${groupOrder.participantCount} participant${
          groupOrder.participantCount === 1 ? "" : "s"
        }`
      : null;

  const content = (
    <>
      <View style={styles.headerRow}>
        <View style={styles.titleContainer}>
          <Text style={styles.eyebrow}>Active group order</Text>
          <Text style={styles.title}>{groupOrder.title}</Text>
        </View>

        <View style={groupOrder.isHost ? styles.hostBadge : styles.guestBadge}>
          <Text style={styles.badgeText}>
            {groupOrder.isHost ? "Host" : "Guest"}
          </Text>
        </View>
      </View>

      <View style={styles.metaRow}>
        {participantLabel ? (
          <Text style={styles.mutedText}>{participantLabel}</Text>
        ) : null}

        {groupOrder.inviteCode ? (
          <Text style={styles.mutedText}>Invite: {groupOrder.inviteCode}</Text>
        ) : null}
      </View>

      {onPress ? <Text style={styles.linkText}>View cart</Text> : null}
    </>
  );

  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
      >
        {content}
      </Pressable>
    );
  }

  return <View style={styles.card}>{content}</View>;
}

const styles = StyleSheet.create({
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
  errorCard: {
    backgroundColor: "#FEF2F2",
    borderColor: "#FCA5A5",
  },
  loadingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
  },
  titleContainer: {
    flex: 1,
  },
  eyebrow: {
    color: "#6B7280",
    fontSize: 12,
    fontWeight: "800",
    textTransform: "uppercase",
    marginBottom: 4,
  },
  title: {
    color: "#111827",
    fontSize: 17,
    fontWeight: "800",
  },
  mutedText: {
    color: "#6B7280",
    fontSize: 14,
    lineHeight: 20,
  },
  errorTitle: {
    color: "#B91C1C",
    fontSize: 15,
    fontWeight: "800",
    marginBottom: 4,
  },
  errorText: {
    color: "#B91C1C",
    fontSize: 14,
    lineHeight: 20,
  },
  metaRow: {
    marginTop: 10,
    gap: 4,
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
  linkText: {
    color: "#2563EB",
    fontSize: 14,
    fontWeight: "800",
    marginTop: 12,
  },
});
