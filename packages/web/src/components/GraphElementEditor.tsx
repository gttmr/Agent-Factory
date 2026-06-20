// Controlled by GraphEditState.draft: field changes update the live draft immediately.
// The canvas toolbar owns whole-graph save/cancel, so this form keeps no mirror state.
import { useEffect, useState, type ReactNode } from "react";
import {
  AGENT_EXECUTION_MODES,
  GRAPH_EDGE_KINDS,
  GRAPH_INVOKE_BINDINGS,
  type AgentExecutionMode,
  type A2AContract,
  type EdgeKind,
  type GraphEdge,
  type GraphInvokeBinding,
  type GraphNode,
  type ModuleCandidate,
  type ModuleCategory,
  type NodeKind
} from "../analyzer/types";
import { CategoryBadge } from "./CategoryBadge";
import type { GraphEditState } from "./GraphCanvas";
import {
  GRAPH_ELEMENT_TABS,
  isEdgeKindEditable,
  isModuleBoundNodeKind,
  isNodeModuleLinkEditable,
  isNodeRuntimeControlEditable,
  type GraphElementTabId
} from "./graphElementEditorModel";
import { Button, Field, SelectField, TextareaField } from "../ui/primitives";

interface GraphElementEditorProps {
  editState: GraphEditState;
  moduleCandidates: ModuleCandidate[];
  a2aContracts: A2AContract[];
  onClose: () => void;
}

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
  const [activeTab, setActiveTab] = useState<GraphElementTabId>("basic");
  const selectionKey = editState.selectedNode
    ? `node:${editState.selectedNode.id}`
    : editState.selectedEdge
      ? `edge:${editState.selectedEdge.id ?? `${editState.selectedEdge.from}->${editState.selectedEdge.to}`}`
      : "empty";

  useEffect(() => {
    setActiveTab("basic");
  }, [selectionKey]);

  if (editState.selectedNode) {
    return (
      <NodeForm
        node={editState.selectedNode}
        editState={editState}
        moduleCandidates={moduleCandidates}
        activeTab={activeTab}
        onTabChange={setActiveTab}
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
        activeTab={activeTab}
        onTabChange={setActiveTab}
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

function GraphElementTabs({
  activeTab,
  onTabChange
}: {
  activeTab: GraphElementTabId;
  onTabChange: (tab: GraphElementTabId) => void;
}) {
  return (
    <div className="graph-element-tabs" role="tablist" aria-label="그래프 요소 편집 탭">
      {GRAPH_ELEMENT_TABS.map((tab) => (
        <button
          key={tab.id}
          type="button"
          role="tab"
          aria-selected={activeTab === tab.id}
          className={`graph-element-tab${activeTab === tab.id ? " is-active" : ""}`}
          onClick={() => onTabChange(tab.id)}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}

function EmptyTabMessage({ children }: { children: ReactNode }) {
  return <p className="graph-element-editor-hint">{children}</p>;
}

function ReadonlyInput({ value }: { value: ReactNode }) {
  return <input value={typeof value === "string" || typeof value === "number" ? String(value) : ""} readOnly />;
}

function NodeForm({
  node,
  editState,
  moduleCandidates,
  activeTab,
  onTabChange,
  onClose
}: {
  node: GraphNode;
  editState: GraphEditState;
  moduleCandidates: ModuleCandidate[];
  activeTab: GraphElementTabId;
  onTabChange: (tab: GraphElementTabId) => void;
  onClose: () => void;
}) {
  const category = moduleCategoryFromNodeKind(node.node_kind);
  const canLinkModule = isModuleBoundNodeKind(node.node_kind);
  const moduleLinkEditable = isNodeModuleLinkEditable(node, editState.draft.edges);
  const runtimeControlEditable = isNodeRuntimeControlEditable(node);
  const matchingCandidates = canLinkModule
    ? moduleCandidates.filter((candidate) => candidate.module_category === moduleCategoryFromNodeKind(node.node_kind))
    : [];
  const agentExecutionMode: AgentExecutionMode = node.agent_execution_mode === "chat" ? "chat" : "single_turn";
  const schemaRefs = node.schema_refs ?? [];
  const containerLabel = node.container_id
    ? editState.draft.containers.find((container) => container.id === node.container_id)?.label ?? node.container_id
    : "없음";
  const moduleLabel = node.module_id
    ? matchingCandidates.find((candidate) => candidate.id === node.module_id)?.name
      ? `${matchingCandidates.find((candidate) => candidate.id === node.module_id)?.name} (${node.module_id})`
      : node.module_id
    : "없음";

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

      <GraphElementTabs activeTab={activeTab} onTabChange={onTabChange} />

      {activeTab === "basic" ? (
      <EditorSection title="기본">
        <Field label="라벨">
          <input value={node.label} onChange={(event) => editState.updateNodeFields(node.id, { label: event.target.value })} />
        </Field>

        <Field label="종류" hint="종류 변경은 삭제 후 재추가">
          <input value={`${NODE_KIND_LABEL[node.node_kind] ?? node.node_kind} (${node.node_kind})`} readOnly />
        </Field>

        <Field label="module_category">
          <ReadonlyInput value={category ?? "없음"} />
        </Field>

        <Field label="레인 lane_id" hint="node_kind 기준 자동값">
          <ReadonlyInput value={node.lane_id} />
        </Field>

        <Field label="컨테이너 container_id" hint="연결 구조와 container membership에서 관리">
          <ReadonlyInput value={node.container_id ? `${containerLabel} (${node.container_id})` : "없음"} />
        </Field>

        {canLinkModule ? (
          <>
            {moduleLinkEditable ? (
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
            ) : (
              <Field label="모듈 연결 module_id" hint="연결된 엣지 또는 계약이 있으면 삭제 후 재추가로 변경">
                <ReadonlyInput value={moduleLabel} />
              </Field>
            )}
            {!node.module_id && moduleLinkEditable ? (
              <p className="graph-element-editor-warning">이 노드는 모듈 후보 연결이 필요합니다.</p>
            ) : null}
          </>
        ) : null}

        <Field label="검토 상태">
          <input value={node.review_status ?? "n/a"} readOnly />
        </Field>
      </EditorSection>
      ) : null}

      {activeTab === "contract" ? (
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
          {!schemaRefs.length && !node.input_schema && !node.output_schema && !node.workflow_ref ? (
            <EmptyTabMessage>이 노드에 표시할 계약 정보가 없습니다.</EmptyTabMessage>
          ) : null}
        </EditorSection>
      ) : null}

      {activeTab === "runtime" ? (
      <EditorSection title="실행">
        {runtimeControlEditable ? (
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
        ) : (
          <Field label="invoke_binding" hint="node_kind와 runtime contract에서 고정">
            <ReadonlyInput value={node.invoke_binding ?? "없음"} />
          </Field>
        )}

        {node.runtime_binding ? (
          <Field label="runtime_binding" hint="legacy/compat">
            <input value={node.runtime_binding} readOnly />
          </Field>
        ) : null}

        <Field label="decision_owner" hint="Workflow-first Graph Model에서 자동 결정">
          <ReadonlyInput value={node.decision_owner ?? "없음"} />
        </Field>

        <Field label="call_control" hint="node_kind와 호출 주체 기준 고정">
          <ReadonlyInput value={node.call_control ?? "없음"} />
        </Field>

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
      ) : null}

      {activeTab === "policy" ? (
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
      ) : null}

      {activeTab === "mock" ? (
        <EditorSection title="Mock">
          {node.node_kind === "adapter_call" || node.mock_binding ? (
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
          ) : (
            <EmptyTabMessage>이 노드는 Mock Lab binding 대상이 아닙니다.</EmptyTabMessage>
          )}
        </EditorSection>
      ) : null}

      {activeTab === "adk" ? (
        <EditorSection title="ADK">
          {node.adk_skeleton_contract ? (
            <TextareaField label="contract" value={JSON.stringify(node.adk_skeleton_contract, null, 2)} readOnly rows={7} />
          ) : (
            <EmptyTabMessage>ADK Skeleton Contract가 없습니다.</EmptyTabMessage>
          )}
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
  activeTab,
  onTabChange,
  onClose
}: {
  edge: GraphEdge;
  editState: GraphEditState;
  a2aContracts: A2AContract[];
  activeTab: GraphElementTabId;
  onTabChange: (tab: GraphElementTabId) => void;
  onClose: () => void;
}) {
  const edgeId = selectedEdgeId(editState, edge);
  const fromLabel = nodeLabel(editState.draft.nodes, edge.from);
  const toLabel = nodeLabel(editState.draft.nodes, edge.to);
  const isStateEdge = STATE_EDGE_KINDS.has(edge.edge_kind);
  const edgeKindEditable = isEdgeKindEditable(edge);
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

      <GraphElementTabs activeTab={activeTab} onTabChange={onTabChange} />

      {activeTab === "basic" ? (
      <EditorSection title="기본">
        <Field label="연결">
          <input value={`${edge.from} → ${edge.to}`} readOnly />
        </Field>

        {edgeKindEditable ? (
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
        ) : (
          <Field label="edge_kind" hint="router/remote boundary 연결에서 자동 고정">
            <ReadonlyInput value={edge.edge_kind} />
          </Field>
        )}
        <p className="graph-element-editor-hint">{EDGE_KIND_HELP[edge.edge_kind] ?? ""}</p>

        <Field label="execution_semantics" hint="연결된 노드의 실행 의미에서 자동 결정">
          <ReadonlyInput value={edge.execution_semantics} />
        </Field>
      </EditorSection>
      ) : null}

      {activeTab === "contract" ? (
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
      ) : null}

      {activeTab === "runtime" ? (
      <EditorSection title="실행">
        <Field label="flow_kind" hint="edge_kind와 graph topology에서 고정">
          <ReadonlyInput value={edge.flow_kind ?? "없음"} />
        </Field>

        <Field label="call_control" hint="routing/callback/resume 의미에서 고정">
          <ReadonlyInput value={edge.call_control ?? "없음"} />
        </Field>
      </EditorSection>
      ) : null}

      {activeTab === "policy" ? (
      <EditorSection title="정책">
        <Field label="is_remote_boundary_crossing">
          <input value={edge.is_remote_boundary_crossing ? "true" : "false"} readOnly />
        </Field>
      </EditorSection>
      ) : null}

      {activeTab === "mock" ? (
        <EditorSection title="Mock">
          <EmptyTabMessage>엣지는 Mock Lab binding을 직접 갖지 않습니다.</EmptyTabMessage>
        </EditorSection>
      ) : null}

      {activeTab === "adk" ? (
        <EditorSection title="ADK">
          <EmptyTabMessage>엣지는 ADK Skeleton Contract를 직접 갖지 않습니다.</EmptyTabMessage>
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
