import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import fixture from "../../../templates/regression-scenarios/scenario-a-simple-local-specialist/analysis-result.json" with { type: "json" };
import graphWorkflowFixture from "../../../templates/regression-scenarios/scenario-d-graph-workflow/analysis-result.json" with { type: "json" };
import { runCodexAnalyzer, validateAnalysisResult, type CodexAnalyzerRunner } from "./codexAnalyzer.ts";

const repoRoot = await mkdtemp(join(tmpdir(), "af-codex-analyzer-"));

try {
  const schemaDir = join(repoRoot, "schemas");
  await mkdir(schemaDir, { recursive: true });
  await writeFile(join(schemaDir, "analysis-result.schema.json"), `${JSON.stringify({ type: "object" })}\n`, "utf8");
  await writeFile(join(schemaDir, "analysis-draft.schema.json"), `${JSON.stringify({ type: "object" })}\n`, "utf8");

  const runner: CodexAnalyzerRunner = {
    async run(input) {
      assert.equal(input.model, "gpt-5.5");
      assert.equal(input.repoRoot, repoRoot);
      assert.equal(typeof input.prompt, "string");
      assert.deepEqual(input.outputSchema, { type: "object" });
      return {
        outputText: JSON.stringify({
          ...fixture,
          normalizedRequirement: {
            ...fixture.normalizedRequirement,
            raw_text: "SDK analyzer requirement"
          }
        }),
        stdout: "{\"type\":\"thread.started\"}\n",
        stderr: "",
        diagnostics: {
          elapsedMs: 12,
          eventCount: 1,
          lastEventType: "thread.started",
          eventTypeCounts: { "thread.started": 1 },
          lastTraceTitle: "Thread 시작",
          lastTraceSnippet: "thread-test"
        }
      };
    }
  };

  const run = await runCodexAnalyzer({
    repoRoot,
    schemaPath: join(schemaDir, "analysis-result.schema.json"),
    draftSchemaPath: join(schemaDir, "analysis-draft.schema.json"),
    input: {
      rawText: "SDK analyzer requirement",
      domain: "공통"
    },
    model: "gpt-5.5",
    catalog: [],
    codexRunner: runner
  });

  assert.equal((run.output as typeof fixture).normalizedRequirement.raw_text, "SDK analyzer requirement");
  assert.equal(run.diagnostics.eventCount, 1);
  assert.equal(run.promptChars > 0, true);
  assert.equal(run.timeoutMs > 0, true);
} finally {
  await rm(repoRoot, { recursive: true, force: true });
}

const invalidReviewedAdkFields = structuredClone(fixture);
invalidReviewedAdkFields.processFlow.nodes[0].node_kind = "human_input";
invalidReviewedAdkFields.processFlow.nodes[0].lane_id = "human_input";
invalidReviewedAdkFields.processFlow.nodes[0].human_input_contract = {
  message: " ",
  payload_schema_ref: { schema: "AddressForm" },
  response_schema_ref: "AddressForm",
  response_mapping: []
};
invalidReviewedAdkFields.processFlow.edges[0].edge_kind = "event_output";
invalidReviewedAdkFields.processFlow.edges[0].route_aliases = ["route-only"];
invalidReviewedAdkFields.processFlow.edges[0].is_default_route = true;
invalidReviewedAdkFields.processFlow.edges.push({
  ...invalidReviewedAdkFields.processFlow.edges[0],
  id: "edge-999",
  edge_kind: "route",
  route_condition: "choice == duplicate",
  route_aliases: [" "],
  is_default_route: true
});

const invalidReviewedAdkFieldErrors = validateAnalysisResult(invalidReviewedAdkFields);
assert.match(invalidReviewedAdkFieldErrors.join("\n"), /human_input_contract\.message/);
assert.match(invalidReviewedAdkFieldErrors.join("\n"), /payload_schema_ref/);
assert.match(invalidReviewedAdkFieldErrors.join("\n"), /response_mapping/);
assert.match(invalidReviewedAdkFieldErrors.join("\n"), /response_schema_ref/);
assert.match(invalidReviewedAdkFieldErrors.join("\n"), /route_aliases is allowed only on route or loop decision edges/);
assert.match(invalidReviewedAdkFieldErrors.join("\n"), /is_default_route is allowed only on route or loop decision edges/);

const loopDecisionRouteMetadataErrors = validateAnalysisResult(graphWorkflowFixture);
assert.deepEqual(loopDecisionRouteMetadataErrors, []);
