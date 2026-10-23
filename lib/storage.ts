// Per-browser preferences and state in localStorage. Every key is listed here.
// Access can throw (private mode, blocked storage, server render), so every
// call is guarded and falls back to the default.

export const STORAGE_KEYS = {
  team: "f1-garage:team",
  muted: "f1-garage:muted",
  chat: "f1-garage:chat",
  progress: "f1-garage:progress",
} as const

type Key = (typeof STORAGE_KEYS)[keyof typeof STORAGE_KEYS]

export function readString(key: Key): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

export function readJson<T>(key: Key): T | null {
  const raw = readString(key)
  if (!raw) return null
  try {
    return JSON.parse(raw) as T
  } catch {
    return null
  }
}

export function write(key: Key, value: string | object) {
  try {
    localStorage.setItem(key, typeof value === "string" ? value : JSON.stringify(value))
  } catch {
    // Storage full or blocked: the app works without persistence.
  }
}

export function remove(key: Key) {
  try {
    localStorage.removeItem(key)
  } catch {}
}
