import type { ChangeEvent } from "react";
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
  analysisProgress: AnalyzerProgressEvent[];
  analyzerModel: CodexAnalyzerModel;
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
  analysisProgress,
  analyzerModel
}: RequirementIntakeContextProps) {
  function handleUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      onInputChange({ ...input, rawText: String(reader.result ?? "") });
    };
    reader.readAsText(file);
  }

  return (
    <div className="context-stack">
      <Panel tone="muted" className="context-panel-block">
        <SectionHeader eyebrow="가져오기" title="텍스트 파일" />
        <FileField label="파일 선택" accept=".txt,.md,.yaml,.yml" onChange={handleUpload} />
        <div className="metric-pill-row">
          <MetricPill label="문자 수" value={input.rawText.length} />
          <MetricPill label="도메인" value={input.domain} />
        </div>
      </Panel>

      <Panel tone="muted" className="context-panel-block">
        <SectionHeader eyebrow="실행 로그" title="분석 Trace" />
        <AnalysisTracePanel events={analysisProgress} analyzerModel={analyzerModel} inputChars={input.rawText.length} />
      </Panel>
    </div>
  );
}
