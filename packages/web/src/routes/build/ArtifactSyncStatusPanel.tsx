import { EmptyState } from "../../ui/primitives";
import type { ArtifactSyncProcessResult, ArtifactSyncRunResult } from "../../state/useArtifactSync";

interface ArtifactSyncStatusPanelProps {
  readonly result: ArtifactSyncRunResult | null;
  readonly isRunning: boolean;
}

export function ArtifactSyncStatusPanel({ result, isRunning }: ArtifactSyncStatusPanelProps) {
  if (!result) {
    return (
      <div className="af-artifact-sync-status">
        <EmptyState
          title={isRunning ? "동기화 실행 중" : "아직 실행 결과가 없습니다"}
          description="실행하면 drift, 작성 artifact, 생성 명령, validation 결과가 여기에 남습니다."
        />
      </div>
    );
  }

  return (
    <div className="af-artifact-sync-status">
      <div className="af-artifact-sync-summary">
        <ResultMetric label="결과" value={result.ok ? "통과" : "실패"} />
        <ResultMetric label="출력 모드" value={result.output_mode} />
        <ResultMetric label="실행 전 drift" value={formatBeforeDrift(result)} />
        <ResultMetric label="실행 후 상태" value={formatAfterDrift(result)} />
      </div>
      {result.error ? <p className="af-landing-error">{result.error}</p> : null}
      <div className="af-artifact-sync-detail-grid">
        <div>
          <strong>작성된 artifact</strong>
          {result.artifacts_written.length > 0 ? (
            <ul className="af-artifact-sync-list">
              {result.artifacts_written.map((path) => (
                <li key={path}>
                  <code>{path}</code>
                </li>
              ))}
            </ul>
          ) : (
            <p className="af-landing-message">작성된 artifact 가 없습니다.</p>
          )}
        </div>
        <ProcessResultSummary label="generator" result={result.generation} skippedLabel="runtime-stub 재생성 안 함" />
        <ProcessResultSummary label="validation" result={result.validation} skippedLabel="validation 실행 안 함" />
      </div>
    </div>
  );
}

function ResultMetric({ label, value }: { readonly label: string; readonly value: string }) {
  return (
    <div className="af-stage-summary-item">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function ProcessResultSummary({
  label,
  result,
  skippedLabel
}: {
  readonly label: string;
  readonly result?: ArtifactSyncProcessResult;
  readonly skippedLabel: string;
}) {
  if (!result) {
    return (
      <div className="af-artifact-sync-process">
        <strong>{label}</strong>
        <p className="af-landing-message">{skippedLabel}</p>
      </div>
    );
  }
  return (
    <div className="af-artifact-sync-process">
      <strong>{label}</strong>
      <p>{result.ok ? "통과" : "실패"} · exit {result.exit_code}</p>
      <code>{result.command || result.command_key || "command 없음"}</code>
      {result.files && result.files.length > 0 ? <small>파일 {result.files.length}개</small> : null}
      {result.stdout ? (
        <details className="af-blocker-list">
          <summary>stdout</summary>
          <pre>{result.stdout}</pre>
        </details>
      ) : null}
      {result.stderr ? (
        <details className="af-blocker-list">
          <summary>stderr</summary>
          <pre>{result.stderr}</pre>
        </details>
      ) : null}
    </div>
  );
}

function formatBeforeDrift(result: ArtifactSyncRunResult): string {
  const stale = countDrift(result.drift.before, "stale");
  const missing = countDrift(result.drift.before, "missing");
  const unchanged = countDrift(result.drift.before, "unchanged");
  return `stale ${stale} · missing ${missing} · unchanged ${unchanged}`;
}

function formatAfterDrift(result: ArtifactSyncRunResult): string {
  const synced = countDrift(result.drift.after, "synced");
  const unchanged = countDrift(result.drift.after, "unchanged");
  return `synced ${synced} · unchanged ${unchanged}`;
}

function countDrift(entries: readonly { readonly status: string }[], status: string): number {
  return entries.filter((entry) => entry.status === status).length;
}
