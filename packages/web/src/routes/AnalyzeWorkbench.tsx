import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { AnalysisResult } from "../components/AnalysisResult";
import { StageRunnerPanel } from "../components/StageRunnerPanel";
import { StageShell, useStageStep, type StageNextAction, type StageStep } from "../layout/StageShell";
import { Button, EmptyState, Field, Panel, SectionHeader, TextareaField } from "../ui/primitives";
import { useAnalysisArtifact, useSaveAnalysisArtifact } from "../state/useAnalysisArtifact";
import { useArtifactRoot } from "../state/useArtifactRoot";
import { useApprovalGate } from "../state/useApprovalGate";
import { useRecentRoots } from "../state/useRecentRoots";
import { putArtifactJson } from "../state/apiClient";
import { parseAnalysisResultArtifact } from "../analyzer/analysisArtifactImport";
import { useQueryClient } from "@tanstack/react-query";
import { useCatalog, type CatalogHubEntry } from "../state/useCatalog";
import { resolveAnalyzeRawText } from "../analyzer/analyzeInput";
import { canToggleAnalysisReviewed as canToggleAnalysisReviewedGate } from "../analyzer/analysisReviewGate";

type AnalyzeStepId = "run" | "review" | "approve";
const ANALYZE_STEP_IDS: AnalyzeStepId[] = ["run", "review", "approve"];

interface AnalyzeCatalogEntry {
  id?: string;
  name: string;
  module_category: "agent" | "workflow" | "adapter" | "remote_a2a";
  subtype?: string | null;
  [key: string]: unknown;
}

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

  const [acceptedMissing, setAcceptedMissing] = useState<string[]>([]);
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

  const steps: StageStep[] = [
    {
      id: "run",
      label: "1. 실행",
      hint: "요구사항 분석",
      status: hasAnalysis ? "done" : activeStep === "run" ? "current" : "todo"
    },
    {
      id: "review",
      label: "2. 검토",
      hint: "이해·누락정보 확인",
      available: hasAnalysis,
      status: !hasAnalysis
        ? "todo"
        : reviewReady
          ? "done"
          : activeStep === "review"
            ? "current"
            : "blocked"
    },
    {
      id: "approve",
      label: "3. 승인",
      hint: "analysis_reviewed",
      available: hasAnalysis,
      status: approved
        ? "done"
        : !reviewReady
          ? hasAnalysis
            ? "blocked"
            : "todo"
          : activeStep === "approve"
            ? "current"
            : "todo"
    }
  ];

  const nextAction = buildNextAction({
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
          <SummaryItem label="후보 모듈" value={analysis ? `${analysis.moduleCandidates.length}개` : "—"} />
          <SummaryItem label="needs_info" value={`${needsInfoCount}개`} />
          <SummaryItem label="누락 정보" value={`${missingInfo.length}건 / 수용 ${acceptedMissing.length}`} />
          <SummaryItem label="catalog" value={`${catalog.length}개`} />
        </>
      }
      nextAction={nextAction}
    >
      {notice}

      {activeStep === "run" ? (
        <StageRunnerPanel
          reqId={reqId}
          stage="analyze"
          skillName="af-analyze-requirement"
          title="Analyze Skill Runner"
          description="요구사항 텍스트와 seed catalog 를 서버 Stage Runner 로 보내고, 결과는 run 폴더의 proposed artifact 로 먼저 저장합니다. canonical analysis-result.json 은 제안 적용 후에만 바뀝니다."
          headerAction={
            <div className="af-action-row">
              <label className="ui-button ui-button-secondary af-import-button">
                분석 결과 import…
                <input type="file" accept="application/json,.json" onChange={handleImport} hidden />
              </label>
            </div>
          }
          controls={
            <div className="af-analyze-intake">
              <TextareaField
                label="요구사항 텍스트"
                value={requirementText}
                onChange={(event) => setRequirementText(event.target.value)}
                rows={7}
                placeholder="예: 고객 문의를 분류하고 담당자가 먼저 읽을 수 있는 요약을 생성하는 Agent가 필요합니다."
                hint={
                  rawText
                    ? "비워 두면 현재 analysis-result.json 의 normalizedRequirement.raw_text 로 분석합니다."
                    : "입력한 텍스트가 Analyze Skill Runner 입력으로 전송됩니다."
                }
              />
              <div className="af-analyze-intake-controls">
                <Field label="도메인">
                  <input
                    type="text"
                    value={domainDraft}
                    onChange={(event) => setDomainDraft(event.target.value)}
                    placeholder="공통"
                  />
                </Field>
                {rawText ? (
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => {
                      setRequirementText(rawText);
                      setDomainDraft(domain);
                    }}
                  >
                    현재 raw_text 불러오기
                  </Button>
                ) : null}
              </div>
            </div>
          }
          metrics={[
            { label: "입력 글자", value: `${analyzeRawText.length}자`, tone: analyzeRawText ? "ok" : "danger" },
            { label: "현재 후보", value: analysis ? `${analysis.moduleCandidates.length}개` : "없음" },
            { label: "catalog", value: `${catalog.length}개` },
            {
              label: "catalog 구성",
              value: `A ${catalogCounts.agent} · W ${catalogCounts.workflow} · D ${catalogCounts.adapter} · R ${catalogCounts.remote_a2a}`
            }
          ]}
          disabledReason={
            analyzeRawText
              ? null
              : "요구사항 텍스트가 비어 있습니다. 원문을 입력하거나 raw_text 가 포함된 analysis-result.json 을 import 하세요."
          }
          currentArtifactEtag={analysisEtag}
          runButtonLabel={analysis ? "Analyze 재실행" : "Analyze 실행"}
          buildRunBody={(model) => ({
            model,
            input: { rawText: analyzeRawText, domain: analyzeDomain },
            catalog
          })}
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
          <AnalysisResult
            analysis={analysis}
            onRerun={() => setActiveStep("run")}
            onContinue={() => setActiveStep("approve")}
            acceptedMissing={acceptedMissing}
            onToggleAcceptedMissing={toggleAcceptedMissing}
          />
        )
      ) : null}

      {activeStep === "approve" ? (
        manifest ? (
          <Panel tone="muted">
            <SectionHeader
              title="Gate: analysis_reviewed"
              description={
                reviewReady
                  ? "요구사항 수준 누락 정보 항목이 ‘수용’ 처리되었습니다. gate를 토글하여 모듈 검토(설계) 단계로 진행하세요."
                  : "다음 단계로 넘어가려면 ‘2. 검토’에서 요구사항 수준 missing_information 항목을 모두 ‘수용’ 처리해야 합니다."
              }
              action={
                <Button
                  variant={approved ? "secondary" : "primary"}
                  type="button"
                  onClick={handleToggleAnalysisReviewed}
                  disabled={approvalMutation.isPending || (!approved && !reviewReady)}
                >
                  {approvalMutation.isPending
                    ? "갱신 중…"
                    : approved
                      ? "검토 완료 취소"
                      : "검토 완료로 표시"}
                </Button>
              }
            />
            <ul className="af-gate-summary">
              <li>모듈 후보: {analysis ? `${analysis.moduleCandidates.length}개` : "—"}</li>
              <li>needs_info 후보: {needsInfoCount}</li>
              <li>누락 정보: {missingInfo.length}건 / 수용 {acceptedMissing.length}건</li>
            </ul>
          </Panel>
        ) : (
          <Panel>
            <EmptyState title="manifest 없음" description="af-run-manifest.json 을 확인하세요." />
          </Panel>
        )
      ) : null}
    </StageShell>
  );
}

function SummaryItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="af-stage-summary-item">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function buildNextAction({
  activeStep,
  reqId,
  hasAnalysis,
  reviewReady,
  approved,
  onAdvance
}: {
  activeStep: AnalyzeStepId;
  reqId: string;
  hasAnalysis: boolean;
  reviewReady: boolean;
  approved: boolean;
  onAdvance: (id: AnalyzeStepId) => void;
}): StageNextAction {
  if (activeStep === "run") {
    return {
      label: "검토로 →",
      onClick: () => onAdvance("review"),
      disabled: !hasAnalysis,
      hint: hasAnalysis
        ? "분석 결과가 준비됐습니다. ‘2. 검토’로 이동해 이해와 누락 정보를 확인하세요."
        : "왼쪽 입력란에 요구사항을 적고 Analyze 를 실행하면 분석 결과가 생성됩니다."
    };
  }
  if (activeStep === "review") {
    return {
      label: "승인으로 →",
      onClick: () => onAdvance("approve"),
      disabled: !reviewReady,
      hint: reviewReady
        ? "누락 정보를 모두 수용했습니다. ‘3. 승인’으로 이동하세요."
        : "‘보조 근거 → 누락 정보’ drawer에서 모든 항목을 ‘수용’ 처리해야 승인할 수 있습니다."
    };
  }
  return {
    label: "설계 단계로 →",
    to: `/af/${reqId}/design`,
    disabled: !approved,
    hint: approved
      ? "분석 검토가 완료됐습니다. 설계(경계) 단계로 이동하세요."
      : reviewReady
        ? "아래 ‘검토 완료로 표시’를 눌러 analysis_reviewed 게이트를 통과하세요."
        : "먼저 ‘2. 검토’에서 누락 정보를 모두 수용하세요."
  };
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
