import { Alert, Pressable, StyleSheet, Text, View } from "react-native";

import { useAuth } from "@/providers/AuthProvider";

export default function OrdersHomeScreen() {
  const { user, signOut } = useAuth();

  async function handleSignOut() {
    try {
      await signOut();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unable to sign out.";
      Alert.alert("Sign out failed", message);
    }
  }

  return (
    <View style={styles.container}>
      <View>
        <Text style={styles.eyebrow}>Signed in as</Text>
        <Text style={styles.email}>{user?.email}</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Group Ordering App</Text>
        <Text style={styles.cardText}>
          Auth is working. Next, this screen will let the host create a group
          order and invite up to two other people.
        </Text>
      </View>

      <Pressable
        onPress={handleSignOut}
        style={({ pressed }) => [
          styles.secondaryButton,
          pressed && styles.buttonPressed,
        ]}
      >
        <Text style={styles.secondaryButtonText}>Sign out</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#111111",
    padding: 24,
    justifyContent: "center",
    gap: 24,
  },
  eyebrow: {
    color: "#8A8A8A",
    fontSize: 13,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 6,
  },
  email: {
    color: "#FFFFFF",
    fontSize: 22,
    fontWeight: "800",
  },
  card: {
    borderRadius: 20,
    backgroundColor: "#1A1A1A",
    borderWidth: 1,
    borderColor: "#2A2A2A",
    padding: 20,
  },
  cardTitle: {
    color: "#FFFFFF",
    fontSize: 22,
    fontWeight: "800",
    marginBottom: 8,
  },
  cardText: {
    color: "#B8B8B8",
    fontSize: 16,
    lineHeight: 23,
  },
  secondaryButton: {
    minHeight: 52,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#7C3AED",
    alignItems: "center",
    justifyContent: "center",
  },
  buttonPressed: {
    opacity: 0.85,
  },
  secondaryButtonText: {
    color: "#A78BFA",
    fontSize: 16,
    fontWeight: "800",
  },
});
