import { mintNextContractId } from "./a2aNormalize";
import { buildRemoteA2ANode, withLocalA2AGraph } from "./localA2aGraph";
import type { A2AContract, AnalysisResult, ModuleCandidate } from "./types";

export interface LocalA2AAgentCardExtension {
  readonly uri?: string;
  readonly required?: boolean;
  readonly description?: string;
}

export interface LocalA2AAgentCard {
  name: string;
  description?: string;
  url?: string;
  version?: string;
  protocolVersion?: string;
  preferredTransport?: string;
  defaultInputModes?: string[];
  defaultOutputModes?: string[];
  capabilities?: { streaming?: boolean; extensions?: LocalA2AAgentCardExtension[] };
  skills?: Array<{ id?: string; name?: string; description?: string; tags?: string[] }>;
}

export interface LocalA2AProviderImport {
  providerReqId: string;
  appName: string;
  agentCardUrl: string;
  rpcUrl: string;
  card: LocalA2AAgentCard;
}

export interface LocalA2AProviderImportResult {
  analysis: AnalysisResult;
  candidateId: string;
  contractId: string;
  nodeId: string;
}

export function importLocalA2AProvider(
  analysis: AnalysisResult,
  provider: LocalA2AProviderImport
): LocalA2AProviderImportResult {
  const contractId = mintNextContractId(usedContractIds(analysis));
  const baseId = `mod-${slug(provider.appName || provider.card.name || provider.providerReqId)}`;
  const candidateId = uniqueId(baseId, new Set(analysis.moduleCandidates.map((candidate) => candidate.id)));
  const nodeId = uniqueId(`node-${slug(provider.appName || provider.card.name || provider.providerReqId)}`, new Set(analysis.processFlow.nodes.map((node) => node.id)));
  const candidate = buildCandidate(analysis, provider, candidateId, contractId);
  const contract = buildContract(provider, candidateId, contractId);
  const node = buildRemoteA2ANode(provider.card.name || provider.appName, candidateId, nodeId);
  return {
    analysis: {
      ...analysis,
      moduleCandidates: [...analysis.moduleCandidates, candidate],
      a2aContracts: [...(analysis.a2aContracts ?? []), contract],
      processFlow: withLocalA2AGraph(analysis.processFlow, node, contractId)
    },
    candidateId,
    contractId,
    nodeId
  };
}

function buildCandidate(
  analysis: AnalysisResult,
  provider: LocalA2AProviderImport,
  candidateId: string,
  contractId: string
): ModuleCandidate {
  const title = provider.card.name || provider.appName;
  return {
    id: candidateId,
    source_requirement_id: analysis.normalizedRequirement.id,
    name: title,
    module_category: "remote_a2a",
    agent_kind: null,
    workflow_kind: null,
    adapter_kind: null,
    remote_contract_kind: "a2a",
    legacy_recommended_type: "remote_a2a_contract",
    confidence: 0.95,
    rationale: `Local ADK Agent Card imported from ${provider.providerReqId}.`,
    inputs: [{ name: "message", type: "string", required: true }],
    outputs: [{ name: "response", type: "string", required: true }],
    reuse_candidate: true,
    risk_level: "high",
    risk_signals: ["audit_required"],
    status: "needs_info",
    missing_information: ["review local provider ownership, lifecycle, fallback, audit, and data policy before approval"],
    owner: `local artifact:${provider.providerReqId}`,
    agent_card: provider.agentCardUrl,
    auth: "local_dev_none",
    task_lifecycle: "ADK A2A task lifecycle exposed by adk api_server --a2a",
    timeout: "review_required",
    retry: "review_required",
    fallback: "manual_review",
    audit: "review_required",
    data_policy: "local_dev_only",
    a2a_contract_id: contractId
  };
}

