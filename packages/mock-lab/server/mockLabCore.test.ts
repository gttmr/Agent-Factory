import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { loadCatalogPrefill } from "./catalogPrefillLoader.ts";
import {
  MockGenerationRegistry,
  buildCodexPrompt,
  createRunId,
  type MockCodexGenerator
} from "./mockRunner.ts";
import { MockProcessRegistry } from "./mockProcessRegistry.ts";
import { MockSpecStore } from "./mockSpecStore.ts";
import { validateMockSpec, validateValueAgainstSchema } from "./schemaValidation.ts";

const testRoot = await mkdtemp(join(tmpdir(), "af-mock-lab-"));
const repoRoot = join(testRoot, "repo");
await mkdir(join(repoRoot, "catalog"), { recursive: true });
await writeFile(
  join(repoRoot, "catalog", "adapters.yaml"),
  [
    "adapters:",
    "  - name: bank_document_ocr_mock_adapter",
    "    adapter_kind: external_service",
    "    owner_domain: 공통",
    "    access_protocol: local",
    "    component_source: stub",
    "    contract_status: mock_ready",
    "    inputs:",
    "      - name: document_uri",
    "        type: string",
    "        required: true",
    "      - name: document_type_hint",
    "        type: string",
    "        required: false",
    "    outputs:",
    "      - name: ocr_text",
    "        type: text",
    "      - name: confidence",
    "        type: number",
    "    risk_signals:",
    "      - audit_required",
    "    runtime_mock:",
    "      ocr_text: '[SYNTHETIC] sample OCR text'",
    "      confidence: 0.91",
    "    notes: synthetic OCR adapter",
    "  - name: production_only_adapter",
    "    adapter_kind: legacy_api",
    "    owner_domain: 공통",
    "    access_protocol: http_rest",
    "    component_source: mcp",
    "    contract_status: approved",
    "    inputs: []",
    "    outputs: []"
  ].join("\n"),
  "utf8"
);

const catalog = await loadCatalogPrefill(repoRoot);
assert.equal(catalog.entries.length, 1);
assert.equal(catalog.entries[0].name, "bank_document_ocr_mock_adapter");
assert.equal(catalog.entries[0].has_runtime_mock, true);
assert.equal(catalog.entries[0].prefill.server_name, "bank_document_ocr_mock_adapter-mcp");
assert.equal(catalog.entries[0].prefill.tools[0].name, "bank_document_ocr_mock_adapter");
assert.deepEqual(catalog.entries[0].prefill.tools[0].inputSchema.required, ["document_uri"]);
assert.deepEqual(catalog.entries[0].prefill.tools[0].successResponse, {
  ocr_text: "[SYNTHETIC] sample OCR text",
  confidence: 0.91
});

const validSpec = catalog.entries[0].prefill;
const specValidation = validateMockSpec(validSpec);
assert.deepEqual(specValidation.errors, []);
assert.deepEqual(specValidation.warnings, []);
assert.equal(validateValueAgainstSchema({}, validSpec.tools[0].inputSchema).ok, false);
assert.equal(validateValueAgainstSchema(validSpec.tools[0].successResponse, validSpec.tools[0].outputSchema).ok, true);

const invalidSpec = {
  ...validSpec,
  guardrails: {
    ...validSpec.guardrails,
    no_credentials: false
  }
};
assert.match(
  validateMockSpec(invalidSpec)
    .errors.map((issue) => `${issue.path}: ${issue.message}`)
    .join("\n"),
  /no_credentials/
);

const store = new MockSpecStore({ repoRoot });
await assert.rejects(() => store.writeSpec("../escape", validSpec), /mock_id/);
await assert.rejects(
  () => store.readSpec("missing_saved_spec"),
  (error) => {
    assert.equal(error instanceof Error, true);
    assert.match((error as Error).message, /Mock spec is not saved/);
    assert.equal((error as { statusCode?: number }).statusCode, 404);
    return true;
  }
);
await store.writeSpec(validSpec.mock_id, validSpec);
const saved = await store.readSpec(validSpec.mock_id);
assert.equal(saved.server_name, "bank_document_ocr_mock_adapter-mcp");
await store.writeSpec("delete_me_mock", {
  ...validSpec,
  mock_id: "delete_me_mock",
  server_name: "delete-me-mcp"
});
const deleteResult = await store.deleteMock("delete_me_mock");
assert.deepEqual(deleteResult, { ok: true, mock_id: "delete_me_mock" });
await assert.rejects(() => store.readSpec("delete_me_mock"), /Mock spec is not saved/);

