import { useState } from "react";
import { useRouter } from "expo-router";
import { View, Text } from "react-native";
import { usePreview } from "@/preview/store";
import {
  Avatar,
  Badge,
  Button,
  Copy,
  Heading,
  Meta,
  Page,
  Surface,
  colors,
  styles,
} from "@/ui";

export default function Account() {
  const router = useRouter();
  const { reset } = usePreview();
  const [resetDone, setResetDone] = useState(false);
  return (
    <Page>
      <Heading>A little about you.</Heading>
      <Surface>
        <View style={styles.row}>
          <Avatar initials="AM" size={72} mint />
          <View style={{ flex: 1, gap: 5 }}>
            <Text
              style={{ fontSize: 22, fontWeight: "600", color: colors.ink }}
            >
              Alex Morgan
            </Text>
            <Badge tone="mint">SAMPLE ATHLETE</Badge>
          </View>
        </View>
        <Copy>A fictional profile for exploring the new MovX app.</Copy>
      </Surface>
      <Surface>
        <Heading small>Your space to reflect</Heading>
        <Meta icon="lock">Personal workout notes are private.</Meta>
        <Meta icon="note">
          Booked-session feedback is shared with that coach.
        </Meta>
        <Button
          secondary
          onPress={() => router.push("/notes/personal-strength")}
        >
          Try a personal note
        </Button>
      </Surface>
      <Surface>
        <Heading small>Built around your training</Heading>
        <Copy>
          The first beta will connect your real account, messages, session
          history and notes. Coaches will manage their schedule and profile on
          the website initially.
        </Copy>
        <Copy style={{ fontSize: 13 }}>
          This preview has no sign-in and does not access real accounts. Edits
          reset when the app reloads.
        </Copy>
      </Surface>
      <Button
        secondary
        onPress={() => {
          reset();
          setResetDone(true);
        }}
      >
        Reset sample data
      </Button>
      {resetDone && (
        <Copy accessibilityRole="alert" style={{ color: colors.mintInk }}>
          Sample data reset. Real account data was not accessed.
        </Copy>
      )}
      <Copy style={{ textAlign: "center", fontSize: 11 }}>
        MOVX · A LITTLE MOVEMENT, A LITTLE MORE YOU
      </Copy>
    </Page>
  );
}
