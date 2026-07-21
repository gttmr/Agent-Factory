import type { CatalogHubEntry } from "./catalogIndex";

export type CatalogProvenance = "seeded" | "session_added" | "session_edited" | "session_deleted" | "catalog_published";
export type RuntimeMock = Record<string, unknown>;

export interface CatalogEntry extends CatalogHubEntry {
  provenance: CatalogProvenance;
  originalSnapshot?: CatalogEntrySnapshot;
}

export type CatalogEntrySnapshot = Omit<CatalogEntry, "provenance" | "originalSnapshot">;
