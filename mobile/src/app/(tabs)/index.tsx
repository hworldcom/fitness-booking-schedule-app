import { useState } from "react";
import { useRouter } from "expo-router";
import {
  ScrollView,
  Text,
  View,
  StyleSheet,
  useWindowDimensions,
} from "react-native";
import { coaches } from "@/preview/data";
import {
  Avatar,
  Badge,
  Button,
  Chip,
  Copy,
  Heading,
  Icon,
  Page,
  Surface,
  colors,
  styles,
} from "@/ui";

export default function Explore() {
  const [discipline, setDiscipline] = useState("All");
  const router = useRouter();
  const { width } = useWindowDimensions();
  const results = coaches.filter(
    (coach) => discipline === "All" || coach.discipline === discipline,
  );
  return (
    <Page>
      <View style={hero.container}>
        <Badge tone="plain">YOUR NEXT CHAPTER</Badge>
        <Text accessibilityRole="header" style={hero.title}>
          Find your{"\n"}next move.
        </Text>
        <Copy style={{ color: "#EDE5FF", maxWidth: 230 }}>
          A little guidance. A new challenge. A coach in your corner.
        </Copy>
        <View
          accessible={false}
          style={[hero.art, width < 380 && { display: "none" }]}
        >
          <View style={hero.ring} />
          <View style={hero.square} />
          <Text style={hero.spark}>✳</Text>
        </View>
      </View>
      <View style={styles.between}>
        <Heading small>Find your coach</Heading>
        <View style={styles.row}>
          <Icon name="pin" size={15} color={colors.muted} />
          <Copy style={{ fontSize: 12 }}>Berlin</Copy>
        </View>
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 8 }}
      >
        {["All", "Boxing", "BJJ", "Fitness"].map((item) => (
          <Chip
            key={item}
            selected={discipline === item}
            onPress={() => setDiscipline(item)}
          >
            {item}
          </Chip>
        ))}
      </ScrollView>
      <View style={{ gap: 14 }}>
        {results.map((coach) => (
          <Surface key={coach.id}>
            <View style={styles.row}>
              <Avatar initials={coach.initials} mint={coach.color === "mint"} />
              <View style={{ flex: 1, gap: 3 }}>
                <Text style={hero.coachName}>{coach.name}</Text>
                <Copy style={{ fontSize: 13 }}>
                  {coach.discipline} · {coach.area}
                </Copy>
              </View>
              <Icon name="arrow" color={colors.purple} />
            </View>
            <Copy>{coach.focus}</Copy>
            <Button
              secondary
              label={"Meet " + coach.name}
              onPress={() => router.push("/coach/" + coach.id)}
            >
              Meet {coach.name.split(" ")[0]}
            </Button>
          </Surface>
        ))}
      </View>
      <View style={[styles.row, { paddingHorizontal: 3 }]}>
        <Icon name="explore" color={colors.purple} />
        <Copy style={{ flex: 1, fontSize: 13 }}>
          Your pace. Your people. A good place to start.
        </Copy>
      </View>
    </Page>
  );
}

const hero = StyleSheet.create({
  container: {
    borderRadius: 26,
    padding: 24,
    paddingBottom: 29,
    gap: 16,
    backgroundColor: colors.purple,
    overflow: "hidden",
  },
  title: {
    color: colors.white,
    fontSize: 43,
    lineHeight: 47,
    fontWeight: "600",
    letterSpacing: -1.9,
    zIndex: 1,
  },
  art: {
    position: "absolute",
    right: -24,
    top: 68,
    width: 125,
    height: 150,
    opacity: 0.5,
  },
  ring: {
    borderColor: "#D9D0FF",
    borderWidth: 18,
    width: 110,
    height: 110,
    borderRadius: 60,
    transform: [{ rotate: "-30deg" }],
  },
  square: {
    backgroundColor: "#D5F1BA",
    width: 65,
    height: 65,
    borderRadius: 17,
    position: "absolute",
    top: 70,
    left: 13,
    transform: [{ rotate: "20deg" }],
  },
  spark: {
    color: "#EBF7CB",
    position: "absolute",
    right: 24,
    top: -40,
    fontSize: 58,
  },
  coachName: {
    fontSize: 18,
    fontWeight: "600",
    letterSpacing: -0.3,
    color: colors.ink,
  },
});