const generation = new MockGenerationRegistry({
  repoRoot,
  store,
  timeoutMs: 5000,
  codexGenerator: createFakeCodexGenerator()
});
const startedGeneration = await generation.start({ mockId: validSpec.mock_id, model: "gpt-5.5" });
assert.equal(startedGeneration.status, "running");
assert.equal(startedGeneration.pid, null);
assert.equal(startedGeneration.command, "codex sdk");
assert.equal(startedGeneration.codex?.backend, "sdk");
const runningRuns = await store.listRuns(validSpec.mock_id);
assert.equal((runningRuns[0] as { status: string }).status, "running");
await waitFor(async () => {
  const detail = await readRunDetailForTest(store, validSpec.mock_id, startedGeneration.run_id);
  assert.equal(detail.summary.status, "completed");
  assert.equal(detail.summary.codex?.thread_id, "thread-mock-lab-test");
  assert.equal(detail.summary.codex?.event_count, 2);
  assert.match(detail.stdout, /thread.started/);
  assert.deepEqual(
    detail.proposed_files.map((file) => file.path).sort(),
    ["package.json", "src/server.ts"]
  );
});

const cancellableGeneration = new MockGenerationRegistry({
  repoRoot,
  store,
  timeoutMs: 5000,
  codexGenerator: createBlockingCodexGenerator()
});
const cancellableRun = await cancellableGeneration.start({ mockId: validSpec.mock_id, model: "gpt-5.5" });
const duplicateRun = await cancellableGeneration.start({ mockId: validSpec.mock_id, model: "gpt-5.5" });
assert.equal(duplicateRun.run_id, cancellableRun.run_id);
assert.equal(duplicateRun.status, "running");
const cancelledRun = await cancellableGeneration.cancel(validSpec.mock_id, cancellableRun.run_id);
assert.equal(cancelledRun.status, "cancelled");
assert.equal(cancelledRun.codex?.thread_id, "thread-mock-lab-blocking");
await waitFor(async () => {
  const detail = await readRunDetailForTest(store, validSpec.mock_id, cancellableRun.run_id);
  assert.equal(detail.summary.status, "cancelled");
});

const runId = "20260529T010203Z-generate-abcdef";
const proposedRoot = store.resolveRunProposedDir(validSpec.mock_id, runId);
await writeGeneratedFile(
  proposedRoot,
  "package.json",
  JSON.stringify({ type: "module", scripts: { start: "node server.mjs" } }, null, 2)
);
await writeGeneratedFile(
  proposedRoot,
  "server.mjs",
  [
    "import { appendFileSync } from 'node:fs';",
    "import readline from 'node:readline';",
    "const audit = process.env.AFML_AUDIT_LOG;",
    "const tool = { name: 'bank_document_ocr_mock_adapter', description: 'synthetic OCR adapter', inputSchema: { type: 'object', required: ['document_uri'], properties: { document_uri: { type: 'string' } } }, outputSchema: { type: 'object', required: ['ocr_text', 'confidence'], properties: { ocr_text: { type: 'string' }, confidence: { type: 'number' } } } };",
    "const rl = readline.createInterface({ input: process.stdin });",
    "process.stdin.resume();",
    "const keepAlive = setInterval(() => {}, 2147483647);",
    "process.on('SIGTERM', () => { clearInterval(keepAlive); process.exit(0); });",
    "rl.on('close', () => { clearInterval(keepAlive); });",
    "rl.on('line', (line) => {",
    "  const request = JSON.parse(line);",
    "  if (request.method === 'tools/list') { console.log(JSON.stringify({ jsonrpc: '2.0', id: request.id, result: { tools: [tool] } })); return; }",
    "  if (request.method === 'tools/call') {",
    "    const structuredContent = { ocr_text: '[SYNTHETIC] sample OCR text', confidence: 0.91, synthetic: true, source: 'agent-factory-mock-lab' };",
    "    if (audit) appendFileSync(audit, JSON.stringify({ method: 'tools/call', synthetic: true, tool_name: request.params.name }) + '\\n');",
    "    console.log(JSON.stringify({ jsonrpc: '2.0', id: request.id, result: { content: [{ type: 'text', text: JSON.stringify(structuredContent) }], structuredContent, isError: false } }));",
    "  }",
    "});"
  ].join("\n")
);
const applied = await store.applyGeneratedFiles(validSpec.mock_id, runId);
assert.deepEqual(
  applied.files.map((file) => file.path).sort(),
  ["package.json", "server.mjs"]
);

