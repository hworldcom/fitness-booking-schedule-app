import { useState, type PropsWithChildren } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type TextProps,
  type ColorValue,
  type ViewStyle,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Svg, { Circle, Path, Rect } from "react-native-svg";

export const colors = {
  ink: "#242035",
  muted: "#716B80",
  purple: "#6241BB",
  purpleDark: "#47308D",
  lavender: "#F0EAFB",
  mint: "#E4F2DF",
  mintInk: "#365A3D",
  paper: "#FAF9F6",
  white: "#FFFFFF",
  line: "#E9E5EE",
  peach: "#FAE8D9",
  error: "#A12E3F",
};

export type IconName =
  | "explore"
  | "calendar"
  | "message"
  | "person"
  | "arrow"
  | "clock"
  | "pin"
  | "lock"
  | "note"
  | "send"
  | "check";
export function Icon({
  name,
  size = 22,
  color = colors.ink,
}: {
  name: IconName;
  size?: number;
  color?: ColorValue;
}) {
  const paths: Record<IconName, React.ReactNode> = {
    explore: (
      <>
        <Circle cx="12" cy="12" r="9" />
        <Path d="m16 8-2.5 5.5L8 16l2.5-5.5Z" />
      </>
    ),
    calendar: (
      <>
        <Rect x="3" y="5" width="18" height="16" rx="3" />
        <Path d="M7 3v4m10-4v4M3 11h18m-13 4h.01m4 0h.01m4 0h.01" />
      </>
    ),
    message: (
      <Path d="M21 11.5a8.5 8.5 0 0 1-8.5 8.5H4l-2 2V11.5A8.5 8.5 0 0 1 10.5 3h2A8.5 8.5 0 0 1 21 11.5Z" />
    ),
    person: (
      <>
        <Circle cx="12" cy="8" r="4" />
        <Path d="M4 21v-2a8 8 0 0 1 16 0v2" />
      </>
    ),
    arrow: <Path d="M5 12h14m-6-6 6 6-6 6" />,
    clock: (
      <>
        <Circle cx="12" cy="12" r="9" />
        <Path d="M12 6v6l4 2" />
      </>
    ),
    pin: (
      <>
        <Path d="M19 10c0 5-7 11-7 11S5 15 5 10a7 7 0 1 1 14 0Z" />
        <Circle cx="12" cy="10" r="2.5" />
      </>
    ),
    lock: (
      <>
        <Rect x="5" y="10" width="14" height="11" rx="2" />
        <Path d="M8 10V6a4 4 0 0 1 8 0v4m-4 5v2" />
      </>
    ),
    note: (
      <>
        <Rect x="4" y="3" width="16" height="18" rx="3" />
        <Path d="M8 8h8m-8 4h8m-8 4h5" />
      </>
    ),
    send: <Path d="m21 3-7 18-4-7-7-4 18-7ZM10 14 21 3" />,
    check: <Path d="m5 12 4 4L19 6" />,
  };
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={1.65}
      strokeLinecap="round"
      strokeLinejoin="round"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {paths[name]}
    </Svg>
  );
}

export function Copy({ style, ...props }: TextProps) {
  return <Text {...props} style={[styles.copy, style]} />;
}

export function Heading({
  children,
  small = false,
}: PropsWithChildren<{ small?: boolean }>) {
  return (
    <Text
      accessibilityRole="header"
      style={small ? styles.sectionTitle : styles.title}
    >
      {children}
    </Text>
  );
}

export function Badge({
  children,
  tone = "purple",
}: PropsWithChildren<{ tone?: "purple" | "mint" | "plain" }>) {
  return (
    <View
      style={[
        styles.badge,
        {
          backgroundColor:
            tone === "mint"
              ? colors.mint
              : tone === "plain"
                ? colors.paper
                : colors.lavender,
        },
      ]}
    >
      <Text
        style={[
          styles.badgeText,
          { color: tone === "mint" ? colors.mintInk : colors.purpleDark },
        ]}
      >
        {children}
      </Text>
    </View>
  );
}

export function Page({
  children,
  detail = false,
  scroll = true,
}: PropsWithChildren<{ detail?: boolean; scroll?: boolean }>) {
  return (
    <SafeAreaView edges={detail ? ["bottom"] : ["top"]} style={styles.page}>
      {!detail && (
        <View style={styles.brandRow}>
          <Text style={styles.wordmark}>
            movx<Text style={{ color: colors.purple }}>.</Text>
          </Text>
          <Badge tone="plain">BERLIN</Badge>
        </View>
      )}
      <View style={styles.previewNotice}>
        <View style={styles.previewDot} />
        <Text style={styles.previewText}>
          Sample preview · no live account or bookings
        </Text>
      </View>
      {scroll ? (
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          {children}
        </ScrollView>
      ) : (
        <View style={styles.fill}>{children}</View>
      )}
    </SafeAreaView>
  );
}

export function Surface({
  children,
  style,
}: PropsWithChildren<{ style?: ViewStyle }>) {
  return <View style={[styles.surface, style]}>{children}</View>;
}

