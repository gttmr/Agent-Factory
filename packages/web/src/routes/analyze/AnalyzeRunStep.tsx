import { StageRunnerPanel } from "../../components/StageRunnerPanel";
import { Button, Field, TextareaField } from "../../ui/primitives";
import type { AnalyzeCatalogEntry } from "./analyzeStageModel";

interface AnalyzeRunStepProps {
  reqId: string;
  hasAnalysis: boolean;
  analysisEtag: string | null;
  requirementText: string;
  domainDraft: string;
  rawText: string;
  domain: string;
  analyzeRawText: string;
  analyzeDomain: string;
  catalog: AnalyzeCatalogEntry[];
  catalogCounts: Record<AnalyzeCatalogEntry["module_category"], number>;
  currentCandidateCount: number | null;
  onRequirementTextChange: (value: string) => void;
  onDomainDraftChange: (value: string) => void;
  onImport: (event: React.ChangeEvent<HTMLInputElement>) => void;
}

export function AnalyzeRunStep({
  reqId,
  hasAnalysis,
  analysisEtag,
  requirementText,
  domainDraft,
  rawText,
  domain,
  analyzeRawText,
  analyzeDomain,
  catalog,
  catalogCounts,
  currentCandidateCount,
  onRequirementTextChange,
  onDomainDraftChange,
  onImport
}: AnalyzeRunStepProps) {
  return (
    <StageRunnerPanel
      reqId={reqId}
      stage="analyze"
      skillName="af-analyze-requirement"
      title="Analyze Skill Runner"
      description={
        hasAnalysis
          ? "분석 결과가 있을 때 이 단계는 입력 보강, 재분석, JSON import 를 위한 refresh path 입니다. 검토 근거와 approval path 는 ‘2. 검토’ 이후에서 확인합니다."
          : "요구사항 텍스트와 seed catalog 를 서버 Stage Runner 로 보내고, 결과는 run 폴더의 proposed artifact 로 먼저 저장합니다. canonical analysis-result.json 은 제안 적용 후에만 바뀝니다."
      }
      headerAction={
        <div className="af-action-row">
          <label className="ui-button ui-button-secondary af-import-button">
            분석 결과 import…
            <input type="file" accept="application/json,.json" onChange={onImport} hidden />
          </label>
        </div>
      }
      controls={
        <div className="af-analyze-intake">
          <TextareaField
            label="요구사항 텍스트"
            value={requirementText}
            onChange={(event) => onRequirementTextChange(event.target.value)}
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
                onChange={(event) => onDomainDraftChange(event.target.value)}
                placeholder="공통"
              />
            </Field>
            {rawText ? (
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  onRequirementTextChange(rawText);
                  onDomainDraftChange(domain);
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
        { label: "현재 후보", value: currentCandidateCount === null ? "없음" : `${currentCandidateCount}개` },
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
      runButtonLabel={hasAnalysis ? "Analyze 재실행" : "Analyze 실행"}
      buildRunBody={(model) => ({
        model,
        input: { rawText: analyzeRawText, domain: analyzeDomain },
        catalog
      })}
    />
  );
}
