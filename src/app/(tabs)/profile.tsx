import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    KeyboardAvoidingView,
    Platform,
    Pressable,
    SafeAreaView,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    View,
} from "react-native";

import { supabase } from "@/lib/supabase";

type ProfileRow = {
  id: string;
  email: string | null;
  display_name: string | null;
  created_at?: string | null;
};

type GroupOrderRow = {
  id: string;
  name: string | null;
  host_user_id: string | null;
  invite_code: string | null;
  status: string | null;
  created_at: string | null;
  checked_out_at?: string | null;
};

function generateInviteCode() {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

export default function ProfileScreen() {
  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [activeGroupOrder, setActiveGroupOrder] =
    useState<GroupOrderRow | null>(null);
  const [groupName, setGroupName] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [loading, setLoading] = useState(true);
  const [creatingGroup, setCreatingGroup] = useState(false);
  const [joiningGroup, setJoiningGroup] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const loadProfile = useCallback(async () => {
    try {
      setLoading(true);
      setErrorMessage(null);

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError) {
        throw userError;
      }

      if (!user) {
        router.replace("/login");
        return;
      }

      const { data: profileRow, error: profileError } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .maybeSingle();

      if (profileError) {
        throw profileError;
      }

      setProfile(
        (profileRow as ProfileRow | null) ?? {
          id: user.id,
          email: user.email ?? null,
          display_name: null,
        },
      );

      const { data: hostedGroupRows, error: hostedError } = await supabase
        .from("group_orders")
        .select("*")
        .eq("host_user_id", user.id)
        .is("checked_out_at", null)
        .order("created_at", { ascending: false })
        .limit(1);

      if (hostedError) {
        throw hostedError;
      }

      if (hostedGroupRows?.[0]) {
        setActiveGroupOrder(hostedGroupRows[0] as GroupOrderRow);
        return;
      }

      const { data: memberRows, error: memberError } = await supabase
        .from("group_members")
        .select("group_order_id")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(1);

      if (memberError) {
        throw memberError;
      }

      const memberGroupOrderId = memberRows?.[0]?.group_order_id;

      if (!memberGroupOrderId) {
        setActiveGroupOrder(null);
        return;
      }

      const { data: memberGroupOrder, error: memberGroupError } = await supabase
        .from("group_orders")
        .select("*")
        .eq("id", memberGroupOrderId)
        .is("checked_out_at", null)
        .maybeSingle();

      if (memberGroupError) {
        throw memberGroupError;
      }

      setActiveGroupOrder((memberGroupOrder as GroupOrderRow | null) ?? null);
    } catch (error) {
      console.error("Failed to load profile:", error);
      setErrorMessage(
        error instanceof Error ? error.message : "Could not load profile.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadProfile();
    }, [loadProfile]),
  );

  const createGroupOrder = useCallback(async () => {
    const trimmedName = groupName.trim();

    if (!trimmedName) {
      Alert.alert("Group name required", "Please enter a group order name.");
      return;
    }

    try {
      setCreatingGroup(true);
      setErrorMessage(null);

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError) {
        throw userError;
      }

      if (!user) {
        throw new Error("You need to be signed in to create a group order.");
      }

      const generatedInviteCode = generateInviteCode();

      const { data: groupOrder, error: groupOrderError } = await supabase
        .from("group_orders")
        .insert({
          name: trimmedName,
          host_user_id: user.id,
          invite_code: generatedInviteCode,
          status: "open",
        })
        .select("*")
        .single();

      if (groupOrderError) {
        throw groupOrderError;
      }

      const typedGroupOrder = groupOrder as GroupOrderRow;

      const { error: memberError } = await supabase
        .from("group_members")
        .insert({
          group_order_id: typedGroupOrder.id,
          user_id: user.id,
          invited_email: user.email ?? null,
          role: "host",
          status: "joined",
        });

      if (memberError) {
        throw memberError;
      }

      setGroupName("");

      router.replace({
        pathname: "/group-confirmation",
        params: {
          groupOrderId: typedGroupOrder.id,
          mode: "created",
        },
      });
    } catch (error) {
      console.error("Failed to create group order:", error);
      Alert.alert(
        "Could not create group order",
        error instanceof Error ? error.message : "Please try again.",
      );
    } finally {
      setCreatingGroup(false);
    }
  }, [groupName]);

  const joinGroupOrder = useCallback(async () => {
    const trimmedInviteCode = inviteCode.trim().toUpperCase();

    if (!trimmedInviteCode) {
      Alert.alert("Invite code required", "Please enter an invite code.");
      return;
    }

    try {
      setJoiningGroup(true);
      setErrorMessage(null);

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError) {
        throw userError;
      }

      if (!user) {
        throw new Error("You need to be signed in to join a group order.");
      }

      const { data: groupOrder, error: groupOrderError } = await supabase
        .from("group_orders")
        .select("*")
        .eq("invite_code", trimmedInviteCode)
        .is("checked_out_at", null)
        .maybeSingle();

      if (groupOrderError) {
        throw groupOrderError;
      }

      if (!groupOrder) {
        Alert.alert(
          "Group order not found",
          "Check the invite code and try again.",
        );
        return;
      }

      const typedGroupOrder = groupOrder as GroupOrderRow;

      const { data: existingMember, error: existingMemberError } =
        await supabase
          .from("group_members")
          .select("*")
          .eq("group_order_id", typedGroupOrder.id)
          .eq("user_id", user.id)
          .maybeSingle();

      if (existingMemberError) {
        throw existingMemberError;
      }

      if (!existingMember) {
        const { data: invitedMember, error: invitedMemberError } =
          await supabase
            .from("group_members")
            .select("*")
            .eq("group_order_id", typedGroupOrder.id)
            .eq("invited_email", user.email ?? "")
            .is("user_id", null)
            .maybeSingle();

        if (invitedMemberError) {
          throw invitedMemberError;
        }

        if (invitedMember) {
          const { error: updateMemberError } = await supabase
            .from("group_members")
            .update({
              user_id: user.id,
              status: "joined",
            })
            .eq("id", invitedMember.id);

          if (updateMemberError) {
            throw updateMemberError;
          }
        } else {
          const { error: insertMemberError } = await supabase
            .from("group_members")
            .insert({
              group_order_id: typedGroupOrder.id,
              user_id: user.id,
              invited_email: user.email ?? null,
              role: "guest",
              status: "joined",
            });

          if (insertMemberError) {
            throw insertMemberError;
          }
        }
      }

      setInviteCode("");

      router.replace({
        pathname: "/group-confirmation",
        params: {
          groupOrderId: typedGroupOrder.id,
          mode: "joined",
        },
      });
    } catch (error) {
      console.error("Failed to join group order:", error);
      Alert.alert(
        "Could not join group order",
        error instanceof Error ? error.message : "Please try again.",
      );
    } finally {
      setJoiningGroup(false);
    }
  }, [inviteCode]);

  const signOut = useCallback(async () => {
    try {
      setSigningOut(true);

      const { error } = await supabase.auth.signOut();

      if (error) {
        throw error;
      }

      router.replace("/login");
    } catch (error) {
      console.error("Failed to sign out:", error);
      Alert.alert(
        "Could not sign out",
        error instanceof Error ? error.message : "Please try again.",
      );
    } finally {
      setSigningOut(false);
    }
  }, []);

  if (loading) {
    return (
      <SafeAreaView style={styles.screen}>
        <View style={styles.centered}>
          <ActivityIndicator />
          <Text style={styles.loadingText}>Loading profile...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.screen}>
      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.header}>
            <Text style={styles.title}>Profile</Text>
            <Text style={styles.subtitle}>Create or join a group order.</Text>
          </View>

          {errorMessage ? (
            <View style={styles.messageCard}>
              <Text style={styles.errorText}>{errorMessage}</Text>
            </View>
          ) : null}

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Account</Text>
            <Text style={styles.label}>Email</Text>
            <Text style={styles.value}>
              {profile?.email ?? "No email available"}
            </Text>

            {profile?.display_name ? (
              <>
                <Text style={[styles.label, styles.spacedLabel]}>
                  Display name
                </Text>
                <Text style={styles.value}>{profile.display_name}</Text>
              </>
            ) : null}
          </View>

          {activeGroupOrder ? (
            <View style={styles.activeGroupCard}>
              <Text style={styles.cardEyebrow}>Active group order</Text>
              <Text style={styles.activeGroupName}>
                {activeGroupOrder.name ?? "Group order"}
              </Text>

              {activeGroupOrder.invite_code ? (
                <Text style={styles.activeGroupInvite}>
                  Invite code: {activeGroupOrder.invite_code}
                </Text>
              ) : null}

              <View style={styles.activeGroupActions}>
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

                <Pressable
                  onPress={() => {
                    router.push({
                      pathname: "/group-confirmation",
                      params: {
                        groupOrderId: activeGroupOrder.id,
                        mode:
                          activeGroupOrder.host_user_id === profile?.id
                            ? "created"
                            : "joined",
                      },
                    });
                  }}
                  style={({ pressed }) => [
                    styles.secondaryButton,
                    pressed && styles.buttonPressed,
                  ]}
                >
                  <Text style={styles.secondaryButtonText}>View details</Text>
                </Pressable>
              </View>
            </View>
          ) : null}

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Create group order</Text>
            <Text style={styles.cardText}>
              Start a new group order and invite others with a code.
            </Text>

            <TextInput
              value={groupName}
              onChangeText={setGroupName}
              placeholder="Group order name"
              placeholderTextColor="#9CA3AF"
              autoCapitalize="words"
              style={styles.input}
            />

            <Pressable
              disabled={creatingGroup}
              onPress={createGroupOrder}
              style={({ pressed }) => [
                styles.primaryButton,
                (pressed || creatingGroup) && styles.buttonPressed,
              ]}
            >
              {creatingGroup ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.primaryButtonText}>Create group order</Text>
              )}
            </Pressable>
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Join group order</Text>
            <Text style={styles.cardText}>
              Enter an invite code from a host to join their order.
            </Text>

            <TextInput
              value={inviteCode}
              onChangeText={(value) => setInviteCode(value.toUpperCase())}
              placeholder="Invite code"
              placeholderTextColor="#9CA3AF"
              autoCapitalize="characters"
              autoCorrect={false}
              style={styles.input}
            />

            <Pressable
              disabled={joiningGroup}
              onPress={joinGroupOrder}
              style={({ pressed }) => [
                styles.secondaryButton,
                (pressed || joiningGroup) && styles.buttonPressed,
              ]}
            >
              {joiningGroup ? (
                <ActivityIndicator />
              ) : (
                <Text style={styles.secondaryButtonText}>Join group order</Text>
              )}
            </Pressable>
          </View>

          <Pressable
            disabled={signingOut}
            onPress={signOut}
            style={({ pressed }) => [
              styles.signOutButton,
              (pressed || signingOut) && styles.buttonPressed,
            ]}
          >
            <Text style={styles.signOutButtonText}>
              {signingOut ? "Signing out..." : "Sign out"}
            </Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#F8FAFC",
  },
  keyboardView: {
    flex: 1,
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
    fontWeight: "900",
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
    fontWeight: "700",
  },
  card: {
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
  activeGroupCard: {
    backgroundColor: "#EFF6FF",
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: "#BFDBFE",
    gap: 10,
  },
  cardEyebrow: {
    color: "#1D4ED8",
    fontSize: 12,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  activeGroupName: {
    color: "#111827",
    fontSize: 20,
    fontWeight: "900",
  },
  activeGroupInvite: {
    color: "#1E40AF",
    fontSize: 14,
    fontWeight: "800",
  },
  activeGroupActions: {
    gap: 10,
    marginTop: 4,
  },
  cardTitle: {
    color: "#111827",
    fontSize: 20,
    fontWeight: "900",
  },
  cardText: {
    color: "#6B7280",
    fontSize: 14,
    lineHeight: 20,
  },
  label: {
    color: "#6B7280",
    fontSize: 12,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  spacedLabel: {
    marginTop: 4,
  },
  value: {
    color: "#111827",
    fontSize: 15,
    fontWeight: "800",
  },
  input: {
    backgroundColor: "#F9FAFB",
    borderColor: "#D1D5DB",
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: "#111827",
    fontSize: 15,
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
    fontWeight: "900",
  },
  secondaryButton: {
    backgroundColor: "#FFFFFF",
    borderColor: "#D1D5DB",
    borderWidth: 1,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 50,
  },
  secondaryButtonText: {
    color: "#111827",
    fontSize: 15,
    fontWeight: "900",
  },
  signOutButton: {
    backgroundColor: "#FEF2F2",
    borderColor: "#FCA5A5",
    borderWidth: 1,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 50,
  },
  signOutButtonText: {
    color: "#B91C1C",
    fontSize: 15,
    fontWeight: "900",
  },
  buttonPressed: {
    opacity: 0.7,
    transform: [{ scale: 0.995 }],
  },
});
