import assert from "node:assert/strict";
import simpleScenario from "../../../../templates/regression-scenarios/scenario-a-simple-local-specialist/analysis-result.json" with { type: "json" };
import { parseAnalysisResultArtifact } from "./analysisArtifactImport.ts";

const imported = parseAnalysisResultArtifact(JSON.stringify(simpleScenario), "analysis-result.json");

assert.equal(imported.analysis.normalizedRequirement.id, "req-001");
assert.equal(imported.input.rawText, simpleScenario.normalizedRequirement.raw_text);
assert.equal(imported.input.domain, "공통");
assert.equal(imported.moduleCandidates.length, 1);
assert.equal(imported.moduleCandidates[0]?.schema_review_state, "not_started");
assert.equal(imported.analysis.a2aContracts.length, 0);
assert.ok(Array.isArray(imported.analysis.runtimeContracts));
assert.equal(imported.analysis.processFlow.requirement_id, "req-001");

const reviewedArtifact = {
  ...imported.analysis,
  moduleCandidates: imported.moduleCandidates.map((candidate) => ({ ...candidate, status: "approved" }))
};
assert.equal(reviewedArtifact.moduleCandidates[0]?.status, "approved");
assert.equal(reviewedArtifact.processFlow.requirement_id, "req-001");

const serialized = `${JSON.stringify({
  ...imported.analysis,
  moduleCandidates: reviewedArtifact.moduleCandidates
}, null, 2)}\n`;
assert.ok(serialized.endsWith("\n"));
assert.equal(JSON.parse(serialized).moduleCandidates[0]?.status, "approved");

assert.throws(
  () => parseAnalysisResultArtifact("{", "broken.json"),
  /JSON/
);
assert.throws(
  () => parseAnalysisResultArtifact(JSON.stringify({}), "empty.json"),
  /normalizedRequirement/
);