export function Button({
  children,
  onPress,
  secondary = false,
  disabled = false,
  label,
  testID,
}: PropsWithChildren<{
  onPress: () => void;
  secondary?: boolean;
  disabled?: boolean;
  label?: string;
  testID?: string;
}>) {
  const [focused, setFocused] = useState(false);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      testID={testID}
      onPress={onPress}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      style={({ pressed }) => [
        styles.button,
        secondary && styles.secondaryButton,
        focused && styles.focus,
        disabled && { opacity: 0.45 },
        pressed && { opacity: 0.75 },
      ]}
    >
      <Text style={[styles.buttonText, secondary && { color: colors.purple }]}>
        {children}
      </Text>
    </Pressable>
  );
}

export function Chip({
  children,
  selected,
  onPress,
}: PropsWithChildren<{ selected: boolean; onPress: () => void }>) {
  const [focused, setFocused] = useState(false);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      style={[
        styles.chip,
        selected && styles.selectedChip,
        focused && styles.focus,
      ]}
    >
      <Text style={[styles.chipText, selected && { color: colors.white }]}>
        {children}
      </Text>
    </Pressable>
  );
}

export function Avatar({
  initials,
  size = 60,
  mint = false,
}: {
  initials: string;
  size?: number;
  mint?: boolean;
}) {
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size * 0.35,
        backgroundColor: mint ? colors.mint : colors.lavender,
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
      }}
    >
      <Text
        style={{
          color: mint ? colors.mintInk : colors.purpleDark,
          fontWeight: "600",
          fontSize: size * 0.32,
        }}
      >
        {initials}
      </Text>
    </View>
  );
}

export function Meta({
  icon,
  children,
}: PropsWithChildren<{ icon: IconName }>) {
  return (
    <View style={styles.meta}>
      <Icon name={icon} size={16} color={colors.muted} />
      <Copy style={styles.metaText}>{children}</Copy>
    </View>
  );
}

export function EmptyState({
  title,
  children,
}: PropsWithChildren<{ title: string }>) {
  return (
    <Surface style={{ alignItems: "center", paddingVertical: 32, gap: 12 }}>
      <Icon name="note" size={32} color={colors.purple} />
      <Heading small>{title}</Heading>
      <Copy style={{ textAlign: "center" }}>{children}</Copy>
    </Surface>
  );
}

export const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.paper },
  fill: { flex: 1 },
  content: { padding: 22, paddingBottom: 36, gap: 22 },
  brandRow: {
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 10,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  wordmark: {
    fontSize: 30,
    fontWeight: "800",
    letterSpacing: -1.5,
    color: colors.ink,
  },
  previewNotice: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    paddingHorizontal: 24,
    paddingVertical: 10,
    backgroundColor: "#F2EFF6",
  },
  previewDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: colors.purple,
  },
  previewText: { flex: 1, fontSize: 11, lineHeight: 16, color: "#655D75" },
  title: {
    fontSize: 32,
    lineHeight: 39,
    letterSpacing: -1.2,
    fontWeight: "700",
    color: colors.ink,
  },
  sectionTitle: {
    fontSize: 20,
    lineHeight: 27,
    letterSpacing: -0.4,
    fontWeight: "600",
    color: colors.ink,
  },
  copy: { fontSize: 15, lineHeight: 23, color: colors.muted },
  row: { flexDirection: "row", alignItems: "center", gap: 12 },
  between: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  stack: { gap: 12 },
  surface: {
    padding: 20,
    gap: 14,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 22,
  },
  badge: {
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  badgeText: {
    fontSize: 10,
    lineHeight: 15,
    fontWeight: "700",
    letterSpacing: 0.6,
  },
  button: {
    minHeight: 48,
    paddingVertical: 12,
    paddingHorizontal: 18,
    borderRadius: 13,
    backgroundColor: colors.purple,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "transparent",
  },
  secondaryButton: { backgroundColor: colors.lavender },
  buttonText: {
    color: colors.white,
    fontWeight: "600",
    fontSize: 15,
    lineHeight: 21,
    textAlign: "center",
  },
  focus: { borderColor: colors.purpleDark, borderWidth: 2 },
  chip: {
    minHeight: 44,
    justifyContent: "center",
    paddingHorizontal: 17,
    paddingVertical: 10,
    borderWidth: 2,
    borderColor: colors.line,
    backgroundColor: colors.white,
    borderRadius: 24,
  },
  selectedChip: { backgroundColor: colors.purple, borderColor: colors.purple },
  chipText: { color: colors.muted, fontSize: 13, fontWeight: "500" },
  meta: { flexDirection: "row", gap: 8, alignItems: "center" },
  metaText: { flex: 1, fontSize: 13, lineHeight: 20 },
  input: {
    borderWidth: 1,
    borderColor: "#CEC6DB",
    backgroundColor: colors.white,
    borderRadius: 14,
    padding: 14,
    fontSize: 16,
    lineHeight: 24,
    color: colors.ink,
    minHeight: 130,
    textAlignVertical: "top",
  },
  error: { color: colors.error, fontSize: 13, lineHeight: 20 },
});
