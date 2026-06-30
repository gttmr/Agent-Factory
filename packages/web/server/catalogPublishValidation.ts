import { readFile, stat } from "node:fs/promises";
import { resolve, sep } from "node:path";
import { REQ_ID_PATTERN } from "./artifactRootStore";
import { discoverAppName, readExistingAgentCard } from "./runtimeA2aCard";
import { adapterKinds, agentKinds, moduleCategories, remoteContractKinds, workflowKinds } from "../src/analyzer/types";
import { parseCatalogDelta, type ProposedAddition } from "../src/catalog/catalogDelta";
import { runtimeBindings } from "../src/catalog/types";

export type CatalogCategory = (typeof moduleCategories)[number];

const componentSources = ["mcp", "remote_a2a", "stub"] as const;
const a2aReadyContractStatuses = ["a2a_ready", "approved"] as const;

export interface PublishProposal {
  readonly category?: unknown;
  readonly name?: unknown;
  readonly module_category?: unknown;
  readonly workflow_kind?: unknown;
  readonly agent_kind?: unknown;
  readonly adapter_kind?: unknown;
  readonly remote_contract_kind?: unknown;
  readonly owner_domain?: unknown;
  readonly component_source?: unknown;
  readonly runtime_binding?: unknown;
  readonly a2a_provider_req_id?: unknown;
  readonly responsibility?: unknown;
  readonly inputs?: unknown;
  readonly outputs?: unknown;
  readonly composition?: unknown;
  readonly risk_signals?: unknown;
  readonly required_before_approval?: unknown;
  readonly contract_status?: unknown;
  readonly notes?: unknown;
  readonly source_candidate_id?: unknown;
}

export interface PublishRequest {
  readonly req_id?: unknown;
  readonly proposal?: unknown;
}

export function validatePublishRequest(reqId: string, proposal: PublishProposal | null): string[] {
  const details: string[] = [];
  if (!reqId) details.push("req_id 는 필수입니다.");
  else if (!REQ_ID_PATTERN.test(reqId)) {
    details.push("req_id 형식이 올바르지 않습니다. 소문자/숫자/하이픈/언더스코어만 허용됩니다.");
  }
  if (!proposal) return [...details, "proposal 은 객체여야 합니다."];
  const category = typeof proposal.category === "string" ? proposal.category : "";
  if (!isOneOf(category, moduleCategories)) {
    details.push("category 는 agent, workflow, adapter, remote_a2a 중 하나여야 합니다.");
  }
  if (typeof proposal.module_category === "string" && proposal.module_category !== category) {
    details.push("module_category 는 category 와 같아야 합니다.");
  }
  const name = typeof proposal.name === "string" ? proposal.name.trim() : "";
  if (!name) {
    details.push("name 은 필수입니다.");
  } else if (!/^[a-z0-9_]+$/.test(name)) {
    details.push("name 은 ^[a-z0-9_]+$ 형식이어야 합니다.");
  }
  const owner = typeof proposal.owner_domain === "string" ? proposal.owner_domain.trim() : "";
  if (!owner) details.push("owner_domain 은 필수입니다.");
  if (isOneOf(category, moduleCategories)) {
    details.push(...validateSubtype(category, proposal));
    details.push(...validateRuntimeExposure(category, proposal));
  }
  details.push(...validateOptionalFieldSpecs("inputs", proposal.inputs));
  details.push(...validateOptionalFieldSpecs("outputs", proposal.outputs));
  details.push(...validateOptionalStringArray("composition", proposal.composition));
  details.push(...validateOptionalStringArray("risk_signals", proposal.risk_signals));
  details.push(...validateOptionalStringArray("required_before_approval", proposal.required_before_approval));
  details.push(...validateOptionalString("contract_status", proposal.contract_status));
  return details;
}

