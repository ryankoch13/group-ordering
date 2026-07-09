import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { supabase } from "@/lib/supabase";

type ConfirmationMode = "created" | "joined";

type GroupOrderRow = {
  id: string;
  name: string | null;
  host_user_id: string | null;
  invite_code: string | null;
  status: string | null;
  created_at: string | null;
  checked_out_at?: string | null;
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

export default function GroupConfirmationScreen() {
  const params = useLocalSearchParams<{
    groupOrderId?: string | string[];
    mode?: string | string[];
  }>();

  const groupOrderId = Array.isArray(params.groupOrderId)
    ? params.groupOrderId[0]
    : params.groupOrderId;

  const modeParam = Array.isArray(params.mode) ? params.mode[0] : params.mode;

  const mode: ConfirmationMode = modeParam === "created" ? "created" : "joined";

  const [groupOrder, setGroupOrder] = useState<GroupOrderRow | null>(null);
  const [member, setMember] = useState<GroupMemberRow | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [memberCount, setMemberCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const isHost = useMemo(() => {
    return Boolean(currentUserId && groupOrder?.host_user_id === currentUserId);
  }, [currentUserId, groupOrder?.host_user_id]);

  const title =
    mode === "created" ? "Group order created" : "You joined the order";

  const subtitle =
    mode === "created"
      ? "Your group order is ready. Share the invite code with guests so they can add their items."
      : "You’re in. Add your items from the menu and the host can checkout when everyone is ready.";

  const loadConfirmation = useCallback(async () => {
    try {
      setLoading(true);
      setErrorMessage(null);

      const authResult = await withTimeout(
        supabase.auth.getUser(),
        8000,
        "Auth lookup",
      );

      if (authResult.error) {
        throw authResult.error;
      }

      const user = authResult.data.user;

      if (!user) {
        setErrorMessage("You need to be signed in to view this group order.");
        return;
      }

      setCurrentUserId(user.id);

      if (!groupOrderId) {
        if (!groupOrderId) {
          router.replace("/(tabs)/profile");
          return;
        }
      }

      const groupOrderResult = await withTimeout(
        supabase
          .from("group_orders")
          .select("*")
          .eq("id", groupOrderId)
          .maybeSingle(),
        8000,
        "Group order lookup",
      );

      if (groupOrderResult.error) {
        throw groupOrderResult.error;
      }

      if (!groupOrderResult.data) {
        setErrorMessage("This group order could not be found.");
        return;
      }

      const memberResult = await withTimeout(
        supabase
          .from("group_members")
          .select("*")
          .eq("group_order_id", groupOrderId)
          .eq("user_id", user.id)
          .maybeSingle(),
        8000,
        "Group member lookup",
      );

      if (memberResult.error) {
        throw memberResult.error;
      }

      const countResult = await withTimeout(
        supabase
          .from("group_members")
          .select("id", { count: "exact", head: true })
          .eq("group_order_id", groupOrderId),
        8000,
        "Group member count lookup",
      );

      if (countResult.error) {
        console.warn("Could not load group member count:", countResult.error);
      }

      setGroupOrder(groupOrderResult.data as GroupOrderRow);
      setMember((memberResult.data as GroupMemberRow | null) ?? null);
      setMemberCount(
        typeof countResult.count === "number" ? countResult.count : null,
      );
    } catch (error) {
      console.error("Failed to load confirmation:", error);
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Could not load this group order.",
      );
    } finally {
      setLoading(false);
    }
  }, [groupOrderId]);

  useFocusEffect(
    useCallback(() => {
      loadConfirmation();
    }, [loadConfirmation]),
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.screen}>
        <View style={styles.centered}>
          <ActivityIndicator />
          <Text style={styles.loadingText}>Loading group order...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (errorMessage || !groupOrder) {
    return (
      <SafeAreaView style={styles.screen}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorTitle}>Something went wrong</Text>
          <Text style={styles.errorText}>
            {errorMessage ?? "Could not load this group order."}
          </Text>

          <Pressable
            onPress={() => {
              router.replace("/(tabs)/profile");
            }}
            style={({ pressed }) => [
              styles.primaryButton,
              pressed && styles.buttonPressed,
            ]}
          >
            <Text style={styles.primaryButtonText}>Go to profile</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  const roleLabel = isHost ? "Host" : (member?.role ?? "Guest");
  const memberName = member?.invited_email ?? null;

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.successIcon}>
          <Text style={styles.successIconText}>✓</Text>
        </View>

        <View style={styles.titleBlock}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.subtitle}>{subtitle}</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardEyebrow}>Active group order</Text>
          <Text style={styles.groupName}>
            {groupOrder.name ?? "Group order"}
          </Text>

          <View style={styles.detailList}>
            <DetailRow label="Your role" value={capitalize(roleLabel)} />

            {memberName ? (
              <DetailRow label="Ordering as" value={memberName} />
            ) : null}

            {typeof memberCount === "number" ? (
              <DetailRow
                label="Members"
                value={`${memberCount} member${memberCount === 1 ? "" : "s"}`}
              />
            ) : null}

            {groupOrder.status ? (
              <DetailRow label="Status" value={capitalize(groupOrder.status)} />
            ) : null}
          </View>
        </View>

        {groupOrder.invite_code ? (
          <View style={styles.inviteCard}>
            <Text style={styles.cardEyebrow}>Invite code</Text>
            <Text selectable style={styles.inviteCode}>
              {groupOrder.invite_code}
            </Text>
            <Text style={styles.inviteHelp}>
              Share this code with guests so they can join this group order.
            </Text>
          </View>
        ) : null}

        <View style={styles.actions}>
          <Pressable
            onPress={() => {
              router.replace("/(tabs)/menu");
            }}
            style={({ pressed }) => [
              styles.primaryButton,
              pressed && styles.buttonPressed,
            ]}
          >
            <Text style={styles.primaryButtonText}>Go to menu</Text>
          </Pressable>

          <Pressable
            onPress={() => {
              router.replace("/(tabs)/cart");
            }}
            style={({ pressed }) => [
              styles.secondaryButton,
              pressed && styles.buttonPressed,
            ]}
          >
            <Text style={styles.secondaryButtonText}>View cart</Text>
          </Pressable>
        </View>

        {isHost ? (
          <View style={styles.noteCard}>
            <Text style={styles.noteTitle}>Host reminder</Text>
            <Text style={styles.noteText}>
              Guests can add their own items, but only you can checkout the
              final group order.
            </Text>
          </View>
        ) : (
          <View style={styles.noteCard}>
            <Text style={styles.noteTitle}>Guest reminder</Text>
            <Text style={styles.noteText}>
              Add your items from the menu. The host will checkout once everyone
              is ready.
            </Text>
          </View>
        )}
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

