import * as Linking from "expo-linking";
import { router } from "expo-router";
import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { supabase } from "@/lib/supabase";

export default function SignUpScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSignUp = async () => {
    const trimmedEmail = email.trim().toLowerCase();

    if (!trimmedEmail || !password) {
      Alert.alert("Missing info", "Please enter an email and password.");
      return;
    }

    if (password.length < 6) {
      Alert.alert(
        "Password too short",
        "Your password must be at least 6 characters.",
      );
      return;
    }

    if (password !== confirmPassword) {
      Alert.alert(
        "Passwords do not match",
        "Please make sure both passwords match.",
      );
      return;
    }

    setLoading(true);

    try {
      const redirectTo = Linking.createURL("auth/callback");

      const { error } = await supabase.auth.signUp({
        email: trimmedEmail,
        password,
        options: {
          emailRedirectTo: redirectTo,
        },
      });

      if (error) {
        throw error;
      }

      Alert.alert(
        "Check your email",
        "We sent you a verification link. After confirming your email, return to the app and sign in.",
        [
          {
            text: "OK",
            onPress: () => router.replace("/login"),
          },
        ],
      );
    } catch (error) {
      Alert.alert(
        "Sign up failed",
        error instanceof Error ? error.message : "Something went wrong.",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={styles.card}>
        <Text style={styles.title}>Create Account</Text>
        <Text style={styles.subtitle}>
          Sign up to start or join a group order.
        </Text>

        <TextInput
          value={email}
          onChangeText={setEmail}
          placeholder="Email"
          placeholderTextColor="#8A8A8A"
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
          textContentType="emailAddress"
          style={styles.input}
        />

        <TextInput
          value={password}
          onChangeText={setPassword}
          placeholder="Password"
          placeholderTextColor="#8A8A8A"
          autoCapitalize="none"
          autoCorrect={false}
          secureTextEntry
          textContentType="newPassword"
          style={styles.input}
        />

        <TextInput
          value={confirmPassword}
          onChangeText={setConfirmPassword}
          placeholder="Confirm password"
          placeholderTextColor="#8A8A8A"
          autoCapitalize="none"
          autoCorrect={false}
          secureTextEntry
          textContentType="newPassword"
          style={styles.input}
        />

        <Pressable
          onPress={handleSignUp}
          disabled={loading}
          style={({ pressed }) => [
            styles.button,
            pressed && !loading && styles.buttonPressed,
            loading && styles.buttonDisabled,
          ]}
        >
          {loading ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.buttonText}>Sign Up</Text>
          )}
        </Pressable>

        <Pressable
          onPress={() => router.replace("/login")}
          disabled={loading}
          style={styles.linkButton}
        >
          <Text style={styles.linkText}>Already have an account? Sign in</Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#F6F7FB",
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  card: {
    width: "100%",
    maxWidth: 420,
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 24,
    shadowColor: "#000000",
    shadowOpacity: 0.08,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4,
  },
  title: {
    fontSize: 28,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 8,
    textAlign: "center",
  },
  subtitle: {
    fontSize: 15,
    color: "#6B7280",
    marginBottom: 24,
    textAlign: "center",
    lineHeight: 22,
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
    marginBottom: 14,
  },
  button: {
    backgroundColor: "#2563EB",
    borderRadius: 12,
    paddingVertical: 15,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 6,
  },
  buttonPressed: {
    opacity: 0.85,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
  },
  linkButton: {
    marginTop: 18,
    alignItems: "center",
  },
  linkText: {
    color: "#2563EB",
    fontSize: 15,
    fontWeight: "600",
  },
});
