import assert from "node:assert/strict";
import { insertCatalogWorkflowNode } from "./nestedWorkflowInsert.ts";
import type { AnalysisResult, GraphIR } from "./types.ts";
import type { CatalogHubEntry } from "../catalog/catalogIndex.ts";

function baseGraph(): GraphIR {
  return {
    requirement_id: "req-round-b",
    graph_id: "graph-001",
    root_workflow_module_id: null,
    nodes: [
      {
        id: "node-input",
        label: "Input",
        module_id: null,
        node_kind: "input",
        execution_kind: null,
        adk_node_role: null,
        owner_scope: "local",
        container_id: "container-root",
        lane_id: "input",
        input_ports: [],
        output_ports: [],
        schema_refs: [],
        review_status: "n/a",
        position: null
      }
    ],
    edges: [],
    containers: [
      {
        id: "container-root",
        module_id: null,
        label: "Root graph workflow",
        container_kind: "graph_workflow",
        adk_mapping: null,
        contains_node_ids: ["node-input"],
        entry_node_ids: ["node-input"],
        exit_node_ids: [],
        layout_policy: "dag_with_routes",
        parent_container_id: null
      }
    ],
    lanes: [
      { id: "input", label: "input" },
      { id: "local_graph", label: "local_graph" }
    ],
    validation: { ok: true, errors: [], warnings: [] }
  };
}

function baseAnalysis(processFlow: GraphIR | null = baseGraph()): AnalysisResult {
  return {
    normalizedRequirement: {
      id: "req-round-b",
      title: "Round B",
      raw_text: "Insert catalog workflow",
      domain: "공통",
      requester: { team: "platform", role: "reviewer" },
      business_goal: "Insert reusable workflow",
      current_process: [],
      inputs: [],
      outputs: [],
      systems: [],
      risk_signals: [],
      missing_information: [],
      contradictions: [],
      status: "draft"
    },
    evidence: {
      requested_goal: "Insert reusable workflow",
      business_domain_hint: "공통",
      user_role: "reviewer",
      input_data: [],
      output_data: [],
      systems_mentioned: [],
      decisions_implied: [],
      risk_signals: [],
      missing_information: [],
      contradictions: [],
      assumptions: []
    },
    moduleCandidates: [
      {
        id: "mod-credit-review",
        source_requirement_id: "req-round-b",
        name: "Credit Review",
        module_category: "workflow",
        workflow_kind: "graph",
        confidence: 0.7,
        rationale: "Existing candidate",
        inputs: [],
        outputs: [],
        reuse_candidate: false,
        risk_level: "low",
        risk_signals: [],
        status: "approved",
        missing_information: []
      }
    ],
    a2aContracts: [],
    runtimeContracts: [],
    processFlow: processFlow as AnalysisResult["processFlow"]
  };
}

const entry: CatalogHubEntry = {
  id: "workflow:Credit Review",
  category: "workflow",
  name: "Credit Review",
  workflow_kind: "dynamic",
  owner_domain: "여신",
  version: 3,
  status: "published",
  responsibility: "카탈로그에 등록된 여신 검토 workflow 를 재사용한다.",
  inputs: [{ name: "application", type: "object", required: true }],
  outputs: [{ name: "decision", type: "object", required: true }]
};

const inserted = insertCatalogWorkflowNode(baseAnalysis(), entry, "req-round-b");
const candidate = inserted.moduleCandidates[inserted.moduleCandidates.length - 1];

assert.ok(candidate, "candidate should be appended");
assert.match(candidate.id, /^mod-[a-z0-9-]+$/);
assert.equal(candidate.id, "mod-credit-review-2");
assert.equal(candidate.module_category, "workflow");
assert.equal(candidate.workflow_kind, "dynamic");
assert.equal(candidate.catalog_entry_id, entry.id);
assert.equal(candidate.reuse_candidate, true);
assert.equal(candidate.name, entry.name);
assert.equal(candidate.rationale, entry.responsibility);
assert.deepEqual(candidate.inputs, [{ name: "application", type: "object", required: true }]);
assert.deepEqual(candidate.outputs, [{ name: "decision", type: "object", required: true }]);
assert.equal(candidate.risk_level, "low");
assert.deepEqual(candidate.risk_signals, []);
assert.equal(candidate.source_requirement_id, "req-round-b");
assert.equal(candidate.confidence, 0.8);
assert.equal(candidate.owner_domain, entry.owner_domain);
assert.equal(candidate.versioned, true);
// 회귀 가드: adk_hints 를 빈 문자열로 채우면 서버 validateAnalysisResult 가
// "비어 있지 않은 문자열 또는 null" 규칙으로 거부한다. 삽입 후보는 adk_hints 를 생략해야 한다.
assert.equal(candidate.adk_hints, undefined);
assert.equal(candidate.status, "needs_info");
assert.deepEqual(candidate.missing_information, []);

const node = inserted.processFlow.nodes.find((item) => item.module_id === candidate.id);
assert.ok(node, "workflow graph node should be appended");
assert.equal(node.id, "node-credit-review");
assert.equal(node.node_kind, "workflow");
assert.equal(node.module_id, candidate.id);
assert.equal(node.label, entry.name);
assert.equal(node.lane_id, "local_graph");
assert.equal(node.owner_scope, "local");
assert.equal(node.execution_kind, "workflow");
assert.equal(node.review_status, "needs_info");
assert.deepEqual(node.input_ports, []);
assert.deepEqual(node.output_ports, []);
assert.deepEqual(node.schema_refs, []);
assert.equal(node.position, null);
assert.equal(node.container_id, "container-root");
assert.ok(
  inserted.processFlow.containers
    .find((container) => container.id === "container-root")
    ?.contains_node_ids.includes(node.id)
);

const nullFlowAnalysis = baseAnalysis(null);
const guarded = insertCatalogWorkflowNode(nullFlowAnalysis, entry, "req-round-b");
assert.equal(guarded, nullFlowAnalysis);
