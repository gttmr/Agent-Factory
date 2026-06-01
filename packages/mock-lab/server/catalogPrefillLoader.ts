import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { load as parseYaml } from "js-yaml";
import type { CatalogPrefillEntry, CatalogPrefillPayload, JsonSchema, MockSpec } from "../src/types/mockSpec";

interface CatalogAdapter {
  name?: unknown;
  adapter_kind?: unknown;
  owner_domain?: unknown;
  access_protocol?: unknown;
  component_source?: unknown;
  contract_status?: unknown;
  inputs?: unknown;
  outputs?: unknown;
  risk_signals?: unknown;
  runtime_mock?: unknown;
  mcp_tool_name?: unknown;
  notes?: unknown;
}

export async function loadCatalogPrefill(repoRoot: string): Promise<CatalogPrefillPayload> {
  const sourceFile = join(repoRoot, "catalog", "adapters.yaml");
  const text = await readFile(sourceFile, "utf8");
  const parsed = parseYaml(text);
  const adapters = readAdapters(parsed);
  const entries = adapters.filter(isPrefillCandidate).map((adapter) => toPrefillEntry(adapter, sourceFile));
  return {
    entries,
    loaded_at: new Date().toISOString(),
    source_file: "catalog/adapters.yaml"
  };
}

function readAdapters(value: unknown): CatalogAdapter[] {
  if (isRecord(value) && Array.isArray(value.adapters)) return value.adapters.filter(isRecord) as CatalogAdapter[];
  if (Array.isArray(value)) return value.filter(isRecord) as CatalogAdapter[];
  return [];
}

function isPrefillCandidate(adapter: CatalogAdapter): boolean {
  return (
    stringField(adapter.contract_status) === "mock_ready" ||
    isRecord(adapter.runtime_mock) ||
    stringField(adapter.component_source) === "stub"
  );
}

function toPrefillEntry(adapter: CatalogAdapter, sourceFile: string): CatalogPrefillEntry {
  const name = stringField(adapter.name) || "unnamed_adapter";
  const riskSignals = arrayOfStrings(adapter.risk_signals);
  const inputs = arrayOfRecords(adapter.inputs);
  const outputs = arrayOfRecords(adapter.outputs);
  const inputSchema = fieldsToSchema(inputs, "input");
  const outputSchema = fieldsToSchema(outputs, "output");
  const successResponse = isRecord(adapter.runtime_mock) ? cloneRecord(adapter.runtime_mock) : {};
  const toolName = sanitizeToolName(stringField(adapter.mcp_tool_name) || name);
  const prefill: MockSpec = {
    mock_id: sanitizeMockId(name),
    server_name: `${name}-mcp`,
    protocol: "mcp_stdio",
    description: stringField(adapter.notes) || `${name} synthetic MCP mock server`,
    source: {
      prefill_from_catalog: true,
      catalog_entry_name: name,
      catalog_file: "catalog/adapters.yaml"
    },
    tools: [
      {
        name: toolName,
        title: name,
        description: stringField(adapter.notes) || `${name} synthetic MCP tool`,
        inputSchema,
        outputSchema,
        successResponse,
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
    name,
    adapter_kind: stringField(adapter.adapter_kind),
    owner_domain: stringField(adapter.owner_domain),
    access_protocol: stringField(adapter.access_protocol),
    contract_status: stringField(adapter.contract_status),
    component_source: stringField(adapter.component_source),
    inputs,
    outputs,
    risk_signals: riskSignals,
    has_runtime_mock: isRecord(adapter.runtime_mock),
    notes: stringField(adapter.notes),
    prefill
  };
}

function fieldsToSchema(fields: Array<Record<string, unknown>>, mode: "input" | "output"): JsonSchema {
  const properties: Record<string, JsonSchema> = {};
  const required: string[] = [];
  for (const field of fields) {
    const name = stringField(field.name);
    if (!name) continue;
    properties[name] = fieldToJsonSchema(stringField(field.type) || "string");
    if (mode === "output" || field.required === true) required.push(name);
  }
  return {
    type: "object",
    properties,
    required,
    additionalProperties: mode === "output"
  };
}

function fieldToJsonSchema(type: string): JsonSchema {
  const normalized = type.trim().toLowerCase();
  const arrayMatch = normalized.match(/^array<(.+)>$/);
  if (arrayMatch) {
    return { type: "array", items: fieldToJsonSchema(arrayMatch[1]) };
  }
  if (normalized === "text" || normalized === "string") return { type: "string" };
  if (normalized === "number" || normalized === "float" || normalized === "double") return { type: "number" };
  if (normalized === "integer" || normalized === "int") return { type: "integer" };
  if (normalized === "boolean" || normalized === "bool") return { type: "boolean" };
  if (normalized === "object" || normalized === "record") return { type: "object", additionalProperties: true };
  if (normalized === "array") return { type: "array", items: { type: "string" } };
  return { type: "string", description: `Catalog field type: ${type}` };
}

export function sanitizeToolName(value: string): string {
  const sanitized = value.replace(/[^a-zA-Z0-9_]/g, "_").replace(/_+/g, "_").replace(/^_+|_+$/g, "");
  const withPrefix = /^[a-zA-Z_]/.test(sanitized) ? sanitized : `tool_${sanitized}`;
  const result = withPrefix.slice(0, 80);
  return result.length >= 3 ? result : "mock_tool";
}

function sanitizeMockId(value: string): string {
  const sanitized = value.replace(/[^a-zA-Z0-9_-]/g, "-").replace(/-+/g, "-").replace(/^-+|-+$/g, "");
  const result = sanitized.slice(0, 80);
  return result.length >= 3 ? result : "mock-lab-spec";
}

function stringField(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function arrayOfStrings(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function arrayOfRecords(value: unknown): Array<Record<string, unknown>> {
  return Array.isArray(value) ? value.filter(isRecord) : [];
}

function cloneRecord(value: Record<string, unknown>): Record<string, unknown> {
  return JSON.parse(JSON.stringify(value)) as Record<string, unknown>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
