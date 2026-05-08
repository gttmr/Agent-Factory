import { getCandidateSubtype } from "./classificationRules";
import type { CommonizationNotes, ModuleCandidate, ProcessFlow } from "./types";

export function buildCommonizationNotes(moduleCandidates: ModuleCandidate[]): CommonizationNotes {
  return {
    confirmed_reuse_bindings: moduleCandidates
      .filter((candidate) => candidate.reuse_candidate && candidate.status === "approved")
      .map((candidate) => candidate.name),
    proposed_shared_agents: moduleCandidates
      .filter((candidate) => candidate.module_category === "agent" && candidate.agent_kind === "shared")
      .map((candidate) => candidate.name),
    proposed_adapter_catalog_entries: moduleCandidates
      .filter((candidate) => candidate.module_category === "adapter" && candidate.reuse_candidate)
      .map((candidate) => candidate.name),
    proposed_workflow_reuse: moduleCandidates
      .filter((candidate) => candidate.module_category === "workflow" && candidate.reuse_candidate)
      .map((candidate) => candidate.name),
    remote_a2a_contracts: moduleCandidates
      .filter((candidate) => candidate.module_category === "remote_a2a")
      .map((candidate) => candidate.name),
    deferred_reuse: moduleCandidates
      .filter((candidate) => candidate.reuse_candidate && candidate.status === "deferred")
      .map((candidate) => candidate.name),
    rejected_reuse: moduleCandidates
      .filter((candidate) => candidate.reuse_candidate && candidate.status === "rejected")
      .map((candidate) => candidate.name)
  };
}

export function buildMermaidProcessFlow(processFlow: ProcessFlow): string {
  const nodeLines = processFlow.nodes.map((node) => {
    const executionLabel = node.execution_kind ? `: ${node.execution_kind}` : "";
    return `  ${safeId(node.id)}["${node.label} (${node.node_kind}${executionLabel})"]`;
  });
  const edgeLines = processFlow.edges.map((edge) => {
    const label = edge.edge_kind === "remote_a2a" ? `remote_a2a: ${edge.data_label}` : edge.data_label;
    return `  ${safeId(edge.from)} -->|"${label}"| ${safeId(edge.to)}`;
  });

  return ["graph LR", ...nodeLines, ...edgeLines].join("\n");
}

export function buildCatalogDeltaYaml(moduleCandidates: ModuleCandidate[]): string {
  const reusable = moduleCandidates.filter((candidate) => candidate.reuse_candidate || candidate.module_category === "remote_a2a");
  if (!reusable.length) {
    return "catalog_delta:\n  entries: []\n";
  }

  return [
    "catalog_delta:",
    "  entries:",
    ...reusable.flatMap((candidate) => [
      `    - name: ${yamlScalar(candidate.name)}`,
      `      module_category: ${candidate.module_category}`,
      `      subtype: ${yamlScalar(getCandidateSubtype(candidate) ?? "unknown")}`,
      `      status: ${candidate.status}`,
      `      reuse_candidate: ${candidate.reuse_candidate}`,
      `      risk_level: ${candidate.risk_level}`,
      `      risk_signals: [${candidate.risk_signals.map(yamlScalar).join(", ")}]`
    ])
  ].join("\n");
}

function safeId(value: string): string {
  return value.replace(/[^a-zA-Z0-9_]/g, "_");
}

function yamlScalar(value: string): string {
  if (/^[a-zA-Z0-9_-]+$/.test(value)) {
    return value;
  }
  return JSON.stringify(value);
}
