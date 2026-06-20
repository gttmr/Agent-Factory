// Controlled by GraphEditState.draft: field changes update the live draft immediately.
// The canvas toolbar owns whole-graph save/cancel, so this form keeps no mirror state.
import type { ReactNode } from "react";
import {
  AGENT_EXECUTION_MODES,
  GRAPH_CALL_CONTROLS,
  GRAPH_DECISION_OWNERS,
  GRAPH_EDGE_KINDS,
  GRAPH_EXECUTION_SEMANTICS,
  GRAPH_FLOW_KINDS,
  GRAPH_INVOKE_BINDINGS,
  GRAPH_LANE_IDS,
  type AgentExecutionMode,
  type A2AContract,
  type EdgeKind,
  type ExecutionSemantics,
  type GraphCallControl,
  type GraphDecisionOwner,
  type GraphEdge,
  type GraphFlowKind,
  type GraphInvokeBinding,
  type GraphNode,
  type LaneId,
  type ModuleCandidate,
  type ModuleCategory,
  type NodeKind
} from "../analyzer/types";
import { CategoryBadge } from "./CategoryBadge";
import type { GraphEditState } from "./GraphCanvas";
import { Button, Field, SelectField, TextareaField } from "../ui/primitives";

interface GraphElementEditorProps {
  editState: GraphEditState;
  moduleCandidates: ModuleCandidate[];
  a2aContracts: A2AContract[];
  onClose: () => void;
}

const MODULE_NODE_KINDS = new Set([
  "agent",
  "workflow",
  "workflow_call",
  "adapter",
  "adapter_call",
  "remote_a2a",
  "remote_agent_call"
]);
const STATE_EDGE_KINDS = new Set(["session_state", "temp_state", "user_state", "app_state"]);

const NODE_KIND_LABEL: Record<NodeKind, string> = {
  input: "입력",
  output: "출력",
  agent: "판단",
  function: "함수",
  tool: "도구",
  adapter: "Adapter",
  adapter_call: "API/도구 호출",
  human_input: "사람 입력/승인",
  callback_wait: "대기/callback",
  workflow: "Workflow",
  workflow_call: "서브워크플로우 호출",
  remote_a2a: "외부 Agent",
  remote_agent_call: "외부 Agent 호출",
  join: "병합",
  router: "조건 분기",
  loop_control: "반복 제어"
};

const AGENT_EXECUTION_MODE_LABEL: Record<AgentExecutionMode, string> = {
  single_turn: "Single turn",
  chat: "Chat"
};
const AGENT_EXECUTION_MODE_HELP: Record<AgentExecutionMode, string> = {
  single_turn: "현재 입력과 연결된 edge 데이터만 사용합니다.",
  chat: "같은 ADK session의 이전 대화 흐름을 함께 봅니다."
};

const INVOKE_BINDING_LABEL: Record<GraphInvokeBinding, string> = {
  unresolved: "미정",
  local_python: "Local Python",
  direct_api: "Direct API",
  mcp_tool: "MCP tool",
  mcp_toolset: "MCP toolset",
  local_function: "Local function",
  internal_workflow: "Internal workflow",
  ui_input: "UI input",
  remote_a2a: "Remote A2A",
  callback_wait: "Callback wait",
  unknown: "Unknown"
};

const DECISION_OWNER_LABEL: Record<GraphDecisionOwner, string> = {
  workflow_code: "Workflow code",
  llm: "LLM",
  human: "Human",
  remote_agent: "Remote agent",
  system: "System",
  unknown: "Unknown"
};

const CALL_CONTROL_LABEL: Record<GraphCallControl, string> = {
  none: "없음",
  fixed_by_workflow: "Workflow 고정",
  selected_by_llm: "LLM 선택",
  selected_by_human: "Human 선택",
  event_callback: "Event callback",
  resume: "Resume",
  unknown: "Unknown"
};

