import {
  adapterKindLabels,
  agentKindLabels,
  moduleCategoryLabels,
  remoteContractKindLabels,
  workflowKindLabels
} from "../analyzer/classificationRules";
import type {
  FlowDataChannel,
  FlowEdge,
  FlowNode,
  FlowNodeType,
  ModuleCandidate,
  ProcessFlow
} from "../analyzer/types";

interface ProcessFlowViewProps {
  processFlow: ProcessFlow;
  moduleCandidates: ModuleCandidate[];
  onContinue: () => void;
}

interface FlowStage {
  id: string;
  title: string;
  agentType: string;
  detail: string;
  layout: "row" | "parallel";
  marker?: { kind: "parallel" | "loop" | "human_review" | "branch"; label: string };
  nodes: FlowNode[];
}

interface GraphEdgeView {
  edge: FlowEdge;
  from: FlowNode | null;
  to: FlowNode | null;
  channel: FlowDataChannel;
  marker: "branch" | "parallel" | "loop" | "remote" | "local";
}

interface GraphInsightModel {
  edges: GraphEdgeView[];
  stateEdges: GraphEdgeView[];
  artifactEdges: GraphEdgeView[];
  stats: {
    nodeCount: number;
    edgeCount: number;
    branchCount: number;
    mergeCount: number;
    loopCount: number;
    parallelCount: number;
  };
}

const categoryGlyph: Record<string, string> = {
  input: "⇥",
  output: "⇤",
  agent: "◆",
  workflow: "▶",
  adapter: "⚙",
  remote_a2a: "⇨"
};

const subtypeGlyph: Record<string, string> = {
  parallel: "⇉",
  loop: "↻",
  human_review: "✓",
  sequential: "→",
  orchestration: "⋈",
  graph: "⬢",
  dynamic: "λ",
  retrieval: "🔎",
  rule_registry: "§",
  legacy_api: "API",
  data_query: "?",
  template: "T",
  computation: "Σ",
  external_service: "↗",
  specialist: "S",
  shared: "★",
  a2a: "A2A",
  unknown: "·"
};

const markerCopy: Record<NonNullable<FlowStage["marker"]>["kind"], { label: string; glyph: string }> = {
  parallel: { label: "병렬 분기", glyph: "⇉" },
  loop: { label: "재확인 루프", glyph: "↻" },
  human_review: { label: "사람 검토", glyph: "✓" },
  branch: { label: "조건 분기", glyph: "⋔" }
};

const adkHintRows = [
  ["state_memory", "Session/State"],
  ["callbacks", "Callbacks/Guardrail"],
  ["artifacts_events", "Artifacts/Events"],
  ["mcp_a2a", "MCP↔A2A"],
  ["streaming_grounding", "Streaming/Grounding"]
] as const;

const dataChannelLabels: Record<FlowDataChannel, string> = {
  event_output: "Event.output",
  event_message: "Event.message",
  session_state: "Session State",
  temp_state: "temp: State",
  user_state: "user: State",
  app_state: "app: State",
  artifact: "Artifact",
  route: "Route",
  control: "Control",
  unknown: "미정"
};

const dataChannelGlyph: Record<FlowDataChannel, string> = {
  event_output: "O",
  event_message: "M",
  session_state: "S",
  temp_state: "T",
  user_state: "U",
  app_state: "A",
  artifact: "F",
  route: "R",
  control: "C",
  unknown: "?"
};

