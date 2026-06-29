import assert from "node:assert/strict";
import { buildScaffoldPlan } from "./scaffoldPlan.ts";
import { buildRuntimeContracts, runtimeContractReadinessIssues } from "./runtimeContracts.ts";
import type { CatalogEntry } from "../catalog/types.ts";
import type { ModuleCandidate, NormalizedRequirement, ProcessFlow, RuntimeContract } from "./types.ts";

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
assert.equal(runnableModule.model, "hosted_vllm/local-model");
assert.equal(runnableModule.agent_execution_mode, "single_turn");
assert.ok(runnablePlan.manifest.new_code_required[0].reason.includes("카탈로그"));
assert.ok(runnableModule.developer_todos.every((todo) => /검토|구현|매핑|자격|승인/.test(todo)));
assert.ok(
  runnablePlan.validation.warnings.some((warning) => /LlmAgent smoke TODO skeleton/.test(warning)),
  "runnable agent warning must say this is a smoke TODO skeleton"
);
assert.ok(
  runnablePlan.validation.warnings.every((warning) => !/fully implemented|generated as/.test(warning)),
  "runnable warnings must not imply a complete production implementation"
);

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
assert.equal(
  (workflowCallModule as unknown as { invoke_binding?: string | null }).invoke_binding,
  "internal_workflow",
  "workflow_call nodes should default to internal_workflow invoke_binding"
);
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
        invoke_binding: "mcp_tool",
        decision_owner: "workflow_code",
        call_control: "fixed_by_workflow",
        side_effect: "read",
        policy: "audit_required",
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
assert.equal((mockBindingModule as unknown as { invoke_binding?: string | null }).invoke_binding, "mcp_tool");
assert.equal((mockBindingModule as unknown as { decision_owner?: string | null }).decision_owner, "workflow_code");
assert.equal((mockBindingModule as unknown as { call_control?: string | null }).call_control, "fixed_by_workflow");
assert.equal((mockBindingModule as unknown as { side_effect?: string | null }).side_effect, "read");
assert.equal((mockBindingModule as unknown as { policy?: string | null }).policy, "audit_required");
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
assert.ok(
  mockBindingPlan.validation.warnings.some((warning) => /Mock Lab MCP synthetic adapter skeleton/.test(warning)),
  "runnable MCP adapter warning must describe the synthetic skeleton boundary"
);
assert.equal(mockBindingModule.adk_skeleton_contract.implementation_template, "mcp_mock_adapter_stub");

