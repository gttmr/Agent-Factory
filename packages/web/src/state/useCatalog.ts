import { useQuery } from "@tanstack/react-query";
import { parseCatalogIndexPayload, type CatalogIndex } from "../catalog/catalogIndex";
import { AfApiError } from "./apiClient";

export type {
  CatalogCategory,
  CatalogEntryRaw,
  CatalogHubEntry,
  CatalogIO,
  CatalogIndex,
  TargetCatalogCategory
} from "../catalog/catalogIndex";

export function useCatalog() {
  return useQuery<CatalogIndex>({
    queryKey: ["af", "catalog-index"] as const,
    queryFn: async () => {
      const response = await fetch("/api/catalog");
      if (!response.ok) throw new AfApiError(response.status, "catalog 조회 실패");
      return parseCatalogIndexPayload(await response.json());
    },
    staleTime: 60_000
  });
}
