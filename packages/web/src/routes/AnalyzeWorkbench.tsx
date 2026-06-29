import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { StageShell, useStageStep } from "../layout/StageShell";
import { EmptyState, Panel } from "../ui/primitives";
import { useAnalysisArtifact, useSaveAnalysisArtifact } from "../state/useAnalysisArtifact";
import { useArtifactRoot } from "../state/useArtifactRoot";
import { useApprovalGate } from "../state/useApprovalGate";
import { useRecentRoots } from "../state/useRecentRoots";
import { putArtifactJson } from "../state/apiClient";
import { parseAnalysisResultArtifact } from "../analyzer/analysisArtifactImport";
import { useQueryClient } from "@tanstack/react-query";
import { useCatalog } from "../state/useCatalog";
import { resolveAnalyzeRawText } from "../analyzer/analyzeInput";
import { canToggleAnalysisReviewed as canToggleAnalysisReviewedGate } from "../analyzer/analysisReviewGate";
import { AnalyzeApprovalStep } from "./analyze/AnalyzeApprovalStep";
import { AnalyzeReviewWorkspace } from "./analyze/AnalyzeReviewWorkspace";
import { AnalyzeRunStep } from "./analyze/AnalyzeRunStep";
import {
  ANALYZE_STEP_IDS,
  AnalyzeSummaryItem,
  buildAnalyzeSteps,
  buildAnalyzeNextAction,
  flattenCatalogForAnalyzer,
  type AnalyzeStepId
} from "./analyze/analyzeStageModel";