const graphSemanticsPlan = buildScaffoldPlan({
  normalizedRequirement,
  moduleCandidates: [
    candidate({ id: "mod-a", name: "A_agent" }),
    candidate({
      id: "mod-b",
      name: "B_adapter",
      module_category: "adapter",
      agent_kind: null,
      adapter_kind: "data_query",
      inputs: [{ name: "query", type: "string", required: true }],
      outputs: [{ name: "rows", type: "object", required: true }]
    })
  ],
  processFlow: {
    ...flow,
    nodes: [
      {
        id: "node-a",
        label: "A_agent",
        module_id: "mod-a",
        node_kind: "agent",
        execution_kind: "agent",
        adk_node_role: "workflow_node",
        owner_scope: "local",
        container_id: null,
        lane_id: "local_graph",
        input_ports: [],
        output_ports: [],
        schema_refs: [],
        review_status: "approved"
      },
      {
        id: "node-b",
        label: "B_adapter",
        module_id: "mod-b",
        node_kind: "adapter_call",
        execution_kind: "adapter_call",
        adk_node_role: "workflow_node",
        owner_scope: "local",
        container_id: null,
        lane_id: "adapter",
        input_ports: [],
        output_ports: [],
        schema_refs: [],
        // adapter_call is a fixed call node: mcp_tool + fixed_by_workflow.
        // (LLM-selected toolset semantics — mcp_toolset / selected_by_llm —
        // belong on an agent node and are rejected by the validator; covered in
        // validate-artifacts.test.mjs and graphMigration.test.ts.)
        invoke_binding: "mcp_tool",
        decision_owner: "workflow_code",
        call_control: "fixed_by_workflow",
        side_effect: "read",
        policy: "timeout_retry_required",
        input_mapping: { query: "agent_query" },
        output_mapping: { rows: "adapter_rows" },
        review_status: "approved"
      },
      {
        id: "node-router",
        label: "Route",
        module_id: null,
        node_kind: "router",
        execution_kind: null,
        adk_node_role: "synthetic",
        owner_scope: "local",
        container_id: null,
        lane_id: "local_graph",
        input_ports: [],
        output_ports: [],
        schema_refs: [],
        review_status: "n/a"
      }
    ],
    edges: [
      {
        id: "edge-a-b",
        from: "node-a",
        to: "node-b",
        from_port: null,
        to_port: null,
        edge_kind: "session_state",
        execution_semantics: "fan_out",
        data_label: "agent_to_adapter",
        schema_ref: "agent_to_adapter.v1",
        route_condition: null,
        state_key: "agent_query",
        artifact_key: null,
        a2a_contract_id: null,
        is_remote_boundary_crossing: false,
        flow_kind: "fan_out",
        call_control: "fixed_by_workflow"
      },
      {
        id: "edge-route",
        from: "node-router",
        to: "node-b",
        from_port: null,
        to_port: null,
        edge_kind: "route",
        execution_semantics: "conditional",
        data_label: "",
        schema_ref: null,
        route_condition: "choice == approve",
        state_key: null,
        artifact_key: null,
        a2a_contract_id: null,
        is_remote_boundary_crossing: false,
        flow_kind: "route",
        call_control: "fixed_by_workflow",
        route_aliases: ["승인"],
        is_default_route: true
      }
    ]
  },
  catalogEntries: [],
  outputMode: "runnable"
});
assert.equal(graphSemanticsPlan.graph?.nodes.find((node) => node.id === "node-b")?.invoke_binding, "mcp_tool");
assert.equal(graphSemanticsPlan.graph?.nodes.find((node) => node.id === "node-b")?.decision_owner, "workflow_code");
assert.equal(graphSemanticsPlan.graph?.nodes.find((node) => node.id === "node-b")?.call_control, "fixed_by_workflow");
assert.deepEqual(graphSemanticsPlan.modules.find((module) => module.id === "mod-b")?.input_mapping, { query: "agent_query" });
assert.deepEqual(graphSemanticsPlan.modules.find((module) => module.id === "mod-b")?.output_mapping, { rows: "adapter_rows" });
assert.equal(graphSemanticsPlan.graph?.edges[0]?.flow_kind, "fan_out");
assert.equal(graphSemanticsPlan.graph?.edges[0]?.call_control, "fixed_by_workflow");
assert.equal((graphSemanticsPlan.graph?.edges[0] as { state_key?: string | null } | undefined)?.state_key, "agent_query");
assert.equal((graphSemanticsPlan.graph?.edges[0] as { schema_ref?: string | null } | undefined)?.schema_ref, "agent_to_adapter.v1");
const graphSemanticsRouteEdge = graphSemanticsPlan.graph?.edges.find((edge) => edge.id === "edge-route");
assert.deepEqual((graphSemanticsRouteEdge as { route_aliases?: string[] | null } | undefined)?.route_aliases, [
  "승인"
]);
assert.equal((graphSemanticsRouteEdge as { is_default_route?: boolean | null } | undefined)?.is_default_route, true);

const selectedToolsetPlan = buildScaffoldPlan({
  normalizedRequirement,
  moduleCandidates: [
    candidate({
      id: "mod-toolset-adapter",
      name: "LLM 선택 Toolset",
      module_category: "adapter",
      agent_kind: null,
      adapter_kind: "data_query",
      access_protocol: "mcp",
      mcp_server: "mock-toolset",
      mcp_tool_name: "lookup_any",
      inputs: [{ name: "query", type: "string", required: true }],
      outputs: [{ name: "result", type: "object", required: true }]
    })
  ],
  processFlow: {
    ...flow,
    nodes: [
      {
        id: "node-toolset",
        label: "LLM 선택 Toolset",
        module_id: "mod-toolset-adapter",
        node_kind: "adapter_call",
        execution_kind: "adapter_call",
        adk_node_role: "workflow_node",
        owner_scope: "local",
        container_id: null,
        lane_id: "adapter",
        input_ports: [],
        output_ports: [],
        schema_refs: [],
        invoke_binding: "mcp_toolset",
        decision_owner: "llm",
        call_control: "selected_by_llm",
        mock_binding: {
          provider: "mock_lab",
          package_path: "packages/mock-lab",
          mock_server_id: "mock-toolset",
          tool_name: "lookup_any",
          input_schema: null,
          output_schema: null,
          sample_response_ref: null,
          status: "linked"
        },
        adk_skeleton_contract: {
          scaffold_level: "mock_testable_skeleton",
          target_runtime: "adk_python_2_x",
          implementation_template: "mcp_mock_adapter_stub",
          manual_completion_required: true,
          developer_todos: ["stale mock adapter metadata"]
        },
        review_status: "approved"
      }
    ]
  },
  catalogEntries: [],
  outputMode: "runnable"
});
const selectedToolsetModule = selectedToolsetPlan.modules[0];
assert.equal(selectedToolsetModule.mock_binding?.status, "missing");
assert.equal(selectedToolsetModule.adk_skeleton_contract?.scaffold_level, "handoff");
assert.equal(selectedToolsetModule.adk_skeleton_contract?.implementation_template, "adapter_placeholder_stub");

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

