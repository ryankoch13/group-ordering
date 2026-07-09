import { router } from "expo-router";
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

export default function LoginScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [signingIn, setSigningIn] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const signIn = useCallback(async () => {
    const trimmedEmail = email.trim().toLowerCase();
    const trimmedPassword = password.trim();

    if (!trimmedEmail || !trimmedPassword) {
      Alert.alert("Missing info", "Please enter your email and password.");
      return;
    }

    try {
      setSigningIn(true);
      setErrorMessage(null);

      const { error } = await supabase.auth.signInWithPassword({
        email: trimmedEmail,
        password: trimmedPassword,
      });

      if (error) {
        throw error;
      }

      router.replace("/(tabs)/menu");
    } catch (error) {
      console.error("Failed to sign in:", error);

      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Could not sign in. Please try again.",
      );
    } finally {
      setSigningIn(false);
    }
  }, [email, password]);

  const goToSignup = useCallback(() => {
    router.push("/signup");
  }, []);

  return (
    <SafeAreaView style={styles.screen}>
      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.hero}>
            <View style={styles.logoCircle}>
              <Text style={styles.logoText}>🍽️</Text>
            </View>

            <Text style={styles.title}>Welcome back</Text>
            <Text style={styles.subtitle}>
              Sign in to create, join, and manage your group orders.
            </Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Sign in</Text>

            {errorMessage ? (
              <View style={styles.messageCard}>
                <Text style={styles.errorText}>{errorMessage}</Text>
              </View>
            ) : null}

            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Email</Text>
              <TextInput
                value={email}
                onChangeText={setEmail}
                placeholder="you@example.com"
                placeholderTextColor="#9CA3AF"
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="email"
                textContentType="emailAddress"
                style={styles.input}
              />
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Password</Text>
              <TextInput
                value={password}
                onChangeText={setPassword}
                placeholder="Password"
                placeholderTextColor="#9CA3AF"
                secureTextEntry
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="password"
                textContentType="password"
                style={styles.input}
              />
            </View>

            <Pressable
              disabled={signingIn}
              onPress={signIn}
              style={({ pressed }) => [
                styles.primaryButton,
                (pressed || signingIn) && styles.buttonPressed,
              ]}
            >
              {signingIn ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.primaryButtonText}>Sign in</Text>
              )}
            </Pressable>

            <View style={styles.signupRow}>
              <Text style={styles.signupText}>Don’t have an account?</Text>

              <Pressable onPress={goToSignup}>
                <Text style={styles.signupLink}>Create one</Text>
              </Pressable>
            </View>
          </View>

          <View style={styles.footerCard}>
            <Text style={styles.footerTitle}>Group ordering made simple</Text>
            <Text style={styles.footerText}>
              Hosts create the order, guests add their own items, and only the
              host checks out.
            </Text>
          </View>
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
    flexGrow: 1,
    padding: 20,
    paddingBottom: 40,
    justifyContent: "center",
    gap: 18,
  },
  hero: {
    alignItems: "center",
    gap: 10,
    marginBottom: 6,
  },
  logoCircle: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: "#EFF6FF",
    borderWidth: 1,
    borderColor: "#BFDBFE",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  logoText: {
    fontSize: 34,
  },
  title: {
    color: "#111827",
    fontSize: 34,
    fontWeight: "900",
    textAlign: "center",
  },
  subtitle: {
    color: "#6B7280",
    fontSize: 15,
    lineHeight: 22,
    textAlign: "center",
    maxWidth: 320,
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 22,
    padding: 18,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    gap: 14,
    shadowColor: "#000000",
    shadowOpacity: 0.05,
    shadowRadius: 12,
    shadowOffset: {
      width: 0,
      height: 5,
    },
    elevation: 2,
  },
  cardTitle: {
    color: "#111827",
    fontSize: 22,
    fontWeight: "900",
  },
  messageCard: {
    backgroundColor: "#FEF2F2",
    borderColor: "#FCA5A5",
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
  },
  errorText: {
    color: "#B91C1C",
    fontSize: 14,
    fontWeight: "700",
    lineHeight: 20,
  },
  fieldGroup: {
    gap: 7,
  },
  label: {
    color: "#374151",
    fontSize: 13,
    fontWeight: "900",
  },
  input: {
    backgroundColor: "#F9FAFB",
    borderColor: "#D1D5DB",
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 13,
    color: "#111827",
    fontSize: 15,
  },
  primaryButton: {
    backgroundColor: "#2563EB",
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 52,
    marginTop: 2,
  },
  primaryButtonText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "900",
  },
  buttonPressed: {
    opacity: 0.7,
    transform: [{ scale: 0.995 }],
  },
  signupRow: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 6,
    marginTop: 2,
  },
  signupText: {
    color: "#6B7280",
    fontSize: 14,
    fontWeight: "600",
  },
  signupLink: {
    color: "#2563EB",
    fontSize: 14,
    fontWeight: "900",
  },
  footerCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  footerTitle: {
    color: "#111827",
    fontSize: 15,
    fontWeight: "900",
    marginBottom: 4,
    textAlign: "center",
  },
  footerText: {
    color: "#6B7280",
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center",
  },
});
