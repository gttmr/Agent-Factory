import assert from "node:assert/strict";
import { buildScaffoldPlan } from "./scaffoldPlan.ts";
import type { CatalogEntry } from "../catalog/types.ts";
import type { ModuleCandidate, NormalizedRequirement, ProcessFlow } from "./types.ts";

const normalizedRequirement: NormalizedRequirement = {
  id: "req-ko-defaults",
  title: "페이지 추천 워크플로우",
  raw_text: "사용자 CDP 데이터를 바탕으로 추천 페이지를 고른다.",
  domain: "공통",
  requester: { team: "마케팅", role: "기획자" },
  business_goal: "사용자에게 적합한 페이지를 추천한다.",
  current_process: [],
  inputs: [],
  outputs: [],
  systems: [],
  risk_signals: [],
  missing_information: [],
  contradictions: [],
  status: "approved"
};

const flow: ProcessFlow = {
  requirement_id: "req-ko-defaults",
  graph_id: "graph-req-ko-defaults",
  root_workflow_module_id: null,
  nodes: [],
  edges: [],
  containers: [],
  lanes: [],
  validation: { ok: true, errors: [], warnings: [] }
};

const reviewedInput = [{ name: "user_segment", type: "string", required: true, schema: {} }];
const reviewedOutput = [{ name: "recommended_page", type: "string", required: true, schema: {} }];

function candidate(overrides: Partial<ModuleCandidate> = {}): ModuleCandidate {
  return {
    id: "mod-001",
    source_requirement_id: "req-ko-defaults",
    name: "page_recommendation_agent",
    module_category: "agent",
    agent_kind: "specialist",
    workflow_kind: null,
    adapter_kind: null,
    remote_contract_kind: null,
    confidence: 0.9,
    rationale: "CDP 신호를 해석해 추천 페이지 후보를 좁힌다.",
    inputs: reviewedInput,
    outputs: reviewedOutput,
    reuse_candidate: false,
    risk_level: "low",
    risk_signals: [],
    status: "approved",
    missing_information: [],
    developer_todos: [],
    smoke_spec: {
      sample_user_message: "신규 방문자에게 보여줄 페이지를 추천해줘.",
      synthetic_inputs: { user_segment: "new_visitor" },
      expected_output_shape: {},
      expected_event_markers: [],
      mock_sources: [],
      ready: true
    },
    ...overrides
  };
}

function catalogEntry(overrides: Partial<CatalogEntry> = {}): CatalogEntry {
  return {
    id: "cat-page-agent",
    name: "page_recommendation_agent",
    module_category: "agent",
    agent_kind: "specialist",
    component_source: "stub",
    responsibility: "검토된 CDP 신호만 사용해 추천 페이지를 설명한다.",
    inputs: reviewedInput,
    outputs: reviewedOutput,
    risk_signals: [],
    provenance: "seeded",
    ...overrides
  };
}

const runnablePlan = buildScaffoldPlan({
  normalizedRequirement,
  moduleCandidates: [candidate()],
  processFlow: flow,
  catalogEntries: [],
  outputMode: "runnable"
});

const runnableModule = runnablePlan.modules[0];
assert.ok(runnableModule.instruction?.includes("당신은"), "agent instruction must be Korean-first");
assert.ok(runnableModule.instruction?.includes("입력"), "agent instruction must describe inputs in Korean");
assert.ok(runnableModule.instruction?.includes("출력"), "agent instruction must describe outputs in Korean");
assert.ok(runnableModule.instruction?.includes("검토된 synthetic 입력"), "guardrail must be Korean-first");
assert.doesNotMatch(runnableModule.instruction ?? "", /You are|Responsibility|Inputs you receive|Outputs you must produce/);
assert.equal(runnableModule.agent_execution_mode, "single_turn");
assert.ok(runnablePlan.manifest.new_code_required[0].reason.includes("카탈로그"));
assert.ok(runnableModule.developer_todos.every((todo) => /검토|구현|매핑|자격|승인/.test(todo)));

const chatPlan = buildScaffoldPlan({
  normalizedRequirement,
  moduleCandidates: [candidate()],
  processFlow: {
    ...flow,
    nodes: [
      {
        id: "node-agent",
        label: "page_recommendation_agent",
        module_id: "mod-001",
        node_kind: "agent",
        execution_kind: "agent",
        agent_execution_mode: "chat",
        adk_node_role: "workflow_node",
        owner_scope: "local",
        container_id: null,
        lane_id: "local_graph",
        input_ports: [],
        output_ports: [],
        schema_refs: [],
        review_status: "approved"
      }
    ]
  },
  catalogEntries: [],
  outputMode: "runnable"
});
assert.equal(chatPlan.modules[0].agent_execution_mode, "chat");

