const PREFIX = "pth:";

interface Envelope<T> {
  v: T;
  t: number;
}

function key(k: string) {
  return PREFIX + k;
}

export function rawGet<T>(k: string): T | null {
  try {
    const raw = localStorage.getItem(key(k));
    if (!raw) return null;
    return (JSON.parse(raw) as Envelope<T>).v;
  } catch {
    return null;
  }
}

export function cacheGet<T>(k: string, maxAgeMs: number): T | null {
  try {
    const raw = localStorage.getItem(key(k));
    if (!raw) return null;
    const env = JSON.parse(raw) as Envelope<T>;
    if (maxAgeMs >= 0 && Date.now() - env.t > maxAgeMs) return null;
    return env.v;
  } catch {
    return null;
  }
}

export function cacheSet<T>(k: string, v: T): void {
  try {
    const env: Envelope<T> = { v, t: Date.now() };
    localStorage.setItem(key(k), JSON.stringify(env));
  } catch {
    /* quota exceeded - ignore, cache is best-effort */
  }
}

export function cacheAge(k: string): number | null {
  try {
    const raw = localStorage.getItem(key(k));
    if (!raw) return null;
    return Date.now() - (JSON.parse(raw) as Envelope<unknown>).t;
  } catch {
    return null;
  }
}

export function cacheRemove(k: string): void {
  try {
    localStorage.removeItem(key(k));
  } catch {
    /* ignore */
  }
}
