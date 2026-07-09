import { Redirect, Tabs } from "expo-router";
import { ActivityIndicator, StyleSheet, View } from "react-native";

import { useAuth } from "@/providers/AuthProvider";

export default function TabsLayout() {
  const { session, loading } = useAuth();

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
      </View>
    );
  }

  if (!session) {
    return <Redirect href="/login" />;
  }

  return (
    <Tabs
      screenOptions={{
        headerStyle: {
          backgroundColor: "#111111",
        },
        headerTintColor: "#FFFFFF",
        tabBarStyle: {
          backgroundColor: "#111111",
          borderTopColor: "#2A2A2A",
        },
        tabBarActiveTintColor: "#A78BFA",
        tabBarInactiveTintColor: "#8A8A8A",
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Orders",
          tabBarLabel: "Orders",
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
});
