import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadCatalogPrefill } from "./catalogPrefillLoader.ts";
import { MockDraftRegistry, buildDraftSpecPrompt, createDraftId, readDraftDetail } from "./mockDraftRunner.ts";
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
assert.match(
  validateMockSpec({
    ...validSpec,
    tools: [
      {
        ...validSpec.tools[0],
        errorScenarios: [{ name: "unsupported", response: { message: "bad shape" } }]
      }
    ]
  })
    .errors.map((issue) => `${issue.path}: ${issue.message}`)
    .join("\n"),
  /errorCode/
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

const draftRegistry = new MockDraftRegistry({
  repoRoot,
  store,
  timeoutMs: 5000,
  draftRunner: {
    async run() {
      await new Promise((resolve) => setTimeout(resolve, 50));
      return {
        command: "fake codex sdk draft",
        outputText:
          "```json\n" +
          JSON.stringify(
            {
              mock_id: "bank_document_ocr_mock_adapter",
              server_name: "drafted-ocr-mcp",
              protocol: "mcp_stdio",
              description: "Drafted OCR spec",
              tools: [
                {
                  name: "drafted_ocr_tool",
                  description: "Drafted synthetic OCR tool.",
                  inputSchema: {
                    type: "object",
                    properties: { document_uri: { type: "string" } },
                    required: ["document_uri"],
                    additionalProperties: false
                  },
                  outputSchema: {
                    type: "object",
                    properties: { ocr_text: { type: "string" } },
                    required: ["ocr_text"],
                    additionalProperties: false
                  },
                  successResponse: { ocr_text: "[SYNTHETIC] drafted OCR text" },
                  errorScenarios: [],
                  latencyMs: 0,
                  riskSignals: [],
                  auditRequired: true
                }
              ],
              guardrails: {
                synthetic_only: true,
                no_private_data: true,
                no_private_endpoint: true,
                no_credentials: true,
                no_production_business_logic: true
              }
            },
            null,
            2
          ) +
          "\n```",
        stdout: "{\"event\":\"fake-draft-complete\"}\n"
      };
    }
  }
});
const startedDraft = await draftRegistry.start({
  mockId: validSpec.mock_id,
  prompt: "Draft a synthetic OCR MCP mock spec.",
  model: "gpt-5.5"
});
assert.equal(startedDraft.status, "running");
assert.equal(startedDraft.pid, null);
const runningDrafts = await store.listDrafts(validSpec.mock_id);
assert.equal(runningDrafts[0].status, "running");
await waitFor(async () => {
  const detail = await readDraftDetail(store, validSpec.mock_id, startedDraft.draft_id);
  assert.equal(detail.summary.status, "completed");
  assert.equal(detail.summary.validation.ok, true);
  assert.equal(detail.draft_spec?.server_name, "drafted-ocr-mcp");
});

const invalidDraftRegistry = new MockDraftRegistry({
  repoRoot,
  store,
  timeoutMs: 5000,
  draftRunner: {
    async run() {
      return {
        command: "fake invalid sdk draft",
        outputText: JSON.stringify({ mock_id: "bad" })
      };
    }
  }
});
const invalidDraft = await invalidDraftRegistry.start({
  mockId: validSpec.mock_id,
  prompt: "Return an invalid mock spec.",
  model: "gpt-5.5"
});
await waitFor(async () => {
  const detail = await readDraftDetail(store, validSpec.mock_id, invalidDraft.draft_id);
  assert.equal(detail.summary.status, "failed");
  assert.equal(detail.summary.validation.ok, false);
  assert.equal(detail.draft_spec, null);
});

const registry = new MockProcessRegistry({ repoRoot, store });
const status = await registry.start(validSpec.mock_id);
assert.equal(status.status, "running");
assert.match(status.command ?? "", /saved mock spec runtime/);
await assert.rejects(() => registry.start(validSpec.mock_id), /already running/);
const listed = await registry.sendJsonRpc(validSpec.mock_id, "tools/list", {});
assert.equal(listed.result.tools[0].name, "bank_document_ocr_mock_adapter");
const called = await registry.sendJsonRpc(validSpec.mock_id, "tools/call", {
  name: "bank_document_ocr_mock_adapter",
  arguments: { document_uri: "synthetic://document/1" }
});
assert.deepEqual(called.result.structuredContent, validSpec.tools[0].successResponse);
assert.match(called.result.content[0].text, /agent-factory-mock-lab/);
const invalidCall = await registry.sendJsonRpc(validSpec.mock_id, "tools/call", {
  name: "bank_document_ocr_mock_adapter",
  arguments: {}
});
assert.equal(invalidCall.error?.code, -32602);
assert.match(invalidCall.error?.message ?? "", /input schema validation failed/);
const auditLog = await readFile(join(repoRoot, "artifacts/mock-lab", validSpec.mock_id, "audit-log.jsonl"), "utf8");
assert.match(auditLog, /tools\/call/);
const stopped = await registry.stop(validSpec.mock_id);
assert.equal(stopped.status, "stopped");

const generatedDraftId = createDraftId(new Date("2026-05-29T01:02:03Z"), "abcdef");
assert.equal(generatedDraftId, "20260529T010203Z-draft-abcdef");
const prompt = buildDraftSpecPrompt({
  mockId: "bank_document_ocr_mock_adapter",
  userPrompt: "Create an OCR mock spec."
});
assert.match(prompt, /Return only one valid MockSpec JSON object/);
assert.match(prompt, /Required server_name: bank_document_ocr_mock_adapter-mcp/);
assert.match(prompt, /errorCode/);
assert.match(prompt, /when must be a JSON object/);
assert.match(prompt, /Create an OCR mock spec/);
assert.doesNotMatch(prompt, /Generate a local MCP stdio mock server from the approved Mock Lab spec/);

await rm(testRoot, { recursive: true, force: true });

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
