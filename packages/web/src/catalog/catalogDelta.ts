import { dump as dumpYaml, load as parseYaml } from "js-yaml";
import {
  assetTypes,
  domainScopes,
  reuseStatuses,
  type AssetBinding,
  type AssetConnection,
  type AssetExposure,
  type AssetType,
  type DomainScope,
  type FieldSpec,
  type ReuseStatus,
  type WorkflowProfile
} from "../analyzer/types";
import { parseCatalogDocument } from "./catalogIndex";

export interface ProposedAddition {
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
  responsibility?: string;
  inputs?: FieldSpec[];
  outputs?: FieldSpec[];
  composition?: string[];
  risk_signals?: string[];
  runtime_mock?: Record<string, unknown> | null;
  required_before_approval?: string[];
  contract_status?: string;
  notes?: string;
  source_candidate_id?: string;
  rationale?: string;
  proposed_by?: string;
  proposed_at?: string;
}

export interface CatalogDeltaParseResult {
  proposals: ProposedAddition[];
  error: string | null;
}

export function parseCatalogDelta(yamlText: string): CatalogDeltaParseResult {
  if (!yamlText.trim()) return { proposals: [], error: null };
  try {
    const doc = parseYaml(yamlText);
    if (!isRecord(doc) || !Array.isArray(doc.proposed_additions)) return { proposals: [], error: null };
    return { proposals: doc.proposed_additions.flatMap(parseProposedAddition), error: null };
  } catch (error) {
    return { proposals: [], error: error instanceof Error ? error.message : "catalog-delta.yaml 파싱 실패" };
  }
}

export function appendCatalogDeltaProposal(existing: string, proposal: object): string {
  let parsed: unknown = {};
  if (existing.trim()) {
    try {
      parsed = parseYaml(existing);
    } catch (error) {
      throw new Error(`catalog-delta.yaml 파싱 실패: ${error instanceof Error ? error.message : "YAML 오류"}`);
    }
  }
  if (parsed === null || parsed === undefined) parsed = {};
  if (!isRecord(parsed)) throw new Error("catalog-delta.yaml 은 YAML 객체여야 합니다.");
  if (parsed.proposed_additions !== undefined && !Array.isArray(parsed.proposed_additions)) {
    throw new Error("proposed_additions 는 배열이어야 합니다.");
  }
  parsed.proposed_additions = [...(Array.isArray(parsed.proposed_additions) ? parsed.proposed_additions : []), proposal];
  return dumpYaml(parsed, { lineWidth: -1, noRefs: true });
}

function parseProposedAddition(value: unknown): ProposedAddition[] {
  if (!isRecord(value)) return [];
  const assetId = readString(value.asset_id);
  const assetType = normalizeEnum(value.asset_type, assetTypes);
  const name = readString(value.name);
  const domainScope = normalizeEnum(value.domain_scope, domainScopes);
  const businessDomains = readStringArray(value.business_domains);
  const owner = readString(value.owner);
  const reuseStatus = normalizeEnum(value.reuse_status, reuseStatuses);
  const capabilityTags = readStringArray(value.capability_tags);
  if (
    !assetId ||
    !assetType ||
    !name ||
    !domainScope ||
    businessDomains === null ||
    !owner ||
    !reuseStatus ||
    capabilityTags === null ||
    !("binding" in value) ||
    !("connection" in value) ||
    !("workflow_profile" in value) ||
    !("exposure" in value)
  ) {
    return [];
  }
  if (
    !nullableRecord(value.binding) ||
    !nullableRecord(value.connection) ||
    !nullableRecord(value.workflow_profile) ||
    !nullableRecord(value.exposure) ||
    ("runtime_mock" in value && !nullableRecord(value.runtime_mock))
  ) {
    return [];
  }
  const key = assetType === "agent" ? "agents" : assetType === "workflow" ? "workflows" : "tools";
  const catalogEntry = { ...value };
  delete catalogEntry.rationale;
  delete catalogEntry.proposed_by;
  delete catalogEntry.proposed_at;
  try {
    parseCatalogDocument({ [key]: [catalogEntry] }, key, assetType);
  } catch {
    return [];
  }
  const parsed: ProposedAddition = {
    asset_id: assetId,
    asset_type: assetType,
    name,
    domain_scope: domainScope,
    business_domains: businessDomains,
    owner,
    reuse_status: reuseStatus,
    capability_tags: capabilityTags,
    binding: value.binding as AssetBinding | null,
    connection: value.connection as AssetConnection | null,
    workflow_profile: value.workflow_profile as WorkflowProfile | null,
    exposure: value.exposure as AssetExposure | null
  };
  for (const key of [
    "responsibility",
    "contract_status",
    "notes",
    "source_candidate_id",
    "rationale",
    "proposed_by",
    "proposed_at"
  ] as const) copyString(parsed, key, value[key]);
  for (const key of ["composition", "risk_signals", "required_before_approval"] as const) {
    const strings = readStringArray(value[key]);
    if (strings !== null) parsed[key] = strings;
  }
  if (Array.isArray(value.inputs)) parsed.inputs = value.inputs as FieldSpec[];
  if (Array.isArray(value.outputs)) parsed.outputs = value.outputs as FieldSpec[];
  if ("runtime_mock" in value) parsed.runtime_mock = value.runtime_mock as Record<string, unknown> | null;
  return [parsed];
}

function normalizeEnum<T extends readonly string[]>(value: unknown, allowed: T): T[number] | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return (allowed as readonly string[]).includes(trimmed) ? (trimmed as T[number]) : null;
}

function readString(value: unknown): string | null {
  if (value instanceof Date) return value.toISOString();
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function readStringArray(value: unknown): string[] | null {
  if (!Array.isArray(value) || value.some((entry) => typeof entry !== "string" || !entry.trim())) return null;
  return value.map((entry) => entry.trim());
}

function copyString(target: ProposedAddition, key: keyof ProposedAddition, value: unknown): void {
  const next = readString(value);
  if (next) (target as unknown as Record<string, unknown>)[key] = next;
}

function nullableRecord(value: unknown): boolean {
  return value === null || isRecord(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
