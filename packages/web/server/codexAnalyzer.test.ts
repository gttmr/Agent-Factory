import assert from "node:assert/strict";
import { resolve } from "node:path";
import { validateAnalysisResult } from "./analysisResultValidation.ts";
import { runCodexAnalyzer, type CodexAnalyzerRunner } from "./codexAnalyzer.ts";

const candidateBase = {
  source_requirement_id: "req-001",
  catalog_entry_id: null,
  domain_scope: "domain_neutral",
  business_domains: [],
  owner: "platform",
  reuse_status: "project_only",
  capability_tags: [],
  connection: { transport: "unknown" },
  confidence: 0.9,
  inputs: [],
  outputs: [],
  risk_level: "low",
  risk_signals: [],
  status: "needs_info",
  missing_information: [],
  developer_todos: []
} as const;

const strictTarget = {
  contract_version: "2.0",
  normalizedRequirement: {
    id: "req-001",
    title: "A2A target contract",
    raw_text: "Call a remote reviewer",
    domain: "공통",
    requester: { team: "platform", role: "developer" },
    business_goal: "Review a request",
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
    requested_goal: "Review a request",
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
      ...candidateBase,
      asset_id: "workflow.review",
      name: "Review workflow",
      asset_type: "workflow",
      binding: null,
      connection: null,
      workflow_profile: { representation: "graph", coordination: "explicit", template_ref: null },
      exposure: null,
      rationale: "Owns control flow"
    },
    {
      ...candidateBase,
      asset_id: "agent.remote-reviewer",
      name: "Remote reviewer",
      asset_type: "agent",
      binding: null,
      connection: null,
      workflow_profile: null,
      exposure: null,
      rationale: "Owns a remote review decision"
    }
  ],
  a2aContracts: [],
  runtimeContracts: [],
  graph: {
    graph_id: "graph-001",
    source_requirement_id: "req-001",
    workflow_ref: "workflow.review",
    nodes: [
      { id: "node-agent", label: "Remote reviewer", node_kind: "agent", agent_ref: "agent.remote-reviewer", available_tools: [] }
    ],
    edges: [],
    regions: []
  }
};

assert.deepEqual(validateAnalysisResult(strictTarget), [], "strict Target v2 shape should be accepted");

for (const key of ["moduleCandidates", "processFlow"] as const) {
  const legacy = structuredClone(strictTarget) as Record<string, unknown>;
  legacy[key] = {};
  assert.match(validateAnalysisResult(legacy).join("\n"), new RegExp(key));
}

const versionless = structuredClone(strictTarget) as Record<string, unknown>;
delete versionless.contract_version;
assert.match(validateAnalysisResult(versionless).join("\n"), /contract_version/);

const badBinding = structuredClone(strictTarget);
badBinding.assetCandidates[1]!.binding = { kind: "a2a" } as never;
assert.match(validateAnalysisResult(badBinding).join("\n"), /contract_ref/);

const oldGraph = structuredClone(strictTarget);
Object.assign(oldGraph.graph.edges, [{
  id: "edge-001",
  from: "node-agent",
  to: "node-agent",
  edge_kind: "remote_a2a",
  flow_kind: "sequence",
  call_control: "fixed_by_workflow"
}]);
assert.match(validateAnalysisResult(oldGraph).join("\n"), /edge_kind|flow_kind|call_control/);

const repoRoot = resolve(process.cwd(), "../..");
const runner: CodexAnalyzerRunner = {
  async run(input) {
    assert.equal(input.model, "gpt-5.5");
    assert.equal(JSON.stringify(input.outputSchema).includes('"$ref"'), false, "SDK schema must bundle canonical external refs");
    return {
      outputText: JSON.stringify(strictTarget),
      stdout: "",
      stderr: "",
      diagnostics: { elapsedMs: 1, eventCount: 0, eventTypeCounts: {} }
    };
  }
};
const run = await runCodexAnalyzer({
  repoRoot,
  schemaPath: resolve(repoRoot, "schemas/analysis-result.schema.json"),
  draftSchemaPath: resolve(repoRoot, "schemas/analysis-draft.schema.json"),
  input: { rawText: "Call a remote reviewer", domain: "공통" },
  model: "gpt-5.5",
  catalog: [],
  codexRunner: runner
});
assert.deepEqual(run.output, strictTarget, "analyzer must return the strict result without hydration or migration");

console.log("codex analyzer strict Target contract validation tests passed");
