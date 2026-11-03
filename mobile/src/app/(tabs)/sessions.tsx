import { useState } from "react";
import { useRouter } from "expo-router";
import { ScrollView, Text, View } from "react-native";
import { personalWorkouts, sessions } from "@/preview/data";
import {
  Badge,
  Button,
  Chip,
  Copy,
  EmptyState,
  Heading,
  Icon,
  Meta,
  Page,
  Surface,
  colors,
  styles,
} from "@/ui";

export default function Sessions() {
  const router = useRouter();
  const [view, setView] = useState("Upcoming");
  const shown = sessions.filter((session) =>
    view === "Upcoming"
      ? session.upcoming
      : view === "Past"
        ? !session.upcoming
        : false,
  );
  return (
    <Page>
      <View style={{ gap: 6 }}>
        <Heading>Your training,{"\n"}in one place.</Heading>
        <Copy>Make a little room for your next move.</Copy>
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 8 }}
      >
        {["Upcoming", "Past", "Requests"].map((item) => (
          <Chip
            key={item}
            selected={view === item}
            onPress={() => setView(item)}
          >
            {item}
          </Chip>
        ))}
      </ScrollView>
      {shown.length === 0 && (
        <EmptyState title="No sample requests">
          Your real requests will appear here after account integration.
        </EmptyState>
      )}
      {shown.map((session) => (
        <Surface key={session.id}>
          <View style={styles.between}>
            <Badge tone="mint">{session.status.toUpperCase()}</Badge>
            <Copy style={{ fontSize: 12 }}>{session.date}</Copy>
          </View>
          <View style={{ gap: 4 }}>
            <Heading small>{session.title}</Heading>
            <Copy>With Nia Winter</Copy>
          </View>
          <Meta icon="clock">{session.time} · Berlin time</Meta>
          <Meta icon="pin">{session.venue}</Meta>
          <Button
            label={"Open " + session.title}
            onPress={() => router.push("/session/" + session.id)}
          >
            View session
          </Button>
        </Surface>
      ))}
      <View style={styles.between}>
        <Heading small>Personal notes</Heading>
        <Icon name="lock" size={18} color={colors.muted} />
      </View>
      <Copy style={{ fontSize: 13, marginTop: -14 }}>
        A space for your own workouts. Always separate from shared session
        notes.
      </Copy>
      {personalWorkouts.map((workout) => (
        <Surface key={workout.id}>
          <View style={styles.row}>
            <View
              style={{
                width: 44,
                height: 44,
                borderRadius: 13,
                backgroundColor: colors.mint,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Icon name="note" color={colors.mintInk} />
            </View>
            <View style={{ flex: 1 }}>
              <Text
                style={{ color: colors.ink, fontSize: 16, fontWeight: "600" }}
              >
                {workout.title}
              </Text>
              <Copy style={{ fontSize: 12 }}>{workout.date} · Private</Copy>
            </View>
          </View>
          <Button
            secondary
            label={"Open notes for " + workout.title}
            onPress={() => router.push("/notes/" + workout.id)}
          >
            Open personal note
          </Button>
        </Surface>
      ))}
    </Page>
  );
}
