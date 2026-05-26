import { useEffect, useState } from "react";

const STORAGE_KEY = "agent-factory:recent-artifact-roots";
const MAX_ENTRIES = 20;

export interface RecentRoot {
  requirement_id: string;
  last_opened: string;
}

function readStorage(): RecentRoot[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (entry): entry is RecentRoot =>
        typeof entry === "object" &&
        entry !== null &&
        typeof (entry as RecentRoot).requirement_id === "string" &&
        typeof (entry as RecentRoot).last_opened === "string"
    );
  } catch {
    return [];
  }
}

function writeStorage(entries: RecentRoot[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  } catch {
    // best effort — ignore quota errors
  }
}

export function useRecentRoots() {
  const [entries, setEntries] = useState<RecentRoot[]>(() => readStorage());

  useEffect(() => {
    writeStorage(entries);
  }, [entries]);

  function touch(requirementId: string): void {
    setEntries((prev) => {
      const filtered = prev.filter((entry) => entry.requirement_id !== requirementId);
      const next: RecentRoot[] = [{ requirement_id: requirementId, last_opened: new Date().toISOString() }, ...filtered];
      return next.slice(0, MAX_ENTRIES);
    });
  }

  function remove(requirementId: string): void {
    setEntries((prev) => prev.filter((entry) => entry.requirement_id !== requirementId));
  }

  return { entries, touch, remove };
}
