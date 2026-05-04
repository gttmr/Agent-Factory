import type {
  AccessProtocol,
  AdapterKind,
  AgentKind,
  ModuleCategory,
  RemoteContractKind,
  RiskSignal,
  WorkflowKind
} from "../analyzer/types";

export type CatalogProvenance = "seeded" | "session_added" | "session_edited" | "session_deleted";

export interface CatalogEntry {
  id: string;
  name: string;
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
  owner_domain?: string;
  status?: string;
  responsibility?: string;
  scaffold_output?: string;
  notes?: string;
  contract_status?: string;
  risk_signals?: RiskSignal[];
  required_before_approval?: string[];
  provenance: CatalogProvenance;
  originalSnapshot?: CatalogEntrySnapshot;
}

export type CatalogEntrySnapshot = Omit<CatalogEntry, "provenance" | "originalSnapshot">;

export interface CatalogChangeSet {
  added: CatalogEntry[];
  updated: Array<{ before: CatalogEntrySnapshot; after: CatalogEntry }>;
  removed: CatalogEntrySnapshot[];
}
