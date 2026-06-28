import type {
  AccessProtocol,
  AdapterKind,
  AgentKind,
  ModuleCategory,
  RemoteContractKind,
  FieldSpec,
  RiskSignal,
  ComponentSource,
  WorkflowKind
} from "../analyzer/types";

export type CatalogProvenance = "seeded" | "session_added" | "session_edited" | "session_deleted" | "catalog_published";

export type RuntimeBinding = "unresolved" | "mcp" | "remote_a2a";

export const runtimeBindings: readonly RuntimeBinding[] = [
  "unresolved",
  "mcp",
  "remote_a2a"
];

export type RuntimeMock = Record<string, unknown>;

export interface CatalogEntry {
  id: string;
  name: string;
  version?: number;
  module_category: ModuleCategory;
  agent_kind?: AgentKind | null;
  workflow_kind?: WorkflowKind | null;
  adapter_kind?: AdapterKind | null;
  remote_contract_kind?: RemoteContractKind | null;
  access_protocol?: AccessProtocol | null;
  mcp_server?: string;
  mcp_tool_name?: string;
  mcp_schema_ref?: string;
  mcp_auth_mode?: string;
  component_source?: ComponentSource;
  runtime_binding?: RuntimeBinding | null;
  owner_domain?: string;
  status?: string;
  published_at?: string;
  published_from?: string;
  source_candidate_id?: string;
  responsibility?: string;
  inputs?: FieldSpec[];
  outputs?: FieldSpec[];
  composition?: string[];
  scaffold_output?: string;
  notes?: string;
  contract_status?: string;
  risk_signals?: RiskSignal[];
  runtime_mock?: RuntimeMock | null;
  required_before_approval?: string[];
  provenance: CatalogProvenance;
  originalSnapshot?: CatalogEntrySnapshot;
}

export type CatalogEntrySnapshot = Omit<CatalogEntry, "provenance" | "originalSnapshot">;
