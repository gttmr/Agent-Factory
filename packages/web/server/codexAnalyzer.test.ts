import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import fixture from "../../../templates/regression-scenarios/scenario-a-simple-local-specialist/analysis-result.json" with { type: "json" };
import { runCodexAnalyzer, type CodexAnalyzerRunner } from "./codexAnalyzer.ts";

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
