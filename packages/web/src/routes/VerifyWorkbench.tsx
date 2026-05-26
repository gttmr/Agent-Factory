import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Button, EmptyState, Panel, SectionHeader } from "../ui/primitives";
import { useArtifactRoot } from "../state/useArtifactRoot";
import { useRecentRoots } from "../state/useRecentRoots";
import { useSaveTextArtifact, useTextArtifact } from "../state/useTextArtifact";
import { useRunVerify, VERIFY_COMMANDS, type VerifyRunResult } from "../state/useVerify";

export default function VerifyWorkbench() {
  const params = useParams<{ reqId: string }>();
  const reqId = params.reqId;
  const { touch } = useRecentRoots();
  useEffect(() => {
    if (reqId) touch(reqId);
  }, [reqId, touch]);

  const { data: manifestData } = useArtifactRoot(reqId);
  const runVerify = useRunVerify(reqId);

  const reportArtifact = useTextArtifact(reqId, "validation-report.md");
  const saveReport = useSaveTextArtifact(reqId, "validation-report.md");
  const deltaArtifact = useTextArtifact(reqId, "catalog-delta.yaml");
  const saveDelta = useSaveTextArtifact(reqId, "catalog-delta.yaml");

  const [reportDraft, setReportDraft] = useState("");
  const [reportDirty, setReportDirty] = useState(false);
  const [deltaDraft, setDeltaDraft] = useState("");
  const [deltaDirty, setDeltaDirty] = useState(false);
  const [lastRun, setLastRun] = useState<VerifyRunResult | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!reportDirty && reportArtifact.data) setReportDraft(reportArtifact.data.content);
  }, [reportArtifact.data, reportDirty]);
  useEffect(() => {
    if (!deltaDirty && deltaArtifact.data) setDeltaDraft(deltaArtifact.data.content);
  }, [deltaArtifact.data, deltaDirty]);

  const manifest = manifestData?.manifest;

  if (!reqId) {
    return (
      <Panel>
        <EmptyState title="requirement_id 가 없습니다" description="Landing 에서 artifact root 를 선택하세요." />
        <Link className="ui-button ui-button-secondary" to="/">Landing 으로</Link>
      </Panel>
    );
  }

  function handleRun(commandKey: string) {
    setActionMessage(null);
    runVerify.mutate(commandKey, {
      onSuccess: (result) => {
        setLastRun(result);
        setActionMessage(
          result.ok
            ? `${result.command_key} 통과 (exit ${result.exit_code})`
            : `${result.command_key} 실패 (exit ${result.exit_code}) — stderr 확인`
        );
      },
      onError: (error) => setActionMessage(error instanceof Error ? error.message : "실행 실패")
    });
  }

  return (
    <div className="af-stage-workspace">
      <Panel>
        <SectionHeader
          eyebrow={`af-verify-feedback · ${reqId}`}
          title="검증 및 피드백"
          description="검증 명령은 허용 목록으로만 실행됩니다. 결과는 validation-report.md 에, catalog 변경 제안은 catalog-delta.yaml 에 기록합니다 (catalog/*.yaml 직접 편집 금지)."
          action={
            <div className="af-action-row">
              <Link className="ui-button ui-button-ghost" to={`/af/${reqId}/build`}>Build 로</Link>
            </div>
          }
        />
        {actionMessage ? <p className="af-landing-message">{actionMessage}</p> : null}
        {manifest ? (
          <ul className="af-gate-summary">
            <li>manifest.validation.last_result: {manifest.validation.last_result}</li>
            <li>마지막 명령: {manifest.validation.commands.join(", ") || "없음"}</li>
          </ul>
        ) : null}
      </Panel>

      <Panel>
        <SectionHeader title="검증 명령 실행" description="허용된 명령만 child_process 로 실행됩니다." />
        <div className="af-verify-grid">
          {VERIFY_COMMANDS.map((command) => (
            <article key={command.key} className="af-verify-card">
              <header>
                <strong>{command.label}</strong>
                <code>{command.key}</code>
              </header>
              <p>{command.description}</p>
              <Button
                type="button"
                variant="primary"
                disabled={runVerify.isPending}
                onClick={() => handleRun(command.key)}
              >
                {runVerify.isPending && runVerify.variables === command.key ? "실행 중…" : "실행"}
              </Button>
            </article>
          ))}
        </div>
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
        ) : null}
      </Panel>

      <Panel>
        <SectionHeader
          title="validation-report.md"
          description="검증 명령 결과와 잔존 위험을 markdown 으로 정리합니다."
          action={
            <Button
              type="button"
              variant="primary"
              disabled={!reportDirty || saveReport.isPending}
              onClick={() =>
                saveReport.mutate(
                  { content: reportDraft, etag: reportArtifact.data?.etag ?? null },
                  {
                    onSuccess: () => {
                      setActionMessage("validation-report.md 저장 완료");
                      setReportDirty(false);
                    },
                    onError: (error) =>
                      setActionMessage(error instanceof Error ? error.message : "validation-report 저장 실패")
                  }
                )
              }
            >
              {saveReport.isPending ? "저장 중…" : "저장"}
            </Button>
          }
        />
        <textarea
          value={reportDraft}
          onChange={(event) => {
            setReportDraft(event.target.value);
            setReportDirty(true);
          }}
          rows={10}
          className="af-markdown-editor"
          placeholder="# Validation report&#10;&#10;- 명령: …&#10;- 결과: …&#10;- 잔존 위험: …"
        />
      </Panel>

      <Panel>
        <SectionHeader
          title="catalog-delta.yaml"
          description="catalog 변경 제안만 기록합니다 (실제 catalog/*.yaml 은 절대 직접 편집하지 않습니다)."
          action={
            <Button
              type="button"
              variant="primary"
              disabled={!deltaDirty || saveDelta.isPending}
              onClick={() =>
                saveDelta.mutate(
                  { content: deltaDraft, etag: deltaArtifact.data?.etag ?? null },
                  {
                    onSuccess: () => {
                      setActionMessage("catalog-delta.yaml 저장 완료");
                      setDeltaDirty(false);
                    },
                    onError: (error) =>
                      setActionMessage(error instanceof Error ? error.message : "catalog-delta 저장 실패")
                  }
                )
              }
            >
              {saveDelta.isPending ? "저장 중…" : "저장"}
            </Button>
          }
        />
        <textarea
          value={deltaDraft}
          onChange={(event) => {
            setDeltaDraft(event.target.value);
            setDeltaDirty(true);
          }}
          rows={10}
          className="af-markdown-editor af-yaml-editor"
          placeholder={`proposed_additions:\n  - category: adapter\n    name: …\n    rationale: …\n`}
        />
      </Panel>
    </div>
  );
}
