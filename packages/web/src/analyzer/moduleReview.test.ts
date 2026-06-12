import assert from "node:assert/strict";
import {
  applyNodeReviewStatus,
  approveCandidate,
  resolveMissingItem,
  setCandidateStatus
} from "./moduleReview.ts";
import type { GraphIR, ModuleCandidate } from "./types.ts";

const reviewedInput = [{ name: "customer_id", type: "string", required: true, schema: {} }];
const reviewedOutput = [{ name: "summary", type: "string", required: true, schema: {} }];

function candidate(overrides: Partial<ModuleCandidate> = {}): ModuleCandidate {
  return {
    id: "mod-review",
    source_requirement_id: "req-review",
    name: "review_agent",
    module_category: "agent",
    agent_kind: "specialist",
    workflow_kind: null,
    adapter_kind: null,
    remote_contract_kind: null,
    confidence: 0.9,
    rationale: "고객 신호를 검토해 요약한다.",
    inputs: reviewedInput,
    outputs: reviewedOutput,
    reuse_candidate: false,
    risk_level: "medium",
    risk_signals: ["human_approval_required"],
    status: "needs_info",
    missing_information: ["입력 출처", "출력 형식"],
    resolved_missing_information: ["기존 항목"],
    missing_information_resolution: "기존 메모",
    developer_todos: [],
    ...overrides
  };
}

function graph(): GraphIR {
  return {
    requirement_id: "req-review",
    graph_id: "graph-review",
    root_workflow_module_id: null,
    nodes: [
      {
        id: "node-1",
        label: "review",
        module_id: "mod-review",
        node_kind: "agent",
        execution_kind: null,
        adk_node_role: "workflow_node",
        owner_scope: "local",
        container_id: null,
        lane_id: "local_graph",
        input_ports: [],
        output_ports: [],
        schema_refs: [],
        review_status: "needs_info"
      },
      {
        id: "node-2",
        label: "other",
        module_id: "other-module",
        node_kind: "adapter",
        execution_kind: null,
        adk_node_role: "workflow_node",
        owner_scope: "local",
        container_id: null,
        lane_id: "local_graph",
        input_ports: [],
        output_ports: [],
        schema_refs: [],
        review_status: "needs_info"
      }
    ],
    edges: [],
    containers: [],
    lanes: [],
    validation: { ok: true, errors: [], warnings: [] }
  };
}

const resolved = resolveMissingItem(candidate(), "입력 출처", "CRM 이벤트로 확인");
assert.deepEqual(resolved.missing_information, ["출력 형식"]);
assert.deepEqual(resolved.resolved_missing_information, ["기존 항목", "입력 출처"]);
assert.equal(resolved.missing_information_resolution, "기존 메모\nCRM 이벤트로 확인");
assert.equal(resolved.status, "needs_info");

const deduped = resolveMissingItem(candidate({ resolved_missing_information: ["입력 출처"] }), "입력 출처");
assert.deepEqual(deduped.resolved_missing_information, ["입력 출처"]);

const resolvedWithoutNote = resolveMissingItem(
  candidate({ missing_information_resolution: undefined, resolved_missing_information: undefined }),
  "입력 출처"
);
assert.equal(resolvedWithoutNote.missing_information_resolution, "");
assert.deepEqual(resolvedWithoutNote.resolved_missing_information, ["입력 출처"]);

const waiting = candidate();
assert.strictEqual(approveCandidate(waiting), waiting);

const approvedAt = new Date("2026-06-12T00:00:00.000Z");
const approved = approveCandidate(
  candidate({
    missing_information: [],
    resolved_missing_information: ["입력 출처", "출력 형식"],
    missing_information_resolution: ""
  }),
  approvedAt
);
assert.equal(approved.status, "approved");
assert.deepEqual(approved.missing_information, []);
assert.ok(approved.missing_information_resolution?.trim());
assert.equal(approved.resolution_applied_at, approvedAt.toISOString());
assert.equal(approved.schema_review_state, "applied");
assert.equal(approved.smoke_spec?.ready, true);
assert.deepEqual(approved.smoke_spec?.synthetic_inputs, { customer_id: "synthetic_string" });
assert.deepEqual(approved.smoke_spec?.expected_output_shape, {
  type: "object",
  properties: { summary: { type: "string" } }
});
assert.deepEqual(approved.smoke_spec?.expected_event_markers, ["mod-review:completed"]);

assert.equal(setCandidateStatus(candidate(), "deferred").status, "deferred");
assert.equal(setCandidateStatus(candidate(), "rejected").status, "rejected");

const syncedGraph = applyNodeReviewStatus(graph(), "mod-review", "approved");
assert.equal(syncedGraph.nodes[0].review_status, "approved");
assert.equal(syncedGraph.nodes[1].review_status, "needs_info");
