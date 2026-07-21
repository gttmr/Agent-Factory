import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { load as parseYaml } from "js-yaml";
import type { CatalogPrefillEntry, CatalogPrefillPayload, JsonSchema, MockSpec } from "../src/types/mockSpec";

interface CatalogToolCandidate {
  asset_id: string;
  asset_type: "tool";
  name: string;
  domain_scope: "domain_specific" | "cross_domain" | "domain_neutral";
  business_domains: string[];
  version?: number;
  status?: string;
  capability_tags: string[];
  owner: string;
  reuse_status: "not_reviewed" | "reuse_existing" | "publish_candidate" | "project_only" | "excluded";
  binding: { kind: "mcp"; server_ref: string; tool_name: string };
  connection: { transport: "stdio" | "http" };
  contract_status?: string;
  inputs?: Array<Record<string, unknown>>;
  outputs?: Array<Record<string, unknown>>;
  risk_signals?: string[];
  runtime_mock?: Record<string, unknown>;
  responsibility?: string;
  notes?: string;
}

export async function loadCatalogPrefill(repoRoot: string): Promise<CatalogPrefillPayload> {
  const tools = activeLatestByAssetId(await readCatalogTools(repoRoot));
  return {
    entries: tools.filter(isPrefillCandidate).map(toPrefillEntry),
    loaded_at: new Date().toISOString(),
    source_file: "catalog/tools.yaml"
  };
}

async function readCatalogTools(repoRoot: string): Promise<CatalogToolCandidate[]> {
  const sourceFile = join(repoRoot, "catalog/tools.yaml");
  const parsed = parseYaml(await readFile(sourceFile, "utf8"));
  if (!isRecord(parsed) || Object.keys(parsed).length !== 1 || !Array.isArray(parsed.tools)) {
    throw new Error("catalog/tools.yaml 은 tools 배열 하나만 포함해야 합니다.");
  }
  return parsed.tools.map((entry, index) => parseTool(entry, index));
}

function parseTool(value: unknown, index: number): CatalogToolCandidate {
  const path = `tools[${index}]`;
  if (!isRecord(value)) throw new Error(`${path} 는 객체여야 합니다.`);
  for (const key of retiredKeys) {
    if (key in value) throw new Error(`${path}.${key} retired key는 허용되지 않습니다.`);
  }
  for (const key of Object.keys(value)) {
    if (!catalogToolKeys.has(key)) throw new Error(`${path}.${key} 지원하지 않는 Catalog field입니다.`);
  }
  const binding = value.binding;
  const connection = value.connection;
  if (value.asset_type !== "tool") throw new Error(`${path}.asset_type 은 tool이어야 합니다.`);
  if (!isRecord(binding) || binding.kind !== "mcp") throw new Error(`${path}.binding.kind 는 mcp여야 합니다.`);
  if (!isRecord(connection) || connection.transport !== "stdio") {
    throw new Error(`${path}.connection.transport 는 stdio여야 합니다.`);
  }
  if (value.workflow_profile !== null) throw new Error(`${path}.workflow_profile 은 null이어야 합니다.`);
  if (value.exposure !== null) throw new Error(`${path}.exposure 는 null이어야 합니다.`);
  const parsed: CatalogToolCandidate = {
    asset_id: requiredString(value.asset_id, `${path}.asset_id`),
    asset_type: "tool",
    name: requiredString(value.name, `${path}.name`),
    domain_scope: requiredEnum(
      value.domain_scope,
      ["domain_specific", "cross_domain", "domain_neutral"] as const,
      `${path}.domain_scope`
    ),
    business_domains: requiredStringArray(value.business_domains, `${path}.business_domains`),
    capability_tags: requiredStringArray(value.capability_tags, `${path}.capability_tags`),
    owner: requiredString(value.owner, `${path}.owner`),
    reuse_status: requiredEnum(
      value.reuse_status,
      ["not_reviewed", "reuse_existing", "publish_candidate", "project_only", "excluded"] as const,
      `${path}.reuse_status`
    ),
    binding: {
      kind: "mcp",
      server_ref: requiredString(binding.server_ref, `${path}.binding.server_ref`),
      tool_name: requiredString(binding.tool_name, `${path}.binding.tool_name`)
    },
    connection: { transport: connection.transport }
  };
  if (typeof value.version === "number" && Number.isFinite(value.version)) parsed.version = value.version;
  copyString(parsed, "status", value.status);
  copyString(parsed, "contract_status", value.contract_status);
  copyString(parsed, "responsibility", value.responsibility);
  copyString(parsed, "notes", value.notes);
  if (Array.isArray(value.inputs)) parsed.inputs = value.inputs.filter(isRecord);
  if (Array.isArray(value.outputs)) parsed.outputs = value.outputs.filter(isRecord);
  if (Array.isArray(value.risk_signals)) parsed.risk_signals = requiredStringArray(value.risk_signals, `${path}.risk_signals`);
  if (isRecord(value.runtime_mock)) parsed.runtime_mock = cloneRecord(value.runtime_mock);
  return parsed;
}

function activeLatestByAssetId(entries: CatalogToolCandidate[]): CatalogToolCandidate[] {
  const latest = new Map<string, CatalogToolCandidate>();
  for (const entry of entries) {
    if (entry.status === "deprecated") continue;
    const current = latest.get(entry.asset_id);
    if (!current || numericVersion(entry.version) > numericVersion(current.version)) latest.set(entry.asset_id, entry);
  }
  return [...latest.values()];
}

