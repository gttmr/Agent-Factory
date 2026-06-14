// 정렬/중복 제거용 점수. finite number 면 그대로 쓴다(원래 client hydration 의미 유지).
// publish 증분(nextVersionForName)은 정수만 만들어 내므로 finite 검사로도 server 동작은 동일하다.
export function entryVersion(entry: unknown): number {
  if (!isRecord(entry)) return 0;
  return typeof entry.version === "number" && Number.isFinite(entry.version) ? entry.version : 0;
}

export function latestByName(entries: readonly unknown[], name: string): Record<string, unknown> | null {
  const named = entries.filter((entry): entry is Record<string, unknown> => isRecord(entry) && entry.name === name);
  if (named.length === 0) return null;
  return named.reduce((latest, entry) => (entryVersion(entry) > entryVersion(latest) ? entry : latest));
}

export function dedupeKeepLatestPublished<T>(entries: readonly T[]): T[] {
  const byName = new Map<unknown, T>();
  for (const entry of entries) {
    if (isRecord(entry) && entry.status === "deprecated") continue;
    const current = byName.get(entryName(entry));
    if (!current || entryVersion(entry) > entryVersion(current)) {
      byName.set(entryName(entry), entry);
    }
  }
  return Array.from(byName.values());
}

export function nextVersionForName(entries: readonly unknown[], name: string): number {
  const versions = entries
    .filter((entry) => isRecord(entry) && entry.name === name)
    .map(entryVersion)
    .filter((version) => version > 0);
  if (versions.length === 0) return 1;
  return Math.max(...versions) + 1;
}

function entryName(entry: unknown): unknown {
  return isRecord(entry) ? entry.name : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
