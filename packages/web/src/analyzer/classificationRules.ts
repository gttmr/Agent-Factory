import type { AssetCandidate, AssetType, DomainScope, ReuseStatus, RuntimeContractKind } from "./types";

export const assetTypeLabels: Record<AssetType, string> = {
  agent: "Agent",
  workflow: "Workflow",
  tool: "Tool"
};

export const domainScopeLabels: Record<DomainScope, string> = {
  domain_specific: "Domain-specific",
  cross_domain: "Cross-domain",
  domain_neutral: "Domain-neutral"
};

export const reuseStatusLabels: Record<ReuseStatus, string> = {
  not_reviewed: "미검토",
  reuse_existing: "기존 자산 재사용",
  publish_candidate: "Catalog 등록 후보",
  project_only: "프로젝트 전용",
  excluded: "재사용 제외"
};

export const runtimeContractKindLabels: Record<RuntimeContractKind, string> = {
  mcp_connection: "MCP 연결",
  external_connection: "외부 연결",
  context_manager: "Context Manager",
  callback_broker: "Callback Broker",
  adk_callback: "ADK Callback",
  async_resume: "비동기 재개"
};

export function getCandidateDescriptor(candidate: AssetCandidate): string {
  const binding = candidate.binding?.kind === "mcp" ? "MCP" : candidate.binding?.kind === "a2a" ? "A2A" : candidate.binding?.kind ?? "no binding";
  return `${assetTypeLabels[candidate.asset_type]} · ${binding}`;
}
