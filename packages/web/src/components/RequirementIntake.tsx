import type { ChangeEvent } from "react";
import type { RequirementIntakeInput } from "../analyzer/types";

interface RequirementIntakeProps {
  input: RequirementIntakeInput;
  onInputChange: (input: RequirementIntakeInput) => void;
  onAnalyze: () => void;
  onLoadExample: () => void;
  onClear: () => void;
  validationMessage: string;
  isAnalyzing: boolean;
}

export function RequirementIntake({
  input,
  onInputChange,
  onAnalyze,
  onLoadExample,
  onClear,
  validationMessage,
  isAnalyzing
}: RequirementIntakeProps) {
  function updateField(field: keyof RequirementIntakeInput, value: string) {
    onInputChange({ ...input, [field]: value });
  }

  function handleUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      updateField("rawText", String(reader.result ?? ""));
    };
    reader.readAsText(file);
  }

  return (
    <div className="two-column">
      <section className="panel intake-panel">
        <div className="section-heading">
          <p className="eyebrow">Source</p>
          <h2>요구사항 접수</h2>
        </div>

        <label>
          <span>제목</span>
          <input
            value={input.title}
            onChange={(event) => updateField("title", event.target.value)}
            placeholder="Customer complaint triage agent"
          />
        </label>

        <div className="field-grid">
          <label>
            <span>도메인 힌트</span>
            <input
              value={input.domainHint}
              onChange={(event) => updateField("domainHint", event.target.value)}
              placeholder="customer-service"
            />
          </label>
          <label>
            <span>요청 팀</span>
            <input
              value={input.requesterTeam}
              onChange={(event) => updateField("requesterTeam", event.target.value)}
              placeholder="example-operations"
            />
          </label>
          <label>
            <span>요청자 역할</span>
            <input
              value={input.requesterRole}
              onChange={(event) => updateField("requesterRole", event.target.value)}
              placeholder="business-user"
            />
          </label>
          <label>
            <span>알려진 시스템</span>
            <input
              value={input.knownSystems}
              onChange={(event) => updateField("knownSystems", event.target.value)}
              placeholder="system_a, system_b"
            />
          </label>
        </div>

        <label>
          <span>예상 출력</span>
          <input
            value={input.expectedOutput}
            onChange={(event) => updateField("expectedOutput", event.target.value)}
            placeholder="classification, recommendation, draft response"
          />
        </label>

        <label>
          <span>원문 요구사항</span>
          <textarea
            value={input.rawText}
            onChange={(event) => updateField("rawText", event.target.value)}
            placeholder="이해관계자 요구사항 원문을 붙여넣으세요."
            rows={12}
          />
        </label>

        {validationMessage && <p className="validation">{validationMessage}</p>}

        <div className="actions">
          <button type="button" className="primary" onClick={onAnalyze} disabled={isAnalyzing}>
            {isAnalyzing ? "분석 중" : "요구사항 분석"}
          </button>
          <button type="button" onClick={onLoadExample}>
            예시 불러오기
          </button>
          <button type="button" onClick={onClear}>
            초기화
          </button>
        </div>
      </section>

      <aside className="panel side-panel">
        <div className="section-heading">
          <p className="eyebrow">Import</p>
          <h2>텍스트 파일</h2>
        </div>
        <input className="file-input" type="file" accept=".txt,.md,.yaml,.yml" onChange={handleUpload} />
        <dl className="metric-list">
          <div>
            <dt>문자 수</dt>
            <dd>{input.rawText.length}</dd>
          </div>
          <div>
            <dt>선택 필드</dt>
            <dd>{countOptionalFields(input)} / 6</dd>
          </div>
        </dl>
      </aside>
    </div>
  );
}

function countOptionalFields(input: RequirementIntakeInput): number {
  return [
    input.title,
    input.domainHint,
    input.requesterTeam,
    input.requesterRole,
    input.knownSystems,
    input.expectedOutput
  ].filter((value) => value.trim()).length;
}
