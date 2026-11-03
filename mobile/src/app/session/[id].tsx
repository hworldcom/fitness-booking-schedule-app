import { useLocalSearchParams, useRouter } from "expo-router";
import { View } from "react-native";
import { sessions } from "@/preview/data";
import {
  Badge,
  Button,
  Copy,
  EmptyState,
  Heading,
  Meta,
  Page,
  Surface,
} from "@/ui";

export default function SessionDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const session = sessions.find((item) => item.id === id);
  const router = useRouter();
  if (!session)
    return (
      <Page detail>
        <EmptyState title="Sample session not found">
          Go back to Sessions to choose a sample booking.
        </EmptyState>
      </Page>
    );
  return (
    <Page detail>
      <Badge tone="mint">SAMPLE · {session.status.toUpperCase()}</Badge>
      <View style={{ gap: 6 }}>
        <Heading>{session.title}</Heading>
        <Copy>With Nia Winter · Boxing</Copy>
      </View>
      <Surface>
        <Meta icon="calendar">{session.date} · 2026</Meta>
        <Meta icon="clock">{session.time} · Europe/Berlin</Meta>
        <Meta icon="pin">{session.venue}</Meta>
      </Surface>
      <Surface>
        <Badge>COACH’S SHARED PLAN</Badge>
        <Heading small>A focus for your session</Heading>
        <Copy>{session.plan}</Copy>
        <Copy style={{ fontSize: 12 }}>
          Shared with you. Only the coach edits this plan.
        </Copy>
      </Surface>
      <Surface>
        <Heading small>Your session feedback</Heading>
        <Copy>
          Capture what you worked on and how it felt. This feedback is shared
          with Nia for this session.
        </Copy>
        <Button onPress={() => router.push("/notes/" + session.noteId)}>
          Open shared session note
        </Button>
      </Surface>
      <Button secondary onPress={() => router.push("/conversation/nia")}>
        Discuss in Messages
      </Button>
      <Copy style={{ fontSize: 12 }}>
        Sample session only. Real booking changes and cancellations will use the
        connected account.
      </Copy>
    </Page>
  );
}
