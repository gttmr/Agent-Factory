import { buildContract, mintNextContractId } from "./a2aContracts";
import type { AnalysisResult, AssetCandidate, GraphNode } from "./types";

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
  assetId: string;
  contractId: string;
  nodeId: string;
}

export function importLocalA2AProvider(analysis: AnalysisResult, provider: LocalA2AProviderImport): LocalA2AProviderImportResult {
  const contractId = mintNextContractId(new Set(analysis.a2aContracts.map((contract) => contract.contract_id)));
  const assetId = uniqueId(`agent.${slug(provider.appName || provider.card.name || provider.providerReqId)}`, new Set(analysis.assetCandidates.map((candidate) => candidate.asset_id)));
  const nodeId = uniqueId(`node-${slug(provider.appName || provider.card.name || provider.providerReqId)}`, new Set(analysis.graph.nodes.map((node) => node.id)));
  const candidate = buildCandidate(analysis, provider, assetId, contractId);
  const baseContract = buildContract(candidate, contractId);
  const contract = {
    ...baseContract,
    agent_card: {
      discovery_method: "local_provider_import",
      agent_card_url: provider.agentCardUrl,
      version: provider.card.version || "needs_info",
      notes: provider.card.description || "Local A2A provider"
    },
    supported_interfaces: [{
      url: provider.rpcUrl,
      protocol_binding: provider.card.preferredTransport || "JSONRPC",
      protocol_version: provider.card.protocolVersion || "1.0",
      tenant_policy: "local_only"
    }],
    input_modes: provider.card.defaultInputModes?.length ? provider.card.defaultInputModes : baseContract.input_modes,
    output_modes: provider.card.defaultOutputModes?.length ? provider.card.defaultOutputModes : baseContract.output_modes,
    skills: (provider.card.skills ?? []).map((skill) => skill.id || skill.name || "needs_info"),
    extensions: (provider.card.capabilities?.extensions ?? []).map((extension) => extension.uri || "needs_info"),
    streaming: { ...baseContract.streaming, supported: provider.card.capabilities?.streaming === true },
    adk_host_mapping: provider.appName || provider.providerReqId
  };
  const node: GraphNode = { id: nodeId, label: candidate.name, node_kind: "agent", agent_ref: assetId, available_tools: [] };
  return {
    analysis: {
      ...analysis,
      assetCandidates: [...analysis.assetCandidates, candidate],
      a2aContracts: [...analysis.a2aContracts, contract],
      graph: { ...analysis.graph, nodes: [...analysis.graph.nodes, node] }
    },
    assetId,
    contractId,
    nodeId
  };
}

function buildCandidate(analysis: AnalysisResult, provider: LocalA2AProviderImport, assetId: string, contractId: string): AssetCandidate {
  const domain = analysis.normalizedRequirement.domain;
  return {
    asset_id: assetId,
    source_requirement_id: analysis.normalizedRequirement.id,
    catalog_entry_id: null,
    name: provider.card.name || provider.appName,
    asset_type: "agent",
    domain_scope: domain === "공통" ? "domain_neutral" : "domain_specific",
    business_domains: domain === "공통" ? [] : [domain],
    owner: analysis.normalizedRequirement.requester.team || "unresolved",
    reuse_status: "project_only",
    capability_tags: (provider.card.skills ?? []).flatMap((skill) => skill.tags ?? []),
    binding: { kind: "a2a", contract_ref: contractId },
    connection: { transport: "http" },
    workflow_profile: null,
    exposure: { protocol: "a2a", contract_ref: contractId },
    confidence: 1,
    rationale: provider.card.description || `Imported local A2A provider ${provider.providerReqId}`,
    inputs: [],
    outputs: [],
    risk_level: "medium",
    risk_signals: [],
    status: "needs_info",
    missing_information: [],
    developer_todos: []
  };
}

function slug(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "local-provider";
}

function uniqueId(base: string, used: ReadonlySet<string>): string {
  if (!used.has(base)) return base;
  let index = 2;
  while (used.has(`${base}-${index}`)) index += 1;
  return `${base}-${index}`;
}
