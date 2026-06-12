// Controlled by GraphEditState.draft: field changes update the live draft immediately.
// The canvas toolbar owns whole-graph save/cancel, so this form keeps no mirror state.
import {
  GRAPH_EDGE_KINDS,
  GRAPH_EXECUTION_SEMANTICS,
  GRAPH_LANE_IDS,
  type A2AContract,
  type EdgeKind,
  type ExecutionSemantics,
  type GraphEdge,
  type GraphNode,
  type LaneId,
  type ModuleCandidate,
  type ModuleCategory
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

const MODULE_NODE_KINDS = new Set(["agent", "workflow", "adapter", "remote_a2a"]);
const STATE_EDGE_KINDS = new Set(["session_state", "temp_state", "user_state", "app_state"]);

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
    ? moduleCandidates.filter((candidate) => candidate.module_category === node.node_kind)
    : [];

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

      <section className="graph-element-editor-section">
        <Field label="라벨">
          <input value={node.label} onChange={(event) => editState.updateNodeFields(node.id, { label: event.target.value })} />
        </Field>

        <Field label="종류" hint="종류 변경은 삭제 후 재추가">
          <input value={node.node_kind} readOnly />
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

        <Field label="실행 종류 execution_kind">
          <input
            value={node.execution_kind ?? ""}
            onChange={(event) =>
              editState.updateNodeFields(node.id, { execution_kind: nullableString(event.target.value) })
            }
          />
        </Field>

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
                    review_status: "n/a"
                  });
                  return;
                }
                const candidate = matchingCandidates.find((item) => item.id === moduleId);
                if (!candidate) return;
                editState.updateNodeFields(node.id, {
                  module_id: candidate.id,
                  execution_kind: candidate.module_category,
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
              <p className="graph-element-editor-warning">
                이 종류의 노드는 모듈 후보 연결이 필요합니다 (검토 게이트 차단)
              </p>
            ) : null}
          </>
        ) : null}
      </section>

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

      <section className="graph-element-editor-section">
        <Field label="연결">
          <input value={`${edge.from} → ${edge.to}`} readOnly />
        </Field>

        <SelectField
          label="edge_kind"
          value={edge.edge_kind}
          onChange={(event) => editState.updateEdgeFields(edgeId, { edge_kind: event.target.value as EdgeKind })}
        >
          {GRAPH_EDGE_KINDS.map((kind) => (
            <option key={kind} value={kind}>
              {kind}
            </option>
          ))}
        </SelectField>

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

        <Field label="data_label">
          <input value={edge.data_label} onChange={(event) => editState.updateEdgeFields(edgeId, { data_label: event.target.value })} />
        </Field>

        <TextareaField
          label="route_condition"
          rows={2}
          value={edge.route_condition ?? ""}
          onChange={(event) => editState.updateEdgeFields(edgeId, { route_condition: nullableString(event.target.value) })}
          hint={edge.edge_kind === "route" ? "route 엣지는 route_condition이 필요합니다" : undefined}
        />

        <Field
          label="state_key"
          hint={isStateEdge ? "state 엣지는 state_key가 필요합니다 (temp:/user:/app: prefix)" : undefined}
        >
          <input
            value={edge.state_key ?? ""}
            onChange={(event) => editState.updateEdgeFields(edgeId, { state_key: nullableString(event.target.value) })}
          />
        </Field>

        <Field label="artifact_key" hint={edge.edge_kind === "artifact" ? "artifact 엣지는 artifact_key가 필요합니다" : undefined}>
          <input
            value={edge.artifact_key ?? ""}
            onChange={(event) => editState.updateEdgeFields(edgeId, { artifact_key: nullableString(event.target.value) })}
          />
        </Field>

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
              <p className="graph-element-editor-warning">remote_a2a 엣지는 계약 연결이 필요합니다</p>
            ) : null}
          </>
        ) : null}

        <Field label="is_remote_boundary_crossing">
          <input value={edge.is_remote_boundary_crossing ? "true" : "false"} readOnly />
        </Field>
      </section>

      <div className="af-action-row">
        <Button variant="secondary" type="button" onClick={onClose}>
          닫기
        </Button>
      </div>
    </aside>
  );
}

function moduleCategoryFromNodeKind(kind: GraphNode["node_kind"]): ModuleCategory | null {
  if (kind === "agent" || kind === "workflow" || kind === "adapter" || kind === "remote_a2a") return kind;
  return null;
}

// 매 keystroke마다 호출되므로 trim 하지 않는다 — trim 하면 공백 포함 값(route_condition 등)을 입력할 수 없다.
function nullableString(value: string): string | null {
  return value === "" ? null : value;
}

function nodeLabel(nodes: GraphNode[], nodeId: string): string {
  return nodes.find((node) => node.id === nodeId)?.label ?? nodeId;
}

function selectedEdgeId(editState: GraphEditState, edge: GraphEdge): string {
  const index = editState.draft.edges.findIndex((candidate) => candidate === edge);
  return edge.id ?? (index >= 0 ? `edge-${index}` : "");
}
