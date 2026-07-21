import { Button, EmptyState, Panel, SectionHeader } from "../../ui/primitives";
import type { AssetCandidate, ScaffoldOutputMode, ScaffoldPlan } from "../../analyzer/types";
import type { MockLabDiscoveryPayload } from "../../state/useMockLabDiscovery";
import type { AdkGraphReadiness } from "./buildReadiness";
import { hasMockLabBindingTargets } from "../../mock-lab/mockLabIntegration";
import { MockLabBindingPanel } from "./MockLabBindingPanel";

interface ToolConnections {
  readonly connected: readonly AssetCandidate[];
  readonly unconnected: readonly AssetCandidate[];
}

interface ManualScaffoldPanelProps {
  readonly toolConnections: ToolConnections;
  readonly adkGraphReadiness: AdkGraphReadiness;
  readonly blockers: readonly string[];
  readonly designGatesReady: boolean;
  readonly effectivePlan: ScaffoldPlan | null;
  readonly mockLabDiscovery: {
    readonly data: MockLabDiscoveryPayload | null;
    readonly error: unknown;
    readonly isLoading: boolean;
  };
  readonly modeDirty: boolean;
  readonly onMockLabBinding: (asset: AssetCandidate, value: string) => void;
  readonly onOutputModeChange: (mode: ScaffoldOutputMode) => void;
  readonly onSavePlan: () => void;
  readonly outputMode: ScaffoldOutputMode;
  readonly reqId: string;
  readonly savedMode: ScaffoldOutputMode | null;
  readonly savePending: boolean;
  readonly scaffoldLoading: boolean;
  readonly scaffoldPlan: ScaffoldPlan | null | undefined;
  readonly warnings: readonly string[];
}

export function ManualScaffoldPanel({
  toolConnections,
  adkGraphReadiness,
  blockers,
  designGatesReady,
  effectivePlan,
  mockLabDiscovery,
  modeDirty,
  onMockLabBinding,
  onOutputModeChange,
  onSavePlan,
  outputMode,
  reqId,
  savedMode,
  savePending,
  scaffoldLoading,
  scaffoldPlan,
  warnings
}: ManualScaffoldPanelProps) {
  return (
    <Panel tone="muted" className="af-build-manual-panel">
      <SectionHeader
        eyebrow="advanced/manual"
        title="Scaffold plan 수동 제어"
        description="승인된 Agent, Workflow, Tool과 Runtime Contract만 포함됩니다. blockers가 비어 있어야 Runtime Handoff를 생성할 수 있습니다."
        action={
          <Button
            type="button"
            variant="primary"
            disabled={!effectivePlan || !designGatesReady || savePending}
            onClick={onSavePlan}
          >
            {savePending ? "저장 중…" : scaffoldPlan ? "scaffold-plan 재생성" : "scaffold-plan 생성"}
          </Button>
        }
      />
      <OutputModeToggle outputMode={outputMode} onOutputModeChange={onOutputModeChange} />
      {modeDirty ? (
        <p className="af-output-mode-dirty" role="status">
          저장된 scaffold-plan 은 <strong>{savedMode}</strong> 모드입니다. 현재 토글({outputMode})을 적용하려면 빌드 전에
          scaffold-plan 을 재생성하세요.
        </p>
      ) : null}
      {scaffoldLoading ? <p className="af-landing-message">scaffold-plan 불러오는 중…</p> : null}
      {effectivePlan ? (
        <ScaffoldPlanSummary
          toolConnections={toolConnections}
          adkGraphReadiness={adkGraphReadiness}
          outputMode={outputMode}
          plan={effectivePlan}
        />
      ) : (
        <EmptyState title="분석 결과가 없습니다" description="Analyze 단계에서 analysis-result.json 을 먼저 import 하세요." />
      )}
      {outputMode === "runnable" && effectivePlan && hasMockLabBindingTargets(effectivePlan) ? (
        <MockLabBindingPanel
          plan={effectivePlan}
          discovery={mockLabDiscovery.data}
          discoveryLoading={mockLabDiscovery.isLoading}
          discoveryError={mockLabDiscovery.error}
          reqId={reqId}
          onChange={onMockLabBinding}
        />
      ) : null}
      {outputMode === "runnable" && effectivePlan && !hasMockLabBindingTargets(effectivePlan) ? (
        <p className="af-landing-message">Mock Lab MCP 바인딩 대상 Tool이 없습니다. 현재 plan은 Agent/Workflow 중심 Runtime Handoff로 생성됩니다.</p>
      ) : null}
      <BlockerList title="blockers" entries={blockers} open />
      <BlockerList title="warnings" entries={warnings} />
      {scaffoldPlan ? (
        <details className="af-blocker-list">
          <summary>scaffold-plan.json 상세</summary>
          <pre>{JSON.stringify(scaffoldPlan, null, 2)}</pre>
        </details>
      ) : null}
    </Panel>
  );
}

