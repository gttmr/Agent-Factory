import type {
  A2AContract,
  GraphEdge,
  GraphNode,
  ModuleCandidate,
  ModuleCategory
} from "../analyzer/types";
import { CategoryBadge, SubtypeBadge, getSubtypeValue } from "./CategoryBadge";

interface GraphInspectorProps {
  selectedNode: GraphNode | null;
  selectedEdge: GraphEdge | null;
  nodeLabel: (id: string) => string;
  candidate: ModuleCandidate | null;
  a2aContracts: A2AContract[];
  onNavigateToA2AContracts?: () => void;
  onClose: () => void;
}

function moduleCatFromKind(kind: string | undefined): ModuleCategory | null {
  if (kind === "workflow_call") return "workflow";
  if (kind === "adapter_call") return "adapter";
  if (kind === "remote_agent_call") return "remote_a2a";
  if (kind === "agent" || kind === "workflow" || kind === "adapter" || kind === "remote_a2a") {
    return kind;
  }
  return null;
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="graph-inspector-row">
      <span className="graph-inspector-key">{label}</span>
      <span className="graph-inspector-value">{children}</span>
    </div>
  );
}

export function GraphInspector(props: GraphInspectorProps) {
  const { selectedNode, selectedEdge, nodeLabel, candidate, a2aContracts, onNavigateToA2AContracts, onClose } = props;

  if (!selectedNode && !selectedEdge) {
    return (
      <aside className="graph-inspector empty">
        <p>노드 또는 엣지를 선택하면 상세 정보가 표시됩니다.</p>
      </aside>
    );
  }

  if (selectedNode) {
    const cat = moduleCatFromKind(selectedNode.node_kind);
    const agentMode = selectedNode.node_kind === "agent"
      ? selectedNode.agent_execution_mode === "chat"
        ? "chat"
        : "single_turn"
      : null;
    return (
      <aside className="graph-inspector">
        <header className="graph-inspector-head">
          <div>
            <p className="eyebrow">노드 상세</p>
            <h3>{selectedNode.label}</h3>
          </div>
          <button type="button" className="link" onClick={onClose}>
            닫기
          </button>
        </header>

        <Row label="ID">
          <code>{selectedNode.id}</code>
        </Row>
        <Row label="kind">{selectedNode.node_kind ?? "-"}</Row>
        {cat ? (
          <Row label="카테고리">
            <CategoryBadge category={cat} />
            {candidate ? (() => {
              const sub = getSubtypeValue(candidate);
              return sub ? <SubtypeBadge value={sub} /> : null;
            })() : null}
          </Row>
        ) : null}
        <Row label="module_id">{selectedNode.module_id ?? "—"}</Row>
        {selectedNode.execution_kind ? (
          <Row label="execution">{selectedNode.execution_kind}</Row>
        ) : null}
        {selectedNode.runtime_binding ? <Row label="runtime_binding">{selectedNode.runtime_binding}</Row> : null}
        {agentMode ? (
          <>
            <Row label="agent mode">{agentMode}</Row>
            <Row label="context">
              {agentMode === "chat" ? "session history implicit input" : "current input only"}
            </Row>
          </>
        ) : null}
        {selectedNode.adk_node_role ? (
          <Row label="adk_role">{selectedNode.adk_node_role}</Row>
        ) : null}
        <Row label="container">{selectedNode.container_id ?? "—"}</Row>
        <Row label="lane">{(selectedNode.lane_id as string) ?? "—"}</Row>
        <Row label="owner">{selectedNode.owner_scope ?? "—"}</Row>
        <Row label="검토 상태">{selectedNode.review_status ?? "—"}</Row>
        {selectedNode.schema_refs && selectedNode.schema_refs.length ? (
          <Row label="schemas">
            <div className="graph-inspector-chips">
              {selectedNode.schema_refs.map((s) => (
                <span key={s} className="chip">
                  {s}
                </span>
              ))}
            </div>
          </Row>
        ) : null}
        {selectedNode.workflow_ref ? (
          <>
            <Row label="workflow_ref">
              {selectedNode.workflow_ref.display_name} · {selectedNode.workflow_ref.id}
              {selectedNode.workflow_ref.version ? ` · ${selectedNode.workflow_ref.version}` : ""}
            </Row>
            <Row label="input_mapping">
              <code>{JSON.stringify(selectedNode.input_mapping ?? {})}</code>
            </Row>
            <Row label="output_mapping">
              <code>{JSON.stringify(selectedNode.output_mapping ?? {})}</code>
            </Row>
          </>
        ) : null}
        {selectedNode.mock_binding ? (
          <Row label="Mock Lab">
            {selectedNode.mock_binding.status} · {selectedNode.mock_binding.mock_server_id ?? "missing"} ·{" "}
            {selectedNode.mock_binding.tool_name ?? "missing"}
          </Row>
        ) : null}
        {selectedNode.adk_skeleton_contract ? (
          <Row label="ADK Skeleton">
            {selectedNode.adk_skeleton_contract.scaffold_level} · {selectedNode.adk_skeleton_contract.implementation_template}
          </Row>
        ) : null}

        {selectedNode.node_kind === "human_input" ? (
          <Row label="입력 포트">
            <div className="graph-inspector-chips">
              {(selectedNode.input_ports ?? []).map((p) => (
                <span key={p.id} className="chip">
                  {p.label}
                </span>
              ))}
              {(selectedNode.input_ports ?? []).length === 0 ? <span>—</span> : null}
            </div>
          </Row>
        ) : null}

        {candidate ? (
          <>
            <Row label="risk">{candidate.risk_level}</Row>
            {candidate.risk_signals?.length ? (
              <Row label="risk signals">
                <div className="graph-inspector-chips">
                  {candidate.risk_signals.map((s) => (
                    <span key={s} className="chip">
                      {s}
                    </span>
                  ))}
                </div>
              </Row>
            ) : null}
            {candidate.missing_information?.length ? (
              <Row label="누락 정보">
                <ul className="graph-inspector-list">
                  {candidate.missing_information.map((m, i) => (
                    <li key={i}>{m}</li>
                  ))}
                </ul>
              </Row>
            ) : null}
            {candidate.adk_hints ? (
              <Row label="ADK 힌트">
                <span>state/callbacks/artifacts 등 모듈 검토에서 확인하세요.</span>
              </Row>
            ) : null}
          </>
        ) : null}
      </aside>
    );
  }

  // Edge
  if (selectedEdge) {
    const e = selectedEdge;
    const remoteContract = e.a2a_contract_id
      ? a2aContracts.find((c) => c.contract_id === e.a2a_contract_id) ?? null
      : null;
    return (
      <aside className="graph-inspector">
        <header className="graph-inspector-head">
          <div>
            <p className="eyebrow">엣지 상세</p>
            <h3>
              {nodeLabel(e.from)} → {nodeLabel(e.to)}
            </h3>
          </div>
          <button type="button" className="link" onClick={onClose}>
            닫기
          </button>
        </header>

        <Row label="ID">
          <code>{e.id ?? "—"}</code>
        </Row>
        <Row label="edge_kind">{e.edge_kind ?? "event_output"}</Row>
        <Row label="실행 의미">{e.execution_semantics ?? "—"}</Row>
        {e.data_label ? <Row label="data label">{e.data_label}</Row> : null}
        {e.schema_ref ? <Row label="schema">{e.schema_ref}</Row> : null}
        {e.route_condition ? <Row label="route">{e.route_condition}</Row> : null}
        {e.state_key ? <Row label="state_key">{e.state_key}</Row> : null}
        {e.artifact_key ? <Row label="artifact_key">{e.artifact_key}</Row> : null}
        {e.a2a_contract_id ? <Row label="A2A 계약">{e.a2a_contract_id}</Row> : null}
        <Row label="boundary crossing">{e.is_remote_boundary_crossing ? "예" : "아니오"}</Row>

        {e.edge_kind === "remote_a2a" && onNavigateToA2AContracts ? (
          <div className="graph-inspector-actions">
            <button type="button" className="primary" onClick={onNavigateToA2AContracts}>
              Remote A2A 계약 검토 →
            </button>
            {remoteContract ? (
              <p className="graph-inspector-note">
                계약: <strong>{remoteContract.target_agent_name}</strong> ({remoteContract.contract_status})
              </p>
            ) : null}
          </div>
        ) : null}
      </aside>
    );
  }

  return null;
}
