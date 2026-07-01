import { useQuery } from "@tanstack/react-query";
import { dedupeKeepLatestPublished } from "../catalog/catalogVersioning";
import type { CatalogCategory, CatalogEntryRaw, CatalogHubEntry, CatalogIndex } from "../catalog/catalogIndex";
import { AfApiError } from "./apiClient";

export type { CatalogCategory, CatalogEntryRaw, CatalogHubEntry, CatalogIO, CatalogIndex } from "../catalog/catalogIndex";

function readEntries(value: unknown, key: string): CatalogEntryRaw[] {
  if (!value || typeof value !== "object") return [];
  const inner = (value as Record<string, unknown>)[key];
  return Array.isArray(inner) ? (inner.filter((entry): entry is CatalogEntryRaw => Boolean(entry) && typeof entry === "object")) : [];
}

function hydrate(category: CatalogCategory, entry: CatalogEntryRaw): CatalogHubEntry {
  const subtype =
    category === "agent"
      ? entry.agent_kind
      : category === "workflow"
        ? entry.workflow_kind
        : category === "adapter"
          ? entry.adapter_kind
          : entry.remote_contract_kind;
  return {
    ...entry,
    id: entry.id ?? `${category}:${entry.name}`,
    category,
    subtype: subtype ?? undefined
  };
}

function hydrateEntries(category: CatalogCategory, entries: CatalogEntryRaw[]): CatalogHubEntry[] {
  return dedupeKeepLatestPublished(entries).map((entry) => hydrate(category, entry));
}

function readContracts(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(Object.entries(value));
}

export function useCatalog() {
  return useQuery<CatalogIndex>({
    queryKey: ["af", "catalog-index"] as const,
    queryFn: async () => {
      const response = await fetch("/api/catalog");
      if (!response.ok) throw new AfApiError(response.status, "catalog 조회 실패");
      const body = (await response.json()) as Record<string, unknown>;
      return {
        agents: hydrateEntries("agent", readEntries(body.agents, "agents")),
        workflows: hydrateEntries("workflow", readEntries(body.workflows, "workflows")),
        adapters: hydrateEntries("adapter", readEntries(body.adapters, "adapters")),
        remoteA2A: hydrateEntries("remote_a2a", readEntries(body.remoteA2A, "remote_a2a_contracts")),
        contracts: readContracts(body.contracts),
        domainOwners: body.domainOwners,
        riskGates: body.riskGates
      };
    },
    staleTime: 60_000
  });
}
