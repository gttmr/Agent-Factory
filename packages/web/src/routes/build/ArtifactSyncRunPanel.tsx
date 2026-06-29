import { Button, Panel, SectionHeader } from "../../ui/primitives";
import type { ArtifactSyncRunResult } from "../../state/useArtifactSync";
import type { RefObject } from "react";
import { ArtifactSyncStatusPanel } from "./ArtifactSyncStatusPanel";
import { StreamLogPanel } from "./StreamLogPanel";
import type { StreamLogEntry } from "./processLog";

interface ArtifactSyncRunPanelProps {
  readonly compoundDisabledReason: string | null;
  readonly entries: readonly StreamLogEntry[];
  readonly isLogRunning: boolean;
  readonly isPending: boolean;
  readonly logRef: RefObject<HTMLPreElement | null>;
  readonly onRun: () => void;
  readonly result: ArtifactSyncRunResult | null;
  readonly showLog: boolean;
}

export function ArtifactSyncRunPanel({
  compoundDisabledReason,
  entries,
  isLogRunning,
  isPending,
  logRef,
  onRun,
  result,
  showLog
}: ArtifactSyncRunPanelProps) {
  return (
    <Panel>
      <SectionHeader
        eyebrow="primary"
        title="계약 동기화 + runtime-stub 재생성"
        description="analysis-result.json 을 기준으로 split artifact와 scaffold-plan 을 동기화한 뒤 runtime-stub 재생성과 validate_artifact_root 를 한 번에 실행합니다."
        action={
          <Button
            type="button"
            variant="primary"
            disabled={Boolean(compoundDisabledReason) || isPending}
            onClick={onRun}
          >
            {isPending ? "실행 중…" : "계약 동기화 + runtime-stub 재생성"}
          </Button>
        }
      />
      {compoundDisabledReason ? (
        <p className="af-landing-message" role="status">
          {compoundDisabledReason}
        </p>
      ) : null}
      <ArtifactSyncStatusPanel result={result} isRunning={isPending} />
      {showLog ? <StreamLogPanel entries={entries} isRunning={isLogRunning} logRef={logRef} /> : null}
    </Panel>
  );
}
