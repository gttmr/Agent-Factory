export type MockProtocol = "mcp_stdio";

export interface JsonSchema {
  type?: string | string[];
  description?: string;
  properties?: Record<string, JsonSchema>;
  items?: JsonSchema;
  required?: string[];
  enum?: unknown[];
  const?: unknown;
  additionalProperties?: boolean | JsonSchema;
  pattern?: string;
  minLength?: number;
  maxLength?: number;
  minimum?: number;
  maximum?: number;
}

export interface MockToolErrorScenario {
  name: string;
  when?: Record<string, unknown>;
  errorCode: string;
  message: string;
}

export interface MockToolSpec {
  name: string;
  title?: string;
  description: string;
  inputSchema: JsonSchema;
  outputSchema: JsonSchema;
  successResponse: Record<string, unknown>;
  errorScenarios?: MockToolErrorScenario[];
  latencyMs?: number;
  riskSignals?: string[];
  auditRequired?: boolean;
}

export interface MockSpecGuardrails {
  synthetic_only: true;
  no_private_data: true;
  no_private_endpoint: true;
  no_credentials: true;
  no_production_business_logic: true;
}

export interface MockSpecSource {
  prefill_from_catalog?: boolean;
  catalog_asset_id?: string | null;
  catalog_entry_name?: string | null;
  catalog_file?: string | null;
}

export interface MockSpec {
  mock_id: string;
  server_name: string;
  protocol: MockProtocol;
  description?: string;
  source?: MockSpecSource;
  tools: MockToolSpec[];
  guardrails: MockSpecGuardrails;
}

export interface CatalogPrefillEntry {
  asset_id: string;
  name: string;
  asset_type: "tool";
  capability_tags: string[];
  owner: string;
  binding: {
    kind: "mcp";
    server_ref: string;
    tool_name: string;
  };
  connection: {
    transport: "stdio" | "http";
  };
  contract_status: string;
  inputs: Array<Record<string, unknown>>;
  outputs: Array<Record<string, unknown>>;
  risk_signals: string[];
  has_runtime_mock: boolean;
  notes: string | null;
  prefill: MockSpec;
}

export interface CatalogPrefillPayload {
  entries: CatalogPrefillEntry[];
  loaded_at: string;
  source_file: string;
}

export interface ValidationIssue {
  path: string;
  message: string;
}

export interface ValidationResult {
  ok: boolean;
  errors: ValidationIssue[];
  warnings: ValidationIssue[];
}

export type MockDraftStatus = "running" | "completed" | "failed" | "cancelled";

export interface MockDraftSummary {
  draft_id: string;
  mock_id: string;
  status: MockDraftStatus;
  model: string;
  started_at: string;
  finished_at: string | null;
  elapsed_ms: number;
  pid: number | null;
  command: string | null;
  validation: {
    ok: boolean;
    errors: string[];
    warnings: string[];
  };
  last_error: string | null;
}

export interface MockDraftDetail {
  request: unknown;
  summary: MockDraftSummary;
  events: unknown[];
  draft_spec: MockSpec | null;
  stdout: string;
  stderr: string;
}

export type MockServerStatusValue = "stopped" | "starting" | "running" | "exited" | "failed";

export interface MockServerStatus {
  mock_id: string;
  status: MockServerStatusValue;
  pid: number | null;
  started_at: string | null;
  stopped_at?: string | null;
  command: string | null;
  cwd: string | null;
  stdout_tail: string[];
  stderr_tail: string[];
  last_error?: string | null;
}

export interface JsonRpcEnvelope {
  jsonrpc: "2.0";
  id: number | string | null;
  result?: unknown;
  error?: {
    code: number;
    message: string;
    data?: unknown;
  };
}

export function createEmptyMockSpec(mockId = "mock-lab-demo"): MockSpec {
  return {
    mock_id: mockId,
    server_name: `${mockId}-mcp`,
    protocol: "mcp_stdio",
    description: "Synthetic local MCP mock server.",
    source: {
      prefill_from_catalog: false,
      catalog_entry_name: null,
      catalog_file: null
    },
    tools: [
      {
        name: "sample_tool",
        description: "Synthetic sample MCP tool.",
        inputSchema: {
          type: "object",
          properties: {
            request_id: { type: "string" }
          },
          required: ["request_id"],
          additionalProperties: false
        },
        outputSchema: {
          type: "object",
          properties: {
            synthetic: { type: "boolean" },
            source: { type: "string" }
          },
          required: ["synthetic", "source"],
          additionalProperties: true
        },
        successResponse: {
          synthetic: true,
          source: "agent-factory-mock-lab"
        },
        errorScenarios: [],
        latencyMs: 0,
        riskSignals: [],
        auditRequired: true
      }
    ],
    guardrails: {
      synthetic_only: true,
      no_private_data: true,
      no_private_endpoint: true,
      no_credentials: true,
      no_production_business_logic: true
    }
  };
}