const catalogIdFirstPlan = buildScaffoldPlan({
  normalizedRequirement,
  moduleCandidates: [candidate({ name: "renamed_page_agent", catalog_entry_id: "cat-page-agent" })],
  processFlow: flow,
  catalogEntries: [
    catalogEntry({ id: "wrong-name-match", name: "renamed_page_agent", responsibility: "이름 fallback은 legacy 전용입니다." }),
    catalogEntry({ id: "cat-page-agent", name: "catalog_original_agent", responsibility: "ID로 고정된 catalog 계약입니다." })
  ],
  outputMode: "runnable"
});
assert.equal(catalogIdFirstPlan.modules[0].catalog_binding?.catalog_id, "cat-page-agent");
assert.ok(catalogIdFirstPlan.modules[0].instruction?.includes("ID로 고정된 catalog 계약"));

const runtimeContractWithLabelFields: RuntimeContract = {
  contract_id: "rtc-mock-lab-label-fields",
  contract_kind: "mcp_legacy_adapter",
  module_id: "mod-001",
  title: "Mock Lab label-field contract",
  contract_status: "approved",
  summary: "Synthetic Mock Lab contract",
  required_review_fields: ["mock_server_id", "tool_name", "data_policy"],
  reviewer_notes: "",
  runtime_support: {
    context_manager_required: false,
    callback_broker_required: false,
    human_approval_required: false,
    idempotency_required: false,
    audit_required: true,
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
    data_policy: "Synthetic data only"
  },
  graph_ir_annotations: {
    mock_server_id: "wf-page-recommendation-mock",
    tool_name: "search_page_candidates"
  },
  synthetic_examples: [],
  developer_todos: []
};
const normalizedContracts = buildRuntimeContracts({
  normalizedRequirement,
  moduleCandidates: [],
  existingContracts: [runtimeContractWithLabelFields]
});
assert.deepEqual(normalizedContracts[0].required_review_fields, [
  "graph_ir_annotations.mock_server_id",
  "graph_ir_annotations.tool_name",
  "policies.data_policy"
]);
assert.deepEqual(runtimeContractReadinessIssues(normalizedContracts[0]), []);

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

// --- dynamic workflow stays smoke-only: runnable plans block before generation ---
// The runnable ADK generator rejects dynamic workflow modules and
// `dynamic_workflow` containers. The scaffold plan must mirror that so the Build
// gate (`can_generate_source`) never offers a runnable plan the generator refuses.
const dynamicWorkflowCandidate = candidate({
  id: "mod-dynamic-wf",
  name: "이탈위험 동적 Workflow",
  module_category: "workflow",
  agent_kind: null,
  workflow_kind: "dynamic"
});
const dynamicRunnablePlan = buildScaffoldPlan({
  normalizedRequirement,
  moduleCandidates: [dynamicWorkflowCandidate],
  processFlow: {
    ...flow,
    containers: [
      {
        id: "container-dynamic",
        module_id: null,
        label: "Dynamic region",
        container_kind: "dynamic_workflow",
        adk_mapping: null,
        contains_node_ids: [],
        entry_node_ids: [],
        exit_node_ids: [],
        layout_policy: "free",
        parent_container_id: null
      }
    ]
  },
  catalogEntries: [],
  outputMode: "runnable"
});
assert.equal(
  dynamicRunnablePlan.validation.can_generate_source,
  false,
  "runnable plan with a dynamic workflow module must not be generatable"
);
assert.ok(
  dynamicRunnablePlan.validation.blockers.some((b) => b.includes("Dynamic Workflow") && b.includes("workflow_call")),
  "dynamic workflow module should produce a workflow_call redirect blocker"
);
assert.ok(
  dynamicRunnablePlan.validation.blockers.some((b) => b.includes("dynamic_workflow container")),
  "dynamic_workflow container should produce a blocker"
);

// Smoke mode keeps dynamic workflows as a design/contract handoff — no dynamic blocker.
const dynamicSmokePlan = buildScaffoldPlan({
  normalizedRequirement,
  moduleCandidates: [dynamicWorkflowCandidate],
  processFlow: flow,
  catalogEntries: [],
  outputMode: "smoke"
});
assert.ok(
  dynamicSmokePlan.validation.blockers.every((b) => !b.includes("Dynamic Workflow")),
  "smoke mode must not block a dynamic workflow handoff"
);
