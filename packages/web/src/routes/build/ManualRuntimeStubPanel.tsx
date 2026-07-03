import { Button, Panel, SectionHeader } from "../../ui/primitives";
import type { BuildRuntimeStubResult } from "../../state/useScaffoldPlan";
import type { RefObject } from "react";
import { StreamLogPanel } from "./StreamLogPanel";
import type { StreamLogEntry } from "./processLog";
import type { ScaffoldOutputMode } from "../../analyzer/types";

interface ManualRuntimeStubPanelProps {
  readonly artifactSyncPending: boolean;
  readonly buildStubData: BuildRuntimeStubResult | undefined;
  readonly buildStubPending: boolean;
  readonly designGatesReady: boolean;
  readonly entries: readonly StreamLogEntry[];
  readonly logRef: RefObject<HTMLPreElement | null>;
  readonly onBuildStub: () => void;
  readonly outputMode: ScaffoldOutputMode;
  readonly planReady: boolean;
  readonly showLog: boolean;
  readonly stubReady: boolean;
}

export function ManualRuntimeStubPanel({
  artifactSyncPending,
  buildStubData,
  buildStubPending,
  designGatesReady,
  entries,
  logRef,
  onBuildStub,
  outputMode,
  planReady,
  showLog,
  stubReady
}: ManualRuntimeStubPanelProps) {
  return (
    <Panel tone="muted" className="af-build-manual-panel">
      <SectionHeader
        eyebrow="advanced/manual"
        title="Runtime stub 수동 생성"
        description={
          outputMode === "runnable"
            ? "scripts/generate-adk-source.mjs 를 spawn 하여 artifacts/af/<id>/runtime-stub/ 에 실행형 ADK 2.3 Workflow(ADK LlmAgent + Mock Lab MCP 어댑터)를 생성합니다. 승인된 artifact 에서만 생성되며 private endpoint/credential/실데이터는 포함하지 않습니다."
            : "scripts/generate-adk-source.mjs 를 spawn 하여 artifacts/af/<id>/runtime-stub/ 에 synthetic smoke stub 을 생성합니다. business logic 은 TODO 로만 남습니다."
        }
        action={
          <Button
            type="button"
            variant="primary"
            disabled={!planReady || !designGatesReady || buildStubPending || artifactSyncPending}
            onClick={onBuildStub}
          >
            {buildStubPending ? "생성 중…" : stubReady ? "runtime-stub 재생성" : "runtime-stub 생성"}
          </Button>
        }
      />
      {!planReady ? (
        <p className="af-landing-message">
          scaffold-plan 을 저장해 can_generate_source 가 통과되면 runtime-stub 을 생성할 수 있습니다.
        </p>
      ) : null}
      {showLog ? <StreamLogPanel entries={entries} isRunning={buildStubPending} logRef={logRef} /> : null}
      {buildStubData?.stdout ? (
        <details className="af-blocker-list">
          <summary>generate-adk-source stdout</summary>
          <pre>{buildStubData.stdout}</pre>
        </details>
      ) : null}
      {buildStubData?.stderr ? (
        <details className="af-blocker-list">
          <summary>generate-adk-source stderr</summary>
          <pre>{buildStubData.stderr}</pre>
        </details>
      ) : null}
    </Panel>
  );
}
