import { appendNodeToContainer, rootWorkflowContainerId } from "../graph/containerMembership";
import { type AnalysisResult, type FieldSpec, type GraphNode, type ModuleCandidate, type WorkflowKind } from "./types";
import type { CatalogHubEntry } from "../catalog/catalogIndex";

const REQUIREMENT_ID_PATTERN = /^req-[a-z0-9-]+$/;
type CatalogField = NonNullable<CatalogHubEntry["inputs"]>[number] & { schema?: FieldSpec["schema"] };

export function insertCatalogWorkflowNode(
  analysis: AnalysisResult,
  entry: CatalogHubEntry,
  reqId: string
): AnalysisResult {
  if (!analysis.processFlow) return analysis;

  const slug = slugForId(entry.name) || slugForId(entry.id) || "catalog-workflow";
  const candidateId = uniqueId(`mod-${slug}`, new Set(analysis.moduleCandidates.map((candidate) => candidate.id)));
  const rootContainerId = rootWorkflowContainerId(analysis.processFlow);
  const nodeId = uniqueId(`node-${slug}`, new Set((analysis.processFlow.nodes ?? []).map((node) => node.id)));

  const candidate: ModuleCandidate = {
    id: candidateId,
    source_requirement_id: sourceRequirementIdForInsertedCandidate(analysis, reqId),
    catalog_entry_id: entry.id,
    name: entry.name,
    module_category: "workflow",
    agent_kind: null,
    workflow_kind: normalizeWorkflowKind(entry.workflow_kind),
    adapter_kind: null,
    remote_contract_kind: null,
    legacy_recommended_type: "",
    confidence: 0.8,
    rationale: entry.responsibility?.trim() || "카탈로그 workflow 를 현재 설계 Graph IR 에 재사용 노드로 삽입합니다.",
    // adk_hints 는 optional. 빈 문자열 hint 는 서버 validateAnalysisResult 의
    // "비어 있지 않은 문자열 또는 null" 규칙을 위반하므로 아예 생략한다(undefined → 통과).
    inputs: copyFields(entry.inputs),
    outputs: copyFields(entry.outputs),
    reuse_candidate: true,
    risk_level: "low",
    risk_signals: [],
    status: "needs_info",
    missing_information: [],
    side_effect: "none",
    auth_required: false,
    audit_required: false,
    citation_required: false,
    grounding_required: false,
    source_acl_required: false,
    versioned: typeof entry.version === "number",
    effective_date_required: false,
    owner_domain: entry.owner_domain ?? "",
    owner: "",
    agent_card: "",
    auth: "",
    task_lifecycle: "",
    timeout: "",
    retry: "",
    fallback: "",
    audit: "",
    data_policy: "",
    a2a_contract_id: null
  };

  const node: GraphNode = {
    id: nodeId,
    label: entry.name,
    module_id: candidateId,
    node_kind: "workflow_call",
    execution_kind: "workflow_call",
    agent_execution_mode: null,
    adk_node_role: "workflow_node",
    owner_scope: "local",
    container_id: rootContainerId,
    lane_id: "local_graph",
    input_ports: [{ id: "input", label: "input", schema_ref: workflowSchemaRef(entry, "input") }],
    output_ports: [{ id: "output", label: "output", schema_ref: workflowSchemaRef(entry, "output") }],
    schema_refs: [workflowSchemaRef(entry, "input"), workflowSchemaRef(entry, "output")],
    review_status: "needs_info",
    position: null,
    workflow_ref: {
      id: entry.id,
      version: typeof entry.version === "number" ? `v${entry.version}` : null,
      source: "catalog",
      display_name: entry.name
    },
    input_mapping: {},
    output_mapping: {},
    runtime_binding: "workflow_call",
    adk_skeleton_contract: {
      scaffold_level: "mock_testable_skeleton",
      target_runtime: "adk_python_2_x",
      implementation_template: "workflow_call_stub",
      manual_completion_required: true,
      developer_todos: ["target workflow skeleton 연결 방식 확인", "input/output schema mapping 검토"]
    }
  };

  return {
    ...analysis,
    moduleCandidates: [...analysis.moduleCandidates, candidate],
    processFlow: {
      ...analysis.processFlow,
      nodes: [...(analysis.processFlow.nodes ?? []), node],
      containers: rootContainerId
        ? appendNodeToContainer(analysis.processFlow.containers ?? [], rootContainerId, nodeId)
        : analysis.processFlow.containers
    }
  };
}

function normalizeWorkflowKind(value: unknown): WorkflowKind {
  return value === "orchestration" || value === "graph" ? value : "graph";
}

function workflowSchemaRef(entry: CatalogHubEntry, direction: "input" | "output"): string {
  const version = typeof entry.version === "number" ? `v${entry.version}` : "v1";
  const name = entry.name.replace(/[^A-Za-z0-9]+/g, "_").replace(/^_+|_+$/g, "") || "workflow";
  return `catalog.workflow.${name}.${direction}.${version}`;
}

function sourceRequirementIdForInsertedCandidate(analysis: AnalysisResult, reqId: string): string {
  const normalizedId = analysis.normalizedRequirement?.id;
  return typeof normalizedId === "string" && REQUIREMENT_ID_PATTERN.test(normalizedId) ? normalizedId : reqId;
}

function copyFields(fields: CatalogField[] | undefined): FieldSpec[] {
  return (fields ?? []).map((field) => {
    const copied: FieldSpec = {
      name: field.name,
      type: field.type,
      required: field.required ?? false
    };
    if (field.schema !== undefined) {
      copied.schema = structuredClone(field.schema);
    }
    return copied;
  });
}

function uniqueId(base: string, used: Set<string>): string {
  if (!used.has(base)) return base;
  let suffix = 2;
  while (used.has(`${base}-${suffix}`)) {
    suffix += 1;
  }
  return `${base}-${suffix}`;
}

function slugForId(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