export default function AnalyzeWorkbench() {
  const params = useParams<{ reqId: string }>();
  const reqId = params.reqId;
  const queryClient = useQueryClient();
  const { touch } = useRecentRoots();
  useEffect(() => {
    if (reqId) touch(reqId);
  }, [reqId, touch]);

  const { data: manifestData, isLoading: manifestLoading, error: manifestError } = useArtifactRoot(reqId);
  const { data: analysisData, isLoading: analysisLoading, error: analysisError } = useAnalysisArtifact(reqId);
  const saveMutation = useSaveAnalysisArtifact(reqId);
  const approvalMutation = useApprovalGate(reqId);

  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [requirementText, setRequirementText] = useState("");
  const [domainDraft, setDomainDraft] = useState("공통");

  const manifest = manifestData?.manifest;
  const manifestEtag = manifestData?.etag ?? null;
  const analysis = analysisData?.data ?? null;
  const analysisEtag = analysisData?.etag ?? null;

  const { data: catalogIndex } = useCatalog();
  const rawText = analysis?.normalizedRequirement?.raw_text?.trim() ?? "";
  const domain = analysis?.normalizedRequirement?.domain ?? "공통";
  const analyzeRawText = resolveAnalyzeRawText(requirementText, rawText);
  const analyzeDomain = domainDraft.trim() || domain;
  const catalog = flattenCatalogForAnalyzer(catalogIndex);
  const catalogCounts = {
    agent: catalog.filter((entry) => entry.module_category === "agent").length,
    workflow: catalog.filter((entry) => entry.module_category === "workflow").length,
    adapter: catalog.filter((entry) => entry.module_category === "adapter").length,
    remote_a2a: catalog.filter((entry) => entry.module_category === "remote_a2a").length
  };

  const missingInfo = analysis?.evidence?.missing_information ?? [];
  // 수용 상태는 analysis-result.json(evidence.accepted_missing_information)에 영속화한다 —
  // 컴포넌트 메모리에만 두면 리로드 시 초기화된다.
  const acceptedMissing = analysis?.evidence?.accepted_missing_information ?? [];
  const needsInfoCount = analysis?.moduleCandidates.filter((candidate) => candidate.status === "needs_info").length ?? 0;
  const hasAnalysis = Boolean(analysis);
  const reviewReady = canToggleAnalysisReviewedGate({
    hasAnalysis,
    missingInfo,
    acceptedMissing
  });
  const approved = manifest?.approvals.analysis_reviewed === true;

  // 첫 미완료 스텝으로 착지 — 강한 가이드. (게이트 재계산이 아니라 단순 파생)
  const defaultStep: AnalyzeStepId = !hasAnalysis ? "run" : !reviewReady ? "review" : "approve";
  const [activeStep, setActiveStep] = useStageStep(ANALYZE_STEP_IDS, defaultStep);

  function toggleAcceptedMissing(item: string) {
    if (!analysis || saveMutation.isPending) return;
    const next = acceptedMissing.includes(item)
      ? acceptedMissing.filter((entry) => entry !== item)
      : [...acceptedMissing, item];
    saveMutation.mutate(
      {
        analysis: {
          ...analysis,
          evidence: { ...analysis.evidence, accepted_missing_information: next }
        },
        etag: analysisEtag
      },
      {
        onError: (error) =>
          setActionMessage(error instanceof Error ? error.message : "수용 상태 저장 실패")
      }
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
      setRequirementText(parsed.input.rawText);
      setDomainDraft(parsed.input.domain || "공통");
      setActionMessage(`Imported ${file.name}`);
      await queryClient.invalidateQueries({ queryKey: ["af", reqId, "analysis-result"] });
    } catch (error) {
      setImportError(error instanceof Error ? error.message : "Import 실패");
    }
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

  const steps = buildAnalyzeSteps({ hasAnalysis, reviewReady, approved, activeStep: activeStep as AnalyzeStepId });

  const nextAction = buildAnalyzeNextAction({
    activeStep: activeStep as AnalyzeStepId,
    reqId,
    hasAnalysis,
    reviewReady,
    approved,
    onAdvance: setActiveStep
  });

  const notice =
    manifestLoading || manifestError || actionMessage || importError || saveMutation.isError ? (
      <div className="af-stage-notice" role="status">
        {manifestLoading ? <span>manifest 불러오는 중…</span> : null}
        {manifestError ? <span className="is-error">manifest 조회 실패: {(manifestError as Error).message}</span> : null}
        {actionMessage ? <span>{actionMessage}</span> : null}
        {importError ? <span className="is-error">Import 실패: {importError}</span> : null}
        {saveMutation.isError ? (
          <span className="is-error">저장 실패: {(saveMutation.error as Error).message}</span>
        ) : null}
      </div>
    ) : null;

  return (
    <StageShell
      eyebrow={`분석 · ${reqId}`}
      title="분석"
      steps={steps}
      activeStep={activeStep}
      onStepChange={setActiveStep}
      summary={
        <>
          <AnalyzeSummaryItem label="후보 모듈" value={analysis ? `${analysis.moduleCandidates.length}개` : "—"} />
          <AnalyzeSummaryItem label="needs_info" value={`${needsInfoCount}개`} />
          <AnalyzeSummaryItem label="누락 정보" value={`${missingInfo.length}건 / 수용 ${acceptedMissing.length}`} />
          <AnalyzeSummaryItem label="catalog" value={`${catalog.length}개`} />
        </>
      }
      nextAction={nextAction}
    >
      {notice}

      {activeStep === "run" ? (
        <AnalyzeRunStep
          reqId={reqId}
          hasAnalysis={hasAnalysis}
          analysisEtag={analysisEtag}
          requirementText={requirementText}
          domainDraft={domainDraft}
          rawText={rawText}
          domain={domain}
          analyzeRawText={analyzeRawText}
          analyzeDomain={analyzeDomain}
          catalog={catalog}
          catalogCounts={catalogCounts}
          currentCandidateCount={analysis?.moduleCandidates.length ?? null}
          onRequirementTextChange={setRequirementText}
          onDomainDraftChange={setDomainDraft}
          onImport={handleImport}
        />
      ) : null}

      {activeStep === "review" ? (
        analysisLoading ? (
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
              description="‘1. 실행’ 단계에서 요구사항을 분석하거나 ‘분석 결과 import’를 사용하세요."
            />
          </Panel>
        ) : (
          <AnalyzeReviewWorkspace
            analysis={analysis}
            missingInfo={missingInfo}
            acceptedMissing={acceptedMissing}
            reviewReady={reviewReady}
            approved={approved}
            onRerun={() => setActiveStep("run")}
            onContinue={() => setActiveStep("approve")}
            onToggleAcceptedMissing={toggleAcceptedMissing}
          />
        )
      ) : null}

      {activeStep === "approve" ? (
        <AnalyzeApprovalStep
          manifestPresent={Boolean(manifest)}
          reviewReady={reviewReady}
          approved={approved}
          pending={approvalMutation.isPending}
          analysis={analysis}
          needsInfoCount={needsInfoCount}
          missingInfoCount={missingInfo.length}
          acceptedMissingCount={acceptedMissing.length}
          onToggle={handleToggleAnalysisReviewed}
        />
      ) : null}
    </StageShell>
  );
}
