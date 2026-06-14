import assert from "node:assert/strict";
import { buildPublishProposal, getRequiredSubtype, subtypeOptions } from "./catalogPublishProposal.ts";
import type { ProposedAddition } from "./catalogDelta.ts";

const adapterProposal: ProposedAddition = {
  module_category: "adapter",
  name: "customer_notice_template_mock_adapter",
  adapter_kind: "template",
  owner_domain: "고객",
  responsibility: "고객 안내 템플릿 preview 를 반환한다.",
  rationale: "Reuse Hub 신규 등록 제안"
};

assert.equal(getRequiredSubtype(adapterProposal), "template");
assert.deepEqual(buildPublishProposal(adapterProposal, ""), {
  category: "adapter",
  module_category: "adapter",
  name: "customer_notice_template_mock_adapter",
  owner_domain: "고객",
  responsibility: "고객 안내 템플릿 preview 를 반환한다.",
  inputs: undefined,
  outputs: undefined,
  composition: undefined,
  notes: "Reuse Hub 신규 등록 제안",
  source_candidate_id: undefined,
  adapter_kind: "template"
});

const workflowProposal: ProposedAddition = {
  module_category: "workflow",
  name: "loan_workflow"
};
assert.equal(getRequiredSubtype(workflowProposal), null);
assert.ok(subtypeOptions(workflowProposal).includes("graph"));
assert.equal(buildPublishProposal(workflowProposal, "graph").workflow_kind, "graph");