function capitalize(value: string) {
  if (!value) {
    return value;
  }

  return value.charAt(0).toUpperCase() + value.slice(1);
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#F8FAFC",
  },
  content: {
    padding: 20,
    paddingBottom: 40,
    gap: 16,
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
  successIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "#DCFCE7",
    borderWidth: 1,
    borderColor: "#86EFAC",
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "center",
    marginTop: 12,
  },
  successIconText: {
    color: "#047857",
    fontSize: 38,
    fontWeight: "900",
  },
  titleBlock: {
    alignItems: "center",
    gap: 8,
  },
  title: {
    color: "#111827",
    fontSize: 30,
    fontWeight: "900",
    textAlign: "center",
  },
  subtitle: {
    color: "#6B7280",
    fontSize: 15,
    lineHeight: 22,
    textAlign: "center",
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
  inviteCard: {
    backgroundColor: "#EFF6FF",
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: "#BFDBFE",
  },
  cardEyebrow: {
    color: "#6B7280",
    fontSize: 12,
    fontWeight: "900",
    textTransform: "uppercase",
    marginBottom: 6,
  },
  groupName: {
    color: "#111827",
    fontSize: 22,
    fontWeight: "900",
  },
  detailList: {
    marginTop: 14,
    borderTopWidth: 1,
    borderTopColor: "#F3F4F6",
  },
  detailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  detailLabel: {
    color: "#6B7280",
    fontSize: 14,
    fontWeight: "700",
  },
  detailValue: {
    color: "#111827",
    fontSize: 14,
    fontWeight: "900",
    flex: 1,
    textAlign: "right",
  },
  inviteCode: {
    color: "#1D4ED8",
    fontSize: 34,
    fontWeight: "900",
    letterSpacing: 3,
    textAlign: "center",
    marginTop: 4,
  },
  inviteHelp: {
    color: "#1E40AF",
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center",
    marginTop: 8,
  },
  actions: {
    gap: 12,
  },
  primaryButton: {
    backgroundColor: "#2563EB",
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 52,
  },
  primaryButtonText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "900",
  },
  secondaryButton: {
    backgroundColor: "#FFFFFF",
    borderColor: "#D1D5DB",
    borderWidth: 1,
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 52,
  },
  secondaryButtonText: {
    color: "#111827",
    fontSize: 15,
    fontWeight: "900",
  },
  buttonPressed: {
    opacity: 0.7,
    transform: [{ scale: 0.995 }],
  },
  noteCard: {
    backgroundColor: "#FFFFFF",
    borderColor: "#E5E7EB",
    borderWidth: 1,
    borderRadius: 18,
    padding: 16,
  },
  noteTitle: {
    color: "#111827",
    fontSize: 15,
    fontWeight: "900",
    marginBottom: 4,
  },
  noteText: {
    color: "#6B7280",
    fontSize: 14,
    lineHeight: 20,
  },
  errorContainer: {
    flex: 1,
    padding: 20,
    justifyContent: "center",
    gap: 12,
  },
  errorTitle: {
    color: "#111827",
    fontSize: 26,
    fontWeight: "900",
    textAlign: "center",
  },
  errorText: {
    color: "#6B7280",
    fontSize: 15,
    lineHeight: 22,
    textAlign: "center",
    marginBottom: 8,
  },
});