const FLOW_KIND_LABEL: Record<GraphFlowKind, string> = {
  sequence: "순차",
  route: "분기",
  fan_out: "Fan-out",
  fan_in: "Fan-in",
  loop_back: "Loop back",
  loop_exit: "Loop exit",
  fallback: "Fallback",
  error: "Error",
  resume: "Resume",
  callback: "Callback",
  unknown: "Unknown"
};

// "데이터 전달 방식" picker metadata. edge_kind is how a connected edge passes
// data in the generated ADK code: an in-process channel (event/state/artifact),
// a control edge, or a remote A2A call. Groups + labels are UI copy; the enum
// source of truth stays GRAPH_EDGE_KINDS in analyzer/types.
const EDGE_KIND_GROUPS: { label: string; kinds: EdgeKind[] }[] = [
  {
    label: "내부 연결",
    kinds: ["event_output", "event_message", "session_state", "temp_state", "user_state", "app_state", "artifact"]
  },
  { label: "제어", kinds: ["route", "control"] },
  { label: "원격 A2A", kinds: ["remote_a2a"] }
];

const EDGE_KIND_OPTION_LABEL: Record<EdgeKind, string> = {
  event_output: "이벤트 출력",
  event_message: "이벤트 메시지",
  session_state: "세션 상태",
  temp_state: "임시 상태",
  user_state: "사용자 상태",
  app_state: "앱 상태",
  artifact: "아티팩트",
  route: "라우트",
  control: "제어",
  remote_a2a: "원격 A2A"
};

const EDGE_KIND_HELP: Record<EdgeKind, string> = {
  event_output: "다음 노드 입력으로 직접 전달합니다.",
  event_message: "사용자 대면 메시지 데이터입니다.",
  session_state: "session.state 키를 공유합니다. state_key가 필요합니다.",
  temp_state: "이번 호출 동안만 유지됩니다. state_key가 필요합니다.",
  user_state: "사용자별 영속 상태입니다. state_key가 필요합니다.",
  app_state: "앱 전역 공유 상태입니다. state_key가 필요합니다.",
  artifact: "아티팩트 서비스 키로 참조합니다. artifact_key가 필요합니다.",
  route: "조건 분기 엣지입니다. route_condition이 필요합니다.",
  control: "데이터 없이 실행 순서만 지정합니다.",
  remote_a2a: "A2A 프로토콜로 별도 Agent를 호출합니다."
};

export function GraphElementEditor({ editState, moduleCandidates, a2aContracts, onClose }: GraphElementEditorProps) {
  if (editState.selectedNode) {
    return (
      <NodeForm
        node={editState.selectedNode}
        editState={editState}
        moduleCandidates={moduleCandidates}
        onClose={onClose}
      />
    );
  }

  if (editState.selectedEdge) {
    return (
      <EdgeForm
        edge={editState.selectedEdge}
        editState={editState}
        a2aContracts={a2aContracts}
        onClose={onClose}
      />
    );
  }

  return (
    <aside className="graph-element-editor empty">
      <p>편집할 노드 또는 엣지를 선택하세요.</p>
    </aside>
  );
}

