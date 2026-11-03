import {
  createContext,
  useCallback,
  useContext,
  useState,
  type PropsWithChildren,
} from "react";
import { initialMessages, notes } from "./data";

type Message = { id: string; sender: string; body: string; time: string };
type PreviewStore = {
  messages: Message[];
  unread: boolean;
  read: () => void;
  send: (body: string) => void;
  noteValues: Record<string, string>;
  saveNote: (id: string, body: string) => void;
  reset: () => void;
};

const Context = createContext<PreviewStore | null>(null);
const initialNotes = () =>
  Object.fromEntries(notes.map((note) => [note.id, note.initial]));

export function PreviewProvider({ children }: PropsWithChildren) {
  const [messages, setMessages] = useState<Message[]>([...initialMessages]);
  const [unread, setUnread] = useState(true);
  const [noteValues, setNoteValues] =
    useState<Record<string, string>>(initialNotes);
  const read = useCallback(() => setUnread(false), []);
  const reset = () => {
    setMessages([...initialMessages]);
    setUnread(true);
    setNoteValues(initialNotes());
  };
  return (
    <Context.Provider
      value={{
        messages,
        unread,
        read,
        noteValues,
        reset,
        send: (body) =>
          setMessages((items) => [
            ...items,
            {
              id: "preview-" + items.length,
              sender: "you",
              body,
              time: "In this preview",
            },
          ]),
        saveNote: (id, body) =>
          setNoteValues((items) => ({ ...items, [id]: body })),
      }}
    >
      {children}
    </Context.Provider>
  );
}

export function usePreview() {
  const value = useContext(Context);
  if (!value) throw new Error("PreviewProvider is required");
  return value;
}