export function ProcessFlowView({ processFlow, moduleCandidates, onContinue }: ProcessFlowViewProps) {
  const stages = buildFlowStages(processFlow, moduleCandidates);
  const customSignals = detectCustomAgentSignals(processFlow, moduleCandidates);
  const candidateById = new Map(moduleCandidates.map((candidate) => [candidate.id, candidate]));
  const interStageEdges = buildInterStageEdges(stages, processFlow.edges);
  const remoteEdgeCount = processFlow.edges.filter((edge) => edge.edge_type === "remote_a2a").length;
  const graphModel = buildGraphInsightModel(processFlow);
  const graphText = toMermaid(processFlow);

  return (
    <div className="flow-workspace">
      <section className="panel flow-canvas">
        <div className="section-heading flow-heading">
          <div>
            <p className="eyebrow">ADK Workflow 검토</p>
            <h2>프로세스 플로우</h2>
          </div>
          <FlowLegend remoteCount={remoteEdgeCount} />
        </div>

        <GraphOverview model={graphModel} />

        <div className="staged-flow" aria-label="단계별 프로세스 플로우">
          {stages.map((stage, index) => (
            <div className="stage-wrap" key={stage.id}>
              <article className={`flow-stage layout-${stage.layout}`}>
                <header className="stage-header">
                  <div className="stage-titles">
                    <span className="stage-eyebrow">STAGE {index + 1}</span>
                    <h3>{stage.title}</h3>
                    <p>{stage.detail}</p>
                  </div>
                  {stage.marker ? (
                    <span className={`stage-marker marker-${stage.marker.kind}`}>
                      <strong>{markerCopy[stage.marker.kind].glyph}</strong>
                      {stage.marker.label}
                    </span>
                  ) : null}
                </header>

                <div className={`stage-nodes layout-${stage.layout}`}>
                  {stage.nodes.map((node) => {
                    const candidate = candidateById.get(node.id);
                    return <FlowNodeCard key={node.id} node={node} candidate={candidate} />;
                  })}
                </div>
              </article>

              {index < stages.length - 1 && (
                <StageConnector
                  edges={interStageEdges[index] ?? []}
                  isRemote={(interStageEdges[index] ?? []).some((edge) => edge.edge_type === "remote_a2a")}
                />
              )}
            </div>
          ))}
        </div>

        <GraphRouteBoard model={graphModel} />
      </section>

      <aside className="flow-inspector">
        <section className="panel">
          <div className="section-heading">
            <p className="eyebrow">설계 판단</p>
            <h2>분류 가이드</h2>
          </div>
          <ul className="judgment-list">
            <li>
              <strong>
                <span className="cat-glyph cat-agent">◆</span> Agent
              </strong>
              <span>판단, 요약, 분류, 추천 등 reasoning 책임을 가진 단위.</span>
            </li>
            <li>
              <strong>
                <span className="cat-glyph cat-workflow">▶</span> Workflow
              </strong>
              <span>sequential, parallel, loop, human_review, orchestration 같은 control flow.</span>
            </li>
            <li>
              <strong>
                <span className="cat-glyph cat-adapter">⚙</span> Adapter
              </strong>
              <span>callable capability — Legacy API, Retrieval, Rule Registry 등이 subtype.</span>
            </li>
            <li>
              <strong>
                <span className="cat-glyph cat-remote">⇨</span> Remote A2A
              </strong>
              <span>독립 소유 remote agent와의 protocol boundary일 때만 사용.</span>
            </li>
          </ul>
          {customSignals.length ? (
            <div className="custom-warning">
              <strong>Custom Agent 후보 신호</strong>
              <ul>
                {customSignals.map((signal) => (
                  <li key={signal}>{signal}</li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="empty-state">Custom Agent 후보 신호는 감지되지 않았습니다.</p>
          )}
        </section>

        <section className="panel">
          <div className="section-heading">
            <p className="eyebrow">Session/State</p>
            <h2>전달 데이터 저장 위치</h2>
          </div>
          <DataLedger model={graphModel} />
          <p className="state-note">
            ADK 2.0 graph workflow는 node 사이 값을 <code>Event.output</code>으로 넘기고, 작은 진행 값은{" "}
            <code>Event.state</code>와 <code>SessionService</code>로 보존합니다. 큰 파일형 결과는{" "}
            <code>Artifact</code>로 분리합니다.
          </p>
        </section>

        <section className="panel">
          <div className="section-heading">
            <p className="eyebrow">참고</p>
            <h2>Mermaid 형식 초안</h2>
          </div>
          <details className="mermaid-collapsible">
            <summary>그래프 텍스트 펼치기</summary>
            <pre className="json-preview compact-preview">{graphText}</pre>
          </details>
          <div className="actions align-end">
            <button type="button" className="primary" onClick={onContinue}>
              재사용 히트맵으로 이동
            </button>
          </div>
        </section>
      </aside>
    </div>
  );
}

function FlowLegend({ remoteCount }: { remoteCount: number }) {
  return (
    <div className="flow-legend" aria-label="카테고리 범례">
      <span className="legend-chip cat-agent-chip">
        <span className="cat-glyph">◆</span>Agent
      </span>
      <span className="legend-chip cat-workflow-chip">
        <span className="cat-glyph">▶</span>Workflow
      </span>
      <span className="legend-chip cat-adapter-chip">
        <span className="cat-glyph">⚙</span>Adapter
      </span>
      <span className="legend-chip cat-remote-chip">
        <span className="cat-glyph">⇨</span>Remote A2A {remoteCount ? `(${remoteCount})` : ""}
      </span>
    </div>
  );
}

function GraphOverview({ model }: { model: GraphInsightModel }) {
  const { stats } = model;
  return (
    <div className="graph-overview" aria-label="ADK 2.0 graph workflow topology summary">
      <GraphStat label="Nodes" value={stats.nodeCount} />
      <GraphStat label="Edges" value={stats.edgeCount} />
      <GraphStat label="Branch" value={stats.branchCount} />
      <GraphStat label="Merge" value={stats.mergeCount} />
      <GraphStat label="Parallel" value={stats.parallelCount} />
      <GraphStat label="Loop" value={stats.loopCount} />
    </div>
  );
}

function GraphStat({ label, value }: { label: string; value: number }) {
  return (
    <span className={`graph-stat ${value > 0 ? "active" : ""}`}>
      <strong>{value}</strong>
      {label}
    </span>
  );
}

function GraphRouteBoard({ model }: { model: GraphInsightModel }) {
  return (
    <section className="graph-route-board" aria-label="Graph route and data transfer inspection">
      <header className="graph-route-head">
        <div>
          <p className="eyebrow">ADK 2.0 Graph Routes</p>
          <h3>Edge별 데이터 전달</h3>
        </div>
        <span>{model.edges.length}개 edge</span>
      </header>
      <div className="graph-edge-list">
        {model.edges.map((edgeView, index) => (
          <GraphEdgeCard edgeView={edgeView} key={`${edgeView.edge.from}-${edgeView.edge.to}-${index}`} />
        ))}
      </div>
    </section>
  );
}

function GraphEdgeCard({ edgeView }: { edgeView: GraphEdgeView }) {
  const { edge, from, to, channel, marker } = edgeView;
  const storageRefs = getEdgeStorageRefs(edge);
  return (
    <article className={`graph-edge-card marker-${marker}`}>
      <div className="graph-edge-path">
        <strong>{from?.label ?? edge.from}</strong>
        <span>{markerGlyph(marker)}</span>
        <strong>{to?.label ?? edge.to}</strong>
      </div>
      <div className="graph-edge-data">
        <span className={`data-channel channel-${channel}`}>
          <span className="cat-glyph" aria-hidden="true">
            {dataChannelGlyph[channel]}
          </span>
          {dataChannelLabels[channel]}
        </span>
        <span className="graph-edge-payload">{simplifyEdgeData(edge.data)}</span>
      </div>
      {storageRefs.length ? (
        <div className="graph-edge-storage">
          {storageRefs.map((ref) => (
            <span key={ref}>{ref}</span>
          ))}
        </div>
      ) : null}
    </article>
  );
}

function DataLedger({ model }: { model: GraphInsightModel }) {
  const ledgerEdges = [...model.stateEdges, ...model.artifactEdges];
  if (!ledgerEdges.length) {
    return <p className="empty-state">State/Artifact edge metadata가 아직 없습니다.</p>;
  }
  return (
    <div className="data-ledger">
      {ledgerEdges.map((edgeView, index) => (
        <div className="data-ledger-row" key={`${edgeView.edge.from}-${edgeView.edge.to}-${index}`}>
          <span>{dataChannelLabels[edgeView.channel]}</span>
          <strong>{getPrimaryStorageRef(edgeView.edge)}</strong>
          <em>{edgeView.from?.label ?? edgeView.edge.from} → {edgeView.to?.label ?? edgeView.edge.to}</em>
        </div>
      ))}
    </div>
  );
}

function FlowNodeCard({ node, candidate }: { node: FlowNode; candidate?: ModuleCandidate }) {
  const cat = node.type;
  const subtypeLabel = node.subtype ? formatSubtype(node.subtype) : null;
  const subtypeGlyphChar = node.subtype ? subtypeGlyph[node.subtype] ?? "·" : null;
  const reuse = candidate?.reuse_candidate;
  const risk = candidate?.risk_level;
  const hintRows = getAdkHintRows(candidate);

  return (
    <article className={`flow-node cat-${cat}`}>
      <div className="flow-node-stripe" aria-hidden="true" />
      <header className="flow-node-head">
        <span className="flow-node-cat">
          <span className="cat-glyph" aria-hidden="true">
            {categoryGlyph[cat] ?? "·"}
          </span>
          {formatNodeTypeShort(cat)}
        </span>
        {subtypeLabel ? (
          <span className="flow-node-subtype" title={subtypeLabel}>
            <span className="cat-glyph subtype-glyph" aria-hidden="true">
              {subtypeGlyphChar}
            </span>
            {subtypeLabel}
          </span>
        ) : null}
      </header>
      <strong className="flow-node-label">{node.label}</strong>
      {candidate?.rationale ? <p className="flow-node-rationale">{candidate.rationale}</p> : null}
      {hintRows.length ? (
        <details className="flow-node-hints">
          <summary>ADK 구현 힌트</summary>
          {hintRows.map((hint) => (
            <div className="adk-hint-row" key={hint.key}>
              <span className="adk-hint-key">{hint.label}</span>
              <span className="adk-hint-value">{hint.value}</span>
            </div>
          ))}
        </details>
      ) : null}
      {(reuse || risk) && (
        <div className="flow-node-meta">
          {reuse ? <span className="flow-node-meta-chip reuse">재사용 후보</span> : null}
          {risk ? <span className={`flow-node-meta-chip risk-${risk}`}>위험 {riskLabel(risk)}</span> : null}
        </div>
      )}
    </article>
  );
}

function StageConnector({ edges, isRemote }: { edges: FlowEdge[]; isRemote: boolean }) {
  const labels = uniqueEdgeLabels(edges);
  return (
    <div className={`stage-connector ${isRemote ? "remote" : ""}`} aria-hidden={!labels.length}>
      <div className="stage-connector-arrow">{isRemote ? "⇨" : "↓"}</div>
      {labels.length ? (
        <div className="stage-connector-labels">
          {labels.map((label) => (
            <span key={label}>{label}</span>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function getAdkHintRows(candidate?: ModuleCandidate) {
  const hints = candidate?.adk_hints;
  if (!hints) {
    return [];
  }
  return adkHintRows.flatMap(([key, label]) => {
    const value = hints[key];
    return typeof value === "string" && value.trim() ? [{ key, label, value }] : [];
  });
}

function uniqueEdgeLabels(edges: FlowEdge[]): string[] {
  const seen = new Set<string>();
  const labels: string[] = [];
  edges.forEach((edge) => {
    const label = simplifyEdgeData(edge.data);
    if (label && !seen.has(label)) {
      seen.add(label);
      labels.push(label);
    }
  });
  return labels.slice(0, 4);
}

function simplifyEdgeData(data: string): string {
  if (!data) return "";
  if (data.startsWith("parallel:")) return `⇉ ${data.replace("parallel:", "").trim()}`;
  if (data.startsWith("loop:")) return `↻ ${data.replace("loop:", "").trim()}`;
  if (data.startsWith("branch:")) return `⋔ ${data.replace("branch:", "").trim()}`;
  return data;
}

function buildGraphInsightModel(processFlow: ProcessFlow): GraphInsightModel {
  const nodeById = new Map(processFlow.nodes.map((node) => [node.id, node]));
  const incoming = new Map<string, number>();
  const outgoing = new Map<string, number>();
  processFlow.nodes.forEach((node) => {
    incoming.set(node.id, 0);
    outgoing.set(node.id, 0);
  });
  processFlow.edges.forEach((edge) => {
    outgoing.set(edge.from, (outgoing.get(edge.from) ?? 0) + 1);
    incoming.set(edge.to, (incoming.get(edge.to) ?? 0) + 1);
  });

  const edges = processFlow.edges.map((edge): GraphEdgeView => {
    const marker = inferEdgeMarker(edge, outgoing.get(edge.from) ?? 0);
    return {
      edge,
      from: nodeById.get(edge.from) ?? null,
      to: nodeById.get(edge.to) ?? null,
      channel: inferDataChannel(edge),
      marker
    };
  });

  const branchNodes = new Set(
    processFlow.nodes
      .filter((node) => (outgoing.get(node.id) ?? 0) > 1)
      .map((node) => node.id)
  );
  const mergeNodes = new Set(
    processFlow.nodes
      .filter((node) => (incoming.get(node.id) ?? 0) > 1)
      .map((node) => node.id)
  );

  return {
    edges,
    stateEdges: edges.filter((edgeView) => isStateChannel(edgeView.channel) || Boolean(edgeView.edge.state_key)),
    artifactEdges: edges.filter((edgeView) => edgeView.channel === "artifact" || Boolean(edgeView.edge.artifact_key)),
    stats: {
      nodeCount: processFlow.nodes.length,
      edgeCount: processFlow.edges.length,
      branchCount: branchNodes.size + edges.filter((edgeView) => edgeView.marker === "branch").length,
      mergeCount: mergeNodes.size,
      loopCount: edges.filter((edgeView) => edgeView.marker === "loop").length,
      parallelCount: edges.filter((edgeView) => edgeView.marker === "parallel").length
    }
  };
}

function inferDataChannel(edge: FlowEdge): FlowDataChannel {
  if (edge.data_channel) {
    return edge.data_channel;
  }
  const data = edge.data.toLowerCase();
  if (edge.artifact_key || data.includes("artifact") || data.includes("file") || data.includes("report")) {
    return "artifact";
  }
  if (edge.state_key) {
    if (edge.state_key.startsWith("temp:")) return "temp_state";
    if (edge.state_key.startsWith("user:")) return "user_state";
    if (edge.state_key.startsWith("app:")) return "app_state";
    return "session_state";
  }
  if (data.startsWith("branch:")) return "route";
  if (data.startsWith("loop:") || data.includes("escalate") || data.includes("retry")) return "control";
  if (data.includes("approval") || data.includes("human") || data.includes("message") || data.includes("사용자")) {
    return "event_message";
  }
  return "event_output";
}

function inferEdgeMarker(edge: FlowEdge, outgoingCount: number): GraphEdgeView["marker"] {
  if (edge.edge_type === "remote_a2a") return "remote";
  if (edge.data.startsWith("loop:")) return "loop";
  if (edge.data.startsWith("branch:") || edge.route_condition) return "branch";
  if (edge.data.startsWith("parallel:") || outgoingCount > 1) return "parallel";
  return "local";
}

function isStateChannel(channel: FlowDataChannel): boolean {
  return channel === "session_state" || channel === "temp_state" || channel === "user_state" || channel === "app_state";
}

function getEdgeStorageRefs(edge: FlowEdge): string[] {
  return [
    edge.route_condition ? `route=${edge.route_condition}` : "",
    edge.state_key ? `state=${edge.state_key}` : "",
    edge.artifact_key ? `artifact=${edge.artifact_key}` : "",
    edge.schema_ref ? `schema=${edge.schema_ref}` : ""
  ].filter(Boolean);
}

function getPrimaryStorageRef(edge: FlowEdge): string {
  return edge.state_key ?? edge.artifact_key ?? edge.schema_ref ?? edge.route_condition ?? edge.data;
}

function markerGlyph(marker: GraphEdgeView["marker"]): string {
  if (marker === "branch") return "⋔";
  if (marker === "parallel") return "⇉";
  if (marker === "loop") return "↻";
  if (marker === "remote") return "⇨";
  return "→";
}

function buildFlowStages(processFlow: ProcessFlow, moduleCandidates: ModuleCandidate[]): FlowStage[] {
  const candidateById = new Map(moduleCandidates.map((candidate) => [candidate.id, candidate]));
  const nodeIds = new Set(processFlow.nodes.map((node) => node.id));
  const validEdges = processFlow.edges.filter((edge) => nodeIds.has(edge.from) && nodeIds.has(edge.to));
  const components = findStronglyConnectedComponents(processFlow.nodes, validEdges);
  const componentByNode = new Map<string, number>();

  components.forEach((component, index) => {
    component.forEach((nodeId) => componentByNode.set(nodeId, index));
  });

  const componentEdges = new Map<number, Set<number>>();
  const incomingCounts = new Map<number, number>();
  components.forEach((_, index) => {
    componentEdges.set(index, new Set());
    incomingCounts.set(index, 0);
  });

  validEdges.forEach((edge) => {
    const fromComponent = componentByNode.get(edge.from);
    const toComponent = componentByNode.get(edge.to);
    if (fromComponent === undefined || toComponent === undefined || fromComponent === toComponent) {
      return;
    }
    const outgoing = componentEdges.get(fromComponent);
    if (outgoing && !outgoing.has(toComponent)) {
      outgoing.add(toComponent);
      incomingCounts.set(toComponent, (incomingCounts.get(toComponent) ?? 0) + 1);
    }
  });

  const componentLevels = computeComponentLevels(components, componentEdges, incomingCounts);
  const cycleLevels = new Set<number>();
  const nodeLevels = new Map<string, number>();

  components.forEach((component, index) => {
    const level = componentLevels.get(index) ?? 0;
    if (component.length >= 2) {
      cycleLevels.add(level);
    }
    component.forEach((nodeId) => nodeLevels.set(nodeId, level));
  });

  const nodesByLevel = new Map<number, FlowNode[]>();
  processFlow.nodes.forEach((node) => {
    const level = nodeLevels.get(node.id) ?? 0;
    const stageNodes = nodesByLevel.get(level) ?? [];
    stageNodes.push(node);
    nodesByLevel.set(level, stageNodes);
  });

  return Array.from(nodesByLevel.entries())
    .sort(([left], [right]) => left - right)
    .map(([level, nodes]) => buildStage(level, nodes, candidateById, validEdges, cycleLevels.has(level)))
    .filter((stage) => stage.nodes.length);
}

function computeComponentLevels(
  components: string[][],
  componentEdges: Map<number, Set<number>>,
  incomingCounts: Map<number, number>
): Map<number, number> {
  const levels = new Map<number, number>();
  const remainingIncoming = new Map(incomingCounts);
  const roots = components.map((_, index) => index).filter((index) => (incomingCounts.get(index) ?? 0) === 0);
  const queue = roots.length ? [...roots] : components.map((_, index) => index);

  queue.forEach((index) => levels.set(index, 0));

  for (let cursor = 0; cursor < queue.length; cursor += 1) {
    const current = queue[cursor];
    const currentLevel = levels.get(current) ?? 0;
    componentEdges.get(current)?.forEach((next) => {
      levels.set(next, Math.max(levels.get(next) ?? 0, currentLevel + 1));
      remainingIncoming.set(next, (remainingIncoming.get(next) ?? 0) - 1);
      if (remainingIncoming.get(next) === 0) {
        queue.push(next);
      }
    });
  }

  components.forEach((_, index) => {
    if (!levels.has(index)) {
      levels.set(index, 0);
    }
  });

  return levels;
}

function buildStage(
  level: number,
  nodes: FlowNode[],
  candidateById: Map<string, ModuleCandidate>,
  edges: FlowEdge[],
  forceLoopMarker: boolean
): FlowStage {
  const nodeIds = new Set(nodes.map((node) => node.id));
  const candidates = nodes
    .map((node) => candidateById.get(node.id))
    .filter((candidate): candidate is ModuleCandidate => Boolean(candidate));
  const incomingEdges = edges.filter((edge) => nodeIds.has(edge.to));
  const layout = detectStageLayout(nodes);
  const descriptor = describeStage(nodes);

  return {
    id: `stage-${level}-${nodes.map((node) => safeId(node.id)).join("-")}`,
    ...descriptor,
    layout,
    marker: detectStageMarker(layout, candidates, incomingEdges, forceLoopMarker),
    nodes
  };
}

function detectStageLayout(nodes: FlowNode[]): FlowStage["layout"] {
  const categoryCounts = new Map<string, number>();
  nodes.forEach((node) => {
    if (node.type === "input" || node.type === "output") {
      return;
    }
    categoryCounts.set(node.type, (categoryCounts.get(node.type) ?? 0) + 1);
  });
  return Array.from(categoryCounts.values()).some((count) => count >= 2) ? "parallel" : "row";
}

function detectStageMarker(
  layout: FlowStage["layout"],
  candidates: ModuleCandidate[],
  incomingEdges: FlowEdge[],
  forceLoopMarker: boolean
): FlowStage["marker"] {
  const hasLoop =
    forceLoopMarker ||
    candidates.some((candidate) => candidate.workflow_kind === "loop") ||
    incomingEdges.some((edge) => edge.data.startsWith("loop:"));
  if (hasLoop) {
    return { kind: "loop", label: "Loop" };
  }
  if (layout === "parallel" || candidates.some((candidate) => candidate.workflow_kind === "parallel")) {
    return { kind: "parallel", label: "Parallel" };
  }
  if (
    candidates.some(
      (candidate) =>
        candidate.workflow_kind === "human_review" || candidate.risk_signals.includes("human_approval_required")
    )
  ) {
    return { kind: "human_review", label: "Human Review" };
  }
  if (incomingEdges.some((edge) => edge.data.startsWith("branch:"))) {
    return { kind: "branch", label: "Branch" };
  }
  return undefined;
}

function describeStage(nodes: FlowNode[]): Pick<FlowStage, "title" | "agentType" | "detail"> {
  const allInput = nodes.every((node) => node.type === "input");
  const allOutput = nodes.every((node) => node.type === "output");
  const anyRemote = nodes.some((node) => node.type === "remote_a2a");
  const allAdapter = nodes.length > 0 && nodes.every((node) => node.type === "adapter");
  const ruleRegistryOnly = allAdapter && nodes.every((node) => node.subtype === "rule_registry");
  const hasAgentOrWorkflow = nodes.some((node) => node.type === "agent" || node.type === "workflow");

  if (allInput) {
    return {
      title: "입력 컨텍스트",
      agentType: "Session State",
      detail: "원문 요구사항과 식별자는 Session.state의 draft scratchpad로 검토합니다."
    };
  }
  if (allOutput) {
    return {
      title: "결과 산출",
      agentType: "output_key",
      detail: "output_key로 보존할 최종 산출물과 하위 아티팩트 경계를 확인합니다."
    };
  }
  if (anyRemote) {
    return {
      title: "Remote A2A 경계",
      agentType: "Remote Agent",
      detail: "독립 소유 remote agent와의 protocol boundary. 계약, 인증, timeout, retry, fallback, audit 검토 필요."
    };
  }
  if (ruleRegistryOnly) {
    return {
      title: "Rule Registry 라우팅",
      agentType: "Adapter / rule_registry",
      detail: "관리되는 라우팅 규칙을 조회해 다음 경로를 결정합니다. 규칙은 prompt가 아니라 registry에서 조회합니다."
    };
  }
  if (allAdapter) {
    return {
      title: nodes.length >= 2 ? "Adapter 호출 (병렬 검토)" : "Adapter 호출",
      agentType: "Adapter",
      detail:
        nodes.length >= 2
          ? "독립적인 Legacy API 또는 Retrieval Adapter는 local parallel branch로 검토할 수 있습니다."
          : "Adapter는 Agent나 Workflow가 호출하는 callable capability입니다."
    };
  }
  if (hasAgentOrWorkflow) {
    return {
      title: "Local 검토 / Orchestration",
      agentType: "Workflow / Agent",
      detail: "context collection 이후의 local handoff, review, recommendation은 Workflow 또는 Agent node로 유지합니다."
    };
  }
  return {
    title: "추가 모듈",
    agentType: "Module",
    detail: "스테이지에 자동 배치되지 않은 module candidate입니다."
  };
}

function findStronglyConnectedComponents(nodes: FlowNode[], edges: FlowEdge[]): string[][] {
  const adjacency = new Map<string, string[]>();
  nodes.forEach((node) => adjacency.set(node.id, []));
  edges.forEach((edge) => {
    adjacency.get(edge.from)?.push(edge.to);
  });

  const indexes = new Map<string, number>();
  const lowlinks = new Map<string, number>();
  const stack: string[] = [];
  const onStack = new Set<string>();
  const components: string[][] = [];
  let nextIndex = 0;

  function visit(nodeId: string) {
    indexes.set(nodeId, nextIndex);
    lowlinks.set(nodeId, nextIndex);
    nextIndex += 1;
    stack.push(nodeId);
    onStack.add(nodeId);

    adjacency.get(nodeId)?.forEach((nextId) => {
      if (!indexes.has(nextId)) {
        visit(nextId);
        lowlinks.set(nodeId, Math.min(lowlinks.get(nodeId) ?? 0, lowlinks.get(nextId) ?? 0));
      } else if (onStack.has(nextId)) {
        lowlinks.set(nodeId, Math.min(lowlinks.get(nodeId) ?? 0, indexes.get(nextId) ?? 0));
      }
    });

    if (lowlinks.get(nodeId) !== indexes.get(nodeId)) {
      return;
    }

    const component: string[] = [];
    let current: string | undefined;
    do {
      current = stack.pop();
      if (current === undefined) {
        break;
      }
      onStack.delete(current);
      component.push(current);
    } while (current !== nodeId);
    components.push(component);
  }

  nodes.forEach((node) => {
    if (!indexes.has(node.id)) {
      visit(node.id);
    }
  });

  return components;
}

function buildInterStageEdges(stages: FlowStage[], edges: FlowEdge[]): FlowEdge[][] {
  const stageOf = new Map<string, number>();
  stages.forEach((stage, index) => {
    stage.nodes.forEach((node) => stageOf.set(node.id, index));
  });

  const buckets: FlowEdge[][] = stages.map(() => []);
  edges.forEach((edge) => {
    const fromStage = stageOf.get(edge.from);
    const toStage = stageOf.get(edge.to);
    if (fromStage === undefined || toStage === undefined) return;
    if (toStage <= fromStage) return;
    buckets[fromStage].push(edge);
  });
  return buckets;
}

function detectCustomAgentSignals(processFlow: ProcessFlow, moduleCandidates: ModuleCandidate[]): string[] {
  const labels = processFlow.nodes.map((node) => node.label.toLowerCase()).join(" ");
  const moduleText = moduleCandidates
    .map((candidate) => `${candidate.name} ${candidate.rationale}`)
    .join(" ")
    .toLowerCase();
  const edgeText = processFlow.edges.map((edge) => edge.data.toLowerCase()).join(" ");
  const combined = `${labels} ${moduleText} ${edgeText}`;
  const signals: string[] = [];

  if (/\b(route|routing|threshold|conditional|branch)\b/.test(combined)) {
    signals.push("conditional routing 또는 threshold 기반 branch가 보이면 Custom Agent가 필요한지 검토합니다.");
  }
  if (/\b(dynamic|select|selection|delegate)\b/.test(combined)) {
    signals.push("dynamic agent selection 또는 delegated task 흐름이 보이면 predefined workflow만으로 충분한지 확인합니다.");
  }
  if (processFlow.nodes.some((node) => node.type === "remote_a2a")) {
    signals.push("independent remote boundary가 포함되면 external integration flow control을 별도로 검토합니다.");
  }
  if (processFlow.nodes.some((node) => node.type === "workflow") && processFlow.edges.length > processFlow.nodes.length) {
    signals.push("fan-in/fan-out이 많은 internal workflow는 complex state management 여부를 확인합니다.");
  }

  return signals;
}

function toMermaid(processFlow: ProcessFlow): string {
  const nodeLines = processFlow.nodes.map((node) => {
    const subtype = node.subtype ? `: ${formatSubtype(node.subtype)}` : "";
    return `  ${safeId(node.id)}["${node.label} (${formatNodeTypeShort(node.type)}${subtype})"]`;
  });
  const edgeLines = processFlow.edges.map((edge) => {
    const label = edge.edge_type === "remote_a2a" ? `remote_a2a: ${edge.data}` : edge.data;
    return `  ${safeId(edge.from)} -->|"${label}"| ${safeId(edge.to)}`;
  });
  return ["graph LR", ...nodeLines, ...edgeLines].join("\n");
}

function safeId(value: string): string {
  return value.replace(/[^a-zA-Z0-9_]/g, "_");
}

function formatNodeTypeShort(type: FlowNodeType): string {
  if (type === "input") return "입력";
  if (type === "output") return "출력";
  return moduleCategoryLabels[type];
}

function formatSubtype(value: string): string {
  return (
    adapterKindLabels[value as keyof typeof adapterKindLabels] ??
    workflowKindLabels[value as keyof typeof workflowKindLabels] ??
    agentKindLabels[value as keyof typeof agentKindLabels] ??
    remoteContractKindLabels[value as keyof typeof remoteContractKindLabels] ??
    value
  );
}

function riskLabel(level: ModuleCandidate["risk_level"]): string {
  if (level === "low") return "낮음";
  if (level === "medium") return "중간";
  return "높음";
}