function NodeForm({
  node,
  editState,
  moduleCandidates,
  onClose
}: {
  node: GraphNode;
  editState: GraphEditState;
  moduleCandidates: ModuleCandidate[];
  onClose: () => void;
}) {
  const category = moduleCategoryFromNodeKind(node.node_kind);
  const canLinkModule = MODULE_NODE_KINDS.has(node.node_kind);
  const matchingCandidates = canLinkModule
    ? moduleCandidates.filter((candidate) => candidate.module_category === moduleCategoryFromNodeKind(node.node_kind))
    : [];
  const agentExecutionMode: AgentExecutionMode = node.agent_execution_mode === "chat" ? "chat" : "single_turn";
  const schemaRefs = node.schema_refs ?? [];
  const showContractSection =
    Boolean(node.workflow_ref || node.input_schema || node.output_schema || schemaRefs.length) ||
    node.node_kind === "workflow_call";
  const showMockLab = node.node_kind === "adapter_call" || Boolean(node.mock_binding);
  const showAdkSkeleton = Boolean(node.adk_skeleton_contract || node.adk_node_role);

  return (
    <aside className="graph-element-editor">
      <header className="graph-element-editor-head">
        <div>
          <p className="eyebrow">노드 편집</p>
          <h3>{node.label}</h3>
          <div className="graph-element-editor-meta">
            <code>{node.id}</code>
            {category ? <CategoryBadge category={category} /> : null}
          </div>
        </div>
        <Button variant="ghost" type="button" onClick={onClose}>
          닫기
        </Button>
      </header>

      <EditorSection title="책임 분류">
        <Field label="라벨">
          <input value={node.label} onChange={(event) => editState.updateNodeFields(node.id, { label: event.target.value })} />
        </Field>

        <Field label="종류" hint="종류 변경은 삭제 후 재추가">
          <input value={`${NODE_KIND_LABEL[node.node_kind] ?? node.node_kind} (${node.node_kind})`} readOnly />
        </Field>

        <SelectField
          label="레인 lane_id"
          value={node.lane_id}
          onChange={(event) => editState.updateNodeFields(node.id, { lane_id: event.target.value as LaneId })}
        >
          {GRAPH_LANE_IDS.map((laneId) => (
            <option key={laneId} value={laneId}>
              {laneId}
            </option>
          ))}
        </SelectField>

        <SelectField
          label="컨테이너 container_id"
          value={node.container_id ?? ""}
          onChange={(event) =>
            editState.updateNodeFields(node.id, { container_id: nullableString(event.target.value) })
          }
        >
          <option value="">없음</option>
          {editState.draft.containers.map((container) => (
            <option key={container.id} value={container.id}>
              {container.label} ({container.id})
            </option>
          ))}
        </SelectField>

        {canLinkModule ? (
          <>
            <SelectField
              label="모듈 연결 module_id"
              value={node.module_id ?? ""}
              onChange={(event) => {
                const moduleId = nullableString(event.target.value);
                if (!moduleId) {
                  editState.updateNodeFields(node.id, {
                    module_id: null,
                    execution_kind: null,
                    agent_execution_mode: node.node_kind === "agent" ? "single_turn" : null,
                    review_status: "n/a"
                  });
                  return;
                }
                const candidate = matchingCandidates.find((item) => item.id === moduleId);
                if (!candidate) return;
                editState.updateNodeFields(node.id, {
                  module_id: candidate.id,
                  execution_kind: candidate.module_category,
                  agent_execution_mode: node.node_kind === "agent" ? agentExecutionMode : null,
                  review_status: candidate.status
                });
              }}
            >
              <option value="">없음</option>
              {matchingCandidates.map((candidate) => (
                <option key={candidate.id} value={candidate.id}>
                  {candidate.name} ({candidate.id})
                </option>
              ))}
            </SelectField>
            {!node.module_id ? (
              <p className="graph-element-editor-warning">이 노드는 모듈 후보 연결이 필요합니다.</p>
            ) : null}
          </>
        ) : null}

        <Field label="검토 상태">
          <input value={node.review_status ?? "n/a"} readOnly />
        </Field>
      </EditorSection>

      {showContractSection ? (
        <EditorSection title="계약">
          {schemaRefs.length ? (
            <TextareaField label="schema_refs" value={JSON.stringify(schemaRefs, null, 2)} readOnly rows={4} />
          ) : null}
          {node.input_schema ? <Field label="input_schema"><input value={node.input_schema} readOnly /></Field> : null}
          {node.output_schema ? <Field label="output_schema"><input value={node.output_schema} readOnly /></Field> : null}
          {node.node_kind === "workflow_call" ? (
            <>
              <Field label="workflow_ref">
                <input
                  value={
                    node.workflow_ref
                      ? `${node.workflow_ref.display_name} (${node.workflow_ref.id}${node.workflow_ref.version ? ` ${node.workflow_ref.version}` : ""})`
                      : "미지정"
                  }
                  readOnly
                />
              </Field>
              <TextareaField label="input_mapping" value={JSON.stringify(node.input_mapping ?? {}, null, 2)} readOnly rows={4} />
              <TextareaField label="output_mapping" value={JSON.stringify(node.output_mapping ?? {}, null, 2)} readOnly rows={4} />
            </>
          ) : null}
        </EditorSection>
      ) : null}

      <EditorSection title="실행 설정">
        <SelectField
          label="invoke_binding"
          value={node.invoke_binding ?? ""}
          onChange={(event) =>
            editState.updateNodeFields(node.id, {
              invoke_binding: nullableEnum<GraphInvokeBinding>(event.target.value)
            })
          }
        >
          <option value="">없음</option>
          {GRAPH_INVOKE_BINDINGS.map((binding) => (
            <option key={binding} value={binding}>
              {INVOKE_BINDING_LABEL[binding]} ({binding})
            </option>
          ))}
        </SelectField>

        {node.runtime_binding ? (
          <Field label="runtime_binding" hint="legacy/compat">
            <input value={node.runtime_binding} readOnly />
          </Field>
        ) : null}

        <SelectField
          label="decision_owner"
          value={node.decision_owner ?? ""}
          onChange={(event) =>
            editState.updateNodeFields(node.id, {
              decision_owner: nullableEnum<GraphDecisionOwner>(event.target.value)
            })
          }
        >
          <option value="">없음</option>
          {GRAPH_DECISION_OWNERS.map((owner) => (
            <option key={owner} value={owner}>
              {DECISION_OWNER_LABEL[owner]} ({owner})
            </option>
          ))}
        </SelectField>

        <SelectField
          label="call_control"
          value={node.call_control ?? ""}
          onChange={(event) =>
            editState.updateNodeFields(node.id, {
              call_control: nullableEnum<GraphCallControl>(event.target.value)
            })
          }
        >
          <option value="">없음</option>
          {GRAPH_CALL_CONTROLS.map((control) => (
            <option key={control} value={control}>
              {CALL_CONTROL_LABEL[control]} ({control})
            </option>
          ))}
        </SelectField>

        {node.node_kind === "agent" ? (
          <div className="ui-field graph-agent-mode-field">
            <span>Agent context</span>
            <div className="graph-agent-mode-segment" role="group" aria-label="Agent 실행 컨텍스트">
              {AGENT_EXECUTION_MODES.map((mode) => (
                <button
                  key={mode}
                  type="button"
                  className={mode === agentExecutionMode ? "is-selected" : ""}
                  aria-pressed={mode === agentExecutionMode}
                  onClick={() => editState.updateNodeFields(node.id, { agent_execution_mode: mode })}
                >
                  {AGENT_EXECUTION_MODE_LABEL[mode]}
                </button>
              ))}
            </div>
            <small>{AGENT_EXECUTION_MODE_HELP[agentExecutionMode]}</small>
          </div>
        ) : null}
      </EditorSection>

      <EditorSection title="정책·리스크">
        <Field label="owner_scope">
          <input value={node.owner_scope ?? ""} readOnly />
        </Field>
        <Field label="side_effect">
          <input value={node.side_effect ?? "없음"} readOnly />
        </Field>
        <Field label="policy">
          <input value={node.policy ?? "없음"} readOnly />
        </Field>
      </EditorSection>

      {showMockLab ? (
        <EditorSection title="Mock Lab">
          <TextareaField
            label="binding"
            value={JSON.stringify(
              node.mock_binding ?? { provider: "mock_lab", package_path: "packages/mock-lab", status: "missing" },
              null,
              2
            )}
            readOnly
            rows={7}
          />
        </EditorSection>
      ) : null}

      {showAdkSkeleton ? (
        <EditorSection title="ADK Skeleton">
          {node.adk_skeleton_contract ? (
            <TextareaField label="contract" value={JSON.stringify(node.adk_skeleton_contract, null, 2)} readOnly rows={7} />
          ) : null}
          {node.adk_node_role ? (
            <p className="graph-element-editor-hint">ADK role 호환 메타데이터: {node.adk_node_role}</p>
          ) : null}
        </EditorSection>
      ) : null}

      <div className="af-action-row">
        <Button variant="secondary" type="button" onClick={onClose}>
          닫기
        </Button>
      </div>
    </aside>
  );
}

