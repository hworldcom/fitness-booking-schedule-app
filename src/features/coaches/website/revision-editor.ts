/** A revision belongs to one API, never to the whole Profile page. */
export type RevisionValue = { revision: number };
export type EditorReply<T> =
  | { status: "ready" | "saved"; value: T; cleanupPending?: boolean }
  | {
      status:
        | "invalid"
        | "conflict"
        | "signed-out"
        | "forbidden"
        | "unavailable"
        | "not-found";
    };
export type EditorSnapshot<T, D> = {
  saved: T | null;
  draft: D | null;
  editing: boolean;
  busy: boolean;
  recovery: "load" | "choose" | null;
  accessLost: boolean;
  message: string;
};

export class RevisionEditor<T extends RevisionValue, D> {
  private state: EditorSnapshot<T, D> = {
    saved: null,
    draft: null,
    editing: false,
    busy: false,
    recovery: null,
    accessLost: false,
    message: "",
  };
  private listeners = new Set<() => void>();
  private disposed = false;
  constructor(private toDraft: (value: T) => D) {}
  getSnapshot = () => this.state;
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };
  private update(patch: Partial<EditorSnapshot<T, D>>) {
    if (this.disposed) return;
    this.state = { ...this.state, ...patch };
    this.listeners.forEach((listener) => listener());
  }
  dispose() {
    this.disposed = true;
    this.listeners.clear();
    this.state = { ...this.state, saved: null, draft: null };
  }
  revoke() {
    this.denied("forbidden");
  }
  edit() {
    if (this.state.saved && !this.state.busy && !this.state.recovery)
      this.update({
        editing: true,
        draft: this.toDraft(this.state.saved),
        message: "",
      });
  }
  change(draft: D) {
    if (this.state.editing && !this.state.busy) this.update({ draft });
  }
  notice(message: string) {
    this.update({ message });
  }
  cancel() {
    if (this.state.busy || this.state.recovery) return;
    this.update({
      editing: false,
      draft: this.state.saved ? this.toDraft(this.state.saved) : null,
      message: "Unsaved changes discarded.",
    });
  }
  choose(keepDraft: boolean) {
    if (
      this.state.recovery !== "choose" ||
      !this.state.saved ||
      this.state.busy
    )
      return;
    this.update({
      recovery: null,
      editing: keepDraft,
      draft: keepDraft ? this.state.draft : this.toDraft(this.state.saved),
      message: keepDraft
        ? "Your draft is retained against the latest revision. Review it before saving; saving replaces the saved text or rate."
        : "Latest saved version loaded. Unsaved changes discarded.",
    });
  }
  private denied(status: string) {
    if (status !== "signed-out" && status !== "forbidden") return false;
    this.update({
      saved: null,
      draft: null,
      editing: false,
      busy: false,
      recovery: null,
      accessLost: true,
      message: "Your access changed. Reload the page to check your account.",
    });
    return true;
  }
  async load(read: () => Promise<EditorReply<T>>) {
    if (this.disposed || this.state.busy || this.state.accessLost) return;
    this.update({ busy: true, message: "Loading saved version…" });
    try {
      const result = await read();
      if (this.disposed || this.state.accessLost || this.denied(result.status))
        return;
      if (result.status === "ready") {
        const retain = this.state.editing && this.state.draft !== null;
        this.update({
          saved: result.value,
          draft: retain ? this.state.draft : this.toDraft(result.value),
          recovery: retain ? "choose" : null,
          message: retain
            ? "Latest saved version loaded. Choose which text or rate to keep before saving."
            : "Saved version loaded.",
        });
      } else
        this.update({
          message:
            "Saved version could not be loaded. Your draft is retained. Try again.",
        });
    } catch {
      this.update({
        message:
          "Saved version could not be loaded. Your draft is retained. Try again.",
      });
    } finally {
      this.update({ busy: false });
    }
  }
  async mutate(
    write: (revision: number) => Promise<EditorReply<T>>,
    retainDraft = false,
  ) {
    if (
      this.disposed ||
      this.state.busy ||
      this.state.recovery ||
      this.state.accessLost ||
      !this.state.saved
    )
      return;
    const revision = this.state.saved.revision;
    this.update({ busy: true, message: "Saving…" });
    try {
      const result = await write(revision);
      if (this.disposed || this.state.accessLost || this.denied(result.status))
        return;
      if (result.status === "saved" && result.value.revision > revision) {
        this.update({
          saved: result.value,
          draft:
            retainDraft && this.state.editing
              ? this.state.draft
              : this.toDraft(result.value),
          editing: retainDraft && this.state.editing,
          message: result.cleanupPending
            ? "Saved. Old banner cleanup is pending; your current banner is available."
            : retainDraft
              ? "Banner saved. Unsaved text is retained separately."
              : "Saved successfully.",
        });
      } else if (result.status === "invalid") {
        this.update({
          message:
            "Check the field limits, complete each added row and use HTTPS links. Banner files must be single-frame JPEG, PNG or WebP, 320 × 120 px or larger, up to 4 MiB and 8192 px per edge (24 million pixels maximum). Your draft is retained.",
        });
      } else {
        this.update({
          recovery: "load",
          message:
            result.status === "conflict"
              ? "This changed in another tab. Your draft is retained. Load the latest saved version before continuing."
              : "We couldn’t verify the save. It may have succeeded. Your draft is retained. Load the saved version before trying again.",
        });
      }
    } catch {
      this.update({
        recovery: "load",
        message:
          "We couldn’t verify the save. It may have succeeded. Your draft is retained. Load the saved version before trying again.",
      });
    } finally {
      this.update({ busy: false });
    }
  }
}
