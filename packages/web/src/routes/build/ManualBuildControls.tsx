import type { RefObject } from "react";
import type { ScaffoldOutputMode, ScaffoldPlan, ScaffoldPlanModule } from "../../analyzer/types";
import type { MockLabBindingSelection } from "../../mock-lab/mockLabIntegration";
import type { BuildRuntimeStubResult } from "../../state/useScaffoldPlan";
import type { MockLabDiscoveryPayload } from "../../state/useMockLabDiscovery";
import { ManualRuntimeStubPanel } from "./ManualRuntimeStubPanel";
import { ManualScaffoldPanel } from "./ManualScaffoldPanel";
import type { AdkGraphReadiness } from "./buildReadiness";
import type { StreamLogEntry } from "./processLog";

interface AdapterConnections {
  readonly connected: readonly ScaffoldPlanModule[];
  readonly unconnected: readonly ScaffoldPlanModule[];
}

interface ManualBuildControlsProps {
  readonly adapterConnections: AdapterConnections;
  readonly adkGraphReadiness: AdkGraphReadiness;
  readonly artifactSyncPending: boolean;
  readonly blockers: readonly string[];
  readonly buildStubData: BuildRuntimeStubResult | undefined;
  readonly buildStubPending: boolean;
  readonly designGatesReady: boolean;
  readonly effectivePlan: ScaffoldPlan | null;
  readonly entries: readonly StreamLogEntry[];
  readonly logRef: RefObject<HTMLPreElement | null>;
  readonly mockLabDiscovery: {
    readonly data: MockLabDiscoveryPayload | null;
    readonly error: unknown;
    readonly isLoading: boolean;
  };
  readonly modeDirty: boolean;
  readonly onBuildStub: () => void;
  readonly onMockLabBinding: (module: ScaffoldPlanModule, value: string) => void;
  readonly onOutputModeChange: (mode: ScaffoldOutputMode) => void;
  readonly onSavePlan: () => void;
  readonly outputMode: ScaffoldOutputMode;
  readonly planReady: boolean;
  readonly reqId: string;
  readonly savedMode: ScaffoldOutputMode | null;
  readonly savePending: boolean;
  readonly scaffoldLoading: boolean;
  readonly scaffoldPlan: ScaffoldPlan | null | undefined;
  readonly showRuntimeStubLog: boolean;
  readonly stubReady: boolean;
  readonly warnings: readonly string[];
}

export function ManualBuildControls({
  adapterConnections,
  adkGraphReadiness,
  artifactSyncPending,
  blockers,
  buildStubData,
  buildStubPending,
  designGatesReady,
  effectivePlan,
  entries,
  logRef,
  mockLabDiscovery,
  modeDirty,
  onBuildStub,
  onMockLabBinding,
  onOutputModeChange,
  onSavePlan,
  outputMode,
  planReady,
  reqId,
  savedMode,
  savePending,
  scaffoldLoading,
  scaffoldPlan,
  showRuntimeStubLog,
  stubReady,
  warnings
}: ManualBuildControlsProps) {
  return (
    <section className="af-build-advanced-section" aria-label="수동 빌드 제어">
      <div className="af-build-advanced-heading">
        <span>Advanced manual controls</span>
        <p>기본 경로는 compound sync입니다. 개별 산출물을 따로 확인하거나 재생성할 때만 사용하세요.</p>
      </div>
      <div className="af-build-advanced-grid">
        <ManualScaffoldPanel
          adapterConnections={adapterConnections}
          adkGraphReadiness={adkGraphReadiness}
          blockers={blockers}
          designGatesReady={designGatesReady}
          effectivePlan={effectivePlan}
          mockLabDiscovery={mockLabDiscovery}
          modeDirty={modeDirty}
          onMockLabBinding={onMockLabBinding}
          onOutputModeChange={onOutputModeChange}
          onSavePlan={onSavePlan}
          outputMode={outputMode}
          reqId={reqId}
          savedMode={savedMode}
          savePending={savePending}
          scaffoldLoading={scaffoldLoading}
          scaffoldPlan={scaffoldPlan}
          warnings={warnings}
        />
        <ManualRuntimeStubPanel
          artifactSyncPending={artifactSyncPending}
          buildStubData={buildStubData}
          buildStubPending={buildStubPending}
          designGatesReady={designGatesReady}
          entries={entries}
          logRef={logRef}
          onBuildStub={onBuildStub}
          outputMode={outputMode}
          planReady={planReady}
          showLog={showRuntimeStubLog}
          stubReady={stubReady}
        />
      </div>
    </section>
  );
}
