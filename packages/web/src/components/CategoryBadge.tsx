import {
  accessProtocolLabels,
  adapterKindLabels,
  agentKindLabels,
  moduleCategoryLabels,
  remoteContractKindLabels,
  runtimeContractKindLabels,
  workflowKindLabels
} from "../analyzer/classificationRules";
import type { AccessProtocol, ModuleCandidate, ModuleCategory } from "../analyzer/types";

export const categoryGlyph: Record<ModuleCategory, string> = {
  agent: "◆",
  workflow: "▶",
  adapter: "⚙",
  remote_a2a: "⇨"
};

export const subtypeGlyph: Record<string, string> = {
  orchestration: "⋈",
  graph: "⬢",
  dynamic: "λ",
  retrieval: "🔎",
  rule_registry: "§",
  legacy_api: "API",
  data_query: "?",
  template: "T",
  computation: "Σ",
  external_service: "↗",
  mcp_legacy_adapter: "MCP",
  eai_legacy_adapter: "EAI",
  context_manager: "CTX",
  callback_broker: "CB",
  adk_callback: "ADK",
  async_resume: "↻",
  specialist: "S",
  shared: "★",
  a2a: "A2A",
  unknown: "·"
};

export const protocolGlyph: Record<AccessProtocol, string> = {
  local: "·",
  http_rest: "≡",
  mcp: "M",
  grpc: "g",
  message_queue: "Q",
  unknown: "?"
};

export function ProtocolBadge({ value }: { value: AccessProtocol }) {
  return (
    <span className={`protocol-badge protocol-${value}`}>
      <span className="cat-glyph protocol-glyph" aria-hidden="true">
        {protocolGlyph[value]}
      </span>
      {accessProtocolLabels[value]}
    </span>
  );
}

export function categoryClass(category: ModuleCategory): string {
  if (category === "remote_a2a") return "cat-remote";
  return `cat-${category}`;
}

export function CategoryBadge({ category }: { category: ModuleCategory }) {
  return (
    <span className={`category-badge ${categoryClass(category)}`}>
      <span className="cat-glyph" aria-hidden="true">
        {categoryGlyph[category]}
      </span>
      {moduleCategoryLabels[category]}
    </span>
  );
}

export function SubtypeBadge({ value }: { value: string }) {
  return (
    <span className="subtype-badge">
      <span className="cat-glyph subtype-glyph" aria-hidden="true">
        {subtypeGlyph[value] ?? "·"}
      </span>
      {formatSubtypeLabel(value)}
    </span>
  );
}

export function CandidateCategoryBadge({ candidate }: { candidate: ModuleCandidate }) {
  const subtypeValue = getSubtypeValue(candidate);
  return (
    <div className="candidate-cat-row">
      <CategoryBadge category={candidate.module_category} />
      {subtypeValue ? <SubtypeBadge value={subtypeValue} /> : null}
    </div>
  );
}

export function getSubtypeValue(candidate: ModuleCandidate): string | null {
  if (candidate.module_category === "adapter") return candidate.adapter_kind ?? null;
  if (candidate.module_category === "agent") return candidate.agent_kind ?? null;
  if (candidate.module_category === "workflow") return candidate.workflow_kind ?? null;
  if (candidate.module_category === "remote_a2a") return candidate.remote_contract_kind ?? null;
  return null;
}

export function formatSubtypeLabel(value: string): string {
  return (
    adapterKindLabels[value as keyof typeof adapterKindLabels] ??
    workflowKindLabels[value as keyof typeof workflowKindLabels] ??
    agentKindLabels[value as keyof typeof agentKindLabels] ??
    remoteContractKindLabels[value as keyof typeof remoteContractKindLabels] ??
    runtimeContractKindLabels[value as keyof typeof runtimeContractKindLabels] ??
    value
  );
}
