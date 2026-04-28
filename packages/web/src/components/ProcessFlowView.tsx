import { moduleTypeLabels } from "../analyzer/classificationRules";
import type { FlowNode, FlowNodeType, ModuleCandidate, ProcessFlow } from "../analyzer/types";

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
  nodes: FlowNode[];
}

export function ProcessFlowView({ processFlow, moduleCandidates, onContinue }: ProcessFlowViewProps) {
  const graphText = toMermaid(processFlow);
  const stages = buildFlowStages(processFlow);
  const customSignals = detectCustomAgentSignals(processFlow, moduleCandidates);
  const candidateById = new Map(moduleCandidates.map((candidate) => [candidate.id, candidate]));

  return (
    <div className="flow-workspace">
      <section className="panel flow-canvas">
        <div className="section-heading">
          <p className="eyebrow">ADK workflow review</p>
          <h2>프로세스 플로우</h2>
        </div>

        <div className="staged-flow" aria-label="ADK staged process flow">
          {stages.map((stage) => (
            <article className="flow-stage" key={stage.id}>
              <div className="stage-header">
                <div>
                  <span>{stage.agentType}</span>
                  <h3>{stage.title}</h3>
                </div>
              </div>
              <p>{stage.detail}</p>
              <div className="stage-node-list">
                {stage.nodes.map((node) => {
                  const candidate = candidateById.get(node.id);
                  return (
                    <div className="flow-node" key={node.id}>
                      <span>{formatNodeType(node.type)}</span>
                      <strong>{node.label}</strong>
                      {candidate && <em>{candidate.rationale}</em>}
                    </div>
                  );
                })}
              </div>
            </article>
          ))}
        </div>

        <div className="edge-list">
          {processFlow.edges.map((edge) => (
            <div className={edge.edge_type === "remote_a2a" ? "edge remote" : "edge"} key={`${edge.from}-${edge.to}`}>
              <span>{edge.from}</span>
              <strong>{edge.edge_type === "remote_a2a" ? "remote_a2a" : "local"}</strong>
              <span>{edge.to}</span>
              <em>{edge.data}</em>
            </div>
          ))}
        </div>
      </section>

      <aside className="flow-inspector">
        <section className="panel">
          <div className="section-heading">
            <p className="eyebrow">Design judgment</p>
            <h2>ADK 설계 판단</h2>
          </div>
          <ul className="judgment-list">
            <li>
              <strong>ParallelAgent</strong>
              <span>독립적인 `tool_adapter`와 `knowledge_retrieval` 조회는 fan-out/fan-in 후보로 검토합니다.</span>
            </li>
            <li>
              <strong>SequentialAgent</strong>
              <span>분류, 검토, 권장안 생성처럼 순서가 고정된 단계는 deterministic handoff 후보로 봅니다.</span>
            </li>
            <li>
              <strong>LoopAgent</strong>
              <span>반복 종료 조건이 확인될 때만 별도 후보로 승격합니다. 현재 rule analyzer는 기본 후보로 만들지 않습니다.</span>
            </li>
          </ul>
          {customSignals.length ? (
            <div className="custom-warning">
              <strong>Custom Agent 후보</strong>
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
            이 화면은 ADK `Session`, `State`, `Event`, `SessionService` 설계를 검토하기 위한 계획 정보만 표시합니다.
            실제 ADK runtime 통합은 아직 포함하지 않습니다.
          </p>
        </section>

        <section className="panel">
          <div className="section-heading">
            <p className="eyebrow">Graph text</p>
            <h2>Mermaid-style Draft</h2>
          </div>
          <pre className="json-preview compact-preview">{graphText}</pre>
          <div className="actions align-end">
            <button type="button" className="primary" onClick={onContinue}>
              아티팩트 내보내기로 이동
            </button>
          </div>
        </section>
      </aside>
    </div>
  );
}

function buildFlowStages(processFlow: ProcessFlow): FlowStage[] {
  const inputNodes = processFlow.nodes.filter((node) => node.type === "input");
  const outputNodes = processFlow.nodes.filter((node) => node.type === "output");
  const moduleNodes = processFlow.nodes.filter((node) => node.type !== "input" && node.type !== "output");
  const branchNodes = moduleNodes.filter((node) => node.type === "tool_adapter" || node.type === "knowledge_retrieval");
  const reviewNodes = moduleNodes.filter((node) => node.type !== "tool_adapter" && node.type !== "knowledge_retrieval");

  return [
    {
      id: "session-input",
      title: "입력 컨텍스트",
      agentType: "Session State",
      detail: "원문 요구사항과 식별자는 `Session.state`의 초안 scratchpad로 검토합니다.",
      nodes: inputNodes
    },
    ...(branchNodes.length
      ? [
          {
            id: "parallel-branches",
            title: "조회/검색 분기",
            agentType: "ParallelAgent candidate",
            detail: "서로 의존하지 않는 lookup/retrieval 작업은 병렬 실행 가능성을 먼저 검토합니다.",
            nodes: branchNodes
          }
        ]
      : []),
    {
      id: "ordered-review",
      title: "순차 검토/판단",
      agentType: "SequentialAgent candidate",
      detail: "컨텍스트 수집 이후의 handoff, review, recommendation 단계는 고정 순서 후보입니다.",
      nodes: reviewNodes.length ? reviewNodes : moduleNodes
    },
    {
      id: "output",
      title: "결과 산출",
      agentType: "output_key review",
      detail: "`output_key`로 보존할 최종 산출물과 downstream artifact 경계를 확인합니다.",
      nodes: outputNodes
    }
  ].filter((stage) => stage.nodes.length);
}

function detectCustomAgentSignals(processFlow: ProcessFlow, moduleCandidates: ModuleCandidate[]): string[] {
  const labels = processFlow.nodes.map((node) => node.label.toLowerCase()).join(" ");
  const moduleText = moduleCandidates.map((candidate) => `${candidate.name} ${candidate.rationale}`).join(" ").toLowerCase();
  const combined = `${labels} ${moduleText}`;
  const signals: string[] = [];

  if (/\b(route|routing|threshold|conditional|branch)\b/.test(combined)) {
    signals.push("conditional routing 또는 threshold 기반 분기가 보이면 `Custom Agent`가 필요한지 검토합니다.");
  }
  if (/\b(dynamic|select|selection|delegate)\b/.test(combined)) {
    signals.push("dynamic agent selection 또는 delegated task 흐름이 보이면 predefined workflow만으로 충분한지 확인합니다.");
  }
  if (processFlow.nodes.some((node) => node.type === "remote_a2a_contract")) {
    signals.push("독립 remote boundary가 포함되면 external integration flow control을 별도로 검토합니다.");
  }
  if (processFlow.nodes.some((node) => node.type === "internal_workflow") && processFlow.edges.length > processFlow.nodes.length) {
    signals.push("fan-in/fan-out이 많은 internal workflow는 complex state management 여부를 확인합니다.");
  }

  return signals;
}

function toMermaid(processFlow: ProcessFlow): string {
  const nodeLines = processFlow.nodes.map((node) => `  ${safeId(node.id)}["${node.label} (${node.type})"]`);
  const edgeLines = processFlow.edges.map((edge) => {
    const label = edge.edge_type === "remote_a2a" ? `remote_a2a: ${edge.data}` : edge.data;
    return `  ${safeId(edge.from)} -->|"${label}"| ${safeId(edge.to)}`;
  });

  return ["graph LR", ...nodeLines, ...edgeLines].join("\n");
}

function safeId(value: string): string {
  return value.replace(/[^a-zA-Z0-9_]/g, "_");
}

function formatNodeType(type: FlowNodeType): string {
  if (type === "input" || type === "output") {
    return type;
  }
  return moduleTypeLabels[type];
}
