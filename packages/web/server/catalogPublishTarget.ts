import { join } from "node:path";
import type { CatalogCategory } from "./catalogPublishValidation";

export function targetCatalogFile(
  catalogDir: string,
  category: CatalogCategory
): { readonly path: string; readonly relative: string; readonly key: string } {
  if (category === "agent") return { path: join(catalogDir, "agents.yaml"), relative: "catalog/agents.yaml", key: "agents" };
  if (category === "workflow") return { path: join(catalogDir, "workflows.yaml"), relative: "catalog/workflows.yaml", key: "workflows" };
  if (category === "adapter") return { path: join(catalogDir, "adapters.yaml"), relative: "catalog/adapters.yaml", key: "adapters" };
  return {
    path: join(catalogDir, "remote-a2a-contracts.yaml"),
    relative: "catalog/remote-a2a-contracts.yaml",
    key: "remote_a2a_contracts"
  };
}
