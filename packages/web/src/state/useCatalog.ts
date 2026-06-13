import { useQuery } from "@tanstack/react-query";
import { AfApiError } from "./apiClient";

export type CatalogCategory = "agent" | "workflow" | "adapter" | "remote_a2a";

export interface CatalogIO {
  name: string;
  type: string;
  required?: boolean;
}

export interface CatalogEntryRaw {
  id?: string;
  name: string;
  version?: number;
  agent_kind?: string;
  workflow_kind?: string;
  adapter_kind?: string;
  remote_contract_kind?: string;
  owner_domain?: string;
  status?: string;
  component_source?: string;
  runtime_binding?: string;
  access_protocol?: string;
  mcp_server?: string;
  mcp_tool_name?: string;
  mcp_schema_ref?: string;
  mcp_auth_mode?: string;
  contract_status?: string;
  responsibility?: string;
  inputs?: CatalogIO[];
  outputs?: CatalogIO[];
  risk_signals?: string[];
  composition?: string[];
  scaffold_output?: string;
  notes?: string;
  provenance?: string;
  published_at?: string;
  published_from?: string;
  source_candidate_id?: string;
  runtime_mock?: Record<string, unknown> | null;
  required_before_approval?: string[];
}

export interface CatalogHubEntry extends CatalogEntryRaw {
  /** synthetic id stable per (category,name) for keys + pinning */
  id: string;
  category: CatalogCategory;
  subtype?: string;
}

export interface CatalogIndex {
  agents: CatalogHubEntry[];
  workflows: CatalogHubEntry[];
  adapters: CatalogHubEntry[];
  remoteA2A: CatalogHubEntry[];
  domainOwners: unknown;
  riskGates: unknown;
}

function readEntries(value: unknown, key: string): CatalogEntryRaw[] {
  if (!value || typeof value !== "object") return [];
  const inner = (value as Record<string, unknown>)[key];
  return Array.isArray(inner) ? (inner.filter((entry): entry is CatalogEntryRaw => Boolean(entry) && typeof entry === "object")) : [];
}

function hydrate(category: CatalogCategory, entry: CatalogEntryRaw): CatalogHubEntry {
  const subtype =
    category === "agent"
      ? entry.agent_kind
      : category === "workflow"
        ? entry.workflow_kind
        : category === "adapter"
          ? entry.adapter_kind
          : entry.remote_contract_kind;
  return {
    ...entry,
    id: entry.id ?? `${category}:${entry.name}`,
    category,
    subtype: subtype ?? undefined
  };
}

function hydrateEntries(category: CatalogCategory, entries: CatalogEntryRaw[]): CatalogHubEntry[] {
  const byName = new Map<string, CatalogHubEntry>();
  for (const entry of entries) {
    if (entry.status === "deprecated") continue;
    const hydrated = hydrate(category, entry);
    const current = byName.get(entry.name);
    if (!current || entryVersion(hydrated) > entryVersion(current)) {
      byName.set(entry.name, hydrated);
    }
  }
  return Array.from(byName.values());
}

function entryVersion(entry: CatalogEntryRaw): number {
  return typeof entry.version === "number" && Number.isFinite(entry.version) ? entry.version : 0;
}

export function useCatalog() {
  return useQuery<CatalogIndex>({
    queryKey: ["af", "catalog-index"] as const,
    queryFn: async () => {
      const response = await fetch("/api/catalog");
      if (!response.ok) throw new AfApiError(response.status, "catalog 조회 실패");
      const body = (await response.json()) as Record<string, unknown>;
      return {
        agents: hydrateEntries("agent", readEntries(body.agents, "agents")),
        workflows: hydrateEntries("workflow", readEntries(body.workflows, "workflows")),
        adapters: hydrateEntries("adapter", readEntries(body.adapters, "adapters")),
        remoteA2A: hydrateEntries("remote_a2a", readEntries(body.remoteA2A, "remote_a2a_contracts")),
        domainOwners: body.domainOwners,
        riskGates: body.riskGates
      };
    },
    staleTime: 60_000
  });
}

export interface RecommendationScore {
  entry: CatalogHubEntry;
  score: number;
  reasons: string[];
}

interface CandidateForRecommendation {
  id: string;
  module_category: string;
  agent_kind?: string | null;
  workflow_kind?: string | null;
  adapter_kind?: string | null;
  remote_contract_kind?: string | null;
  owner_domain?: string | null;
  name: string;
  inputs?: CatalogIO[];
  outputs?: CatalogIO[];
  risk_signals?: string[];
}

function tokenize(value: string): string[] {
  return value
    .toLowerCase()
    .split(/[\s_/]+/)
    .filter((token) => token.length > 1);
}

function jaccard(a: string[], b: string[]): number {
  if (!a.length || !b.length) return 0;
  const setA = new Set(a);
  const setB = new Set(b);
  let intersection = 0;
  setA.forEach((value) => {
    if (setB.has(value)) intersection += 1;
  });
  const union = setA.size + setB.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

export function recommendCatalogForCandidate(candidate: CandidateForRecommendation, index: CatalogIndex): RecommendationScore[] {
  const pool: CatalogHubEntry[] = (() => {
    switch (candidate.module_category) {
      case "agent":
        return index.agents;
      case "workflow":
        return index.workflows;
      case "adapter":
        return index.adapters;
      case "remote_a2a":
        return index.remoteA2A;
      default:
        return [];
    }
  })();
  const candidateSubtype =
    candidate.agent_kind ?? candidate.workflow_kind ?? candidate.adapter_kind ?? candidate.remote_contract_kind ?? null;
  const candidateInputNames = (candidate.inputs ?? []).map((field) => field.name);
  const candidateOutputNames = (candidate.outputs ?? []).map((field) => field.name);
  const candidateTokens = tokenize(candidate.name);

  const scored = pool.map((entry) => {
    let score = 0;
    const reasons: string[] = [];
    if (candidateSubtype && entry.subtype && candidateSubtype === entry.subtype) {
      score += 0.5;
      reasons.push(`subtype 일치 (${entry.subtype})`);
    }
    if (candidate.owner_domain && entry.owner_domain && candidate.owner_domain === entry.owner_domain) {
      score += 0.15;
      reasons.push(`owner_domain 일치 (${entry.owner_domain})`);
    }
    const entryInputs = (entry.inputs ?? []).map((field) => field.name);
    const entryOutputs = (entry.outputs ?? []).map((field) => field.name);
    const ioScore = (jaccard(candidateInputNames, entryInputs) + jaccard(candidateOutputNames, entryOutputs)) / 2;
    if (ioScore > 0) {
      score += ioScore * 0.2;
      reasons.push(`I/O 시그니처 유사 (${ioScore.toFixed(2)})`);
    }
    const riskOverlap = (candidate.risk_signals ?? []).filter((signal) => (entry.risk_signals ?? []).includes(signal));
    if (riskOverlap.length > 0) {
      score += Math.min(0.1, 0.05 * riskOverlap.length);
      reasons.push(`risk 신호 교집합: ${riskOverlap.join(", ")}`);
    }
    const nameScore = jaccard(candidateTokens, tokenize(entry.name));
    if (nameScore > 0) {
      score += nameScore * 0.05;
    }
    return { entry, score, reasons };
  });

  return scored
    .filter((scored) => scored.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);
}
