import { useRouter } from "expo-router";
import { Button, EmptyState, Page } from "@/ui";

export default function NotFound() {
  const router = useRouter();
  return (
    <Page detail>
      <EmptyState title="That page isn’t in this preview">
        Return to Explore to keep looking around.
      </EmptyState>
      <Button onPress={() => router.replace("/")}>Back to Explore</Button>
    </Page>
  );
}
