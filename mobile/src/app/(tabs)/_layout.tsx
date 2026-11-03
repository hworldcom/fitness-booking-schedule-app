import { Tabs } from "expo-router";
import type { ColorValue } from "react-native";
import { Icon, colors, type IconName } from "@/ui";
import { usePreview } from "@/preview/store";

export default function TabLayout() {
  const { unread } = usePreview();
  const icon = (name: IconName) =>
    function TabIcon({ color }: { color: ColorValue }) {
      return <Icon name={name} color={color} />;
    };
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.purple,
        tabBarInactiveTintColor: colors.muted,
        tabBarStyle: {
          backgroundColor: colors.white,
          borderTopColor: colors.line,
          height: 86,
          paddingTop: 10,
          paddingBottom: 24,
        },
        tabBarLabelStyle: { fontSize: 10, fontWeight: "500", marginTop: 4 },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{ title: "Explore", tabBarIcon: icon("explore") }}
      />
      <Tabs.Screen
        name="sessions"
        options={{ title: "Sessions", tabBarIcon: icon("calendar") }}
      />
      <Tabs.Screen
        name="messages"
        options={{
          title: "Messages",
          tabBarIcon: icon("message"),
          tabBarBadge: unread ? 1 : undefined,
          tabBarBadgeStyle: { backgroundColor: colors.purple, fontSize: 10 },
        }}
      />
      <Tabs.Screen
        name="account"
        options={{ title: "Account", tabBarIcon: icon("person") }}
      />
    </Tabs>
  );
}
