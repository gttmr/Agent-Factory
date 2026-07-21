import {
  assetTypes,
  bindingKinds,
  domainScopes,
  reuseStatuses,
  transportKinds,
  workflowCoordinations,
  workflowRepresentations
} from "../analyzer/types";
import type {
  AssetBinding,
  AssetConnection,
  AssetExposure,
  AssetType,
  DomainScope,
  ReuseStatus,
  WorkflowProfile
} from "../analyzer/types";
import { dedupeKeepLatestPublished } from "./catalogVersioning";

export type CatalogCategory = AssetType;
export type TargetCatalogCategory = AssetType;

export interface CatalogIO {
  name: string;
  type: string;
  required?: boolean;
}

export interface CatalogEntryRaw {
  asset_id: string;
  asset_type: AssetType;
  name: string;
  domain_scope: DomainScope;
  business_domains: string[];
  owner: string;
  reuse_status: ReuseStatus;
  capability_tags: string[];
  binding: AssetBinding | null;
  connection: AssetConnection | null;
  workflow_profile: WorkflowProfile | null;
  exposure: AssetExposure | null;
  version?: number;
  status?: string;
  contract_status?: string;
  responsibility?: string;
  inputs?: CatalogIO[];
  outputs?: CatalogIO[];
  risk_signals?: string[];
  composition?: string[];
  notes?: string;
  provenance?: string;
  published_at?: string;
  published_from?: string;
  source_candidate_id?: string;
  runtime_mock?: Record<string, unknown> | null;
  required_before_approval?: string[];
}

export type CatalogHubEntry = CatalogEntryRaw;

export interface CatalogIndex {
  agents: CatalogHubEntry[];
  workflows: CatalogHubEntry[];
  tools: CatalogHubEntry[];
}

const bucketSpecs = [
  ["agents", "agent"],
  ["workflows", "workflow"],
  ["tools", "tool"]
] as const;
const catalogEntryKeys = new Set([
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
  "composition",
  "notes",
  "provenance",
  "published_at",
  "published_from",
  "source_candidate_id",
  "runtime_mock",
  "required_before_approval"
]);
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

export function parseCatalogIndexPayload(value: unknown): CatalogIndex {
  if (!isRecord(value)) throw new Error("catalog 응답은 객체여야 합니다.");
  const expectedKeys = bucketSpecs.map(([key]) => key).sort();
  const actualKeys = Object.keys(value).sort();
  if (!sameStrings(actualKeys, expectedKeys)) {
    throw new Error("catalog 응답은 agents, workflows, tools 세 bucket만 포함해야 합니다.");
  }

  const index: CatalogIndex = { agents: [], workflows: [], tools: [] };
  const assetIds = new Set<string>();
  for (const [key, assetType] of bucketSpecs) {
    const entries = parseCatalogDocument(value[key], key, assetType);
    for (const entry of entries) {
      if (assetIds.has(entry.asset_id)) throw new Error(`중복 asset_id: ${entry.asset_id}`);
      assetIds.add(entry.asset_id);
    }
    index[key] = entries;
  }
  return index;
}

export function parseCatalogDocument(value: unknown, key: keyof CatalogIndex, assetType: AssetType): CatalogHubEntry[] {
  if (!isRecord(value) || Object.keys(value).length !== 1 || !Array.isArray(value[key])) {
    throw new Error(`${key}.yaml 은 ${key} 배열 하나만 포함해야 합니다.`);
  }
  const parsed = value[key].map((entry, index) => parseCatalogEntry(entry, assetType, `${key}[${index}]`));
  return dedupeKeepLatestPublished(parsed);
}

function parseCatalogEntry(value: unknown, assetType: AssetType, path: string): CatalogHubEntry {
  if (!isRecord(value)) throw new Error(`${path} 는 객체여야 합니다.`);
  for (const key of retiredKeys) {
    if (key in value) throw new Error(`${path}.${key} retired key는 허용되지 않습니다.`);
  }
  for (const key of Object.keys(value)) {
    if (!catalogEntryKeys.has(key)) throw new Error(`${path}.${key} 지원하지 않는 Catalog field입니다.`);
  }
  const assetId = requiredString(value.asset_id, `${path}.asset_id`);
  if (!isOneOf(value.asset_type, assetTypes) || value.asset_type !== assetType) {
    throw new Error(`${path}.asset_type 은 ${assetType}이어야 합니다.`);
  }
  const domainScope = requiredEnum(value.domain_scope, domainScopes, `${path}.domain_scope`);
  const reuseStatus = requiredEnum(value.reuse_status, reuseStatuses, `${path}.reuse_status`);
  const binding = parseBinding(value.binding, assetType, path);
  const connection = parseConnection(value.connection, binding, path);
  const workflowProfile = parseWorkflowProfile(value.workflow_profile, assetType, path);
  const exposure = parseExposure(value.exposure, assetType, path);

  const entry: CatalogHubEntry = {
    ...(value as unknown as CatalogEntryRaw),
    asset_id: assetId,
    asset_type: assetType,
    name: requiredString(value.name, `${path}.name`),
    domain_scope: domainScope,
    business_domains: requiredStringArray(value.business_domains, `${path}.business_domains`),
    owner: requiredString(value.owner, `${path}.owner`),
    reuse_status: reuseStatus,
    capability_tags: requiredStringArray(value.capability_tags, `${path}.capability_tags`),
    binding,
    connection,
    workflow_profile: workflowProfile,
    exposure
  };
  return entry;
}

