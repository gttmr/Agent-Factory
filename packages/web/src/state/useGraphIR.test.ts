import assert from "node:assert/strict";
import simpleScenario from "../../../../templates/regression-scenarios/scenario-a-simple-local-specialist/analysis-result.json" with { type: "json" };
import { parseAnalysisResultArtifact } from "../analyzer/analysisArtifactImport.ts";
import { deriveGraphIRForAnalysis } from "./useGraphIR.ts";

const unsupportedLegacyGraphMessage = "구버전 그래프 형식은 더 이상 지원되지 않습니다";
const nativeAnalysis = parseAnalysisResultArtifact(JSON.stringify(simpleScenario), "analysis-result.json").analysis;

// Given: a native Graph IR analysis result.
const nativeResult = deriveGraphIRForAnalysis(nativeAnalysis);

// Then: the derivation returns a renderable graph and no normalization error.
assert.ok(nativeResult.graphIR);
assert.equal(nativeResult.errorCount, 0);
assert.equal(nativeResult.normalizationError, undefined);

const originalWarn = console.warn;
let warningEmitted = false;

try {
  console.warn = (...args: unknown[]) => {
    warningEmitted = String(args[0]).includes("[useGraphIR] migration failed:");
  };

  // Given: an on-disk analysis root still carrying the old stage-flow keys.
  const legacyStageFlowAnalysis = {
    ...nativeAnalysis,
    processFlow: {
      requirement_id: "req-legacy-design",
      graph_id: "graph-001",
      root_workflow_module_id: null,
      nodes: [{ id: "node-agent", label: "Agent", type: "agent" }],
      edges: [
        {
          id: "edge-001",
          from: "node-agent",
          to: "node-output",
          edge_type: "event",
          data_channel: "event_output",
          data: "payload"
        }
      ],
      containers: [],
      lanes: [],
      validation: { ok: true, errors: [], warnings: [] }
    } as never
  };

  // When: Design derives Graph IR for rendering.
  const legacyResult = deriveGraphIRForAnalysis(legacyStageFlowAnalysis);

  // Then: it blocks rendering instead of returning the raw legacy graph.
  assert.equal(legacyResult.graphIR, null);
  assert.equal(legacyResult.errorCount, 1);
  assert.equal(legacyResult.warningCount, 0);
  assert.match(legacyResult.normalizationError ?? "", new RegExp(unsupportedLegacyGraphMessage));
  assert.equal(warningEmitted, true);
} finally {
  console.warn = originalWarn;
}
