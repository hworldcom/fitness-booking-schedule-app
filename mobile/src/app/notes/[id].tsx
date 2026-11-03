import { useState } from "react";
import { useLocalSearchParams } from "expo-router";
import { KeyboardAvoidingView, Platform, TextInput, View } from "react-native";
import { notes } from "@/preview/data";
import { usePreview } from "@/preview/store";
import {
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

export default function NoteDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const note = notes.find((item) => item.id === id);
  const { noteValues, saveNote } = usePreview();
  const [draft, setDraft] = useState(noteValues[id] ?? "");
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  if (!note)
    return (
      <Page detail>
        <EmptyState title="Sample note not found">
          Go back to Sessions and choose a personal or shared note.
        </EmptyState>
      </Page>
    );
  const personal = note.kind === "personal";
  const save = () => {
    if (!personal && !draft.trim()) {
      setError("A shared session note needs some text.");
      setSaved(false);
      return;
    }
    if ([...draft].length > 2000) {
      setError("Keep this sample note within 2,000 characters.");
      setSaved(false);
      return;
    }
    saveNote(id, draft.trim());
    setError("");
    setSaved(true);
  };
  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={96}
    >
      <Page detail>
        <Badge tone={personal ? "mint" : "purple"}>
          {personal ? "PERSONAL WORKOUT" : "BOOKED SESSION"}
        </Badge>
        <Heading>{note.title}</Heading>
        <Surface>
          <Meta icon={personal ? "lock" : "message"}>{note.subtitle}</Meta>
          <Meta icon="calendar">{note.date} · sample date</Meta>
          <Copy style={{ fontSize: 13 }}>
            {personal
              ? "This private note is separate from shared coaching feedback."
              : "You’re editing your own feedback, not the coach’s shared plan."}
          </Copy>
        </Surface>
        <View style={{ gap: 10 }}>
          <Heading small>
            {personal ? "A note to yourself" : "Your shared feedback"}
          </Heading>
          <TextInput
            accessibilityLabel={
              personal ? "Personal workout note" : "Shared session note"
            }
            multiline
            value={draft}
            onChangeText={(text) => {
              setDraft(text);
              setSaved(false);
              setError("");
            }}
            style={[
              styles.input,
              { minHeight: 190, borderColor: error ? colors.error : "#CEC6DB" },
            ]}
            placeholder="What would you like to remember?"
            placeholderTextColor={colors.muted}
          />
          <Copy style={{ fontSize: 12 }}>
            {[...draft].length} / 2,000 characters · preview only
          </Copy>
        </View>
        {error && (
          <Copy accessibilityRole="alert" style={styles.error}>
            {error}
          </Copy>
        )}
        <Button onPress={save}>Update preview note</Button>
        {saved && (
          <Copy accessibilityRole="alert" style={{ color: colors.mintInk }}>
            Updated in this preview. Nothing was saved to a real account.
          </Copy>
        )}
        <Copy style={{ fontSize: 12 }}>
          You can try editing this sample. Changes stay in memory and reset when
          the app reloads. Video references and real saves arrive with note
          integration.
        </Copy>
      </Page>
    </KeyboardAvoidingView>
  );
}
