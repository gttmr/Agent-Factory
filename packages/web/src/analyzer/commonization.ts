import { getCandidateSubtype } from "./classificationRules";
import { bankDomains, type BankDomain, type CommonizationNotes, type DomainCapabilityMapRow, type ModuleCandidate, type ProcessFlow, type ReuseHeatmapItem } from "./types";

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

export function buildReuseHeatmap(moduleCandidates: ModuleCandidate[]): ReuseHeatmapItem[] {
  return moduleCandidates
    .filter((candidate) => candidate.reuse_candidate || candidate.agent_kind === "shared")
    .map((candidate) => {
      const domains = inferCapabilityDomains(candidate);
      return {
        capability: candidate.name,
        module_category: candidate.module_category,
        subtype: getCandidateSubtype(candidate),
        reuse_score: scoreReuse(candidate, domains),
        domains,
        candidate_status: candidate.status,
        rationale: candidate.rationale
      };
    })
    .sort((a, b) => b.reuse_score - a.reuse_score || a.capability.localeCompare(b.capability));
}

export function buildDomainCapabilityMap(moduleCandidates: ModuleCandidate[]): DomainCapabilityMapRow[] {
  return moduleCandidates
    .filter((candidate) => candidate.reuse_candidate || candidate.module_category === "adapter" || candidate.agent_kind === "shared")
    .map((candidate) => {
      const domains = inferCapabilityDomains(candidate);
      return {
        capability: candidate.name,
        module_category: candidate.module_category,
        subtype: getCandidateSubtype(candidate),
        domains: bankDomains.reduce(
          (accumulator, domain) => ({
            ...accumulator,
            [domain]: domains.includes(domain) ? domainAffinity(candidate, domain) : "낮음"
          }),
          {} as DomainCapabilityMapRow["domains"]
        )
      };
    });
}

export function buildMermaidProcessFlow(processFlow: ProcessFlow): string {
  const nodeLines = processFlow.nodes.map((node) => {
    const subtype = node.subtype ? `: ${node.subtype}` : "";
    return `  ${safeId(node.id)}["${node.label} (${node.type}${subtype})"]`;
  });
  const edgeLines = processFlow.edges.map((edge) => {
    const label = edge.edge_type === "remote_a2a" ? `remote_a2a: ${edge.data}` : edge.data;
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

function inferCapabilityDomains(candidate: ModuleCandidate): BankDomain[] {
  const text = `${candidate.name} ${candidate.rationale} ${candidate.inputs.map((field) => field.name).join(" ")} ${candidate.outputs
    .map((field) => field.name)
    .join(" ")}`.toLowerCase();

  if (candidate.adapter_kind === "rule_registry" || candidate.adapter_kind === "retrieval" || candidate.agent_kind === "shared") {
    return [...bankDomains];
  }
  if (text.includes("loan") || text.includes("credit") || text.includes("여신") || candidate.risk_signals.includes("credit_decision_support")) {
    return ["여신", "리스크", "고객"];
  }
  if (text.includes("card") || text.includes("카드")) {
    return ["카드", "고객", "리스크"];
  }
  if (text.includes("account") || text.includes("deposit") || text.includes("balance") || text.includes("수신")) {
    return ["수신", "고객", "리스크"];
  }
  if (text.includes("risk") || text.includes("리스크")) {
    return ["리스크", "여신", "카드"];
  }
  if (text.includes("customer") || text.includes("profile") || text.includes("complaint") || text.includes("고객")) {
    return ["고객", "수신", "여신", "카드", "리스크"];
  }

  return ["고객"];
}

function scoreReuse(candidate: ModuleCandidate, domains: BankDomain[]): number {
  const base = candidate.reuse_candidate ? 45 : 25;
  const categoryBoost = candidate.module_category === "adapter" ? 20 : candidate.agent_kind === "shared" ? 18 : 10;
  const statusBoost = candidate.status === "approved" ? 15 : candidate.status === "needs_info" ? 8 : 0;
  return Math.min(100, base + categoryBoost + domains.length * 4 + statusBoost);
}

function domainAffinity(candidate: ModuleCandidate, domain: BankDomain): "낮음" | "중간" | "높음" {
  if (candidate.adapter_kind === "rule_registry" || candidate.adapter_kind === "retrieval" || candidate.agent_kind === "shared") {
    return domain === "고객" || domain === "여신" || domain === "리스크" ? "높음" : "중간";
  }
  if (candidate.risk_signals.includes("credit_decision_support") && (domain === "여신" || domain === "리스크")) {
    return "높음";
  }
  if (candidate.risk_signals.includes("personal_data") && domain === "고객") {
    return "높음";
  }
  return candidate.reuse_candidate ? "중간" : "낮음";
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
