import { useState } from "react";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Text, View } from "react-native";
import { coaches } from "@/preview/data";
import {
  Avatar,
  Badge,
  Button,
  Copy,
  EmptyState,
  Heading,
  Meta,
  Page,
  Surface,
  colors,
  styles,
} from "@/ui";

export default function CoachDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const coach = coaches.find((item) => item.id === id);
  const router = useRouter();
  const [notice, setNotice] = useState(false);
  if (!coach)
    return (
      <Page detail>
        <EmptyState title="Sample coach not found">
          Go back to Explore to choose a sample profile.
        </EmptyState>
      </Page>
    );
  return (
    <Page detail>
      <Surface style={{ alignItems: "center", paddingVertical: 28 }}>
        <Avatar
          initials={coach.initials}
          size={92}
          mint={coach.color === "mint"}
        />
        <Badge>{coach.discipline.toUpperCase()}</Badge>
        <Heading>{coach.name}</Heading>
        <Copy style={{ textAlign: "center" }}>{coach.focus}</Copy>
        <Meta icon="pin">{coach.area}, Berlin · sample location</Meta>
      </Surface>
      <View style={styles.stack}>
        <Heading small>A coach in your corner</Heading>
        <Copy>{coach.bio}</Copy>
      </View>
      <Surface>
        <View style={styles.between}>
          <Heading small>Private training</Heading>
          <Badge tone="mint">{coach.duration}</Badge>
        </View>
        <Copy>
          Choose an offered class, a venue and a time. Your coach confirms the
          request before it becomes a booking.
        </Copy>
        <Button onPress={() => setNotice(true)}>Preview booking flow</Button>
        {notice && (
          <View accessibilityRole="alert" style={{ gap: 8 }}>
            <Text style={{ fontWeight: "600", color: colors.purpleDark }}>
              Booking is not connected yet.
            </Text>
            <Copy style={{ fontSize: 13 }}>
              This is a sample profile. No request has been submitted. Open the
              sample session to explore its details and notes.
            </Copy>
            <Button secondary onPress={() => router.push("/session/boxing")}>
              Open sample session
            </Button>
          </View>
        )}
      </Surface>
      <Copy style={{ fontSize: 12 }}>
        Fictional coach and location. No verification, availability or
        affiliation is implied.
      </Copy>
    </Page>
  );
}
