import { dump as dumpYaml, load as parseYaml } from "js-yaml";
import {
  adapterKinds,
  agentKinds,
  moduleCategories,
  remoteContractKinds,
  workflowKinds,
  type AdapterKind,
  type AgentKind,
  type ComponentSource,
  type FieldSpec,
  type ModuleCategory,
  type RemoteContractKind,
  type WorkflowKind
} from "../analyzer/types";
import { runtimeBindings, type RuntimeBinding } from "./types";

const componentSources = ["mcp", "remote_a2a", "stub"] as const;

export interface ProposedAddition {
  module_category: ModuleCategory;
  name: string;
  agent_kind?: AgentKind;
  workflow_kind?: WorkflowKind;
  adapter_kind?: AdapterKind;
  remote_contract_kind?: RemoteContractKind;
  owner_domain?: string;
  component_source?: ComponentSource;
  runtime_binding?: RuntimeBinding;
  a2a_provider_req_id?: string;
  responsibility?: string;
  inputs?: FieldSpec[];
  outputs?: FieldSpec[];
  composition?: string[];
  risk_signals?: string[];
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
    return { proposals: doc.proposed_additions.flatMap((entry) => parseProposedAddition(entry)), error: null };
  } catch (error) {
    return {
      proposals: [],
      error: error instanceof Error ? error.message : "catalog-delta.yaml 파싱 실패"
    };
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
  if (!isRecord(parsed)) {
    throw new Error("catalog-delta.yaml 은 YAML 객체여야 합니다.");
  }
  const additions = parsed.proposed_additions;
  if (additions !== undefined && !Array.isArray(additions)) {
    throw new Error("proposed_additions 는 배열이어야 합니다.");
  }
  parsed.proposed_additions = [...(Array.isArray(additions) ? additions : []), proposal];
  return dumpYaml(parsed, { lineWidth: -1, noRefs: true });
}

function parseProposedAddition(entry: unknown): ProposedAddition[] {
  if (!isRecord(entry)) return [];
  const category = normalizeCategory(entry.module_category ?? entry.category);
  const name = readString(entry.name);
  if (!category || !name) return [];
  const parsed: ProposedAddition = {
    module_category: category,
    name
  };
  copyString(parsed, "owner_domain", entry.owner_domain);
  copyEnum(parsed, "component_source", entry.component_source, componentSources);
  copyEnum(parsed, "runtime_binding", entry.runtime_binding, runtimeBindings);
  copyString(parsed, "a2a_provider_req_id", entry.a2a_provider_req_id);
  copyString(parsed, "responsibility", entry.responsibility);
  copyString(parsed, "notes", entry.notes);
  copyString(parsed, "source_candidate_id", entry.source_candidate_id);
  copyString(parsed, "rationale", entry.rationale);
  copyString(parsed, "proposed_by", entry.proposed_by);
  copyString(parsed, "proposed_at", entry.proposed_at);
  copyArray(parsed, "inputs", entry.inputs);
  copyArray(parsed, "outputs", entry.outputs);
  copyStringArray(parsed, "composition", entry.composition);
  copyStringArray(parsed, "risk_signals", entry.risk_signals);
  copyStringArray(parsed, "required_before_approval", entry.required_before_approval);
  copyString(parsed, "contract_status", entry.contract_status);

  const agentKind = normalizeEnum(entry.agent_kind, agentKinds);
  const workflowKind = normalizeEnum(entry.workflow_kind, workflowKinds);
  const adapterKind = normalizeEnum(entry.adapter_kind, adapterKinds);
  const remoteContractKind = normalizeEnum(entry.remote_contract_kind, remoteContractKinds);
  if (agentKind) parsed.agent_kind = agentKind;
  if (workflowKind) parsed.workflow_kind = workflowKind;
  if (adapterKind) parsed.adapter_kind = adapterKind;
  if (remoteContractKind) parsed.remote_contract_kind = remoteContractKind;
  return [parsed];
}

function normalizeCategory(value: unknown): ModuleCategory | null {
  return normalizeEnum(value, moduleCategories);
}

function normalizeEnum<T extends readonly string[]>(value: unknown, allowed: T): T[number] | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return (allowed as readonly string[]).includes(trimmed) ? trimmed : null;
}

function readString(value: unknown): string | null {
  if (value instanceof Date) return value.toISOString();
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function copyString(target: Partial<ProposedAddition>, key: keyof ProposedAddition, value: unknown): void {
  const next = readString(value);
  if (next) (target as Record<string, unknown>)[key] = next;
}

function copyEnum<T extends readonly string[]>(
  target: Partial<ProposedAddition>,
  key: keyof ProposedAddition,
  value: unknown,
  allowed: T
): void {
  const next = normalizeEnum(value, allowed);
  if (next) (target as Record<string, unknown>)[key] = next;
}

function copyArray(target: Partial<ProposedAddition>, key: keyof ProposedAddition, value: unknown): void {
  if (Array.isArray(value)) (target as Record<string, unknown>)[key] = value;
}

function copyStringArray(target: Partial<ProposedAddition>, key: keyof ProposedAddition, value: unknown): void {
  if (Array.isArray(value)) {
    const strings = value.filter((item): item is string => typeof item === "string");
    if (strings.length > 0) (target as Record<string, unknown>)[key] = strings;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
