import { readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { load as parseYaml } from "js-yaml";
import { dedupeKeepLatestPublished } from "../src/catalog/catalogVersioning";
import { catalogIndexToScaffoldCatalog } from "../src/catalog/scaffoldCatalog";
import type { CatalogCategory, CatalogHubEntry, CatalogIO, CatalogIndex } from "../src/catalog/catalogIndex";
import type { CatalogEntry } from "../src/catalog/types";

interface CatalogFileSpec {
  readonly relative: string;
  readonly yamlKey: string;
  readonly category: CatalogCategory;
}

type CatalogStringField =
  | "agent_kind"
  | "workflow_kind"
  | "adapter_kind"
  | "remote_contract_kind"
  | "owner_domain"
  | "status"
  | "component_source"
  | "runtime_binding"
  | "access_protocol"
  | "mcp_server"
  | "mcp_tool_name"
  | "mcp_schema_ref"
  | "mcp_auth_mode"
  | "contract_status"
  | "responsibility"
  | "scaffold_output"
  | "notes"
  | "provenance"
  | "published_at"
  | "published_from"
  | "source_candidate_id"
  | "subtype";

const CATALOG_FILES: readonly CatalogFileSpec[] = [
  { relative: "agents.yaml", yamlKey: "agents", category: "agent" },
  { relative: "workflows.yaml", yamlKey: "workflows", category: "workflow" },
  { relative: "adapters.yaml", yamlKey: "adapters", category: "adapter" },
  { relative: "remote-a2a-contracts.yaml", yamlKey: "remote_a2a_contracts", category: "remote_a2a" }
] as const;

export async function loadServerScaffoldCatalog(repoRoot: string): Promise<CatalogEntry[]> {
  const catalogDir = resolve(repoRoot, "catalog");
  const index: CatalogIndex = {
    agents: [],
    workflows: [],
    adapters: [],
    remoteA2A: [],
    domainOwners: null,
    riskGates: null
  };

  for (const spec of CATALOG_FILES) {
    const rows = await readCatalogRows(join(catalogDir, spec.relative), spec.yamlKey);
    for (const row of dedupeKeepLatestPublished(rows)) {
      const entry = catalogEntryFromRow(spec.category, row);
      if (!entry) continue;
      appendCatalogEntry(index, entry);
    }
  }

  return catalogIndexToScaffoldCatalog(index);
}

async function readCatalogRows(path: string, key: string): Promise<readonly Record<string, unknown>[]> {
  const text = await readFile(path, "utf8").catch((error) => {
    if (readErrorCode(error) === "ENOENT") return "";
    throw error;
  });
  if (!text.trim()) return [];
  const parsed: unknown = parseYaml(text);
  if (!isRecord(parsed)) return [];
  const rows = parsed[key];
  return Array.isArray(rows) ? rows.filter(isRecord) : [];
}

function catalogEntryFromRow(category: CatalogCategory, row: Record<string, unknown>): CatalogHubEntry | null {
  const name = readString(row.name);
  if (!name) return null;
  const id = readString(row.id) ?? `${category}:${name}`;
  const entry: CatalogHubEntry = { id, category, name };
  copyCatalogStringFields(entry, row);

  const version = readNumber(row.version);
  if (version !== undefined) entry.version = version;

  const inputs = readCatalogIoArray(row.inputs);
  if (inputs !== undefined) entry.inputs = inputs;

  const outputs = readCatalogIoArray(row.outputs);
  if (outputs !== undefined) entry.outputs = outputs;

  const riskSignals = readStringArray(row.risk_signals);
  if (riskSignals !== undefined) entry.risk_signals = riskSignals;

  const composition = readStringArray(row.composition);
  if (composition !== undefined) entry.composition = composition;

  const requiredBeforeApproval = readStringArray(row.required_before_approval);
  if (requiredBeforeApproval !== undefined) entry.required_before_approval = requiredBeforeApproval;

  const runtimeMock = readRuntimeMock(row.runtime_mock);
  if (runtimeMock !== undefined) entry.runtime_mock = runtimeMock;

  return entry;
}

function appendCatalogEntry(index: CatalogIndex, entry: CatalogHubEntry): void {
  if (entry.category === "agent") index.agents.push(entry);
  else if (entry.category === "workflow") index.workflows.push(entry);
  else if (entry.category === "adapter") index.adapters.push(entry);
  else index.remoteA2A.push(entry);
}

function copyCatalogStringFields(entry: CatalogHubEntry, row: Record<string, unknown>): void {
  copyStringField(entry, row, "agent_kind");
  copyStringField(entry, row, "workflow_kind");
  copyStringField(entry, row, "adapter_kind");
  copyStringField(entry, row, "remote_contract_kind");
  copyStringField(entry, row, "owner_domain");
  copyStringField(entry, row, "status");
  copyStringField(entry, row, "component_source");
  copyStringField(entry, row, "runtime_binding");
  copyStringField(entry, row, "access_protocol");
  copyStringField(entry, row, "mcp_server");
  copyStringField(entry, row, "mcp_tool_name");
  copyStringField(entry, row, "mcp_schema_ref");
  copyStringField(entry, row, "mcp_auth_mode");
  copyStringField(entry, row, "contract_status");
  copyStringField(entry, row, "responsibility");
  copyStringField(entry, row, "scaffold_output");
  copyStringField(entry, row, "notes");
  copyStringField(entry, row, "provenance");
  copyStringField(entry, row, "published_at");
  copyStringField(entry, row, "published_from");
  copyStringField(entry, row, "source_candidate_id");
  copyStringField(entry, row, "subtype");
}

function copyStringField(entry: CatalogHubEntry, row: Record<string, unknown>, key: CatalogStringField): void {
  const value = readString(row[key]);
  if (value !== null) entry[key] = value;
}

function readString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function readNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function readBoolean(value: unknown): boolean | undefined {
  return typeof value === "boolean" ? value : undefined;
}

function readErrorCode(error: unknown): string | null {
  if (!isRecord(error)) return null;
  return readString(error.code);
}

function readStringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const strings: string[] = [];
  for (const item of value) {
    const stringValue = readString(item);
    if (stringValue) strings.push(stringValue);
  }
  return strings;
}

function readCatalogIoArray(value: unknown): CatalogIO[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const fields: CatalogIO[] = [];
  for (const item of value) {
    if (!isRecord(item)) continue;
    const name = readString(item.name);
    const type = readString(item.type);
    if (!name || !type) continue;
    const field: CatalogIO = { name, type };
    const required = readBoolean(item.required);
    if (required !== undefined) field.required = required;
    fields.push(field);
  }
  return fields;
}

function readRuntimeMock(value: unknown): Record<string, unknown> | null | undefined {
  if (value === null) return null;
  return isRecord(value) ? value : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
