import type { CatalogHubEntry } from "../catalog/catalogIndex";
import { riskSignals, type AnalysisResult, type AssetCandidate, type FieldSpec, type GraphNode, type RiskSignal } from "./types";

type CatalogField = NonNullable<CatalogHubEntry["inputs"]>[number] & { schema?: FieldSpec["schema"] };

export function insertCatalogWorkflowNode(analysis: AnalysisResult, entry: CatalogHubEntry): AnalysisResult {
  if (entry.asset_type !== "workflow") return analysis;
  const assetId = uniqueId(entry.asset_id, new Set(analysis.assetCandidates.map((candidate) => candidate.asset_id)));
  const candidate: AssetCandidate = {
    asset_id: assetId,
    source_requirement_id: analysis.normalizedRequirement.id,
    catalog_entry_id: entry.asset_id,
    name: entry.name,
    asset_type: "workflow",
    domain_scope: entry.domain_scope,
    business_domains: [...entry.business_domains],
    owner: entry.owner,
    reuse_status: "reuse_existing",
    capability_tags: [...entry.capability_tags],
    binding: null,
    connection: null,
    workflow_profile: entry.workflow_profile ?? { representation: "unresolved", coordination: "explicit", template_ref: null },
    exposure: null,
    confidence: 1,
    rationale: entry.responsibility || `Catalog Workflow ${entry.asset_id} 재사용`,
    inputs: fields(entry.inputs),
    outputs: fields(entry.outputs),
    risk_level: "low",
    risk_signals: (entry.risk_signals ?? []).filter((signal): signal is RiskSignal => riskSignals.includes(signal as RiskSignal)),
    status: "approved",
    missing_information: [],
    developer_todos: []
  };
  const node: GraphNode = {
    id: uniqueId(`node-${slug(entry.asset_id)}`, new Set(analysis.graph.nodes.map((item) => item.id))),
    label: entry.name,
    node_kind: "subworkflow",
    workflow_ref: assetId
  };
  return {
    ...analysis,
    assetCandidates: [...analysis.assetCandidates, candidate],
    graph: { ...analysis.graph, nodes: [...analysis.graph.nodes, node] }
  };
}

export function pruneDetachedCatalogWorkflowCandidates(analysis: AnalysisResult): AnalysisResult {
  const referenced = new Set<string>();
  if (analysis.graph.workflow_ref) referenced.add(analysis.graph.workflow_ref);
  for (const node of analysis.graph.nodes) if (node.node_kind === "subworkflow") referenced.add(node.workflow_ref);
  const next = analysis.assetCandidates.filter((candidate) => {
    const insertedCatalogWorkflow = candidate.asset_type === "workflow" && candidate.catalog_entry_id !== null;
    return !insertedCatalogWorkflow || referenced.has(candidate.asset_id);
  });
  return next.length === analysis.assetCandidates.length ? analysis : { ...analysis, assetCandidates: next };
}

function fields(value: CatalogField[] | undefined): FieldSpec[] {
  return (value ?? []).map((field) => ({ name: field.name, type: field.type, required: field.required, ...(field.schema ? { schema: field.schema } : {}) }));
}

function slug(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "workflow";
}

function uniqueId(base: string, used: ReadonlySet<string>): string {
  if (!used.has(base)) return base;
  let index = 2;
  while (used.has(`${base}-${index}`)) index += 1;
  return `${base}-${index}`;
}