const workflowCallPlan = buildScaffoldPlan({
  normalizedRequirement,
  moduleCandidates: [
    candidate({
      id: "mod-risk-workflow",
      name: "이탈위험 판단 Workflow",
      module_category: "workflow",
      agent_kind: null,
      workflow_kind: "graph",
      inputs: [{ name: "customer_id", type: "string", required: true }],
      outputs: [{ name: "risk_result", type: "object", required: true }]
    })
  ],
  processFlow: {
    ...flow,
    nodes: [
      {
        id: "node-risk-workflow",
        label: "이탈위험 판단 Workflow 호출",
        module_id: "mod-risk-workflow",
        node_kind: "workflow_call",
        execution_kind: "workflow_call",
        adk_node_role: "workflow_node",
        owner_scope: "local",
        container_id: null,
        lane_id: "local_graph",
        input_ports: [],
        output_ports: [],
        schema_refs: [],
        workflow_ref: { id: "wf-risk-check", version: "v1", source: "catalog", display_name: "이탈위험 판단 Workflow" },
        input_mapping: { customer_id: "$state.customer.id" },
        output_mapping: { risk_result: "$result" },
        review_status: "approved"
      }
    ]
  },
  catalogEntries: [],
  outputMode: "runnable"
});
const workflowCallModule = workflowCallPlan.modules[0];
assert.ok(workflowCallModule);
assert.ok(workflowCallModule.adk_skeleton_contract);
assert.equal(workflowCallModule.node_kind, "workflow_call");
assert.deepEqual(workflowCallModule.workflow_ref, {
  id: "wf-risk-check",
  version: "v1",
  source: "catalog",
  display_name: "이탈위험 판단 Workflow"
});
assert.equal(workflowCallModule.adk_skeleton_contract.scaffold_level, "mock_testable_skeleton");
assert.equal(workflowCallModule.adk_skeleton_contract.implementation_template, "workflow_call_stub");
assert.ok(workflowCallModule.developer_todos.some((todo) => todo.includes("workflow_call")));

const mockBindingPlan = buildScaffoldPlan({
  normalizedRequirement,
  moduleCandidates: [
    candidate({
      id: "mod-customer-profile",
      name: "고객 프로파일 조회",
      module_category: "adapter",
      agent_kind: null,
      adapter_kind: "legacy_api",
      access_protocol: "mcp",
      mcp_server: "mock-customer-profile",
      mcp_tool_name: "get_customer_profile",
      mcp_schema_ref: "catalog.customer_profile_request.v1",
      outputs: [{ name: "profile", type: "object", required: true }]
    })
  ],
  processFlow: {
    ...flow,
    nodes: [
      {
        id: "node-profile",
        label: "고객 프로파일 조회",
        module_id: "mod-customer-profile",
        node_kind: "adapter_call",
        execution_kind: "adapter_call",
        adk_node_role: "workflow_node",
        owner_scope: "local",
        container_id: null,
        lane_id: "adapter",
        input_ports: [],
        output_ports: [],
        schema_refs: [],
        runtime_binding: "mcp_tool",
        mock_binding: {
          provider: "mock_lab",
          package_path: "packages/mock-lab",
          mock_server_id: "mock-customer-profile",
          tool_name: "get_customer_profile",
          input_schema: "catalog.customer_profile_request.v1",
          output_schema: "catalog.customer_profile_response.v1",
          sample_response_ref: "mock_samples.customer_profile.basic",
          status: "linked"
        },
        review_status: "approved"
      }
    ]
  },
  catalogEntries: [],
  outputMode: "runnable"
});
const mockBindingModule = mockBindingPlan.modules[0];
assert.ok(mockBindingModule);
assert.ok(mockBindingModule.adk_skeleton_contract);
assert.equal(mockBindingModule.node_kind, "adapter_call");
assert.equal(mockBindingModule.runtime_binding, "mcp_tool");
assert.deepEqual(mockBindingModule.mock_binding, {
  provider: "mock_lab",
  package_path: "packages/mock-lab",
  mock_server_id: "mock-customer-profile",
  tool_name: "get_customer_profile",
  input_schema: "catalog.customer_profile_request.v1",
  output_schema: "catalog.customer_profile_response.v1",
  sample_response_ref: "mock_samples.customer_profile.basic",
  status: "linked"
});
assert.equal(mockBindingModule.adk_skeleton_contract.implementation_template, "mcp_mock_adapter_stub");

const catalogPlan = buildScaffoldPlan({
  normalizedRequirement,
  moduleCandidates: [candidate({ catalog_entry_id: "cat-page-agent" })],
  processFlow: flow,
  catalogEntries: [catalogEntry()],
  outputMode: "runnable"
});

assert.ok(catalogPlan.modules[0].instruction?.includes("검토된 CDP 신호"));
assert.ok(catalogPlan.modules[0].developer_todos.every((todo) => /catalog|런타임|입력|출력/.test(todo)));
assert.ok(catalogPlan.validation.warnings.every((warning) => !/generated as|runtime-wiring TODO/.test(warning)));

// --- root workflow candidate exclusion ---
// The root workflow (root_workflow_module_id) maps to the generated Workflow itself
// (no graph node), so it must not become a scaffold module or a needs-info blocker.
const rootFlow: ProcessFlow = { ...flow, root_workflow_module_id: "mod-root" };
const rootWorkflowCandidate = candidate({
  id: "mod-root",
  name: "case_graph_workflow",
  module_category: "workflow",
  agent_kind: null,
  workflow_kind: "graph",
  status: "needs_info",
  missing_information: ["루프 정책 확정"]
});
const childCandidate = candidate({ id: "mod-002", name: "child_agent" });
const rootPlan = buildScaffoldPlan({
  normalizedRequirement,
  moduleCandidates: [rootWorkflowCandidate, childCandidate],
  processFlow: rootFlow,
  catalogEntries: [],
  outputMode: "runnable"
});
assert.deepEqual(rootPlan.modules.map((m) => m.id), ["mod-002"], "root workflow candidate must be excluded from scaffold modules");
assert.ok(rootPlan.excluded_modules.some((m) => m.id === "mod-root"), "root workflow candidate should be listed in excluded_modules");
assert.ok(
  rootPlan.validation.blockers.every((b) => !b.includes("정보 필요 후보")),
  "root workflow's needs_info must not produce a scaffold blocker"
);
assert.equal(rootPlan.validation.can_generate_source, true, "plan with the root excluded and an approved child should be generatable");
