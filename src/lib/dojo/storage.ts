import { useCallback, useMemo, useSyncExternalStore } from "react";
import type { Hypothesis, PaperPosition, Settings, Snapshot } from "./types";

/**
 * Persistence layer. Today: browser localStorage (this device only).
 * Swap `adapter` for a cloud-database adapter later without touching pages.
 */
export interface StorageAdapter {
  mode: "local" | "cloud";
  label: string;
  detail: string;
  read<T>(key: string, fallback: T): T;
  write<T>(key: string, value: T): void;
  subscribe(listener: () => void): () => void;
}

const PREFIX = "dojo:v1:";
const cache = new Map<string, unknown>();
const listeners = new Set<() => void>();
let windowListenerAttached = false;

function emit() {
  listeners.forEach((l) => l());
}

export const localAdapter: StorageAdapter = {
  mode: "local",
  label: "Local browser storage",
  detail: "Saved only in this browser on this device. Not synced, not backed up.",
  read<T>(key: string, fallback: T): T {
    if (typeof window === "undefined") return fallback;
    if (cache.has(key)) return cache.get(key) as T;
    let value: T = fallback;
    try {
      const raw = window.localStorage.getItem(PREFIX + key);
      if (raw) value = JSON.parse(raw) as T;
    } catch {
      value = fallback;
    }
    cache.set(key, value);
    return value;
  },
  write<T>(key: string, value: T) {
    cache.set(key, value);
    try {
      window.localStorage.setItem(PREFIX + key, JSON.stringify(value));
    } catch {
      /* quota or privacy mode — keep in memory */
    }
    emit();
  },
  subscribe(listener) {
    listeners.add(listener);
    if (!windowListenerAttached && typeof window !== "undefined") {
      windowListenerAttached = true;
      window.addEventListener("storage", (e) => {
        if (e.key?.startsWith(PREFIX)) {
          cache.delete(e.key.slice(PREFIX.length));
          emit();
        }
      });
    }
    return () => listeners.delete(listener);
  },
};

export const adapter: StorageAdapter = localAdapter;

export const KEYS = {
  snapshots: "snapshots",
  positions: "positions",
  hypotheses: "hypotheses",
  settings: "settings",
} as const;

export function usePersistent<T>(key: string, fallback: T): [T, (next: T | ((prev: T) => T)) => void] {
  const value = useSyncExternalStore(
    adapter.subscribe,
    () => adapter.read(key, fallback),
    () => fallback,
  );
  const set = useCallback(
    (next: T | ((prev: T) => T)) => {
      const prev = adapter.read(key, fallback);
      adapter.write(key, typeof next === "function" ? (next as (p: T) => T)(prev) : next);
    },
    [key, fallback],
  );
  return [value, set];
}

const EMPTY: never[] = [];

export function useCollection<T extends { id: string }>(key: string) {
  const [items, setItems] = usePersistent<T[]>(key, EMPTY as T[]);
  const upsert = useCallback(
    (item: T) =>
      setItems((prev) => {
        const i = prev.findIndex((x) => x.id === item.id);
        if (i === -1) return [item, ...prev];
        const copy = prev.slice();
        copy[i] = item;
        return copy;
      }),
    [setItems],
  );
  const remove = useCallback((id: string) => setItems((prev) => prev.filter((x) => x.id !== id)), [setItems]);
  return { items, upsert, remove, setItems };
}

export const DEFAULT_SETTINGS: Settings = {
  privateAccess: true,
  bankrollUsd: 10000,
  maxStakePct: 2,
  maxOpenExposurePct: 10,
  dailyLossCapUsd: 300,
  minEdgePp: 3,
  staleAfterSecBinary: 30,
  staleAfterSecFx: 120,
  alertEmail: "",
  alertOnTrade: true,
  alertOnStale: false,
  alertOnDrawdown: true,
};

export function useSettings(): [Settings, (s: Settings) => void] {
  const [stored, set] = usePersistent<Partial<Settings>>(KEYS.settings, DEFAULT_SETTINGS);
  const merged = useMemo(() => ({ ...DEFAULT_SETTINGS, ...stored }), [stored]);
  return [merged, set as (s: Settings) => void];
}

export const useSnapshots = () => useCollection<Snapshot>(KEYS.snapshots);
export const usePositions = () => useCollection<PaperPosition>(KEYS.positions);
export const useHypotheses = () => useCollection<Hypothesis>(KEYS.hypotheses);

export function exportAll(): string {
  const out: Record<string, unknown> = { exportedAt: new Date().toISOString(), schema: "dojo:v1" };
  for (const k of Object.values(KEYS)) out[k] = adapter.read(k, null);
  return JSON.stringify(out, null, 2);
}

export function importAll(json: string) {
  const data = JSON.parse(json) as Record<string, unknown>;
  if (data.schema !== "dojo:v1") throw new Error("Not a DOJO v1 export file");
  for (const k of Object.values(KEYS)) if (data[k] != null) adapter.write(k, data[k]);
}

export function resetAll() {
  for (const k of Object.values(KEYS)) {
    cache.delete(k);
    try {
      window.localStorage.removeItem(PREFIX + k);
    } catch {
      /* ignore */
    }
  }
  emit();
}