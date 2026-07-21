import assert from "node:assert/strict";
import { appendCatalogDeltaProposal, parseCatalogDelta } from "./catalogDelta.ts";

const targetTool = {
  asset_id: "tool.customer.notice-template",
  asset_type: "tool" as const,
  name: "고객 안내 템플릿 Tool",
  domain_scope: "domain_specific" as const,
  business_domains: ["고객"],
  owner: "AI공통플랫폼팀",
  reuse_status: "publish_candidate" as const,
  capability_tags: ["template"],
  binding: { kind: "function" as const },
  connection: { transport: "in_process" as const },
  workflow_profile: null,
  exposure: null,
  responsibility: "합성 안내문을 생성한다.",
  runtime_mock: {
    synthetic: true,
    preview: "안내문 미리보기"
  },
  proposed_by: "reuse_hub",
  proposed_at: "2026-07-19T00:00:00.000Z"
};

const parsed = parseCatalogDelta(appendCatalogDeltaProposal("notes: keep\n", targetTool));
assert.deepEqual(parsed, { proposals: [targetTool], error: null });
assert.deepEqual(parseCatalogDelta(""), { proposals: [], error: null });

const malformed = parseCatalogDelta("not: [valid");
assert.deepEqual(malformed.proposals, []);
assert.equal(typeof malformed.error, "string");

for (const legacy of [
  { category: "adapter", name: "legacy" },
  { module_category: "tool", name: "legacy" },
  { asset_type: "remote_a2a", asset_id: "remote.legacy", name: "legacy" }
]) {
  assert.deepEqual(
    parseCatalogDelta(appendCatalogDeltaProposal("", legacy)),
    { proposals: [], error: null },
    "legacy or malformed additions are rejected instead of normalized"
  );
}
