import type { CatalogHubEntry, CatalogIndex } from "./catalogIndex";
import type { CatalogEntry } from "./types";

export function catalogIndexToScaffoldCatalog(index: CatalogIndex): CatalogEntry[] {
  return [...index.agents, ...index.workflows, ...index.tools].map(toScaffoldCatalogEntry);
}

export function toScaffoldCatalogEntry(entry: CatalogHubEntry): CatalogEntry {
  return {
    ...entry,
    provenance: (entry.provenance as CatalogEntry["provenance"]) ?? "seeded"
  };
}