function buildContract(provider: LocalA2AProviderImport, candidateId: string, contractId: string): A2AContract {
  const card = provider.card;
  const inputModes = nonEmptyArray(card.defaultInputModes, ["text/plain"]);
  const outputModes = nonEmptyArray(card.defaultOutputModes, ["text/plain"]);
  const version = nonEmpty(card.version, "0.1.0");
  const protocolVersion = nonEmpty(card.protocolVersion, "0.3.0");
  return {
    contract_id: contractId,
    remote_module_id: candidateId,
    target_agent_name: card.name || provider.appName,
    target_agent_purpose: nonEmpty(card.description, "Local ADK A2A provider imported from an Agent Card."),
    contract_status: "draft",
    agent_card: {
      discovery_method: "local_adk_api_server",
      agent_card_url: provider.agentCardUrl,
      version,
      notes: `Imported from artifact root ${provider.providerReqId}.`
    },
    supported_interfaces: [
      {
        url: provider.rpcUrl,
        protocol_binding: nonEmpty(card.preferredTransport, "JSONRPC"),
        protocol_version: protocolVersion,
        tenant_policy: "local_dev_single_tenant"
      }
    ],
    input_modes: inputModes,
    output_modes: outputModes,
    security_schemes: [{ name: "local_dev_none", scheme: "none" }],
    security_requirements: [{ scheme_name: "local_dev_none", scopes: ["local_dev"] }],
    skills: (card.skills ?? []).map((skill) => skill.name || skill.id || "local_provider_skill"),
    extensions: extensionSummaries(card.capabilities?.extensions),
    message_contract: { allowed_part_fields: ["text"], allowed_roles: ["ROLE_USER", "ROLE_AGENT"] },
    task_lifecycle: {
      states: [
        "TASK_STATE_SUBMITTED",
        "TASK_STATE_WORKING",
        "TASK_STATE_INPUT_REQUIRED",
        "TASK_STATE_AUTH_REQUIRED",
        "TASK_STATE_COMPLETED",
        "TASK_STATE_FAILED",
        "TASK_STATE_CANCELED"
      ],
      allowed_transitions: [
        { from: "TASK_STATE_SUBMITTED", to: "TASK_STATE_WORKING" },
        { from: "TASK_STATE_WORKING", to: "TASK_STATE_INPUT_REQUIRED" },
        { from: "TASK_STATE_INPUT_REQUIRED", to: "TASK_STATE_WORKING" },
        { from: "TASK_STATE_WORKING", to: "TASK_STATE_AUTH_REQUIRED" },
        { from: "TASK_STATE_AUTH_REQUIRED", to: "TASK_STATE_WORKING" },
        { from: "TASK_STATE_WORKING", to: "TASK_STATE_COMPLETED" },
        { from: "TASK_STATE_WORKING", to: "TASK_STATE_FAILED" },
        { from: "TASK_STATE_WORKING", to: "TASK_STATE_CANCELED" }
      ],
      terminal_states: ["TASK_STATE_COMPLETED", "TASK_STATE_FAILED", "TASK_STATE_CANCELED"],
      input_required_followup: "manual_review",
      auth_required_followup: "not_applicable_for_local_dev_none"
    },
    streaming: { supported: card.capabilities?.streaming === true, wrappers: [], non_streaming_fallback: "SendMessage" },
    operations: ["SendMessage", "GetTask", "CancelTask"],
    http_paths: ["/message:send", "/tasks/{id}", "/tasks/{id}:cancel"],
    artifact_contract: { mutation_rules: "provider-owned artifacts only", chunking_policy: "text/plain response" },
    adk_host_mapping: `RemoteA2aAgent endpoint ${provider.rpcUrl}`,
    adk_runtime_policy: {
      timeout_seconds: null,
      auth: { mode: "none", env_var: null, metadata_key: null },
      retry_handoff: { max_attempts: null, backoff_seconds: null, retry_on: [] },
      fallback_handoff: { mode: "manual_review", message: "Route failures to the local Workbench reviewer." }
    },
    timeout: "review_required",
    retry: "review_required",
    fallback: "manual_review",
    cancellation: "CancelTask",
    unsupported_operation: "manual_review",
    get_task_fallback: "manual_review",
    push_notification_policy: null,
    auth: "local_dev_none",
    token_handling: "not_applicable_for_local_dev_none",
    audit: "review_required",
    data_policy: "local_dev_only"
  };
}

function usedContractIds(analysis: AnalysisResult): Set<string> {
  const used = new Set<string>();
  for (const contract of analysis.a2aContracts ?? []) used.add(contract.contract_id);
  for (const candidate of analysis.moduleCandidates) {
    if (candidate.a2a_contract_id) used.add(candidate.a2a_contract_id);
  }
  return used;
}

function uniqueId(base: string, used: Set<string>): string {
  if (!used.has(base)) return base;
  let index = 2;
  while (used.has(`${base}-${index}`)) index += 1;
  return `${base}-${index}`;
}

function slug(value: string): string {
  const normalized = value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  return normalized || "local-a2a-provider";
}

function nonEmpty(value: string | undefined, fallback: string): string {
  return value && value.trim() ? value : fallback;
}

function nonEmptyArray(value: string[] | undefined, fallback: string[]): string[] {
  const filtered = value?.filter((item) => item.trim()) ?? [];
  return filtered.length > 0 ? filtered : fallback;
}

function extensionSummaries(extensions: LocalA2AAgentCardExtension[] | undefined): string[] {
  const summaries: string[] = [];
  for (const extension of extensions ?? []) {
    const uri = nonEmpty(extension.uri, "");
    if (!uri) continue;
    const required = extension.required === true ? "required" : "optional";
    const description = nonEmpty(extension.description, "");
    summaries.push(description ? `${uri} (${required}): ${description}` : `${uri} (${required})`);
  }
  return summaries;
}
