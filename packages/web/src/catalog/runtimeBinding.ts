import type { CatalogEntry, RuntimeBinding } from "./types";

export function deriveRuntimeBinding(entry: CatalogEntry): RuntimeBinding {
  if (entry.module_category === "remote_a2a") {
    return "remote_a2a";
  }
  if (entry.component_source === "remote_a2a") {
    return "remote_a2a";
  }
  if (entry.access_protocol === "mcp" || (entry.mcp_server && entry.mcp_tool_name)) {
    return "mcp";
  }
  return "unresolved";
}

export function ensureRuntimeBinding(entry: CatalogEntry): CatalogEntry {
  if (entry.runtime_binding) return entry;
  return { ...entry, runtime_binding: deriveRuntimeBinding(entry) };
}
