import yaml from "js-yaml";
import type { CatalogChangeSet, CatalogEntry, CatalogEntrySnapshot } from "./types";

export function snapshotOf(entry: CatalogEntry): CatalogEntrySnapshot {
  const { provenance: _provenance, originalSnapshot: _originalSnapshot, ...rest } = entry;
  return rest;
}

export function isModified(entry: CatalogEntry): boolean {
  if (entry.provenance !== "session_edited") return false;
  if (!entry.originalSnapshot) return false;
  return JSON.stringify(snapshotOf(entry)) !== JSON.stringify(entry.originalSnapshot);
}

export function buildChangeSet(entries: CatalogEntry[]): CatalogChangeSet {
  const added: CatalogEntry[] = [];
  const updated: Array<{ before: CatalogEntrySnapshot; after: CatalogEntry }> = [];
  const removed: CatalogEntrySnapshot[] = [];

  for (const entry of entries) {
    if (entry.provenance === "session_added") {
      added.push(entry);
    } else if (entry.provenance === "session_edited") {
      if (entry.originalSnapshot && isModified(entry)) {
        updated.push({ before: entry.originalSnapshot, after: entry });
      }
    } else if (entry.provenance === "session_deleted") {
      if (entry.originalSnapshot) {
        removed.push(entry.originalSnapshot);
      } else {
        removed.push(snapshotOf(entry));
      }
    }
  }

  return { added, updated, removed };
}

export function buildCatalogChangesYaml(changes: CatalogChangeSet): string {
  const document = {
    catalog_changes: {
      added: changes.added.map(stripIdAndProvenance),
      updated: changes.updated.map((change) => ({
        before: stripIdAndProvenance(change.before),
        after: stripIdAndProvenance(change.after)
      })),
      removed: changes.removed.map(stripIdAndProvenance)
    }
  };

  return yaml.dump(document, { lineWidth: 100, noRefs: true, sortKeys: false });
}

function stripIdAndProvenance(input: CatalogEntry | CatalogEntrySnapshot): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input)) {
    if (key === "provenance" || key === "originalSnapshot" || key === "id") continue;
    if (value === null || value === undefined) continue;
    if (Array.isArray(value) && !value.length) continue;
    if (typeof value === "string" && !value.length) continue;
    result[key] = value;
  }
  return result;
}
