import assert from "node:assert/strict";
import { appendCatalogDeltaProposal, parseCatalogDelta } from "./catalogDelta.ts";

const proposedByRegisterDrawer = [
  "proposed_additions:",
  "  - category: adapter",
  "    name: customer_notice_template_mock_adapter",
  "    owner_domain: 고객",
  "    responsibility: 고객 안내 템플릿 preview 를 반환한다.",
  "    rationale: Reuse Hub 신규 등록 제안",
  "    proposed_by: reuse_hub",
  "    proposed_at: 2026-06-13T00:00:00.000Z"
].join("\n");

assert.deepEqual(parseCatalogDelta(proposedByRegisterDrawer), {
  proposals: [
    {
      module_category: "adapter",
      name: "customer_notice_template_mock_adapter",
      owner_domain: "고객",
      responsibility: "고객 안내 템플릿 preview 를 반환한다.",
      rationale: "Reuse Hub 신규 등록 제안",
      proposed_by: "reuse_hub",
      proposed_at: "2026-06-13T00:00:00.000Z"
    }
  ],
  error: null
});

assert.deepEqual(parseCatalogDelta(""), { proposals: [], error: null });
const malformed = parseCatalogDelta("not: [valid");
assert.deepEqual(malformed.proposals, []);
assert.equal(typeof malformed.error, "string");
assert.ok(malformed.error);

const appended = appendCatalogDeltaProposal("notes: keep\n", {
  category: "workflow",
  name: "published_workflow",
  owner_domain: "여신"
});
assert.deepEqual(parseCatalogDelta(appended), {
  proposals: [
    {
      module_category: "workflow",
      name: "published_workflow",
      owner_domain: "여신"
    }
  ],
  error: null
});

const remoteA2aWorkflowDelta = [
  "proposed_additions:",
  "  - category: workflow",
  "    name: remote_review_workflow",
  "    workflow_kind: graph",
  "    owner_domain: analysis",
  "    responsibility: Route review work to an exposed A2A provider.",
  "    component_source: remote_a2a",
  "    runtime_binding: remote_a2a",
  "    a2a_provider_req_id: req-example",
  "    inputs:",
  "      - name: case_id",
  "        type: string",
  "    outputs:",
  "      - name: decision",
  "        type: string",
  "    composition:",
  "      - remote-review-agent"
].join("\n");

assert.deepEqual(parseCatalogDelta(remoteA2aWorkflowDelta), {
  proposals: [
    {
      module_category: "workflow",
      name: "remote_review_workflow",
      workflow_kind: "graph",
      owner_domain: "analysis",
      responsibility: "Route review work to an exposed A2A provider.",
      component_source: "remote_a2a",
      runtime_binding: "remote_a2a",
      a2a_provider_req_id: "req-example",
      inputs: [{ name: "case_id", type: "string" }],
      outputs: [{ name: "decision", type: "string" }],
      composition: ["remote-review-agent"]
    }
  ],
  error: null
});
