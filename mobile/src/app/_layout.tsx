import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { View } from "react-native";
import { PreviewProvider } from "@/preview/store";
import { colors } from "@/ui";

export default function RootLayout() {
  return (
    <PreviewProvider>
      <View style={{ flex: 1, backgroundColor: "#EDEBEF" }}>
        <View
          style={{
            flex: 1,
            width: "100%",
            maxWidth: 620,
            alignSelf: "center",
            backgroundColor: colors.paper,
          }}
        >
          <StatusBar style="dark" />
          <Stack
            screenOptions={{
              headerStyle: { backgroundColor: colors.paper },
              headerTintColor: colors.purpleDark,
              headerShadowVisible: false,
              headerBackTitle: "Back",
              contentStyle: { backgroundColor: colors.paper },
            }}
          >
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen
              name="coach/[id]"
              options={{ title: "Meet your coach" }}
            />
            <Stack.Screen
              name="session/[id]"
              options={{ title: "Your session" }}
            />
            <Stack.Screen name="notes/[id]" options={{ title: "Notes" }} />
            <Stack.Screen
              name="conversation/[id]"
              options={{ title: "Nia Winter" }}
            />
            <Stack.Screen name="+not-found" options={{ title: "Not found" }} />
          </Stack>
        </View>
      </View>
    </PreviewProvider>
  );
}