const registry = new MockProcessRegistry({ repoRoot, store });
const status = await registry.start(validSpec.mock_id);
assert.equal(status.status, "running");
await assert.rejects(() => registry.start(validSpec.mock_id), /already running/);
const listed = await registry.sendJsonRpc(validSpec.mock_id, "tools/list", {});
assert.equal(listed.result.tools[0].name, "bank_document_ocr_mock_adapter");
const called = await registry.sendJsonRpc(validSpec.mock_id, "tools/call", {
  name: "bank_document_ocr_mock_adapter",
  arguments: { document_uri: "synthetic://document/1" }
});
assert.equal(called.result.structuredContent.synthetic, true);
assert.equal(called.result.structuredContent.source, "agent-factory-mock-lab");
const auditLog = await readFile(join(repoRoot, "artifacts/mock-lab", validSpec.mock_id, "audit-log.jsonl"), "utf8");
assert.match(auditLog, /tools\/call/);
const stopped = await registry.stop(validSpec.mock_id);
assert.equal(stopped.status, "stopped");

const generatedRunId = createRunId(new Date("2026-05-29T01:02:03Z"), "abcdef");
assert.equal(generatedRunId, "20260529T010203Z-generate-abcdef");
const prompt = buildCodexPrompt({
  repoRoot,
  specPath: join(repoRoot, "artifacts/mock-lab/bank_document_ocr_mock_adapter/mock-spec.json"),
  outputPath: join(repoRoot, "artifacts/mock-lab/bank_document_ocr_mock_adapter/runs/20260529T010203Z-generate-abcdef/proposed-files")
});
assert.match(prompt, /Write files only under the proposed-files directory/);
assert.match(prompt, /process\.stdin\.resume/);
assert.match(prompt, /setInterval/);
assert.match(prompt, /structuredContent/);

await rm(testRoot, { recursive: true, force: true });

async function writeGeneratedFile(root: string, relativePath: string, content: string): Promise<void> {
  const target = join(root, relativePath);
  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, `${content}\n`, "utf8");
}

async function readRunDetailForTest(store: MockSpecStore, mockId: string, runId: string) {
  const { readRunDetail } = await import("./mockRunner.ts");
  return await readRunDetail(store, mockId, runId);
}

function createFakeCodexGenerator(): MockCodexGenerator {
  return {
    async run(input) {
      await input.updateMetadata({
        backend: "sdk",
        thread_id: "thread-mock-lab-test",
        event_count: 1,
        usage: null
      });
      await input.emit({
        phase: "codex_event",
        message: "thread started",
        rawEventType: "thread.started",
        status: "started",
        snippet: "thread-mock-lab-test"
      });
      await writeGeneratedFile(
        input.proposedDir,
        "package.json",
        JSON.stringify({ type: "module", scripts: { start: "node --experimental-strip-types src/server.ts" } }, null, 2)
      );
      await writeGeneratedFile(input.proposedDir, "src/server.ts", "console.log(\"synthetic server\")");
      await input.emit({
        phase: "codex_event",
        message: "turn completed",
        rawEventType: "turn.completed",
        status: "completed"
      });
      return {
        backend: "sdk",
        thread_id: "thread-mock-lab-test",
        event_count: 2,
        usage: {
          input_tokens: 10,
          cached_input_tokens: 2,
          output_tokens: 4,
          reasoning_output_tokens: 1
        }
      };
    }
  };
}

function createBlockingCodexGenerator(): MockCodexGenerator {
  return {
    async run(input) {
      await input.updateMetadata({
        backend: "sdk",
        thread_id: "thread-mock-lab-blocking",
        event_count: 1,
        usage: null
      });
      await new Promise<void>((_resolve, reject) => {
        input.signal.addEventListener("abort", () => reject(new Error("generation cancelled")), { once: true });
      });
      return {
        backend: "sdk",
        thread_id: "thread-mock-lab-blocking",
        event_count: 1,
        usage: null
      };
    }
  };
}

async function waitFor(assertion: () => Promise<void>, timeoutMs = 3000): Promise<void> {
  const startedAt = Date.now();
  let lastError: unknown;
  while (Date.now() - startedAt < timeoutMs) {
    try {
      await assertion();
      return;
    } catch (error) {
      lastError = error;
      await new Promise((resolve) => setTimeout(resolve, 40));
    }
  }
  throw lastError instanceof Error ? lastError : new Error("waitFor timed out");
}