function OutputModeToggle({
  onOutputModeChange,
  outputMode
}: {
  readonly onOutputModeChange: (mode: ScaffoldOutputMode) => void;
  readonly outputMode: ScaffoldOutputMode;
}) {
  return (
    <div className="af-output-mode-toggle" role="group" aria-label="출력 모드">
      <Button
        type="button"
        variant={outputMode === "smoke" ? "primary" : "ghost"}
        aria-pressed={outputMode === "smoke"}
        onClick={() => onOutputModeChange("smoke")}
      >
        smoke
      </Button>
      <Button
        type="button"
        variant={outputMode === "runnable" ? "primary" : "ghost"}
        aria-pressed={outputMode === "runnable"}
        onClick={() => onOutputModeChange("runnable")}
      >
        runnable
      </Button>
      <span className="af-output-mode-hint">
        {outputMode === "runnable"
          ? "ADK LlmAgent 그래프 + Mock Lab MCP Tool 연결을 실행합니다. LLM provider와 secret은 .agent-factory/runtime.env 에 둡니다."
          : "synthetic 스모크 핸드오프입니다 (LLM/키 불필요)."}
      </span>
    </div>
  );
}

function ScaffoldPlanSummary({
  toolConnections,
  adkGraphReadiness,
  outputMode,
  plan
}: {
  readonly toolConnections: ToolConnections;
  readonly adkGraphReadiness: AdkGraphReadiness;
  readonly outputMode: ScaffoldOutputMode;
  readonly plan: ScaffoldPlan;
}) {
  return (
    <ul className="af-gate-summary">
      <li>승인된 자산 {plan.assets.length}개 / 제외된 자산 {plan.excluded_assets.length}개</li>
      <li>Runtime Contract {plan.runtime_contracts.length}개</li>
      <li>can_generate_source: {plan.validation.can_generate_source ? "예" : "아니오"}</li>
      <li>blockers: {plan.validation.blockers.length}건, warnings: {plan.validation.warnings.length}건</li>
      {outputMode === "runnable" ? (
        <>
          <li>
            ADK route: route edge {adkGraphReadiness.routeEdges}개 · default fallback{" "}
            {adkGraphReadiness.defaultRouteEdges}개
          </li>
          <li>
            ADK human input: RequestInput {adkGraphReadiness.humanInputNodes}개 · unsupported response_schema{" "}
            {adkGraphReadiness.unsupportedHumanInputNodes.length}개
            {adkGraphReadiness.unsupportedHumanInputNodes.length > 0
              ? ` (${adkGraphReadiness.unsupportedHumanInputNodes.join(", ")})`
              : ""}
          </li>
          <li>
            ADK control: Join {adkGraphReadiness.joinNodes}개 · 반복 실행 범위 {adkGraphReadiness.loopRegions}개 ·
            Dynamic Workflow {adkGraphReadiness.dynamicWorkflowAssets}개
          </li>
          <li>
            Tool MCP Binding(선언): 선언됨 {toolConnections.connected.length} · 미선언{" "}
            {toolConnections.unconnected.length}
            {toolConnections.unconnected.length > 0
              ? ` (미선언: ${toolConnections.unconnected.map((asset) => asset.name).join(", ")})`
              : ""}
            . 실제 연결 여부는 실행 시 Mock Lab MCP discovery로 확인합니다.
          </li>
        </>
      ) : null}
    </ul>
  );
}

function BlockerList({ entries, open, title }: { readonly entries: readonly string[]; readonly open?: boolean; readonly title: string }) {
  if (entries.length === 0) return null;

  return (
    <details open={open} className="af-blocker-list">
      <summary>{title} ({entries.length})</summary>
      <ul>
        {entries.map((entry, index) => (
          <li key={index}>{entry}</li>
        ))}
      </ul>
    </details>
  );
}
