import type { CatalogEntry, RuntimeBinding } from "./types";

export function deriveRuntimeBinding(entry: CatalogEntry): RuntimeBinding {
  if (entry.module_category === "remote_a2a") {
    return "remote_a2a";
  }
  if (entry.access_protocol === "mcp" || (entry.mcp_server && entry.mcp_tool_name)) {
    return "mcp";
  }
  if (entry.component_source === "stub") {
    return "stub";
  }
  return "unresolved";
}

export function ensureRuntimeBinding(entry: CatalogEntry): CatalogEntry {
  if (entry.runtime_binding) return entry;
  return { ...entry, runtime_binding: deriveRuntimeBinding(entry) };
}

export function refreshRuntimeBinding(entry: CatalogEntry): CatalogEntry {
  const derived = deriveRuntimeBinding(entry);
  if (entry.runtime_binding === derived) return entry;
  return { ...entry, runtime_binding: derived };
}
