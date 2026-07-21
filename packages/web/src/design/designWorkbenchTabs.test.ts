import assert from "node:assert/strict";
import { runtimeContractReadinessIssues } from "../analyzer/runtimeContracts.ts";
import type { RuntimeContract } from "../analyzer/types.ts";
import { DESIGN_BOTTOM_TABS, nextDesignBottomTabAfterAssetSelect } from "./designWorkbenchTabs.ts";
import {
  applyRuntimeContractEditorDraft,
  createDefaultAsyncResumePolicy,
  createDefaultAsyncResumeSideEffectGuard,
  createRuntimeContractEditorDraft,
  hasRuntimeContractEditorDraftChanges,
  runtimeContractGraphAnnotationKeys,
  updateRuntimeContractGraphAnnotation
} from "./RuntimeContractEditorModel.ts";

assert.deepEqual(
  DESIGN_BOTTOM_TABS.map((tab) => [tab.id, tab.label]),
  [
    ["assets", "Assets"],
    ["runtime", "Runtime 계약"],
    ["a2a", "A2A 계약"],
    ["reviewNotes", "검토 메모"]
  ],
  "design bottom tabs should expose only the user-facing review tabs"
);

assert.equal(
  nextDesignBottomTabAfterAssetSelect("assets"),
  "assets",
  "selecting another asset keeps the Assets tab active"
);
assert.equal(
  nextDesignBottomTabAfterAssetSelect("runtime"),
  "runtime",
  "asset selection should not force the bottom panel away from the user's current tab"
);
assert.equal(
  nextDesignBottomTabAfterAssetSelect("reviewNotes"),
  "reviewNotes",
  "asset selection should preserve the review notes tab when it is active"
);

const graphAnnotationContract: RuntimeContract = {
  contract_id: "rtc-route-alias-review",
  contract_kind: "adk_callback",
  asset_id: "asset-route-review",
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

const asyncResumeContract: RuntimeContract = {
  ...graphAnnotationContract,
  contract_id: "rtc-human-resume",
  contract_kind: "async_resume",
  contract_status: "needs_info",
  identifiers: ["review-interrupt-001"],
  required_review_fields: ["resume_policy", "side_effect_guard"],
  runtime_support: {
    ...graphAnnotationContract.runtime_support,
    human_approval_required: true,
    idempotency_required: true
  },
  operation: {
    operation_type: "approval",
    side_effect_level: "write",
    callback_expected: false,
    async_resume_required: true
  },
  resume_policy: null,
  side_effect_guard: null
};
const asyncResumeDraft = createRuntimeContractEditorDraft(asyncResumeContract);
const structuredAsyncResumeDraft = {
  ...asyncResumeDraft,
  resume_policy: createDefaultAsyncResumePolicy(asyncResumeContract),
  side_effect_guard: {
    ...createDefaultAsyncResumeSideEffectGuard(),
    tool_ref: "tool.synthetic-write",
    idempotency_key_input: "change_id"
  }
};
const structuredAsyncResume = applyRuntimeContractEditorDraft(asyncResumeContract, structuredAsyncResumeDraft);

assert.equal(structuredAsyncResume.resume_policy?.interrupt_id, "review-interrupt-001");
assert.equal(structuredAsyncResume.resume_policy?.timeout_seconds, 60);
assert.equal(structuredAsyncResume.side_effect_guard?.delivery_semantics, "at_most_once");
assert.equal(structuredAsyncResume.side_effect_guard?.ledger_scope, "session_state");
assert.equal(hasRuntimeContractEditorDraftChanges(asyncResumeContract, structuredAsyncResumeDraft), true);
assert.deepEqual(
  runtimeContractReadinessIssues({ ...structuredAsyncResume, contract_status: "approved" }),
  [],
  "a fully structured async-resume draft should be approval-ready"
);
