export type CatalogCategory = "agent" | "workflow" | "adapter" | "remote_a2a";

export interface CatalogIO {
  name: string;
  type: string;
  required?: boolean;
}

export interface CatalogEntryRaw {
  id?: string;
  name: string;
  version?: number;
  agent_kind?: string;
  workflow_kind?: string;
  adapter_kind?: string;
  remote_contract_kind?: string;
  owner_domain?: string;
  status?: string;
  component_source?: string;
  runtime_binding?: string;
  access_protocol?: string;
  mcp_server?: string;
  mcp_tool_name?: string;
  mcp_schema_ref?: string;
  mcp_auth_mode?: string;
  contract_status?: string;
  responsibility?: string;
  inputs?: CatalogIO[];
  outputs?: CatalogIO[];
  risk_signals?: string[];
  composition?: string[];
  scaffold_output?: string;
  notes?: string;
  provenance?: string;
  published_at?: string;
  published_from?: string;
  source_candidate_id?: string;
  runtime_mock?: Record<string, unknown> | null;
  required_before_approval?: string[];
}

export interface CatalogHubEntry extends CatalogEntryRaw {
  /** synthetic id stable per (category,name) for keys + pinning */
  id: string;
  category: CatalogCategory;
  subtype?: string;
}

export interface CatalogIndex {
  agents: CatalogHubEntry[];
  workflows: CatalogHubEntry[];
  adapters: CatalogHubEntry[];
  remoteA2A: CatalogHubEntry[];
  domainOwners: unknown;
  riskGates: unknown;
}