function EdgeForm({
  edge,
  editState,
  a2aContracts,
  onClose
}: {
  edge: GraphEdge;
  editState: GraphEditState;
  a2aContracts: A2AContract[];
  onClose: () => void;
}) {
  const edgeId = selectedEdgeId(editState, edge);
  const fromLabel = nodeLabel(editState.draft.nodes, edge.from);
  const toLabel = nodeLabel(editState.draft.nodes, edge.to);
  const isStateEdge = STATE_EDGE_KINDS.has(edge.edge_kind);
  // Any enum value not yet placed in a group still renders (under "기타") so a
  // future edge_kind never silently disappears from the picker.
  const ungroupedEdgeKinds = GRAPH_EDGE_KINDS.filter(
    (kind) => !EDGE_KIND_GROUPS.some((group) => group.kinds.includes(kind))
  );

  return (
    <aside className="graph-element-editor">
      <header className="graph-element-editor-head">
        <div>
          <p className="eyebrow">엣지 편집</p>
          <h3>
            {fromLabel} → {toLabel}
          </h3>
          <div className="graph-element-editor-meta">
            <code>{edgeId}</code>
          </div>
        </div>
        <Button variant="ghost" type="button" onClick={onClose}>
          닫기
        </Button>
      </header>

      <EditorSection title="책임 분류">
        <Field label="연결">
          <input value={`${edge.from} → ${edge.to}`} readOnly />
        </Field>

        <SelectField
          label="edge_kind"
          value={edge.edge_kind}
          onChange={(event) => editState.updateEdgeFields(edgeId, { edge_kind: event.target.value as EdgeKind })}
        >
          {EDGE_KIND_GROUPS.map((group) => (
            <optgroup key={group.label} label={group.label}>
              {group.kinds.map((kind) => (
                <option key={kind} value={kind}>
                  {EDGE_KIND_OPTION_LABEL[kind]} ({kind})
                </option>
              ))}
            </optgroup>
          ))}
          {ungroupedEdgeKinds.length ? (
            <optgroup label="기타">
              {ungroupedEdgeKinds.map((kind) => (
                <option key={kind} value={kind}>
                  {EDGE_KIND_OPTION_LABEL[kind] ?? kind} ({kind})
                </option>
              ))}
            </optgroup>
          ) : null}
        </SelectField>
        <p className="graph-element-editor-hint">{EDGE_KIND_HELP[edge.edge_kind] ?? ""}</p>

        <SelectField
          label="execution_semantics"
          value={edge.execution_semantics}
          onChange={(event) =>
            editState.updateEdgeFields(edgeId, { execution_semantics: event.target.value as ExecutionSemantics })
          }
        >
          {GRAPH_EXECUTION_SEMANTICS.map((semantics) => (
            <option key={semantics} value={semantics}>
              {semantics}
            </option>
          ))}
        </SelectField>
      </EditorSection>

      <EditorSection title="계약">
        <Field label="data_label">
          <input value={edge.data_label} onChange={(event) => editState.updateEdgeFields(edgeId, { data_label: event.target.value })} />
        </Field>

        {edge.edge_kind === "route" ? (
          <TextareaField
            label="route_condition"
            rows={2}
            value={edge.route_condition ?? ""}
            onChange={(event) => editState.updateEdgeFields(edgeId, { route_condition: nullableString(event.target.value) })}
            hint="route 엣지는 route_condition이 필요합니다"
          />
        ) : null}

        {isStateEdge ? (
          <Field label="state_key" hint="state key">
            <input
              value={edge.state_key ?? ""}
              onChange={(event) => editState.updateEdgeFields(edgeId, { state_key: nullableString(event.target.value) })}
            />
          </Field>
        ) : null}

        {edge.edge_kind === "artifact" ? (
          <Field label="artifact_key" hint="artifact key">
            <input
              value={edge.artifact_key ?? ""}
              onChange={(event) => editState.updateEdgeFields(edgeId, { artifact_key: nullableString(event.target.value) })}
            />
          </Field>
        ) : null}

        <Field label="schema_ref">
          <input
            value={edge.schema_ref ?? ""}
            onChange={(event) => editState.updateEdgeFields(edgeId, { schema_ref: nullableString(event.target.value) })}
          />
        </Field>

        {edge.edge_kind === "remote_a2a" ? (
          <>
            <SelectField
              label="a2a_contract_id"
              value={edge.a2a_contract_id ?? ""}
              onChange={(event) =>
                editState.updateEdgeFields(edgeId, { a2a_contract_id: nullableString(event.target.value) })
              }
            >
              <option value="">없음</option>
              {a2aContracts.map((contract) => (
                <option key={contract.contract_id} value={contract.contract_id}>
                  {contract.contract_id}
                </option>
              ))}
            </SelectField>
            {!edge.a2a_contract_id ? (
              <p className="graph-element-editor-warning">remote_a2a 엣지는 계약 연결이 필요합니다.</p>
            ) : null}
          </>
        ) : null}
      </EditorSection>

      <EditorSection title="실행 설정">
        <SelectField
          label="flow_kind"
          value={edge.flow_kind ?? ""}
          onChange={(event) =>
            editState.updateEdgeFields(edgeId, {
              flow_kind: nullableEnum<GraphFlowKind>(event.target.value)
            })
          }
        >
          <option value="">없음</option>
          {GRAPH_FLOW_KINDS.map((flowKind) => (
            <option key={flowKind} value={flowKind}>
              {FLOW_KIND_LABEL[flowKind]} ({flowKind})
            </option>
          ))}
        </SelectField>

        <SelectField
          label="call_control"
          value={edge.call_control ?? ""}
          onChange={(event) =>
            editState.updateEdgeFields(edgeId, {
              call_control: nullableEnum<GraphCallControl>(event.target.value)
            })
          }
        >
          <option value="">없음</option>
          {GRAPH_CALL_CONTROLS.map((control) => (
            <option key={control} value={control}>
              {CALL_CONTROL_LABEL[control]} ({control})
            </option>
          ))}
        </SelectField>
      </EditorSection>

      <EditorSection title="정책·리스크">
        <Field label="is_remote_boundary_crossing">
          <input value={edge.is_remote_boundary_crossing ? "true" : "false"} readOnly />
        </Field>
      </EditorSection>

      <div className="af-action-row">
        <Button variant="secondary" type="button" onClick={onClose}>
          닫기
        </Button>
      </div>
    </aside>
  );
}

function EditorSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="graph-element-editor-section">
      <h4>{title}</h4>
      <div className="graph-element-editor-section-body">{children}</div>
    </section>
  );
}

function moduleCategoryFromNodeKind(kind: GraphNode["node_kind"]): ModuleCategory | null {
  if (kind === "workflow_call") return "workflow";
  if (kind === "adapter_call") return "adapter";
  if (kind === "remote_agent_call") return "remote_a2a";
  if (kind === "agent" || kind === "workflow" || kind === "adapter" || kind === "remote_a2a") return kind;
  return null;
}

// 매 keystroke마다 호출되므로 trim 하지 않는다 — trim 하면 공백 포함 값(route_condition 등)을 입력할 수 없다.
function nullableString(value: string): string | null {
  return value === "" ? null : value;
}

function nullableEnum<T extends string>(value: string): T | null {
  return value === "" ? null : (value as T);
}

function nodeLabel(nodes: GraphNode[], nodeId: string): string {
  return nodes.find((node) => node.id === nodeId)?.label ?? nodeId;
}

function selectedEdgeId(editState: GraphEditState, edge: GraphEdge): string {
  const index = editState.draft.edges.findIndex((candidate) => candidate === edge);
  return edge.id ?? (index >= 0 ? `edge-${index}` : "");
}
