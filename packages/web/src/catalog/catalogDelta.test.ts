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
