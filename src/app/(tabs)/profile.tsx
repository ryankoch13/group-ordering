import { router } from "expo-router";
import { useEffect, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    Pressable,
    StyleSheet,
    Text,
    TextInput,
    View,
} from "react-native";

import { useActiveGroupOrderSync } from "@/hooks/useActiveGroupOrderSync";
import { createHostedGroupOrder } from "@/lib/groups";
import { supabase } from "@/lib/supabase";
import { useGroupOrderStore } from "@/store/groupOrderStore";

export default function ProfileScreen() {
  const [email, setEmail] = useState<string>("Loading...");
  const [newGroupName, setNewGroupName] = useState("");
  const [creatingGroup, setCreatingGroup] = useState(false);

  const activeGroupOrderId = useGroupOrderStore(
    (state) => state.activeGroupOrderId,
  );
  const groupName = useGroupOrderStore((state) => state.groupName);
  const inviteCode = useGroupOrderStore((state) => state.inviteCode);
  const isHost = useGroupOrderStore((state) => state.isHost);
  const setActiveGroup = useGroupOrderStore((state) => state.setActiveGroup);
  const clearActiveGroup = useGroupOrderStore(
    (state) => state.clearActiveGroup,
  );

  const { loading: loadingGroup, errorMessage } = useActiveGroupOrderSync();

  useEffect(() => {
    let mounted = true;

    const loadUser = async () => {
      const { data, error } = await supabase.auth.getUser();

      if (!mounted) {
        return;
      }

      if (error) {
        setEmail("Could not load user");
        return;
      }

      setEmail(data.user?.email ?? "Not signed in");
    };

    loadUser();

    return () => {
      mounted = false;
    };
  }, []);

  const handleCreateGroupOrder = async () => {
    setCreatingGroup(true);

    try {
      const { group, currentUserId } =
        await createHostedGroupOrder(newGroupName);

      setActiveGroup(group, currentUserId);
      setNewGroupName("");

      Alert.alert("Group order created", "You can now invite people to join.");
    } catch (error) {
      console.log("PROFILE CREATE GROUP ERROR:", error);

      Alert.alert(
        "Could not create group order",
        error instanceof Error ? error.message : "Something went wrong.",
      );
    } finally {
      setCreatingGroup(false);
    }
  };

  const handleSignOut = async () => {
    const { error } = await supabase.auth.signOut();

    if (error) {
      Alert.alert("Sign out failed", error.message);
      return;
    }

    clearActiveGroup();
    router.replace("/login");
  };

  return (
    <View style={styles.screen}>
      <View style={styles.profileCard}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {email && email !== "Loading..."
              ? email.charAt(0).toUpperCase()
              : "?"}
          </Text>
        </View>

        <Text style={styles.email}>{email}</Text>
        <Text style={styles.role}>{isHost ? "Host" : "Guest"}</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Current Group</Text>

        {loadingGroup ? (
          <View style={styles.loadingRow}>
            <ActivityIndicator color="#2563EB" />
            <Text style={styles.loadingText}>Loading group order...</Text>
          </View>
        ) : errorMessage ? (
          <Text style={styles.errorText}>{errorMessage}</Text>
        ) : activeGroupOrderId ? (
          <>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Order</Text>
              <Text style={styles.infoValue}>{groupName}</Text>
            </View>

            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Role</Text>
              <Text style={styles.infoValue}>{isHost ? "Host" : "Guest"}</Text>
            </View>

            <View style={styles.inviteBox}>
              <Text style={styles.inviteLabel}>Invite Code</Text>
              <Text selectable style={styles.inviteCode}>
                {inviteCode}
              </Text>
              <Text style={styles.inviteHint}>
                People will use this code to join the group order.
              </Text>
            </View>
          </>
        ) : (
          <>
            <Text style={styles.emptyGroupText}>
              You are not in a group order yet. Create one to become the host.
            </Text>

            <TextInput
              value={newGroupName}
              onChangeText={setNewGroupName}
              placeholder="Example: Friday Lunch"
              placeholderTextColor="#8A8A8A"
              style={styles.input}
            />

            <Pressable
              style={[
                styles.createButton,
                creatingGroup && styles.buttonDisabled,
              ]}
              onPress={handleCreateGroupOrder}
              disabled={creatingGroup}
            >
              {creatingGroup ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.createButtonText}>Create Group Order</Text>
              )}
            </Pressable>
          </>
        )}
      </View>

      <Pressable style={styles.signOutButton} onPress={handleSignOut}>
        <Text style={styles.signOutButtonText}>Sign Out</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#F6F7FB",
    padding: 16,
  },
  profileCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 20,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    marginBottom: 14,
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "#2563EB",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  avatarText: {
    color: "#FFFFFF",
    fontSize: 30,
    fontWeight: "900",
  },
  email: {
    color: "#111827",
    fontSize: 17,
    fontWeight: "900",
  },
  role: {
    color: "#2563EB",
    fontWeight: "900",
    marginTop: 5,
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
    color: "#111827",
    fontSize: 18,
    fontWeight: "900",
    marginBottom: 12,
  },
  loadingRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  loadingText: {
    color: "#6B7280",
    fontWeight: "700",
    marginLeft: 10,
  },
  errorText: {
    color: "#EF4444",
    lineHeight: 20,
  },
  emptyGroupText: {
    color: "#6B7280",
    lineHeight: 22,
    marginBottom: 12,
  },
  input: {
    borderWidth: 1,
    borderColor: "#D1D5DB",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 13,
    fontSize: 16,
    color: "#111827",
    backgroundColor: "#FFFFFF",
    marginBottom: 12,
  },
  createButton: {
    backgroundColor: "#2563EB",
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
  },
  createButtonText: {
    color: "#FFFFFF",
    fontWeight: "900",
    fontSize: 16,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 9,
  },
  infoLabel: {
    color: "#6B7280",
    fontWeight: "700",
  },
  infoValue: {
    color: "#111827",
    fontWeight: "900",
  },
  inviteBox: {
    marginTop: 12,
    backgroundColor: "#EFF6FF",
    borderRadius: 14,
    padding: 14,
  },
  inviteLabel: {
    color: "#2563EB",
    fontWeight: "900",
    marginBottom: 6,
  },
  inviteCode: {
    color: "#111827",
    fontSize: 24,
    fontWeight: "900",
    letterSpacing: 2,
  },
  inviteHint: {
    color: "#6B7280",
    lineHeight: 20,
    marginTop: 6,
  },
  signOutButton: {
    backgroundColor: "#EF4444",
    borderRadius: 16,
    paddingVertical: 15,
    alignItems: "center",
    marginTop: 4,
  },
  signOutButtonText: {
    color: "#FFFFFF",
    fontWeight: "900",
    fontSize: 16,
  },
});
