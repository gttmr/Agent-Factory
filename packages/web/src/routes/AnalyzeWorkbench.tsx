import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { AnalysisResult } from "../components/AnalysisResult";
import { Button, EmptyState, Panel, SectionHeader, SelectField } from "../ui/primitives";
import { useAnalysisArtifact, useSaveAnalysisArtifact } from "../state/useAnalysisArtifact";
import { useArtifactRoot } from "../state/useArtifactRoot";
import { useApprovalGate } from "../state/useApprovalGate";
import { useRecentRoots } from "../state/useRecentRoots";
import { putArtifactJson } from "../state/apiClient";
import { parseAnalysisResultArtifact } from "../analyzer/analysisArtifactImport";
import { useQueryClient } from "@tanstack/react-query";
import { useAnalyze, type AnalyzeCatalogEntry } from "../state/useAnalyze";
import { useCatalog, type CatalogHubEntry } from "../state/useCatalog";
import { codexAnalyzerModels, type CodexAnalyzerModel } from "../analyzer/types";

export default function AnalyzeWorkbench() {
  const params = useParams<{ reqId: string }>();
  const reqId = params.reqId;
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { touch } = useRecentRoots();
  useEffect(() => {
    if (reqId) touch(reqId);
  }, [reqId, touch]);

  const { data: manifestData, isLoading: manifestLoading, error: manifestError } = useArtifactRoot(reqId);
  const { data: analysisData, isLoading: analysisLoading, error: analysisError } = useAnalysisArtifact(reqId);
  const saveMutation = useSaveAnalysisArtifact(reqId);
  const approvalMutation = useApprovalGate(reqId);

  const [acceptedMissing, setAcceptedMissing] = useState<string[]>([]);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [selectedModel, setSelectedModel] = useState<CodexAnalyzerModel>(codexAnalyzerModels[0]);

  const manifest = manifestData?.manifest;
  const manifestEtag = manifestData?.etag ?? null;
  const analysis = analysisData?.data ?? null;
  const analysisEtag = analysisData?.etag ?? null;

  const { data: catalogIndex } = useCatalog();
  const analyze = useAnalyze(reqId);
  const rawText = analysis?.normalizedRequirement?.raw_text?.trim() ?? "";
  const domain = analysis?.normalizedRequirement?.domain ?? "general";
  const canRerun = Boolean(reqId) && rawText.length > 0 && analyze.status !== "running";
  const rerunBusy = analyze.status === "running";

  const allCandidatesResolved = useMemo(() => {
    if (!analysis) return false;
    if (!Array.isArray(analysis.moduleCandidates) || analysis.moduleCandidates.length === 0) return false;
    return analysis.moduleCandidates.every((candidate) => candidate.status !== "needs_info");
  }, [analysis]);

  const missingInfo = analysis?.evidence?.missing_information ?? [];
  const allMissingHandled = missingInfo.every((item) => acceptedMissing.includes(item));
  const canToggleAnalysisReviewed = Boolean(analysis) && allCandidatesResolved && allMissingHandled;

  function toggleAcceptedMissing(item: string) {
    setAcceptedMissing((prev) =>
      prev.includes(item) ? prev.filter((entry) => entry !== item) : [...prev, item]
    );
  }

  async function handleImport(event: React.ChangeEvent<HTMLInputElement>) {
    if (!reqId) return;
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setImportError(null);
    setActionMessage(null);
    try {
      const text = await file.text();
      const parsed = parseAnalysisResultArtifact(text, file.name);
      await putArtifactJson(reqId, "analysis-result.json", parsed.analysis, analysisEtag);
      setActionMessage(`Imported ${file.name}`);
      await queryClient.invalidateQueries({ queryKey: ["af", reqId, "analysis-result"] });
    } catch (error) {
      setImportError(error instanceof Error ? error.message : "Import 실패");
    }
  }

  function handleRerun() {
    if (!reqId) return;
    if (!rawText) {
      setActionMessage(
        "원문 요구사항(normalizedRequirement.raw_text)이 비어 있어 재분석할 수 없습니다. 먼저 raw_text 가 포함된 analysis-result.json 을 import 하세요."
      );
      return;
    }
    setActionMessage(null);
    setImportError(null);
    const catalog = flattenCatalogForAnalyzer(catalogIndex);
    void analyze.start({ rawText, domain, model: selectedModel, catalog });
  }

  function handleAbortRerun() {
    analyze.abort();
  }

  function handleToggleAnalysisReviewed() {
    if (!manifest) return;
    approvalMutation.mutate(
      {
        gate: "analysis_reviewed",
        value: !manifest.approvals.analysis_reviewed,
        etag: manifestEtag
      },
      {
        onSuccess: () => setActionMessage("analysis_reviewed 갱신 완료"),
        onError: (error) =>
          setActionMessage(error instanceof Error ? error.message : "approval gate 갱신 실패")
      }
    );
  }

  function handleContinueToDesign() {
    if (!reqId) return;
    navigate(`/af/${reqId}/design`);
  }

  if (!reqId) {
    return (
      <Panel>
        <EmptyState title="requirement_id가 없습니다" description="Landing 페이지에서 artifact root를 선택하세요." />
        <Link className="ui-button ui-button-secondary" to="/">
          Landing으로
        </Link>
      </Panel>
    );
  }

  return (
    <div className="af-stage-workspace">
      <Panel>
        <SectionHeader
          eyebrow={`af-analyze-requirement · ${reqId}`}
          title="요구사항 분석 검토"
          description="artifact root에 저장된 analysis-result.json을 검토하고 analysis_reviewed gate를 토글합니다."
          action={
            <div className="af-action-row">
              <label className="ui-button ui-button-secondary af-import-button">
                분석 결과 import…
                <input type="file" accept="application/json,.json" onChange={handleImport} hidden />
              </label>
            </div>
          }
        />
        {manifestLoading ? <p className="af-landing-message">manifest 불러오는 중…</p> : null}
        {manifestError ? (
          <p className="af-landing-error">manifest 조회 실패: {(manifestError as Error).message}</p>
        ) : null}
        {actionMessage ? <p className="af-landing-message">{actionMessage}</p> : null}
        {importError ? <p className="af-landing-error">Import 실패: {importError}</p> : null}
        {saveMutation.isError ? (
          <p className="af-landing-error">저장 실패: {(saveMutation.error as Error).message}</p>
        ) : null}
      </Panel>

      <Panel tone="muted">
        <SectionHeader
          title="Codex CLI 재분석"
          description={
            rawText
              ? "현재 root 의 raw_text 와 seed catalog 를 Codex CLI 로 다시 보내 analysis-result.json 을 새 결과로 덮어씁니다. 진행 상황은 아래 progress 영역에 SSE 로 흐릅니다."
              : "원문 요구사항(normalizedRequirement.raw_text) 이 비어 있어 재분석할 수 없습니다. raw_text 가 포함된 분석 결과를 먼저 import 하세요."
          }
          action={
            <div className="af-action-row">
              <SelectField
                label="모델"
                value={selectedModel}
                onChange={(event) => setSelectedModel(event.target.value as CodexAnalyzerModel)}
                disabled={rerunBusy}
              >
                {codexAnalyzerModels.map((model) => (
                  <option key={model} value={model}>
                    {model}
                  </option>
                ))}
              </SelectField>
              <Button
                type="button"
                variant="primary"
                onClick={handleRerun}
                disabled={!canRerun}
              >
                {rerunBusy ? "분석 중…" : "Codex CLI 로 재분석"}
              </Button>
              {rerunBusy ? (
                <Button type="button" variant="ghost" onClick={handleAbortRerun}>
                  중단
                </Button>
              ) : null}
            </div>
          }
        />
        {analyze.error ? <p className="af-landing-error">{analyze.error}</p> : null}
        {analyze.status === "completed" ? (
          <p className="af-landing-message">analysis-result.json 이 새 결과로 갱신되었습니다.</p>
        ) : null}
        {analyze.events.length > 0 ? (
          <details className="af-analyze-progress" open={analyze.status === "running"}>
            <summary>
              progress ({analyze.events.length}건) · 현재 상태: {analyze.status}
            </summary>
            <ol className="af-analyze-progress-list">
              {analyze.events.slice(-20).map((event, index) => (
                <li key={`${event.phase}-${event.at}-${index}`} className={`af-analyze-event af-analyze-event-${event.phase}`}>
                  <span className="af-analyze-event-phase">{event.phase}</span>
                  <span className="af-analyze-event-title">{event.title ?? event.message}</span>
                  {typeof event.elapsedMs === "number" ? (
                    <small className="af-analyze-event-meta">{event.elapsedMs}ms</small>
                  ) : null}
                </li>
              ))}
            </ol>
          </details>
        ) : null}
      </Panel>

      {analysisLoading ? (
        <Panel>
          <p className="af-landing-message">analysis-result.json 불러오는 중…</p>
        </Panel>
      ) : analysisError ? (
        <Panel>
          <p className="af-landing-error">analysis 조회 실패: {(analysisError as Error).message}</p>
        </Panel>
      ) : !analysis ? (
        <Panel>
          <EmptyState
            title="아직 analysis-result.json 이 없습니다"
            description="상단의 ‘분석 결과 import’를 사용해 외부에서 만든 결과를 올리거나, Legacy 분석기에서 분석을 실행하고 export 한 결과를 import 하세요."
          />
        </Panel>
      ) : (
        <AnalysisResult
          analysis={analysis}
          onRerun={handleRerun}
          onContinue={handleContinueToDesign}
          acceptedMissing={acceptedMissing}
          onToggleAcceptedMissing={toggleAcceptedMissing}
        />
      )}

      {manifest ? (
        <Panel tone="muted">
          <SectionHeader
            title="Gate: analysis_reviewed"
            description={
              canToggleAnalysisReviewed
                ? "모든 모듈 후보의 needs_info가 해소되고 누락 정보 항목이 ‘수용’ 처리되었습니다. gate를 토글하여 다음 단계로 진행하세요."
                : "다음 단계로 넘어가려면 모든 모듈 status가 needs_info가 아니어야 하고, 위에서 missing_information 항목을 모두 ‘수용’ 처리해야 합니다."
            }
            action={
              <Button
                variant={manifest.approvals.analysis_reviewed ? "secondary" : "primary"}
                type="button"
                onClick={handleToggleAnalysisReviewed}
                disabled={
                  approvalMutation.isPending ||
                  (!manifest.approvals.analysis_reviewed && !canToggleAnalysisReviewed)
                }
              >
                {approvalMutation.isPending
                  ? "갱신 중…"
                  : manifest.approvals.analysis_reviewed
                    ? "검토 완료 취소"
                    : "검토 완료로 표시"}
              </Button>
            }
          />
          <ul className="af-gate-summary">
            <li>모듈 후보: {analysis ? `${analysis.moduleCandidates.length}개` : "—"}</li>
            <li>needs_info 후보: {analysis?.moduleCandidates.filter((candidate) => candidate.status === "needs_info").length ?? 0}</li>
            <li>누락 정보: {missingInfo.length}건 / 수용 {acceptedMissing.length}건</li>
          </ul>
        </Panel>
      ) : null}
    </div>
  );
}

function flattenCatalogForAnalyzer(
  index: { agents: CatalogHubEntry[]; workflows: CatalogHubEntry[]; adapters: CatalogHubEntry[]; remoteA2A: CatalogHubEntry[] } | undefined
): AnalyzeCatalogEntry[] {
  if (!index) return [];
  const groups: Array<[AnalyzeCatalogEntry["module_category"], CatalogHubEntry[]]> = [
    ["agent", index.agents],
    ["workflow", index.workflows],
    ["adapter", index.adapters],
    ["remote_a2a", index.remoteA2A]
  ];
  const result: AnalyzeCatalogEntry[] = [];
  for (const [moduleCategory, entries] of groups) {
    for (const entry of entries) {
      result.push({
        ...entry,
        id: entry.id,
        name: entry.name,
        module_category: moduleCategory,
        subtype: entry.subtype ?? null
      });
    }
  }
  return result;
}
