import { router } from "expo-router";
import { useEffect, useState } from "react";
import {
    ActivityIndicator,
    SafeAreaView,
    StyleSheet,
    Text,
    View,
} from "react-native";

import { supabase } from "@/lib/supabase";

export default function IndexScreen() {
  const [checkingSession, setCheckingSession] = useState(true);

  useEffect(() => {
    let isMounted = true;

    async function checkSession() {
      try {
        const { data, error } = await supabase.auth.getSession();

        if (error) {
          throw error;
        }

        if (!isMounted) {
          return;
        }

        if (data.session) {
          router.replace("/(tabs)/menu");
        } else {
          router.replace("/login");
        }
      } catch (error) {
        console.error("Failed to check session:", error);

        if (isMounted) {
          router.replace("/login");
        }
      } finally {
        if (isMounted) {
          setCheckingSession(false);
        }
      }
    }

    checkSession();

    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.centered}>
        <ActivityIndicator />
        <Text style={styles.text}>
          {checkingSession ? "Loading..." : "Redirecting..."}
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#F8FAFC",
  },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  text: {
    color: "#6B7280",
    fontSize: 15,
    marginTop: 12,
  },
});
