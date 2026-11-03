import { useEffect, useRef, useState } from "react";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { usePreview } from "@/preview/store";
import {
  Badge,
  Button,
  Copy,
  EmptyState,
  Page,
  Surface,
  colors,
  styles,
} from "@/ui";

export default function Conversation() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { messages, read, send } = usePreview();
  const [draft, setDraft] = useState("");
  const [error, setError] = useState("");
  const history = useRef<ScrollView>(null);
  useEffect(() => {
    if (id === "nia") read();
  }, [id, read]);
  if (id !== "nia")
    return (
      <Page detail>
        <EmptyState title="Sample conversation not found">
          Choose the sample conversation from Messages.
        </EmptyState>
      </Page>
    );
  const submit = () => {
    if (!draft.trim()) {
      setError("Write a sample message first.");
      return;
    }
    if ([...draft].length > 4000) {
      setError("Keep this sample message within 4,000 characters.");
      return;
    }
    send(draft.trim());
    setDraft("");
    setError("");
  };
  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={96}
    >
      <Page detail scroll={false}>
        <ScrollView
          ref={history}
          contentContainerStyle={{ padding: 20, gap: 18 }}
          keyboardShouldPersistTaps="handled"
          onContentSizeChange={() =>
            history.current?.scrollToEnd({ animated: false })
          }
        >
          <Copy style={{ textAlign: "center", fontSize: 11 }}>
            A SAMPLE CONVERSATION
          </Copy>
          <Surface
            style={{ backgroundColor: colors.mint, borderColor: colors.mint }}
          >
            <Badge tone="plain">YOUR SHARED SESSION</Badge>
            <Text
              style={{ fontWeight: "600", fontSize: 16, color: colors.ink }}
            >
              Boxing fundamentals
            </Text>
            <Copy style={{ fontSize: 13 }}>
              Thu, 5 Nov · 18:00–19:15 · Berlin
            </Copy>
            <Button secondary onPress={() => router.push("/session/boxing")}>
              View shared session
            </Button>
          </Surface>
          {messages.map((message) => (
            <View
              key={message.id}
              style={{
                alignSelf: message.sender === "you" ? "flex-end" : "flex-start",
                maxWidth: "90%",
                gap: 5,
              }}
            >
              <View
                style={{
                  padding: 14,
                  borderRadius: 18,
                  borderBottomRightRadius: message.sender === "you" ? 4 : 18,
                  borderBottomLeftRadius: message.sender === "coach" ? 4 : 18,
                  backgroundColor:
                    message.sender === "you" ? colors.purple : colors.white,
                }}
              >
                <Text
                  style={{
                    color: message.sender === "you" ? colors.white : colors.ink,
                    fontSize: 15,
                    lineHeight: 23,
                  }}
                >
                  {message.body}
                </Text>
              </View>
              <Copy
                style={{
                  fontSize: 10,
                  textAlign: message.sender === "you" ? "right" : "left",
                }}
              >
                {message.sender === "you" ? "You" : "Nia"} · {message.time}
              </Copy>
            </View>
          ))}
        </ScrollView>
        <View
          style={{
            padding: 16,
            gap: 10,
            borderTopColor: colors.line,
            borderTopWidth: 1,
            backgroundColor: colors.white,
          }}
        >
          {error && (
            <Copy accessibilityRole="alert" style={styles.error}>
              {error}
            </Copy>
          )}
          <TextInput
            accessibilityLabel="Sample message"
            value={draft}
            onChangeText={(text) => {
              setDraft(text);
              setError("");
            }}
            multiline
            style={[styles.input, { minHeight: 52, maxHeight: 140 }]}
            placeholder="Write a sample message…"
            placeholderTextColor={colors.muted}
          />
          <Button onPress={submit}>Send sample message</Button>
          <Copy style={{ textAlign: "center", fontSize: 10 }}>
            Only in this preview. No message is sent to another person.
          </Copy>
        </View>
      </Page>
    </KeyboardAvoidingView>
  );
}
