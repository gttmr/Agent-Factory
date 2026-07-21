import { join } from "node:path";
import type { AnalysisResult, AssetCandidate, GraphIR, ScaffoldPlan } from "../src/analyzer/types.ts";
import { type ArtifactTestRequest, createRoot, writeJson } from "./artifactSyncTestHarness.ts";

export async function writeSyncReadyRoot(request: ArtifactTestRequest, root: string, reqId: string): Promise<void> {
  await createRoot(request, reqId);
  await request({
    url: `/${reqId}/manifest/approvals`,
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: {
      analysis_reviewed: true,
      boundaries_approved: true,
      runtime_contracts_approved: true,
      stub_ready_for_followup: false
    }
  });
  const rootDir = join(root, `artifacts/af/${reqId}`);
  const analysis = driftAnalysisResult(reqId);
  const staleGraph = staleGraphVersion(reqId);
  await writeJson(join(rootDir, "analysis-result.json"), analysis);
  await writeJson(join(rootDir, "normalized-requirement.json"), analysis.normalizedRequirement);
  await writeJson(join(rootDir, "asset-candidates.json"), analysis.assetCandidates);
  await writeJson(join(rootDir, "graph-ir.json"), staleGraph);
  await writeJson(join(rootDir, "scaffold-plan.json"), staleScaffoldPlan(reqId, staleGraph));
}

export function driftAnalysisResult(reqId: string, agentCatalogEntryId: string | null = null): AnalysisResult {
  return {
    contract_version: "2.0",
    normalizedRequirement: {
      id: reqId,
      title: "Artifact sync drift regression",
      raw_text: "Keep split artifacts synchronized with the reviewed analysis graph.",
      domain: "workbench",
      requester: { team: "platform", role: "developer" },
      business_goal: "Prevent stale split artifacts from overriding reviewed Graph IR.",
      current_process: ["Review analysis graph", "Regenerate derived artifacts"],
      inputs: [{ name: "reviewed_graph", type: "json", required: true }],
      outputs: [{ name: "synced_artifacts", type: "json", required: true }],
      systems: [],
      risk_signals: ["audit_required"],
      missing_information: [],
      contradictions: [],
      status: "approved"
    },
    evidence: {
      requested_goal: "Sync derived artifact files from analysis-result.json.",
      business_domain_hint: "workbench",
      user_role: "developer",
      input_data: ["analysis-result.json.graph"],
      output_data: ["graph-ir.json", "scaffold-plan.json"],
      systems_mentioned: [],
      decisions_implied: ["analysis-result.json is canonical"],
      risk_signals: ["audit_required"],
      missing_information: [],
      contradictions: [],
      assumptions: ["artifact sync does not mutate approval gates"]
    },
    assetCandidates: [reviewedWorkflowCandidate(reqId), reviewedAgentCandidate(reqId, agentCatalogEntryId)],
    a2aContracts: [],
    runtimeContracts: [],
    graph: graphVersion(reqId, "graph-002", "node-reviewed-agent", "Reviewed graph version B")
  };
}

function reviewedWorkflowCandidate(reqId: string): AssetCandidate {
  return {
    source_requirement_id: reqId,
    catalog_entry_id: null,
    asset_id: "workflow.artifact-sync",
    asset_type: "workflow",
    name: "artifact_sync_workflow",
    domain_scope: "domain_neutral",
    business_domains: [],
    owner: "platform",
    reuse_status: "project_only",
    capability_tags: ["artifact-sync"],
    binding: null,
    connection: null,
    workflow_profile: { representation: "graph", coordination: "explicit", template_ref: null },
    exposure: null,
    confidence: 0.95,
    rationale: "Owns the reviewed synchronization sequence.",
    inputs: [{ name: "reviewed_graph", type: "json", required: true }],
    outputs: [{ name: "synced_artifacts", type: "json", required: true }],
    risk_level: "low",
    risk_signals: ["audit_required"],
    status: "approved",
    missing_information: [],
    developer_todos: []
  };
}

function reviewedAgentCandidate(reqId: string, catalogEntryId: string | null): AssetCandidate {
  return {
    source_requirement_id: reqId,
    catalog_entry_id: catalogEntryId,
    asset_id: "agent.reviewed-graph",
    asset_type: "agent",
    name: "reviewed_graph_agent",
    domain_scope: "domain_neutral",
    business_domains: [],
    owner: "platform",
    reuse_status: "project_only",
    capability_tags: ["artifact-sync"],
    binding: null,
    connection: null,
    workflow_profile: null,
    exposure: null,
    confidence: 0.91,
    rationale: "Single reviewed agent node used to detect graph-ir drift.",
    inputs: [{ name: "reviewed_graph", type: "json", required: true }],
    outputs: [{ name: "synced_artifacts", type: "json", required: true }],
    risk_level: "low",
    risk_signals: ["audit_required"],
    status: "approved",
    missing_information: [],
    developer_todos: ["Keep derived artifacts synchronized from analysis-result.json."]
  };
}

export function staleGraphVersion(reqId: string): GraphIR {
  return graphVersion(reqId, "graph-001", "node-stale-agent", "Stale split graph version A");
}

export function staleScaffoldPlan(reqId: string, graph: GraphIR): ScaffoldPlan {
  return {
    contract_version: "2.0",
    requirement_id: reqId,
    source: "approved_workbench_artifact",
    raw_requirement_to_code: false,
    output_mode: "smoke",
    assets: [],
    runtime_contracts: [],
    excluded_assets: [],
    graph,
    manifest: { catalog_bound_assets: [], new_code_required: [] },
    validation: { can_generate_source: true, blockers: [], warnings: [] }
  };
}

function graphVersion(reqId: string, graphId: string, agentNodeId: string, agentLabel: string): GraphIR {
  return {
    graph_id: graphId,
    source_requirement_id: reqId,
    workflow_ref: "workflow.artifact-sync",
    nodes: [
      { id: "node-input", label: "reviewed_graph", node_kind: "input" },
      {
        id: agentNodeId,
        label: agentLabel,
        node_kind: "agent",
        agent_ref: "agent.reviewed-graph",
        available_tools: []
      },
      { id: "node-output", label: "synced_artifacts", node_kind: "output" }
    ],
    edges: [
      graphEdge("edge-input-agent", "node-input", agentNodeId),
      graphEdge("edge-agent-output", agentNodeId, "node-output")
    ],
    regions: []
  };
}

function graphEdge(id: string, from: string, to: string): GraphIR["edges"][number] {
  return {
    id,
    from,
    to,
    control: { kind: "next", condition: null, accepted_aliases: [], default: false },
    channel: null
  };
}