function isPrefillCandidate(tool: CatalogToolCandidate): boolean {
  return tool.contract_status === "mock_ready" || tool.runtime_mock !== undefined;
}

function toPrefillEntry(tool: CatalogToolCandidate): CatalogPrefillEntry {
  const inputs = tool.inputs ?? [];
  const outputs = tool.outputs ?? [];
  const riskSignals = tool.risk_signals ?? [];
  const description = tool.notes || tool.responsibility || `${tool.name} synthetic MCP Tool`;
  const prefill: MockSpec = {
    mock_id: sanitizeMockId(tool.asset_id),
    server_name: tool.binding.server_ref,
    protocol: "mcp_stdio",
    description,
    source: {
      prefill_from_catalog: true,
      catalog_asset_id: tool.asset_id,
      catalog_entry_name: tool.name,
      catalog_file: "catalog/tools.yaml"
    },
    tools: [
      {
        name: tool.binding.tool_name,
        title: tool.name,
        description,
        inputSchema: fieldsToSchema(inputs, "input"),
        outputSchema: fieldsToSchema(outputs, "output"),
        successResponse: tool.runtime_mock ? cloneRecord(tool.runtime_mock) : {},
        errorScenarios: [],
        latencyMs: 0,
        riskSignals,
        auditRequired: riskSignals.includes("audit_required")
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
  return {
    asset_id: tool.asset_id,
    name: tool.name,
    asset_type: "tool",
    capability_tags: tool.capability_tags,
    owner: tool.owner,
    binding: tool.binding,
    connection: tool.connection,
    contract_status: tool.contract_status ?? "",
    inputs,
    outputs,
    risk_signals: riskSignals,
    has_runtime_mock: tool.runtime_mock !== undefined,
    notes: tool.notes ?? null,
    prefill
  };
}

function fieldsToSchema(fields: Array<Record<string, unknown>>, mode: "input" | "output"): JsonSchema {
  const properties: Record<string, JsonSchema> = {};
  const required: string[] = [];
  for (const field of fields) {
    const name = typeof field.name === "string" ? field.name.trim() : "";
    if (!name) continue;
    properties[name] = fieldToJsonSchema(typeof field.type === "string" ? field.type : "string");
    if (mode === "output" || field.required === true) required.push(name);
  }
  return { type: "object", properties, required, additionalProperties: mode === "output" };
}

function fieldToJsonSchema(type: string): JsonSchema {
  const normalized = type.trim().toLowerCase();
  const arrayMatch = normalized.match(/^array<(.+)>$/);
  if (arrayMatch) return { type: "array", items: fieldToJsonSchema(arrayMatch[1]) };
  if (normalized === "text" || normalized === "string") return { type: "string" };
  if (["number", "float", "double"].includes(normalized)) return { type: "number" };
  if (normalized === "integer" || normalized === "int") return { type: "integer" };
  if (normalized === "boolean" || normalized === "bool") return { type: "boolean" };
  if (normalized === "object" || normalized === "record") return { type: "object", additionalProperties: true };
  if (normalized === "array") return { type: "array", items: { type: "string" } };
  return { type: "string", description: `Catalog field type: ${type}` };
}

function requiredString(value: unknown, path: string): string {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${path} 는 비어 있지 않은 문자열이어야 합니다.`);
  return value.trim();
}

function requiredStringArray(value: unknown, path: string): string[] {
  if (!Array.isArray(value) || value.some((entry) => typeof entry !== "string" || !entry.trim())) {
    throw new Error(`${path} 는 문자열 배열이어야 합니다.`);
  }
  return value.map((entry) => entry.trim());
}

function requiredEnum<T extends readonly string[]>(value: unknown, allowed: T, path: string): T[number] {
  if (typeof value !== "string" || !allowed.some((candidate) => candidate === value)) {
    throw new Error(`${path} 값이 유효하지 않습니다.`);
  }
  return value as T[number];
}

function copyString(target: CatalogToolCandidate, key: keyof CatalogToolCandidate, value: unknown): void {
  if (typeof value === "string" && value.trim()) (target as unknown as Record<string, unknown>)[key] = value.trim();
}

function numericVersion(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function sanitizeMockId(value: string): string {
  const sanitized = value.replace(/[^a-zA-Z0-9_-]/g, "-").replace(/-+/g, "-").replace(/^-+|-+$/g, "");
  const result = sanitized.slice(0, 80);
  return result.length >= 3 ? result : "mock-lab-spec";
}

function cloneRecord(value: Record<string, unknown>): Record<string, unknown> {
  return JSON.parse(JSON.stringify(value)) as Record<string, unknown>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

const retiredKeys = [
  "adapter_kind",
  "owner_domain",
  "access_protocol",
  "component_source",
  "runtime_binding",
  "module_category",
  "subtype",
  "mcp_server",
  "mcp_tool_name",
  "mcp_schema_ref",
  "mcp_auth_mode",
  "scaffold_output"
] as const;
const catalogToolKeys = new Set([
  "asset_id",
  "asset_type",
  "name",
  "domain_scope",
  "business_domains",
  "owner",
  "reuse_status",
  "capability_tags",
  "binding",
  "connection",
  "workflow_profile",
  "exposure",
  "version",
  "status",
  "contract_status",
  "responsibility",
  "inputs",
  "outputs",
  "risk_signals",
  "notes",
  "runtime_mock"
]);
