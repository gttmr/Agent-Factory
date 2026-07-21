import { join } from "node:path";
import type { AssetType } from "../src/analyzer/types";

export function targetCatalogFile(
  catalogDir: string,
  assetType: AssetType
): { readonly path: string; readonly relative: string; readonly key: "agents" | "workflows" | "tools" } {
  switch (assetType) {
    case "agent":
      return { path: join(catalogDir, "agents.yaml"), relative: "catalog/agents.yaml", key: "agents" };
    case "workflow":
      return { path: join(catalogDir, "workflows.yaml"), relative: "catalog/workflows.yaml", key: "workflows" };
    case "tool":
      return { path: join(catalogDir, "tools.yaml"), relative: "catalog/tools.yaml", key: "tools" };
    default:
      return assertNever(assetType);
  }
}

function assertNever(value: never): never {
  throw new Error(`지원하지 않는 asset_type: ${String(value)}`);
}
