import { useEffect, useState, type ReactNode } from "react";
import type {
  A2AContract,
  GraphEdge,
  GraphNode,
  ModuleCandidate,
  ModuleCategory
} from "../analyzer/types";
import { CategoryBadge, SubtypeBadge, getSubtypeValue } from "./CategoryBadge";
import { GRAPH_ELEMENT_TABS, type GraphElementTabId } from "./graphElementEditorModel";

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

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="graph-inspector-row">
      <span className="graph-inspector-key">{label}</span>
      <span className="graph-inspector-value">{children}</span>
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="graph-inspector-section">
      <h4>{title}</h4>
      <div className="graph-inspector-section-body">{children}</div>
    </section>
  );
}

function EmptyValue() {
  return <span className="graph-inspector-muted">—</span>;
}

function EmptyTabMessage({ children }: { children: ReactNode }) {
  return <p className="graph-inspector-note">{children}</p>;
}

function GraphElementTabs({
  activeTab,
  onTabChange
}: {
  activeTab: GraphElementTabId;
  onTabChange: (tab: GraphElementTabId) => void;
}) {
  return (
    <div className="graph-element-tabs" role="tablist" aria-label="그래프 요소 상세 탭">
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

export function GraphInspector(props: GraphInspectorProps) {
  const { selectedNode, selectedEdge, nodeLabel, candidate, a2aContracts, onNavigateToA2AContracts, onClose } = props;
  const [activeTab, setActiveTab] = useState<GraphElementTabId>("basic");
  const selectionKey = selectedNode
    ? `node:${selectedNode.id}`
    : selectedEdge
      ? `edge:${selectedEdge.id ?? `${selectedEdge.from}->${selectedEdge.to}`}`
      : "empty";

  useEffect(() => {
    setActiveTab("basic");
  }, [selectionKey]);

  if (!selectedNode && !selectedEdge) {
    return (
      <aside className="graph-inspector empty">
        <p>노드 또는 엣지를 선택하면 상세 정보가 표시됩니다.</p>
      </aside>
    );
  }

  if (selectedNode) {
    const cat = moduleCatFromKind(selectedNode.node_kind);
    const subtype = candidate ? getSubtypeValue(candidate) : null;
    const agentMode = selectedNode.node_kind === "agent"
      ? selectedNode.agent_execution_mode === "chat"
        ? "chat"
        : "single_turn"
      : null;
    const schemaRefs = selectedNode.schema_refs ?? [];
    const inputPorts = selectedNode.input_ports ?? [];

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

        <GraphElementTabs activeTab={activeTab} onTabChange={setActiveTab} />

        {activeTab === "basic" ? (
          <Section title="기본">
            <Row label="ID">
              <code>{selectedNode.id}</code>
            </Row>
            <Row label="node_kind">{selectedNode.node_kind ?? <EmptyValue />}</Row>
            {cat ? (
              <Row label="카테고리">
                <div className="graph-inspector-chips">
                  <CategoryBadge category={cat} />
                  {subtype ? <SubtypeBadge value={subtype} /> : null}
                </div>
              </Row>
            ) : null}
            <Row label="module_id">{selectedNode.module_id ?? <EmptyValue />}</Row>
            <Row label="검토 상태">{selectedNode.review_status ?? <EmptyValue />}</Row>
            <Row label="lane">{(selectedNode.lane_id as string) ?? <EmptyValue />}</Row>
            <Row label="container">{selectedNode.container_id ?? <EmptyValue />}</Row>
          </Section>
        ) : null}

        {activeTab === "contract" ? (
          <Section title="계약">
            <Row label="schemas">
              {schemaRefs.length ? (
                <div className="graph-inspector-chips">
                  {schemaRefs.map((schemaRef) => (
                    <span key={schemaRef} className="chip">
                      {schemaRef}
                    </span>
                  ))}
                </div>
              ) : (
                <EmptyValue />
              )}
            </Row>
            {selectedNode.input_schema ? <Row label="input_schema">{selectedNode.input_schema}</Row> : null}
            {selectedNode.output_schema ? <Row label="output_schema">{selectedNode.output_schema}</Row> : null}
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
            {selectedNode.node_kind === "human_input" ? (
              <Row label="입력 포트">
                <div className="graph-inspector-chips">
                  {inputPorts.map((port) => (
                    <span key={port.id} className="chip">
                      {port.label}
                    </span>
                  ))}
                  {inputPorts.length === 0 ? <EmptyValue /> : null}
                </div>
              </Row>
            ) : null}
          </Section>
        ) : null}

        {activeTab === "runtime" ? (
          <Section title="실행">
            <Row label="invoke_binding">{selectedNode.invoke_binding ?? <EmptyValue />}</Row>
            {selectedNode.runtime_binding ? (
              <Row label="runtime_binding">
                <span className="graph-inspector-muted">legacy/compat · {selectedNode.runtime_binding}</span>
              </Row>
            ) : null}
            <Row label="decision_owner">{selectedNode.decision_owner ?? <EmptyValue />}</Row>
            <Row label="call_control">{selectedNode.call_control ?? <EmptyValue />}</Row>
            {selectedNode.execution_kind ? <Row label="execution_kind">{selectedNode.execution_kind}</Row> : null}
            {agentMode ? <Row label="agent mode">{agentMode}</Row> : null}
          </Section>
        ) : null}

        {activeTab === "policy" ? (
          <Section title="정책">
            <Row label="owner">{selectedNode.owner_scope ?? <EmptyValue />}</Row>
            <Row label="side_effect">{selectedNode.side_effect ?? <EmptyValue />}</Row>
            <Row label="policy">{selectedNode.policy ?? <EmptyValue />}</Row>
            {candidate ? (
              <>
                <Row label="risk">{candidate.risk_level}</Row>
                {candidate.risk_signals?.length ? (
                  <Row label="risk signals">
                    <div className="graph-inspector-chips">
                      {candidate.risk_signals.map((signal) => (
                        <span key={signal} className="chip">
                          {signal}
                        </span>
                      ))}
                    </div>
                  </Row>
                ) : null}
                {candidate.missing_information?.length ? (
                  <Row label="누락 정보">
                    <ul className="graph-inspector-list">
                      {candidate.missing_information.map((item, index) => (
                        <li key={index}>{item}</li>
                      ))}
                    </ul>
                  </Row>
                ) : null}
                {candidate.adk_hints ? (
                  <Row label="ADK 힌트">
                    <span>state/callback/artifact 검토 필요</span>
                  </Row>
                ) : null}
              </>
            ) : null}
          </Section>
        ) : null}

        {activeTab === "mock" ? (
          <Section title="Mock">
            {selectedNode.mock_binding ? (
              <Row label="binding">
                {selectedNode.mock_binding.status} · {selectedNode.mock_binding.mock_server_id ?? "missing"} ·{" "}
                {selectedNode.mock_binding.tool_name ?? "missing"}
              </Row>
            ) : (
              <EmptyTabMessage>이 노드는 Mock Lab binding 대상이 아닙니다.</EmptyTabMessage>
            )}
          </Section>
        ) : null}

        {activeTab === "adk" ? (
          <Section title="ADK">
            {selectedNode.adk_skeleton_contract ? (
              <Row label="contract">
                {selectedNode.adk_skeleton_contract.scaffold_level} ·{" "}
                {selectedNode.adk_skeleton_contract.implementation_template}
              </Row>
            ) : (
              <EmptyTabMessage>ADK Skeleton Contract가 없습니다.</EmptyTabMessage>
            )}
            {selectedNode.adk_node_role ? (
              <p className="graph-inspector-note">ADK role 호환 메타데이터: {selectedNode.adk_node_role}</p>
            ) : null}
          </Section>
        ) : null}
      </aside>
    );
  }

  if (selectedEdge) {
    const edge = selectedEdge;
    const remoteContract = edge.a2a_contract_id
      ? a2aContracts.find((contract) => contract.contract_id === edge.a2a_contract_id) ?? null
      : null;

    return (
      <aside className="graph-inspector">
        <header className="graph-inspector-head">
          <div>
            <p className="eyebrow">엣지 상세</p>
            <h3>
              {nodeLabel(edge.from)} → {nodeLabel(edge.to)}
            </h3>
          </div>
          <button type="button" className="link" onClick={onClose}>
            닫기
          </button>
        </header>

        <GraphElementTabs activeTab={activeTab} onTabChange={setActiveTab} />

        {activeTab === "basic" ? (
          <Section title="기본">
            <Row label="ID">
              <code>{edge.id ?? "—"}</code>
            </Row>
            <Row label="연결">
              {edge.from} → {edge.to}
            </Row>
            <Row label="edge_kind">{edge.edge_kind ?? "event_output"}</Row>
            <Row label="execution">{edge.execution_semantics ?? <EmptyValue />}</Row>
          </Section>
        ) : null}

        {activeTab === "contract" ? (
          <Section title="계약">
            <Row label="data_label">{edge.data_label || <EmptyValue />}</Row>
            {edge.schema_ref ? <Row label="schema">{edge.schema_ref}</Row> : null}
            {edge.route_condition ? <Row label="route">{edge.route_condition}</Row> : null}
            {edge.state_key ? <Row label="state_key">{edge.state_key}</Row> : null}
            {edge.artifact_key ? <Row label="artifact_key">{edge.artifact_key}</Row> : null}
            {edge.a2a_contract_id ? <Row label="A2A 계약">{edge.a2a_contract_id}</Row> : null}
          </Section>
        ) : null}

        {activeTab === "runtime" ? (
          <Section title="실행">
            <Row label="flow_kind">{edge.flow_kind ?? <EmptyValue />}</Row>
            <Row label="call_control">{edge.call_control ?? <EmptyValue />}</Row>
          </Section>
        ) : null}

        {activeTab === "policy" ? (
          <Section title="정책">
            <Row label="boundary">{edge.is_remote_boundary_crossing ? "예" : "아니오"}</Row>
            {edge.edge_kind === "remote_a2a" && onNavigateToA2AContracts ? (
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
          </Section>
        ) : null}

        {activeTab === "mock" ? (
          <Section title="Mock">
            <EmptyTabMessage>엣지는 Mock Lab binding을 직접 갖지 않습니다.</EmptyTabMessage>
          </Section>
        ) : null}

        {activeTab === "adk" ? (
          <Section title="ADK">
            <EmptyTabMessage>엣지는 ADK Skeleton Contract를 직접 갖지 않습니다.</EmptyTabMessage>
          </Section>
        ) : null}
      </aside>
    );
  }

  return null;
}
