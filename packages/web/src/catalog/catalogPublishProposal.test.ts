import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { buildPublishProposal, getRequiredSubtype, subtypeOptions } from "./catalogPublishProposal.ts";
import { parseCatalogDelta, type ProposedAddition } from "./catalogDelta.ts";
import { validatePublishRequest } from "../../server/catalogPublishValidation.ts";

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

const remoteA2aWorkflowProposal: ProposedAddition = {
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
  composition: ["remote-review-agent"],
  risk_signals: ["audit_required"],
  required_before_approval: ["provider Agent Card route verified"],
  contract_status: "a2a_ready",
  source_candidate_id: "workflow-candidate"
};

assert.deepEqual(buildPublishProposal(remoteA2aWorkflowProposal, ""), {
  category: "workflow",
  module_category: "workflow",
  name: "remote_review_workflow",
  owner_domain: "analysis",
  responsibility: "Route review work to an exposed A2A provider.",
  inputs: [{ name: "case_id", type: "string" }],
  outputs: [{ name: "decision", type: "string" }],
  composition: ["remote-review-agent"],
  risk_signals: ["audit_required"],
  required_before_approval: ["provider Agent Card route verified"],
  contract_status: "a2a_ready",
  notes: undefined,
  source_candidate_id: "workflow-candidate",
  component_source: "remote_a2a",
  runtime_binding: "remote_a2a",
  a2a_provider_req_id: "req-example",
  workflow_kind: "graph"
});

const activeWorkflowA2aDelta = readFileSync(
  new URL("./__fixtures__/workflow-a2a-catalog-delta.yaml", import.meta.url),
  "utf8"
);
const activeWorkflowA2aProposal = parseCatalogDelta(activeWorkflowA2aDelta).proposals[0];
assert.ok(activeWorkflowA2aProposal);
const activeWorkflowA2aPublishProposal = buildPublishProposal(
  activeWorkflowA2aProposal,
  activeWorkflowA2aProposal.workflow_kind ?? "graph"
);
assert.deepEqual(
  {
    name: activeWorkflowA2aPublishProposal.name,
    contract_status: activeWorkflowA2aPublishProposal.contract_status,
    component_source: activeWorkflowA2aPublishProposal.component_source,
    runtime_binding: activeWorkflowA2aPublishProposal.runtime_binding,
    a2a_provider_req_id: activeWorkflowA2aPublishProposal.a2a_provider_req_id
  },
  {
    name: "page_recommendation_required_workflow",
    contract_status: "a2a_ready",
    component_source: "remote_a2a",
    runtime_binding: "remote_a2a",
    a2a_provider_req_id: "req-page-recommendation-a2a-consumer"
  }
);
assert.deepEqual(validatePublishRequest("req-page-recommendation-required", activeWorkflowA2aPublishProposal), []);
