import { Stack } from "expo-router";

import { AuthProvider } from "@/providers/AuthProvider";

export default function RootLayout() {
  return (
    <AuthProvider>
      <Stack
        initialRouteName="index"
        screenOptions={{
          headerShown: false,
        }}
      >
        <Stack.Screen name="index" />
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="group-confirmation" />
        <Stack.Screen name="(tabs)" />
      </Stack>
    </AuthProvider>
  );
}
