/** Focus and visibility often describe the same return to a browser tab. */
export function subscribeToVisibleReturn(
  document: EventTarget & { readonly visibilityState: string },
  window: EventTarget,
  refresh: () => void,
  now: () => number = Date.now,
) {
  let lastReturn = -Infinity;
  const onReturn = () => {
    if (document.visibilityState !== "visible") {
      lastReturn = -Infinity;
      return;
    }
    const time = now();
    if (time - lastReturn < 1000) return;
    lastReturn = time;
    refresh();
  };
  const onFocus = (event: Event) => {
    if (event.target === window) onReturn();
  };
  document.addEventListener("visibilitychange", onReturn);
  window.addEventListener("focus", onFocus);
  return () => {
    document.removeEventListener("visibilitychange", onReturn);
    window.removeEventListener("focus", onFocus);
  };
}
