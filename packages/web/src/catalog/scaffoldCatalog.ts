import { ensureRuntimeBinding } from "./runtimeBinding";
import type { CatalogHubEntry, CatalogIndex } from "./catalogIndex";
import type { CatalogEntry } from "./types";

export function catalogIndexToScaffoldCatalog(index: CatalogIndex): CatalogEntry[] {
  return [...index.agents, ...index.workflows, ...index.adapters, ...index.remoteA2A].map(toScaffoldCatalogEntry);
}

export function toScaffoldCatalogEntry(entry: CatalogHubEntry): CatalogEntry {
  const catalogEntry: CatalogEntry = {
    id: entry.id,
    name: entry.name,
    version: entry.version,
    module_category: entry.category,
    agent_kind: entry.category === "agent" ? (entry.agent_kind as CatalogEntry["agent_kind"]) ?? null : null,
    workflow_kind:
      entry.category === "workflow" ? (entry.workflow_kind as CatalogEntry["workflow_kind"]) ?? null : null,
    adapter_kind: entry.category === "adapter" ? (entry.adapter_kind as CatalogEntry["adapter_kind"]) ?? null : null,
    remote_contract_kind:
      entry.category === "remote_a2a"
        ? (entry.remote_contract_kind as CatalogEntry["remote_contract_kind"]) ?? "a2a"
        : null,
    access_protocol: (entry.access_protocol as CatalogEntry["access_protocol"]) ?? null,
    mcp_server: entry.mcp_server,
    mcp_tool_name: entry.mcp_tool_name,
    mcp_schema_ref: entry.mcp_schema_ref,
    mcp_auth_mode: entry.mcp_auth_mode,
    component_source: (entry.component_source as CatalogEntry["component_source"]) ?? undefined,
    runtime_binding: (entry.runtime_binding as CatalogEntry["runtime_binding"]) ?? undefined,
    owner_domain: entry.owner_domain,
    status: entry.status,
    published_at: entry.published_at,
    published_from: entry.published_from,
    source_candidate_id: entry.source_candidate_id,
    responsibility: entry.responsibility,
    inputs: entry.inputs ?? [],
    outputs: entry.outputs ?? [],
    composition: entry.composition ?? [],
    scaffold_output: entry.scaffold_output,
    notes: entry.notes,
    contract_status: entry.contract_status,
    risk_signals: (entry.risk_signals as CatalogEntry["risk_signals"]) ?? [],
    runtime_mock: entry.runtime_mock ?? null,
    required_before_approval: entry.required_before_approval ?? [],
    provenance: (entry.provenance as CatalogEntry["provenance"]) ?? "seeded"
  };
  return ensureRuntimeBinding(catalogEntry);
}