function parseBinding(value: unknown, assetType: AssetType, path: string): AssetBinding | null {
  if (value === null) {
    if (assetType === "tool") throw new Error(`${path}.binding Tool에는 binding 객체가 필요합니다.`);
    return null;
  }
  if (!isRecord(value) || !isOneOf(value.kind, bindingKinds)) throw new Error(`${path}.binding 이 유효하지 않습니다.`);
  if (assetType === "workflow") throw new Error(`${path}.binding Workflow binding은 null이어야 합니다.`);
  if (assetType === "agent" && value.kind !== "a2a") throw new Error(`${path}.binding Agent는 A2A binding만 사용할 수 있습니다.`);
  if (assetType === "tool" && value.kind === "a2a") throw new Error(`${path}.binding Tool은 A2A binding을 사용할 수 없습니다.`);
  if (value.kind === "mcp") {
    requireExactKeys(value, ["kind", "server_ref", "tool_name"], `${path}.binding`);
    requiredString(value.server_ref, `${path}.binding.server_ref`);
    requiredString(value.tool_name, `${path}.binding.tool_name`);
  } else if (value.kind === "a2a") {
    requireExactKeys(value, ["contract_ref", "kind"], `${path}.binding`);
    requiredString(value.contract_ref, `${path}.binding.contract_ref`);
  } else {
    requireExactKeys(value, ["kind"], `${path}.binding`);
  }
  return value as unknown as AssetBinding;
}

function parseConnection(value: unknown, binding: AssetBinding | null, path: string): AssetConnection | null {
  if (binding === null) {
    if (value !== null) throw new Error(`${path}.connection 은 binding이 null일 때 null이어야 합니다.`);
    return null;
  }
  if (!isRecord(value) || !isOneOf(value.transport, transportKinds)) {
    throw new Error(`${path}.connection.transport 가 유효하지 않습니다.`);
  }
  requireExactKeys(value, ["transport"], `${path}.connection`);
  return value as unknown as AssetConnection;
}

function parseWorkflowProfile(value: unknown, assetType: AssetType, path: string): WorkflowProfile | null {
  if (assetType !== "workflow") {
    if (value !== null) throw new Error(`${path}.workflow_profile 은 Workflow가 아니면 null이어야 합니다.`);
    return null;
  }
  if (
    !isRecord(value) ||
    !isOneOf(value.representation, workflowRepresentations) ||
    !isOneOf(value.coordination, workflowCoordinations)
  ) {
    throw new Error(`${path}.workflow_profile 이 유효하지 않습니다.`);
  }
  requireExactKeys(value, ["coordination", "representation", "template_ref"], `${path}.workflow_profile`);
  requiredNullableString(value.template_ref, `${path}.workflow_profile.template_ref`);
  return value as unknown as WorkflowProfile;
}

function parseExposure(value: unknown, assetType: AssetType, path: string): AssetExposure | null {
  if (value === null) return null;
  if (assetType !== "agent" || !isRecord(value) || value.protocol !== "a2a") {
    throw new Error(`${path}.exposure 는 Agent의 A2A exposure 또는 null이어야 합니다.`);
  }
  requireExactKeys(value, ["contract_ref", "protocol"], `${path}.exposure`);
  requiredString(value.contract_ref, `${path}.exposure.contract_ref`);
  return value as unknown as AssetExposure;
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

function requiredNullableString(value: unknown, path: string): string | null {
  if (value === null) return null;
  return requiredString(value, path);
}

function requiredEnum<T extends readonly string[]>(value: unknown, allowed: T, path: string): T[number] {
  if (!isOneOf(value, allowed)) throw new Error(`${path} 값이 유효하지 않습니다.`);
  return value;
}

function isOneOf<T extends readonly string[]>(value: unknown, allowed: T): value is T[number] {
  return typeof value === "string" && (allowed as readonly string[]).includes(value);
}

function requireExactKeys(value: Record<string, unknown>, expected: readonly string[], path: string): void {
  if (!sameStrings(Object.keys(value).sort(), [...expected].sort())) {
    throw new Error(`${path} 필드 구성이 유효하지 않습니다.`);
  }
}

function sameStrings(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
