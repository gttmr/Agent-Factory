import type { ChangeEvent } from "react";
import { summarizeAfRunManifest, type AfRunManifest } from "../analyzer/afRunManifest";
import {
  codexAnalyzerModels,
  requirementDomains,
  type AnalyzerProgressEvent,
  type CodexAnalyzerModel,
  type RequirementDomain,
  type RequirementIntakeInput
} from "../analyzer/types";
import { AnalysisTracePanel } from "./AnalysisTracePanel";
import { Button, FileField, MetricPill, Panel, SectionHeader, SelectField, TextareaField } from "../ui/primitives";

interface RequirementIntakeProps {
  input: RequirementIntakeInput;
  onInputChange: (input: RequirementIntakeInput) => void;
  onAnalyze: () => void;
  onLoadExample: () => void;
  onLoadRemoteA2AExample: () => void;
  onClear: () => void;
  validationMessage: string;
  isAnalyzing: boolean;
  analyzerModel: CodexAnalyzerModel;
  onAnalyzerModelChange: (model: CodexAnalyzerModel) => void;
}

interface RequirementIntakeContextProps {
  input: RequirementIntakeInput;
  onInputChange: (input: RequirementIntakeInput) => void;
  onImportAnalysisArtifact: (source: string, fileName: string) => void;
  onImportRunManifest: (source: string, fileName: string) => void;
  runManifest: AfRunManifest | null;
  analysisProgress: AnalyzerProgressEvent[];
  analyzerModel: CodexAnalyzerModel;
  isAnalyzing: boolean;
}

export function RequirementIntake({
  input,
  onInputChange,
  onAnalyze,
  onLoadExample,
  onLoadRemoteA2AExample,
  onClear,
  validationMessage,
  isAnalyzing,
  analyzerModel,
  onAnalyzerModelChange
}: RequirementIntakeProps) {
  function updateField<K extends keyof RequirementIntakeInput>(field: K, value: RequirementIntakeInput[K]) {
    onInputChange({ ...input, [field]: value });
  }

  return (
    <Panel className="intake-panel intake-workspace-panel">
      <SectionHeader
        eyebrow="원천 입력"
        title="요구사항 접수"
        description="업무 요구사항 원문을 그대로 넣고 분석 모델이 구조화할 근거를 남깁니다."
      />

      <div className="intake-control-grid">
        <SelectField
          label="도메인"
          value={input.domain}
          onChange={(event) => updateField("domain", event.target.value as RequirementDomain)}
          disabled={isAnalyzing}
        >
          {requirementDomains.map((domain) => (
            <option key={domain} value={domain}>
              {domain}
            </option>
          ))}
        </SelectField>

        <SelectField
          label="분석 모델"
          value={analyzerModel}
          onChange={(event) => onAnalyzerModelChange(event.target.value as CodexAnalyzerModel)}
          disabled={isAnalyzing}
        >
          {codexAnalyzerModels.map((model) => (
            <option key={model} value={model}>
              {model}
            </option>
          ))}
        </SelectField>
      </div>

      <TextareaField
        label="원문 요구사항"
        value={input.rawText}
        onChange={(event) => updateField("rawText", event.target.value)}
        placeholder="요구사항 원문을 그대로 붙여넣으세요. 목표, 현재 흐름, 입력/출력, 시스템, 예외 조건이 섞여 있어도 모델이 구조화합니다."
        rows={20}
      />

      {validationMessage && <p className="validation">{validationMessage}</p>}

      <div className="actions intake-actions">
        <Button type="button" variant="primary" onClick={onAnalyze} disabled={isAnalyzing}>
          {isAnalyzing ? "분석 중" : "요구사항 분석"}
        </Button>
        <Button type="button" onClick={onLoadExample} disabled={isAnalyzing}>
          예시 불러오기
        </Button>
        <Button type="button" onClick={onLoadRemoteA2AExample} disabled={isAnalyzing}>
          Remote A2A 예시
        </Button>
        <Button type="button" variant="ghost" onClick={onClear} disabled={isAnalyzing}>
          초기화
        </Button>
      </div>
    </Panel>
  );
}

export function RequirementIntakeContext({
  input,
  onInputChange,
  onImportAnalysisArtifact,
  onImportRunManifest,
  runManifest,
  analysisProgress,
  analyzerModel,
  isAnalyzing
}: RequirementIntakeContextProps) {
  function handleUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    const inputElement = event.currentTarget;
    const reader = new FileReader();
    reader.onload = () => {
      onInputChange({ ...input, rawText: String(reader.result ?? "") });
      inputElement.value = "";
    };
    reader.onerror = () => {
      inputElement.value = "";
    };
    reader.readAsText(file);
  }

  function handleArtifactUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    const inputElement = event.currentTarget;
    const reader = new FileReader();
    reader.onload = () => {
      onImportAnalysisArtifact(String(reader.result ?? ""), file.name);
      inputElement.value = "";
    };
    reader.onerror = () => {
      onImportAnalysisArtifact("", file.name);
      inputElement.value = "";
    };
    reader.readAsText(file);
  }

  function handleManifestUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    const inputElement = event.currentTarget;
    const reader = new FileReader();
    reader.onload = () => {
      onImportRunManifest(String(reader.result ?? ""), file.name);
      inputElement.value = "";
    };
    reader.onerror = () => {
      onImportRunManifest("", file.name);
      inputElement.value = "";
    };
    reader.readAsText(file);
  }

  const manifestSummary = runManifest ? summarizeAfRunManifest(runManifest) : null;

  return (
    <div className="context-stack">
      <Panel tone="muted" className="context-panel-block">
        <SectionHeader eyebrow="가져오기" title="파일 입력" />
        <div className="artifact-import-stack">
          <FileField
            label="원문 파일"
            accept=".txt,.md,.yaml,.yml"
            onChange={handleUpload}
            disabled={isAnalyzing}
          />
          <FileField
            label="analysis-result.json"
            accept=".json,application/json"
            hint="af-analyze-requirement 산출물을 현재 Workbench 검토 상태로 불러옵니다."
            onChange={handleArtifactUpload}
            disabled={isAnalyzing}
          />
          <FileField
            label="af-run-manifest.json"
            accept=".json,application/json"
            hint="DLC 단계, 승인, 검증 상태를 Workbench 상태 요약에 연결합니다."
            onChange={handleManifestUpload}
            disabled={isAnalyzing}
          />
        </div>
        <div className="metric-pill-row">
          <MetricPill label="문자 수" value={input.rawText.length} />
          <MetricPill label="도메인" value={input.domain} />
        </div>
        {manifestSummary ? (
          <div className="manifest-summary-panel" aria-label="DLC run manifest 요약">
            <div>
              <span>현재 단계</span>
              <strong>
                {manifestSummary.stageLabel} · {manifestSummary.stageStatusLabel}
              </strong>
            </div>
            <div>
              <span>단계 완료</span>
              <strong>
                {manifestSummary.completedStages}/{manifestSummary.totalStages}
              </strong>
            </div>
            <div>
              <span>승인</span>
              <strong>{manifestSummary.approvalCount}/4</strong>
            </div>
            <div>
              <span>검증</span>
              <strong>{manifestSummary.validationStatusLabel}</strong>
            </div>
          </div>
        ) : null}
      </Panel>

      <Panel tone="muted" className="context-panel-block">
        <SectionHeader eyebrow="실행 로그" title="분석 Trace" />
        <AnalysisTracePanel events={analysisProgress} analyzerModel={analyzerModel} inputChars={input.rawText.length} />
      </Panel>
    </div>
  );
}
