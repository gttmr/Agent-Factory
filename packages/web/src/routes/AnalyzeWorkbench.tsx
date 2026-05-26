import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { AnalysisResult } from "../components/AnalysisResult";
import { Button, EmptyState, Panel, SectionHeader } from "../ui/primitives";
import { useAnalysisArtifact, useSaveAnalysisArtifact } from "../state/useAnalysisArtifact";
import { useArtifactRoot } from "../state/useArtifactRoot";
import { useApprovalGate } from "../state/useApprovalGate";
import { useRecentRoots } from "../state/useRecentRoots";
import { putArtifactJson } from "../state/apiClient";
import { parseAnalysisResultArtifact } from "../analyzer/analysisArtifactImport";
import { useQueryClient } from "@tanstack/react-query";

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

  const manifest = manifestData?.manifest;
  const manifestEtag = manifestData?.etag ?? null;
  const analysis = analysisData?.data ?? null;
  const analysisEtag = analysisData?.etag ?? null;

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
    setActionMessage("재분석은 PR2 범위 밖입니다. Legacy wizard에서 분석 후 결과를 import 하세요.");
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
              <Link className="ui-button ui-button-ghost" to="/legacy">
                Legacy 분석기
              </Link>
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
