"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  EMPTY_EXPLORE_PREFERENCES,
  exploreStorageKey,
  parseExplorePreferences,
  type ExplorePreferences,
} from "./explore-discovery-model";

export function useExplorePreferences(scope: string | null) {
  const [preferences, setPreferences] = useState(EMPTY_EXPLORE_PREFERENCES);
  const [ready, setReady] = useState(false);
  const [notice, setNotice] = useState("");
  const current = useRef(preferences);
  const writable = useRef(false);
  useEffect(() => {
    const update = (value: ExplorePreferences) => {
      current.current = value;
      setPreferences(value);
    };
    const read = () => {
      if (!scope) {
        update(EMPTY_EXPLORE_PREFERENCES);
        setNotice(
          "Saved discovery settings are unavailable while your account is being verified.",
        );
        setReady(true);
        return;
      }
      try {
        const raw = window.localStorage.getItem(exploreStorageKey(scope));
        const value =
          raw === null
            ? EMPTY_EXPLORE_PREFERENCES
            : parseExplorePreferences(raw);
        if (!value) throw new Error("Invalid saved discovery settings.");
        update(value);
        writable.current = true;
        setNotice("");
      } catch {
        writable.current = false;
        update(EMPTY_EXPLORE_PREFERENCES);
        setNotice(
          "Saved discovery settings could not be loaded. Changes last for this visit only. You can reset browser settings below.",
        );
      }
      setReady(true);
    };
    read();
    const changed = (event: StorageEvent) => {
      if (
        scope &&
        (event.key === null || event.key === exploreStorageKey(scope))
      )
        read();
    };
    window.addEventListener("storage", changed);
    return () => window.removeEventListener("storage", changed);
  }, [scope]);
  const update = useCallback(
    (change: (previous: ExplorePreferences) => ExplorePreferences) => {
      if (!scope) return;
      const next = change(current.current);
      if (writable.current) {
        try {
          window.localStorage.setItem(
            exploreStorageKey(scope),
            JSON.stringify(next),
          );
        } catch {
          writable.current = false;
          setNotice(
            "Browser storage is unavailable. These changes last for this visit only.",
          );
        }
      }
      current.current = next;
      setPreferences(next);
    },
    [scope],
  );
  const reset = useCallback(() => {
    if (!scope) return;
    try {
      window.localStorage.removeItem(exploreStorageKey(scope));
      writable.current = true;
      current.current = EMPTY_EXPLORE_PREFERENCES;
      setPreferences(EMPTY_EXPLORE_PREFERENCES);
      setNotice("");
    } catch {
      setNotice(
        "Browser settings could not be reset. Allow storage in this browser and try again.",
      );
    }
  }, [scope]);
  return { preferences, ready, notice, update, reset };
}
