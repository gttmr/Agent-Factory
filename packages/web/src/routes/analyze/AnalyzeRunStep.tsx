import { StageRunnerPanel } from "../../components/StageRunnerPanel";
import { Button, Field, TextareaField } from "../../ui/primitives";
import { buildAnalyzeStageRunnerConfig } from "../stageRunnerScreenConfig";
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
  catalogCounts: Record<AnalyzeCatalogEntry["asset_type"], number>;
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
  const stageRunnerConfig = buildAnalyzeStageRunnerConfig({
    hasAnalysis,
    analysisEtag,
    analyzeRawText,
    analyzeDomain,
    catalog,
    catalogCounts,
    currentCandidateCount
  });

  return (
    <StageRunnerPanel
      reqId={reqId}
      {...stageRunnerConfig}
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
    />
  );
}
