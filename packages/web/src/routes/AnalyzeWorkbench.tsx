import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { AnalysisResult } from "../components/AnalysisResult";
import { StageRunnerPanel } from "../components/StageRunnerPanel";
import { Button, EmptyState, Field, Panel, SectionHeader, TextareaField } from "../ui/primitives";
import { useAnalysisArtifact, useSaveAnalysisArtifact } from "../state/useAnalysisArtifact";
import { useArtifactRoot } from "../state/useArtifactRoot";
import { useApprovalGate } from "../state/useApprovalGate";
import { useRecentRoots } from "../state/useRecentRoots";
import { putArtifactJson } from "../state/apiClient";
import { parseAnalysisResultArtifact } from "../analyzer/analysisArtifactImport";
import { useQueryClient } from "@tanstack/react-query";
import type { AnalyzeCatalogEntry } from "../state/useAnalyze";
import { useCatalog, type CatalogHubEntry } from "../state/useCatalog";
import { resolveAnalyzeRawText } from "../analyzer/analyzeInput";
import { canToggleAnalysisReviewed as canToggleAnalysisReviewedGate } from "../analyzer/analysisReviewGate";

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
  const canToggleAnalysisReviewed = canToggleAnalysisReviewedGate({
    hasAnalysis: Boolean(analysis),
    missingInfo,
    acceptedMissing
  });

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

  function handleRerunFromResult() {
    setActionMessage("상단 Skill Runner 패널에서 요구사항을 확인한 뒤 실행하세요.");
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
      {manifestLoading || manifestError || actionMessage || importError || saveMutation.isError ? (
        <Panel>
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
      ) : null}

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
            description="상단에 요구사항 텍스트를 입력해 Codex CLI 분석을 실행하거나, ‘분석 결과 import’를 사용해 외부에서 만든 결과를 올리세요."
          />
        </Panel>
      ) : (
        <AnalysisResult
          analysis={analysis}
          onRerun={handleRerunFromResult}
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
                ? "요구사항 수준 누락 정보 항목이 ‘수용’ 처리되었습니다. gate를 토글하여 모듈 검토 단계로 진행하세요."
                : "다음 단계로 넘어가려면 위에서 요구사항 수준 missing_information 항목을 모두 ‘수용’ 처리해야 합니다."
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
