import assert from "node:assert/strict";
import "./targetContract.test.ts";
import { parseAnalysisResultArtifact } from "./analysisArtifactImport.ts";

const strictTargetArtifact = {
  contract_version: "2.0",
  normalizedRequirement: {
    id: "req-001",
    title: "Strict target analysis",
    raw_text: "Review a request",
    domain: "공통",
    requester: { team: "platform", role: "developer" },
    business_goal: "Review the request",
    current_process: [],
    inputs: [],
    outputs: [],
    systems: [],
    risk_signals: [],
    missing_information: [],
    contradictions: [],
    status: "draft"
  },
  evidence: {
    requested_goal: "Review the request",
    business_domain_hint: "공통",
    user_role: "developer",
    input_data: [],
    output_data: [],
    systems_mentioned: [],
    decisions_implied: [],
    risk_signals: [],
    missing_information: [],
    contradictions: [],
    assumptions: []
  },
  assetCandidates: [
    {
      asset_id: "workflow.review-request",
      source_requirement_id: "req-001",
      catalog_entry_id: null,
      name: "Review request",
      asset_type: "workflow",
      domain_scope: "domain_neutral",
      business_domains: [],
      owner: "platform",
      reuse_status: "project_only",
      capability_tags: [],
      binding: null,
      connection: null,
      workflow_profile: { representation: "graph", coordination: "explicit", template_ref: null },
      exposure: null,
      confidence: 0.9,
      rationale: "Owns the reviewed flow",
      inputs: [],
      outputs: [],
      risk_level: "low",
      risk_signals: [],
      status: "needs_info",
      missing_information: [],
      developer_todos: []
    },
    {
      asset_id: "agent.request-reviewer",
      source_requirement_id: "req-001",
      catalog_entry_id: null,
      name: "Request reviewer",
      asset_type: "agent",
      domain_scope: "domain_neutral",
      business_domains: [],
      owner: "platform",
      reuse_status: "project_only",
      capability_tags: ["review"],
      binding: null,
      connection: null,
      workflow_profile: null,
      exposure: null,
      confidence: 0.8,
      rationale: "Makes the review decision",
      inputs: [],
      outputs: [],
      risk_level: "low",
      risk_signals: [],
      status: "needs_info",
      missing_information: [],
      developer_todos: []
    }
  ],
  a2aContracts: [],
  runtimeContracts: [],
  graph: {
    graph_id: "graph-001",
    source_requirement_id: "req-001",
    workflow_ref: "workflow.review-request",
    nodes: [
      { id: "node-input", label: "Input", node_kind: "input" },
      { id: "node-review", label: "Review", node_kind: "agent", agent_ref: "agent.request-reviewer", available_tools: [] },
      { id: "node-output", label: "Output", node_kind: "output" }
    ],
    edges: [
      {
        id: "edge-001",
        from: "node-input",
        to: "node-review",
        control: { kind: "next", condition: null, accepted_aliases: [], default: false },
        channel: "event"
      },
      {
        id: "edge-002",
        from: "node-review",
        to: "node-output",
        control: { kind: "next", condition: null, accepted_aliases: [], default: false },
        channel: "event"
      }
    ],
    regions: []
  }
} as const;

const imported = parseAnalysisResultArtifact(JSON.stringify(strictTargetArtifact));
assert.equal(imported.analysis.contract_version, "2.0");
assert.equal(imported.analysis.assetCandidates[1]?.asset_id, "agent.request-reviewer");
assert.equal(imported.analysis.graph.workflow_ref, "workflow.review-request");

const standaloneTargetArtifact = {
  ...structuredClone(strictTargetArtifact),
  assetCandidates: [structuredClone(strictTargetArtifact.assetCandidates[1])],
  graph: { ...structuredClone(strictTargetArtifact.graph), workflow_ref: null }
};
const importedStandalone = parseAnalysisResultArtifact(JSON.stringify(standaloneTargetArtifact));
assert.equal(importedStandalone.analysis.graph.workflow_ref, null);
assert.deepEqual(importedStandalone.analysis.assetCandidates.map((candidate) => candidate.asset_type), ["agent"]);

const versionless = structuredClone(strictTargetArtifact) as Record<string, unknown>;
delete versionless.contract_version;
assert.throws(
  () => parseAnalysisResultArtifact(JSON.stringify(versionless)),
  /contract_version/,
  "strict import must reject a missing contract version"
);

const legacyTopLevel = {
  ...structuredClone(strictTargetArtifact),
  moduleCandidates: structuredClone(strictTargetArtifact.assetCandidates),
  processFlow: structuredClone(strictTargetArtifact.graph)
} as Record<string, unknown>;
delete legacyTopLevel.assetCandidates;
delete legacyTopLevel.graph;
assert.throws(
  () => parseAnalysisResultArtifact(JSON.stringify(legacyTopLevel)),
  /moduleCandidates|processFlow|assetCandidates|graph/,
  "strict import must reject legacy top-level keys without backfilling"
);

const legacyCandidate = structuredClone(strictTargetArtifact);
Object.assign(legacyCandidate.assetCandidates[1], { module_category: "agent", id: "mod-001" });
assert.throws(
  () => parseAnalysisResultArtifact(JSON.stringify(legacyCandidate)),
  /module_category|id/,
  "strict import must reject legacy candidate projections"
);

const legacyGraph = structuredClone(strictTargetArtifact);
Object.assign(legacyGraph.graph.nodes[1], { module_id: "mod-001", lane_id: "local_graph" });
Object.assign(legacyGraph.graph.edges[0], { edge_kind: "event_output", flow_kind: "sequence" });
assert.throws(
  () => parseAnalysisResultArtifact(JSON.stringify(legacyGraph)),
  /module_id|lane_id|edge_kind|flow_kind/,
  "strict import must reject coercive Graph migration inputs"
);

console.log("analysis artifact import strict Target contract tests passed");