export async function validatePublishedProposalSource(
  repoRoot: string,
  reqId: string,
  category: CatalogCategory,
  proposal: PublishProposal
): Promise<string[]> {
  const artifactsRoot = resolve(repoRoot, "artifacts/af");
  const rootDir = resolve(artifactsRoot, reqId);
  if (!rootDir.startsWith(artifactsRoot + sep) && rootDir !== artifactsRoot) {
    return ["artifact root 경로가 허용되지 않습니다."];
  }
  const rootStat = await stat(rootDir).catch((error) => {
    if (isErrnoException(error) && error.code === "ENOENT") return null;
    throw error;
  });
  if (!rootStat?.isDirectory()) {
    return [`artifact root 를 찾을 수 없습니다: artifacts/af/${reqId}`];
  }
  const deltaPath = resolve(rootDir, "catalog-delta.yaml");
  const deltaText = await readFile(deltaPath, "utf8").catch((error) => {
    if (isErrnoException(error) && error.code === "ENOENT") return null;
    throw error;
  });
  if (deltaText === null) {
    return [`catalog-delta.yaml 을 찾을 수 없습니다: artifacts/af/${reqId}/catalog-delta.yaml`];
  }
  const parsed = parseCatalogDelta(deltaText);
  if (parsed.error) return [`catalog-delta.yaml 파싱 실패: ${parsed.error}`];
  const name = typeof proposal.name === "string" ? proposal.name.trim() : "";
  const matched = parsed.proposals.find((candidate) => candidate.module_category === category && candidate.name === name);
  if (!matched) {
    return [`catalog-delta.yaml 에 ${category}/${name} 과 일치하는 proposed_additions 항목이 없습니다.`];
  }
  return validatePublishedProposalMatchesDelta(category, proposal, matched);
}

export async function validateWorkflowA2aProvider(
  repoRoot: string,
  category: CatalogCategory,
  proposal: PublishProposal
): Promise<string[]> {
  if (category !== "workflow" || !hasRemoteA2aWorkflowMarker(proposal)) return [];
  const providerReqId = readTrimmedString(proposal.a2a_provider_req_id);
  if (!providerReqId) return [];
  const artifactsRoot = resolve(repoRoot, "artifacts/af");
  const providerRoot = resolve(artifactsRoot, providerReqId);
  if (!providerRoot.startsWith(artifactsRoot + sep) && providerRoot !== artifactsRoot) {
    return [`a2a_provider_req_id 경로가 허용되지 않습니다: ${providerReqId}`];
  }
  const providerStat = await stat(providerRoot).catch((error) => {
    if (isErrnoException(error) && error.code === "ENOENT") return null;
    throw error;
  });
  if (!providerStat?.isDirectory()) {
    return [`A2A provider artifact root 를 찾을 수 없습니다: artifacts/af/${providerReqId}`];
  }
  try {
    const stubDir = resolve(providerRoot, "runtime-stub");
    const appName = await discoverAppName(stubDir);
    await readExistingAgentCard({ stubDir, appName });
    return [];
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown runtime-a2a Agent Card failure";
    return [`runtime-a2a Agent Card validation failed for a2a_provider_req_id ${providerReqId}: ${message}`];
  }
}

function validateRuntimeExposure(category: CatalogCategory, proposal: PublishProposal): string[] {
  const details: string[] = [];
  if (proposal.component_source !== undefined) {
    details.push(...validateEnumField("component_source", proposal.component_source, componentSources));
  }
  if (proposal.runtime_binding !== undefined) {
    details.push(...validateEnumField("runtime_binding", proposal.runtime_binding, runtimeBindings));
  }
  const providerReqId = readTrimmedString(proposal.a2a_provider_req_id);
  if (category !== "workflow" && providerReqId) {
    details.push("a2a_provider_req_id 는 workflow A2A publish 에서만 허용됩니다.");
  }
  if ((category === "agent" || category === "adapter") && hasRemoteA2aWorkflowMarker(proposal)) {
    details.push("remote_a2a exposure metadata 는 workflow A2A publish 에서만 허용됩니다.");
  }
  if (category !== "workflow" || !hasRemoteA2aWorkflowMarker(proposal)) return details;
  if (proposal.component_source !== "remote_a2a") {
    details.push("component_source 는 A2A workflow publish 에서 remote_a2a 여야 합니다.");
  }
  if (proposal.runtime_binding !== "remote_a2a") {
    details.push("runtime_binding 은 A2A workflow publish 에서 remote_a2a 여야 합니다.");
  }
  if (!providerReqId) {
    details.push("a2a_provider_req_id 는 A2A workflow publish 에서 필수입니다.");
  } else if (!REQ_ID_PATTERN.test(providerReqId)) {
    details.push("a2a_provider_req_id 형식이 올바르지 않습니다. 소문자/숫자/하이픈/언더스코어만 허용됩니다.");
  }
  const contractStatus = typeof proposal.contract_status === "string" ? proposal.contract_status.trim() : "";
  if (!contractStatus) {
    details.push("contract_status 는 A2A workflow publish 에서 필수입니다.");
  } else if (!isOneOf(contractStatus, a2aReadyContractStatuses)) {
    details.push("contract_status 는 A2A-ready 상태(a2a_ready 또는 approved)여야 합니다.");
  }
  return details;
}

