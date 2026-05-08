import yaml from "js-yaml";
import agentsYaml from "../../../../catalog/agents.yaml?raw";
import adaptersYaml from "../../../../catalog/adapters.yaml?raw";
import workflowsYaml from "../../../../catalog/workflows.yaml?raw";
import remoteA2aYaml from "../../../../catalog/remote-a2a-contracts.yaml?raw";
import { ensureRuntimeBinding } from "./runtimeBinding";
import type { CatalogEntry } from "./types";

interface AgentRow {
  name: string;
  agent_kind?: string;
  owner_domain?: string;
  status?: string;
  responsibility?: string;
  inputs?: CatalogEntry["inputs"];
  outputs?: CatalogEntry["outputs"];
  scaffold_output?: string;
  component_source?: string;
  notes?: string;
}

interface AdapterRow {
  name: string;
  adapter_kind?: string;
  owner_domain?: string;
  status?: string;
  risk_signals?: string[];
  contract_status?: string;
  inputs?: CatalogEntry["inputs"];
  outputs?: CatalogEntry["outputs"];
  access_protocol?: string;
  mcp_server?: string;
  mcp_tool_name?: string;
  mcp_schema_ref?: string;
  mcp_auth_mode?: string;
  component_source?: string;
  notes?: string;
}

interface WorkflowRow {
  name: string;
  workflow_kind?: string;
  owner_domain?: string;
  status?: string;
  inputs?: CatalogEntry["inputs"];
  outputs?: CatalogEntry["outputs"];
  composition?: string[];
  scaffold_output?: string;
  component_source?: string;
  notes?: string;
}

interface RemoteRow {
  name: string;
  status?: string;
  required_before_approval?: string[];
  owner_domain?: string;
  inputs?: CatalogEntry["inputs"];
  outputs?: CatalogEntry["outputs"];
  component_source?: string;
  notes?: string;
}

function parseSection<T>(source: string, key: string): T[] {
  const doc = yaml.load(source) as Record<string, unknown> | undefined;
  if (!doc || typeof doc !== "object") return [];
  const value = (doc as Record<string, unknown>)[key];
  return Array.isArray(value) ? (value as T[]) : [];
}

function rowId(category: string, name: string): string {
  return `seed-${category}-${name}`;
}

export function loadSeedCatalog(): CatalogEntry[] {
  const entries: CatalogEntry[] = [];

  for (const row of parseSection<AgentRow>(agentsYaml, "agents")) {
    entries.push({
      id: rowId("agent", row.name),
      name: row.name,
      module_category: "agent",
      agent_kind: (row.agent_kind as CatalogEntry["agent_kind"]) ?? null,
      owner_domain: row.owner_domain,
      status: row.status,
      responsibility: row.responsibility,
      inputs: row.inputs ?? [],
      outputs: row.outputs ?? [],
      scaffold_output: row.scaffold_output,
      component_source: (row.component_source as CatalogEntry["component_source"]) ?? undefined,
      notes: row.notes,
      provenance: "seeded"
    });
  }

  for (const row of parseSection<AdapterRow>(adaptersYaml, "adapters")) {
    entries.push({
      id: rowId("adapter", row.name),
      name: row.name,
      module_category: "adapter",
      adapter_kind: (row.adapter_kind as CatalogEntry["adapter_kind"]) ?? null,
      owner_domain: row.owner_domain,
      status: row.status,
      risk_signals: (row.risk_signals as CatalogEntry["risk_signals"]) ?? [],
      contract_status: row.contract_status,
      inputs: row.inputs ?? [],
      outputs: row.outputs ?? [],
      access_protocol: (row.access_protocol as CatalogEntry["access_protocol"]) ?? null,
      mcp_server: row.mcp_server,
      mcp_tool_name: row.mcp_tool_name,
      mcp_schema_ref: row.mcp_schema_ref,
      mcp_auth_mode: row.mcp_auth_mode,
      component_source: (row.component_source as CatalogEntry["component_source"]) ?? undefined,
      notes: row.notes,
      provenance: "seeded"
    });
  }

  for (const row of parseSection<WorkflowRow>(workflowsYaml, "workflows")) {
    entries.push({
      id: rowId("workflow", row.name),
      name: row.name,
      module_category: "workflow",
      workflow_kind: (row.workflow_kind as CatalogEntry["workflow_kind"]) ?? null,
      owner_domain: row.owner_domain,
      status: row.status,
      inputs: row.inputs ?? [],
      outputs: row.outputs ?? [],
      composition: row.composition ?? [],
      scaffold_output: row.scaffold_output,
      component_source: (row.component_source as CatalogEntry["component_source"]) ?? undefined,
      notes: row.notes,
      provenance: "seeded"
    });
  }

  for (const row of parseSection<RemoteRow>(remoteA2aYaml, "remote_a2a_contracts")) {
    entries.push({
      id: rowId("remote_a2a", row.name),
      name: row.name,
      module_category: "remote_a2a",
      remote_contract_kind: "a2a",
      owner_domain: row.owner_domain,
      status: row.status,
      inputs: row.inputs ?? [],
      outputs: row.outputs ?? [],
      component_source: (row.component_source as CatalogEntry["component_source"]) ?? undefined,
      required_before_approval: row.required_before_approval ?? [],
      notes: row.notes,
      provenance: "seeded"
    });
  }

  return entries.map(ensureRuntimeBinding);
}
