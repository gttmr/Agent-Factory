export function entryVersion(entry: unknown): number {
  if (!isRecord(entry)) return 0;
  return typeof entry.version === "number" && Number.isFinite(entry.version) ? entry.version : 0;
}

export function latestByAssetId(entries: readonly unknown[], assetId: string): Record<string, unknown> | null {
  const matching = entries.filter(
    (entry): entry is Record<string, unknown> => isRecord(entry) && entry.asset_id === assetId
  );
  if (matching.length === 0) return null;
  return matching.reduce((latest, entry) => (entryVersion(entry) > entryVersion(latest) ? entry : latest));
}

export function dedupeKeepLatestPublished<T>(entries: readonly T[]): T[] {
  const byAssetId = new Map<string, T>();
  for (const entry of entries) {
    if (!isRecord(entry) || typeof entry.asset_id !== "string" || !entry.asset_id.trim()) continue;
    if (entry.status === "deprecated") continue;
    const current = byAssetId.get(entry.asset_id);
    if (!current || entryVersion(entry) > entryVersion(current)) byAssetId.set(entry.asset_id, entry);
  }
  return [...byAssetId.values()];
}

export function nextVersionForAssetId(entries: readonly unknown[], assetId: string): number {
  const versions = entries
    .filter((entry) => isRecord(entry) && entry.asset_id === assetId)
    .map(entryVersion)
    .filter((version) => version > 0);
  return versions.length === 0 ? 1 : Math.max(...versions) + 1;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