function hasRemoteA2aWorkflowMarker(proposal: PublishProposal): boolean {
  return proposal.component_source === "remote_a2a" || proposal.runtime_binding === "remote_a2a";
}

function validateSubtype(category: CatalogCategory, proposal: PublishProposal): string[] {
  if (category === "agent") return validateEnumField("agent_kind", proposal.agent_kind, agentKinds);
  if (category === "workflow") return validateEnumField("workflow_kind", proposal.workflow_kind, workflowKinds);
  if (category === "adapter") return validateEnumField("adapter_kind", proposal.adapter_kind, adapterKinds);
  return validateEnumField("remote_contract_kind", proposal.remote_contract_kind, remoteContractKinds);
}

function validateEnumField(field: string, value: unknown, allowed: readonly string[]): string[] {
  if (typeof value !== "string" || !value.trim()) return [`${field} 은 필수입니다.`];
  if (!allowed.includes(value)) return [`${field} 값이 허용되지 않습니다: ${value}`];
  return [];
}

function validateOptionalFieldSpecs(field: string, value: unknown): string[] {
  if (value === undefined) return [];
  if (!Array.isArray(value)) return [`${field} 는 배열이어야 합니다.`];
  return value.flatMap((item, index) => {
    if (!isRecord(item)) return [`${field}[${index}] 는 객체여야 합니다.`];
    const name = typeof item.name === "string" ? item.name.trim() : "";
    const type = typeof item.type === "string" ? item.type.trim() : "";
    const details: string[] = [];
    if (!name) details.push(`${field}[${index}].name 은 문자열이어야 합니다.`);
    if (!type) details.push(`${field}[${index}].type 은 문자열이어야 합니다.`);
    return details;
  });
}

function validateOptionalStringArray(field: string, value: unknown): string[] {
  if (value === undefined) return [];
  if (!Array.isArray(value)) return [`${field} 는 문자열 배열이어야 합니다.`];
  return value.flatMap((item, index) => (typeof item === "string" ? [] : [`${field}[${index}] 는 문자열이어야 합니다.`]));
}

function validateOptionalString(field: string, value: unknown): string[] {
  if (value === undefined) return [];
  if (typeof value !== "string" || !value.trim()) return [`${field} 는 문자열이어야 합니다.`];
  return [];
}

function validatePublishedProposalMatchesDelta(
  category: CatalogCategory,
  proposal: PublishProposal,
  reviewed: ProposedAddition
): string[] {
  if (category !== "workflow") return [];
  const stringFields = ["component_source", "runtime_binding", "a2a_provider_req_id", "contract_status"] as const;
  const stringDetails = stringFields.flatMap((field) => {
    const requestedValue = readTrimmedString(proposal[field]);
    const reviewedValue = readTrimmedString(reviewed[field]);
    if (requestedValue === reviewedValue) return [];
    return [`catalog-delta.yaml 의 ${field} 값이 publish 요청과 일치해야 합니다.`];
  });
  const arrayFields = ["risk_signals", "required_before_approval"] as const;
  const arrayDetails = arrayFields.flatMap((field) => {
    const requestedValue = readStringArray(proposal[field]);
    const reviewedValue = readStringArray(reviewed[field]);
    if (JSON.stringify(requestedValue) === JSON.stringify(reviewedValue)) return [];
    return [`catalog-delta.yaml 의 ${field} 값이 publish 요청과 일치해야 합니다.`];
  });
  return [...stringDetails, ...arrayDetails];
}

function readTrimmedString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function readStringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const strings = value.filter((item): item is string => typeof item === "string" && Boolean(item.trim())).map((item) => item.trim());
  return strings.length > 0 ? strings : undefined;
}

function isOneOf<T extends readonly string[]>(value: string, allowed: T): value is T[number] {
  return allowed.includes(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isErrnoException(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error;
}
