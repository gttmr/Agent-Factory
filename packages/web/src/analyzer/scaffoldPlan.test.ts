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
assert.ok(runnablePlan.manifest.new_code_required[0].reason.includes("카탈로그"));
assert.ok(runnableModule.developer_todos.every((todo) => /검토|구현|매핑|자격|승인/.test(todo)));

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
