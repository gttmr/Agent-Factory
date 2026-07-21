import assert from "node:assert/strict";
import type { AnalysisResult, GraphIR } from "../analyzer/types.ts";
import { deriveGraphIRForAnalysis } from "./useGraphIR.ts";

const graph: GraphIR = {
  graph_id: "graph.use-graph-ir",
  source_requirement_id: "req-use-graph-ir",
  workflow_ref: "workflow.use-graph-ir",
  nodes: [
    { id: "input", label: "Input", node_kind: "input" },
    { id: "output", label: "Output", node_kind: "output" }
  ],
  edges: [
    {
      id: "edge.input.output",
      from: "input",
      to: "output",
      control: { kind: "next", condition: null, accepted_aliases: [], default: false },
      channel: null
    }
  ],
  regions: []
};

const analysis = analysisWithGraph(graph);

// Strict current Graph IR is consumed directly, without migration, coercion,
// backfill, cloning, or persisted-validation merging.
const current = deriveGraphIRForAnalysis(analysis);
assert.equal(current.graphIR, graph);
assert.equal(current.errorCount, 0);
assert.equal(current.warningCount, 0);
assert.equal(current.validationError, undefined);

const originalWarn = console.warn;
const warnings: string[] = [];

try {
  console.warn = (...args: unknown[]) => warnings.push(args.map(String).join(" "));

  const retiredOnly = {
    ...analysis,
    graph: undefined,
    processFlow: graph
  } as unknown as AnalysisResult;
  const retiredResult = deriveGraphIRForAnalysis(retiredOnly);
  assert.equal(retiredResult.graphIR, null);
  assert.equal(retiredResult.errorCount, 1);
  assert.equal(retiredResult.warningCount, 0);
  assert.match(retiredResult.validationError ?? "", /graph/i);

  const persistedValidation = {
    ...graph,
    validation: { ok: true, errors: [], warnings: [] }
  } as unknown as GraphIR;
  const persistedValidationResult = deriveGraphIRForAnalysis(analysisWithGraph(persistedValidation));
  assert.equal(persistedValidationResult.graphIR, null);
  assert.equal(persistedValidationResult.errorCount, 1);

  const missingChannel = structuredClone(graph) as GraphIR;
  delete (missingChannel.edges[0] as Partial<GraphIR["edges"][number]>).channel;
  const missingChannelResult = deriveGraphIRForAnalysis(analysisWithGraph(missingChannel));
  assert.equal(missingChannelResult.graphIR, null);
  assert.equal(missingChannelResult.errorCount, 1);
  assert.match(missingChannelResult.validationError ?? "", /channel/);

  assert.equal(warnings.length, 3);
  assert.ok(warnings.every((warning) => warning.includes("[useGraphIR] validation failed:")));
} finally {
  console.warn = originalWarn;
}

assert.deepEqual(deriveGraphIRForAnalysis(null), { graphIR: null, errorCount: 0, warningCount: 0 });

function analysisWithGraph(value: GraphIR): AnalysisResult {
  return {
    contract_version: "2.0",
    normalizedRequirement: {
      id: "req-use-graph-ir",
      title: "Use strict Graph IR",
      raw_text: "Render only the current graph contract.",
      domain: "workbench",
      requester: { team: "platform", role: "developer" },
      business_goal: "Reject retired graph shapes.",
      current_process: [],
      inputs: [],
      outputs: [],
      systems: [],
      risk_signals: [],
      missing_information: [],
      contradictions: [],
      status: "approved"
    },
    evidence: {
      requested_goal: "Render strict Graph IR.",
      business_domain_hint: "workbench",
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
        asset_id: "workflow.use-graph-ir",
        source_requirement_id: "req-use-graph-ir",
        catalog_entry_id: null,
        name: "Use Graph IR Workflow",
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
        confidence: 1,
        rationale: "Owns the strict graph used by this hook regression test.",
        inputs: [],
        outputs: [],
        risk_level: "low",
        risk_signals: [],
        status: "approved",
        missing_information: []
      }
    ],
    a2aContracts: [],
    runtimeContracts: [],
    graph: value
  };
}
