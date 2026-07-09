import assert from "node:assert/strict";
import { runtimeContractReadinessIssues } from "../analyzer/runtimeContracts.ts";
import type { RuntimeContract } from "../analyzer/types.ts";
import { DESIGN_BOTTOM_TABS, nextDesignBottomTabAfterModuleSelect } from "./designWorkbenchTabs.ts";
import {
  applyRuntimeContractEditorDraft,
  createRuntimeContractEditorDraft,
  runtimeContractGraphAnnotationKeys,
  updateRuntimeContractGraphAnnotation
} from "./RuntimeContractEditorModel.ts";

assert.deepEqual(
  DESIGN_BOTTOM_TABS.map((tab) => [tab.id, tab.label]),
  [
    ["modules", "모듈"],
    ["runtime", "Runtime 계약"],
    ["a2a", "Remote A2A"],
    ["reviewNotes", "검토 메모"]
  ],
  "design bottom tabs should expose only the user-facing review tabs"
);

assert.equal(
  nextDesignBottomTabAfterModuleSelect("modules"),
  "modules",
  "selecting another module from the module list should keep the Modules tab active"
);
assert.equal(
  nextDesignBottomTabAfterModuleSelect("runtime"),
  "runtime",
  "module selection should not force the bottom panel away from the user's current tab"
);
assert.equal(
  nextDesignBottomTabAfterModuleSelect("reviewNotes"),
  "reviewNotes",
  "module selection should preserve the review notes tab when it is active"
);

const graphAnnotationContract: RuntimeContract = {
  contract_id: "rtc-route-alias-review",
  contract_kind: "adk_callback",
  module_id: "mod-route-review",
  title: "Route alias review",
  contract_status: "approved",
  summary: "Graph IR annotation review fixture",
  required_review_fields: ["graph_ir_annotations.route_alias_review"],
  reviewer_notes: "",
  runtime_support: {
    context_manager_required: false,
    callback_broker_required: false,
    human_approval_required: false,
    idempotency_required: false,
    audit_required: false,
    compensation_required: false
  },
  operation: {
    operation_type: "read",
    side_effect_level: "read_only",
    callback_expected: false,
    async_resume_required: false
  },
  identifiers: [],
  policies: {
    auth_policy: "synthetic only",
    timeout_policy: "local smoke",
    retry_policy: "none",
    fallback_policy: "manual review",
    masking_policy: "synthetic",
    data_policy: "synthetic only"
  },
  graph_ir_annotations: {
    mock_server_id: "wf-page-recommendation-mock"
  },
  synthetic_examples: [],
  developer_todos: []
};

const graphAnnotationDraft = createRuntimeContractEditorDraft(graphAnnotationContract);
const graphAnnotationKey = "route_alias_review";

assert.ok(
  runtimeContractReadinessIssues(graphAnnotationContract).some((issue) =>
    issue.includes(`graph_ir_annotations.${graphAnnotationKey}`)
  ),
  "missing required graph_ir_annotations value should block readiness"
);
assert.deepEqual(runtimeContractGraphAnnotationKeys(graphAnnotationContract), [
  graphAnnotationKey,
  "mock_server_id"
]);

const savedGraphAnnotationContract = applyRuntimeContractEditorDraft(graphAnnotationContract, {
  ...graphAnnotationDraft,
  graph_ir_annotations: updateRuntimeContractGraphAnnotation(
    graphAnnotationDraft.graph_ir_annotations,
    graphAnnotationKey,
    "Graph IR 라우트 alias 검토 완료"
  )
});

assert.deepEqual(runtimeContractReadinessIssues(savedGraphAnnotationContract), []);
assert.equal(
  savedGraphAnnotationContract.graph_ir_annotations[graphAnnotationKey],
  "Graph IR 라우트 alias 검토 완료"
);
