import { useCallback, useEffect, useState } from "react";
import { rawGet, cacheSet } from "../lib/cache";

/** useState that transparently persists to localStorage under an "pth:" key. */
export function usePersistentState<T>(key: string, initial: T): [T, (v: T | ((p: T) => T)) => void] {
  const [state, setState] = useState<T>(() => {
    const stored = rawGet<T>(key);
    return stored === null ? initial : stored;
  });

  useEffect(() => {
    cacheSet(key, state);
  }, [key, state]);

  const set = useCallback((v: T | ((p: T) => T)) => {
    setState((prev) => (typeof v === "function" ? (v as (p: T) => T)(prev) : v));
  }, []);

  return [state, set];
}
