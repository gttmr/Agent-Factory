import type { RefObject } from "react";
import { Button, EmptyState, Panel, SectionHeader } from "../../ui/primitives";
import { VERIFY_COMMANDS, type VerifyRunResult } from "../../state/useVerify";
import type { StreamLogEntry } from "./verifyStreamLog";

interface VerifyRunStepProps {
  readonly isPending: boolean;
  readonly lastRun: VerifyRunResult | null;
  readonly onRun: (commandKey: string) => void;
  readonly runningCommand: string | undefined;
  readonly streamLog: readonly StreamLogEntry[];
  readonly streamLogRef: RefObject<HTMLPreElement | null>;
}

export function VerifyRunStep({ isPending, lastRun, onRun, runningCommand, streamLog, streamLogRef }: VerifyRunStepProps) {
  return (
    <Panel className="af-verify-run-panel">
      <SectionHeader title="검증 명령 실행" description="허용된 명령만 실행하고 stdout/stderr 를 같은 화면에서 확인합니다." />
      <div className="af-verify-run-layout">
        <div className="af-verify-command-lane" aria-label="검증 명령">
          <div className="af-verify-command-note">
            <strong>Allowed commands</strong>
            <span>child_process 실행은 이 목록으로 제한됩니다.</span>
          </div>
          <div className="af-verify-grid">
            {VERIFY_COMMANDS.map((command) => (
              <article key={command.key} className="af-verify-card">
                <header>
                  <strong>{command.label}</strong>
                  <code>{command.key}</code>
                </header>
                <p>{command.description}</p>
                <Button type="button" variant="primary" disabled={isPending} onClick={() => onRun(command.key)}>
                  {isPending && runningCommand === command.key ? "실행 중…" : "실행"}
                </Button>
              </article>
            ))}
          </div>
        </div>

        <aside className="af-verify-output-lane" aria-label="검증 실행 출력">
          <div className="af-verify-output-header">
            <div>
              <span>Command output</span>
              <strong>{lastRun ? lastRun.command_key : isPending ? runningCommand ?? "실행 중" : "대기"}</strong>
            </div>
            <span className="af-verify-output-status">{isPending ? "실행 중" : lastRun ? `exit ${lastRun.exit_code}` : "no run"}</span>
          </div>

          {streamLog.length > 0 ? (
            <div className="af-stream-log-panel af-stream-log-panel-compact">
              <div className="af-stream-log-header">
                <strong>실시간 로그</strong>
                <span>{isPending ? "실행 중" : "마지막 실행"}</span>
              </div>
              <pre ref={streamLogRef} className="af-stream-log">
                {streamLog.map((entry) => entry.text).join("")}
              </pre>
            </div>
          ) : null}

          {lastRun ? (
            <div className="af-verify-result">
              <p>
                <strong>{lastRun.command_key}</strong> · exit {lastRun.exit_code} · {lastRun.ok ? "통과" : "실패"}
              </p>
              <p>
                <code>{lastRun.command}</code>
              </p>
              {lastRun.stdout ? (
                <details open>
                  <summary>stdout</summary>
                  <pre>{lastRun.stdout}</pre>
                </details>
              ) : null}
              {lastRun.stderr ? (
                <details open>
                  <summary>stderr</summary>
                  <pre>{lastRun.stderr}</pre>
                </details>
              ) : null}
            </div>
          ) : streamLog.length === 0 ? (
            <EmptyState title="실행 결과 없음" description="명령을 실행하면 로그와 exit code 가 여기에 표시됩니다." />
          ) : null}
        </aside>
      </div>
    </Panel>
  );
}
