import { useEffect, useMemo, useState, type ReactNode } from "react";
import type {
  A2AContract,
  GraphEdge,
  GraphIR,
  GraphNode,
  ModuleCandidate,
  ModuleCategory
} from "../analyzer/types";
import { CategoryBadge, SubtypeBadge, getSubtypeValue } from "./CategoryBadge";
import {
  availableGraphElementGroups,
  nextGraphElementGroupAfterSelectionChange,
  type GraphElementGroup,
  type GraphElementGroupId
} from "./graphElementEditorModel";
import { routeMapForNode, upstreamHumanPromptForRouter, type GraphRouteSummary } from "./graph/layout";
import { FieldSpecList, JsonDetails, MappingTable, SchemaRefCards } from "./GraphSchemaDetails";

interface GraphInspectorProps {
  selectedNode: GraphNode | null;
  selectedEdge: GraphEdge | null;
  graphIR: GraphIR | null;
  nodeLabel: (id: string) => string;
  candidate: ModuleCandidate | null;
  a2aContracts: A2AContract[];
  catalogContracts?: Record<string, unknown>;
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

function InlineList({ values }: { values: readonly string[] }) {
  if (!values.length) return <EmptyValue />;
  return (
    <div className="graph-inspector-chips">
      {values.map((value) => (
        <span key={value} className="chip">
          {value}
        </span>
      ))}
    </div>
  );
}

function RouteMapTable({ routes }: { routes: readonly GraphRouteSummary[] }) {
  return (
    <div className="graph-route-map-table">
      {routes.map((route) => (
        <div
          key={`${route.value}:${route.targetNodeId}`}
          className="graph-route-map-row"
          title={`${route.value} -> ${route.targetLabel}${route.aliases.length ? `; aliases: ${route.aliases.join(", ")}` : ""}`}
        >
          <span className="graph-route-value">route: {route.value}</span>
          <span className="graph-route-target">target: {route.targetLabel}</span>
          {route.isDefault ? <span className="graph-route-default">default</span> : null}
          {route.aliases.length ? <span className="graph-route-aliases">aliases: {route.aliases.join(", ")}</span> : null}
        </div>
      ))}
    </div>
  );
}

function GraphElementTabs({
  activeGroup,
  groups,
  onGroupChange
}: {
  activeGroup: GraphElementGroupId;
  groups: readonly GraphElementGroup[];
  onGroupChange: (group: GraphElementGroupId) => void;
}) {
  return (
    <div className="graph-element-tabs" role="tablist" aria-label="그래프 요소 상세 그룹">
      {groups.map((group) => (
        <button
          key={group.id}
          type="button"
          role="tab"
          aria-selected={activeGroup === group.id}
          className={`graph-element-tab${activeGroup === group.id ? " is-active" : ""}`}
          onClick={() => onGroupChange(group.id)}
        >
          {group.label}
        </button>
      ))}
    </div>
  );
}

export function GraphInspector(props: GraphInspectorProps) {
  const {
    selectedNode,
    selectedEdge,
    graphIR,
    nodeLabel,
    candidate,
    a2aContracts,
    catalogContracts = {},
    onNavigateToA2AContracts,
    onClose
  } = props;
  const [activeGroup, setActiveGroup] = useState<GraphElementGroupId>("summary");
  const selectionKey = selectedNode
    ? `node:${selectedNode.id}`
    : selectedEdge
      ? `edge:${selectedEdge.id ?? `${selectedEdge.from}->${selectedEdge.to}`}`
      : "empty";
  const groups = useMemo(
    () => availableGraphElementGroups({ selectedNode, selectedEdge, candidate }),
    [selectedNode, selectedEdge, candidate]
  );

  useEffect(() => {
    setActiveGroup((currentGroup) => nextGraphElementGroupAfterSelectionChange(currentGroup, groups));
  }, [selectionKey, groups]);

  if (!selectedNode && !selectedEdge) {
    return (
      <section className="graph-inspector empty">
        <p>노드 또는 엣지를 선택하면 상세 정보가 표시됩니다.</p>
      </section>
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
    const graphNodes = graphIR?.nodes ?? [];
    const graphEdges = graphIR?.edges ?? [];
    const nodeById = new Map(graphNodes.map((node) => [node.id, node]));
    const routeMap = selectedNode.node_kind === "router" ? routeMapForNode(selectedNode.id, graphEdges, nodeById) : [];
    const upstreamHumanPrompt =
      selectedNode.node_kind === "router" ? upstreamHumanPromptForRouter(selectedNode.id, graphEdges, nodeById) : null;

    return (
      <section className="graph-inspector">
        <header className="graph-inspector-head">
          <div>
            <p className="eyebrow">노드 상세</p>
            <h3>{selectedNode.label}</h3>
          </div>
          <button type="button" className="link" onClick={onClose}>
            닫기
          </button>
        </header>

        <GraphElementTabs activeGroup={activeGroup} groups={groups} onGroupChange={setActiveGroup} />

        {activeGroup === "summary" ? (
          <Section title="요약">
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

        {activeGroup === "io" ? (
          <Section title="입출력">
            <Row label="schemas">
              <SchemaRefCards refs={schemaRefs} contracts={catalogContracts} candidate={candidate} mockBinding={selectedNode.mock_binding} />
            </Row>
            {candidate?.inputs?.length ? <FieldSpecList title="candidate inputs" fields={candidate.inputs} /> : null}
            {candidate?.outputs?.length ? <FieldSpecList title="candidate outputs" fields={candidate.outputs} /> : null}
            {selectedNode.input_schema ? <Row label="input_schema">{selectedNode.input_schema}</Row> : null}
            {selectedNode.output_schema ? <Row label="output_schema">{selectedNode.output_schema}</Row> : null}
            {selectedNode.workflow_ref ? (
              <>
                <Row label="input_mapping">
                  <MappingTable mapping={selectedNode.input_mapping} emptyLabel="명시된 입력 mapping이 없습니다." />
                </Row>
                <Row label="output_mapping">
                  <MappingTable mapping={selectedNode.output_mapping} emptyLabel="명시된 출력 mapping이 없습니다." />
                </Row>
              </>
            ) : null}
            {selectedNode.node_kind === "human_input" ? (
              <>
                <Row label="payload_schema">
                  {selectedNode.human_input_contract?.payload_schema_ref ?? <EmptyValue />}
                </Row>
                <Row label="response_schema">
                  {selectedNode.human_input_contract?.response_schema_ref ?? "str"}
                </Row>
                <Row label="response_mapping">
                  <MappingTable mapping={selectedNode.human_input_contract?.response_mapping} emptyLabel="응답 mapping이 없습니다." />
                </Row>
              </>
            ) : null}
          </Section>
        ) : null}

        {activeGroup === "flow" ? (
          <Section title="흐름">
            {selectedNode.node_kind === "router" ? (
              <>
                <Row label="upstream prompt">{upstreamHumanPrompt ?? <EmptyValue />}</Row>
                <Row label="routes">
                  {routeMap.length ? <RouteMapTable routes={routeMap} /> : <EmptyValue />}
                </Row>
              </>
            ) : null}
            {selectedNode.node_kind === "human_input" ? (
              <>
                <Row label="RequestInput">{selectedNode.human_input_contract?.message ?? selectedNode.label}</Row>
                <Row label="choice_options">
                  <InlineList values={selectedNode.human_input_contract?.choice_options ?? []} />
                </Row>
                <Row label="default_choice">{selectedNode.human_input_contract?.default_choice ?? <EmptyValue />}</Row>
                <Row label="accepted_aliases">
                  <code>{JSON.stringify(selectedNode.human_input_contract?.accepted_aliases ?? {})}</code>
                </Row>
              </>
            ) : null}
            {selectedNode.node_kind === "callback_wait" ? (
              <EmptyTabMessage>외부 callback 또는 resume 이벤트를 기다리는 지점입니다.</EmptyTabMessage>
            ) : null}
            {selectedNode.node_kind === "loop_control" ? (
              <EmptyTabMessage>반복 진입·종료 제어 노드입니다. 반복 조건은 연결 edge와 container에서 검토합니다.</EmptyTabMessage>
            ) : null}
          </Section>
        ) : null}

        {activeGroup === "runtime" ? (
          <Section title="호출·런타임">
            {selectedNode.workflow_ref ? (
              <Row label="workflow_ref">
                {selectedNode.workflow_ref.display_name} · {selectedNode.workflow_ref.id}
                {selectedNode.workflow_ref.version ? ` · ${selectedNode.workflow_ref.version}` : ""}
              </Row>
            ) : null}
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
            {selectedNode.mock_binding ? (
              <>
                <Row label="Mock Lab">
                  {selectedNode.mock_binding.status} · {selectedNode.mock_binding.mock_server_id ?? "missing"} ·{" "}
                  {selectedNode.mock_binding.tool_name ?? "missing"}
                </Row>
                <Row label="sample_response">{selectedNode.mock_binding.sample_response_ref ?? <EmptyValue />}</Row>
              </>
            ) : null}
          </Section>
        ) : null}

        {activeGroup === "risk" ? (
          <Section title="검토·리스크">
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

        {activeGroup === "adk" ? (
          <Section title="ADK Skeleton">
            {selectedNode.adk_skeleton_contract ? (
              <>
                <Row label="contract">
                  {selectedNode.adk_skeleton_contract.scaffold_level} ·{" "}
                  {selectedNode.adk_skeleton_contract.implementation_template}
                </Row>
                <Row label="manual_completion_required">
                  {selectedNode.adk_skeleton_contract.manual_completion_required ? "예" : "아니오"}
                </Row>
                <Row label="developer_todos">
                  <InlineList values={selectedNode.adk_skeleton_contract.developer_todos} />
                </Row>
              </>
            ) : (
              <EmptyTabMessage>ADK Skeleton Contract가 없습니다.</EmptyTabMessage>
            )}
            {selectedNode.adk_node_role ? (
              <p className="graph-inspector-note">ADK role 호환 메타데이터: {selectedNode.adk_node_role}</p>
            ) : null}
          </Section>
        ) : null}

        {activeGroup === "raw" ? (
          <Section title="원본 Graph IR">
            <JsonDetails label="node JSON" value={selectedNode} />
          </Section>
        ) : null}
      </section>
    );
  }

  if (selectedEdge) {
    const edge = selectedEdge;
    const remoteContract = edge.a2a_contract_id
      ? a2aContracts.find((contract) => contract.contract_id === edge.a2a_contract_id) ?? null
      : null;

    return (
      <section className="graph-inspector">
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

        <GraphElementTabs activeGroup={activeGroup} groups={groups} onGroupChange={setActiveGroup} />

        {activeGroup === "summary" ? (
          <Section title="요약">
            <Row label="ID">
              <code>{edge.id ?? "—"}</code>
            </Row>
            <Row label="연결">
              {nodeLabel(edge.from)} → {nodeLabel(edge.to)}
            </Row>
            <Row label="edge_kind">{edge.edge_kind ?? "event_output"}</Row>
            <Row label="execution">{edge.execution_semantics ?? <EmptyValue />}</Row>
          </Section>
        ) : null}

        {activeGroup === "io" ? (
          <Section title="입출력">
            <Row label="data_label">{edge.data_label || <EmptyValue />}</Row>
            {edge.schema_ref ? (
              <Row label="schema">
                <SchemaRefCards refs={[edge.schema_ref]} contracts={catalogContracts} candidate={null} />
              </Row>
            ) : null}
            {edge.state_key ? <Row label="state_key">{edge.state_key}</Row> : null}
            {edge.artifact_key ? <Row label="artifact_key">{edge.artifact_key}</Row> : null}
            {edge.a2a_contract_id ? <Row label="A2A 계약">{edge.a2a_contract_id}</Row> : null}
          </Section>
        ) : null}

        {activeGroup === "flow" ? (
          <Section title="흐름">
            <Row label="flow_kind">{edge.flow_kind ?? <EmptyValue />}</Row>
            <Row label="call_control">{edge.call_control ?? <EmptyValue />}</Row>
            {edge.route_condition ? <Row label="route_condition">{edge.route_condition}</Row> : null}
            {edge.route_aliases?.length ? <Row label="route_aliases">{edge.route_aliases.join(", ")}</Row> : null}
            {edge.edge_kind === "route" ? <Row label="default_route">{edge.is_default_route ? "예" : "아니오"}</Row> : null}
          </Section>
        ) : null}

        {activeGroup === "risk" ? (
          <Section title="검토·리스크">
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

        {activeGroup === "raw" ? (
          <Section title="원본 Graph IR">
            <JsonDetails label="edge JSON" value={edge} />
          </Section>
        ) : null}
      </section>
    );
  }

  return null;
}
