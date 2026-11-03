import { useRouter } from "expo-router";
import { Text, View } from "react-native";
import { usePreview } from "@/preview/store";
import {
  Avatar,
  Badge,
  Button,
  Copy,
  Heading,
  Icon,
  Page,
  Surface,
  colors,
  styles,
} from "@/ui";

export default function Messages() {
  const router = useRouter();
  const { unread, messages } = usePreview();
  return (
    <Page>
      <View style={{ gap: 6 }}>
        <Heading>A conversation{"\n"}away.</Heading>
        <Copy>Questions, encouragement and your next session.</Copy>
      </View>
      <Surface>
        <View style={styles.row}>
          <Avatar initials="NW" />
          <View style={{ flex: 1, gap: 3 }}>
            <Text
              style={{ fontSize: 18, fontWeight: "600", color: colors.ink }}
            >
              Nia Winter
            </Text>
            <Copy style={{ fontSize: 12 }}>Your boxing coach</Copy>
          </View>
          {unread && <Badge>NEW</Badge>}
        </View>
        <Copy numberOfLines={2}>{messages[messages.length - 1].body}</Copy>
        <Button onPress={() => router.push("/conversation/nia")}>
          Open conversation
        </Button>
      </Surface>
      <View style={[styles.row, { alignItems: "flex-start", padding: 4 }]}>
        <Icon name="message" color={colors.purple} />
        <Copy style={{ flex: 1, fontSize: 13 }}>
          Athletes and coaches share the same conversation. Your session notes
          have their own space.
        </Copy>
      </View>
      <Surface
        style={{
          backgroundColor: colors.lavender,
          borderColor: colors.lavender,
        }}
      >
        <Heading small>A first look</Heading>
        <Copy>
          You can try a sample conversation here. Messages stay in this preview
          and are never sent to another person.
        </Copy>
      </Surface>
    </Page>
  );
}
