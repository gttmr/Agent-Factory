import {
  adapterKindLabels,
  agentKindLabels,
  moduleCategoryLabels,
  remoteContractKindLabels,
  workflowKindLabels
} from "../analyzer/classificationRules";
import type {
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

export function ProcessFlowView({ processFlow, moduleCandidates, onContinue }: ProcessFlowViewProps) {
  const stages = buildFlowStages(processFlow, moduleCandidates);
  const customSignals = detectCustomAgentSignals(processFlow, moduleCandidates);
  const candidateById = new Map(moduleCandidates.map((candidate) => [candidate.id, candidate]));
  const interStageEdges = buildInterStageEdges(stages, processFlow.edges);
  const remoteEdgeCount = processFlow.edges.filter((edge) => edge.edge_type === "remote_a2a").length;
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
            <h2>Session/State 계획</h2>
          </div>
          <div className="state-key-grid">
            {["current_step", "temp:branch_results", "user:preferred_language", "app:taxonomy_version"].map((key) => (
              <span key={key}>{key}</span>
            ))}
          </div>
          <p className="state-note">
            이 화면은 ADK <code>Session</code>, <code>State</code>, <code>Event</code>, <code>SessionService</code>{" "}
            설계 검토용 정보만 표시합니다. 실제 ADK runtime 통합은 포함하지 않습니다.
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

function FlowNodeCard({ node, candidate }: { node: FlowNode; candidate?: ModuleCandidate }) {
  const cat = node.type;
  const subtypeLabel = node.subtype ? formatSubtype(node.subtype) : null;
  const subtypeGlyphChar = node.subtype ? subtypeGlyph[node.subtype] ?? "·" : null;
  const reuse = candidate?.reuse_candidate;
  const risk = candidate?.risk_level;

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

function buildFlowStages(processFlow: ProcessFlow, moduleCandidates: ModuleCandidate[]): FlowStage[] {
  const inputNodes = processFlow.nodes.filter((node) => node.type === "input");
  const outputNodes = processFlow.nodes.filter((node) => node.type === "output");
  const moduleNodes = processFlow.nodes.filter((node) => node.type !== "input" && node.type !== "output");
  const branchNodes = moduleNodes.filter(
    (node) => node.type === "adapter" && (node.subtype === "legacy_api" || node.subtype === "retrieval")
  );
  const reviewNodes = moduleNodes.filter((node) => !branchNodes.some((branchNode) => branchNode.id === node.id));
  const ruleRegistryNode = moduleNodes.find((node) => node.subtype === "rule_registry");
  const remoteNodes = moduleNodes.filter((node) => node.type === "remote_a2a");

  const candidateById = new Map(moduleCandidates.map((candidate) => [candidate.id, candidate]));
  const hasParallelHint = branchNodes.length >= 2 || moduleCandidates.some((c) => c.workflow_kind === "parallel");
  const hasLoopHint = moduleCandidates.some((c) => c.workflow_kind === "loop") ||
    processFlow.edges.some((e) => e.data.startsWith("loop:"));
  const hasHumanReview = moduleCandidates.some((c) => c.workflow_kind === "human_review") ||
    moduleCandidates.some((c) => c.risk_signals.includes("human_approval_required"));
  const hasBranch = processFlow.edges.some((e) => e.data.startsWith("branch:"));

  const stages: FlowStage[] = [
    {
      id: "session-input",
      title: "입력 컨텍스트",
      agentType: "Session State",
      detail: "원문 요구사항과 식별자는 Session.state의 draft scratchpad로 검토합니다.",
      layout: "row",
      nodes: inputNodes
    }
  ];

  if (branchNodes.length) {
    stages.push({
      id: "parallel-branches",
      title: branchNodes.length > 1 ? "Adapter 호출 (병렬 검토)" : "Adapter 호출",
      agentType: "Adapter",
      detail:
        branchNodes.length > 1
          ? "독립적인 Legacy API 또는 Retrieval Adapter는 local parallel branch로 검토할 수 있습니다."
          : "Adapter는 Agent나 Workflow가 호출하는 callable capability입니다.",
      layout: branchNodes.length > 1 ? "parallel" : "row",
      marker: hasParallelHint && branchNodes.length > 1 ? { kind: "parallel", label: "Parallel" } : undefined,
      nodes: branchNodes
    });
  }

  const ruleNodeInReview = ruleRegistryNode && reviewNodes.includes(ruleRegistryNode);
  const reviewWithoutRule = ruleNodeInReview ? reviewNodes.filter((n) => n.id !== ruleRegistryNode!.id) : reviewNodes;

  if (reviewWithoutRule.length) {
    stages.push({
      id: "ordered-review",
      title: "Local 검토 / Orchestration",
      agentType: "Workflow / Agent",
      detail: "context collection 이후의 local handoff, review, recommendation은 Workflow 또는 Agent node로 유지합니다.",
      layout: "row",
      marker: hasHumanReview ? { kind: "human_review", label: "Human Review" } : undefined,
      nodes: reviewWithoutRule
    });
  }

  if (ruleRegistryNode) {
    stages.push({
      id: "rule-routing",
      title: "Rule Registry 라우팅",
      agentType: "Adapter / rule_registry",
      detail: "관리되는 라우팅 규칙을 조회해 다음 경로를 결정합니다. 규칙은 prompt가 아니라 registry에서 조회합니다.",
      layout: "row",
      marker: hasLoopHint
        ? { kind: "loop", label: "Loop" }
        : hasBranch
        ? { kind: "branch", label: "Branch" }
        : undefined,
      nodes: [ruleRegistryNode]
    });
  }

  if (remoteNodes.length) {
    stages.push({
      id: "remote-boundary",
      title: "Remote A2A 경계",
      agentType: "Remote Agent",
      detail: "독립 소유 remote agent와의 protocol boundary. 계약, 인증, timeout, retry, fallback, audit 검토 필요.",
      layout: "row",
      nodes: remoteNodes
    });
  }

  if (outputNodes.length) {
    stages.push({
      id: "output",
      title: "결과 산출",
      agentType: "output_key",
      detail: "output_key로 보존할 최종 산출물과 하위 아티팩트 경계를 확인합니다.",
      layout: "row",
      nodes: outputNodes
    });
  }

  // ensure leftover module nodes (e.g. unused) appear once
  const placedIds = new Set(stages.flatMap((stage) => stage.nodes.map((node) => node.id)));
  const leftover = moduleNodes.filter((node) => !placedIds.has(node.id));
  if (leftover.length) {
    stages.splice(stages.length - 1, 0, {
      id: "additional",
      title: "추가 모듈",
      agentType: "Module",
      detail: "스테이지에 자동 배치되지 않은 module candidate입니다.",
      layout: "row",
      nodes: leftover
    });
  }

  return stages.filter((stage) => stage.nodes.length);
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
