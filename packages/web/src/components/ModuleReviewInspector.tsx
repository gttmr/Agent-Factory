import { getCandidateSubtype, moduleCategoryLabels } from "../analyzer/classificationRules";
import type { FieldSpec, ModuleCandidate } from "../analyzer/types";
import type { CatalogEntry } from "../catalog/types";
import { FieldGroup, InspectorPanel, ReadinessList } from "../ui/review";
import { CategoryBadge, SubtypeBadge, getSubtypeValue } from "./CategoryBadge";

const adkHintRows = [
  ["state_memory", "Session/State"],
  ["callbacks", "Callbacks/Guardrail"],
  ["artifacts_events", "Artifacts/Events"],
  ["mcp_a2a", "MCP↔A2A"],
  ["streaming_grounding", "Streaming/Grounding"]
] as const;

interface ModuleReviewInspectorProps {
  candidate: ModuleCandidate | null;
  catalogEntries: CatalogEntry[];
  onNavigateToA2AContracts?: () => void;
}

export function ModuleReviewInspector({
  candidate,
  catalogEntries,
  onNavigateToA2AContracts
}: ModuleReviewInspectorProps) {
  if (!candidate) {
    return (
      <InspectorPanel eyebrow="선택 항목" title="후보 없음">
        <p className="empty-state">검토할 모듈 후보가 없습니다.</p>
      </InspectorPanel>
    );
  }

  const subtype = getCandidateSubtype(candidate) ?? moduleCategoryLabels[candidate.module_category];
  const missingInfoIssues = candidateMissingInfoIssues(candidate);
  const scaffoldIssues = candidate.status === "approved" ? approvalReadinessIssues(candidate, catalogEntries) : [];
  const followUpFields = candidate.module_category === "remote_a2a" ? remoteA2AFields : candidateNextFields(candidate);
  const hintRows = getAdkHintRows(candidate);

  return (
    <InspectorPanel
      eyebrow="선택 항목"
      title={candidate.name}
      meta={
        <div className="module-inspector-badges">
          <CategoryBadge category={candidate.module_category} />
          {getSubtypeValue(candidate) ? <SubtypeBadge value={getSubtypeValue(candidate)!} /> : null}
        </div>
      }
      actions={
        candidate.module_category === "remote_a2a" && onNavigateToA2AContracts ? (
          <button type="button" className="a2a-review-link" onClick={onNavigateToA2AContracts}>
            A2A Contract 검토
          </button>
        ) : null
      }
    >
      <ReadinessList
        title="승인 blocker"
        issues={[...missingInfoIssues, ...scaffoldIssues]}
        emptyText={candidate.status === "approved" ? "Scaffold 준비됨" : "현재 상태에서 즉시 표시할 blocker가 없습니다."}
        tone="warning"
      />

      <FieldGroup title="판단 근거">
        <p className="review-prose">{candidate.rationale}</p>
      </FieldGroup>

      <FieldGroup title="계약 요약">
        <dl className="review-definition-grid">
          <div>
            <dt>입력</dt>
            <dd>{candidate.inputs.length}개</dd>
          </div>
          <div>
            <dt>출력</dt>
            <dd>{candidate.outputs.length}개</dd>
          </div>
          <div>
            <dt>신뢰도</dt>
            <dd>{Math.round(candidate.confidence * 100)}%</dd>
          </div>
          <div>
            <dt>재사용</dt>
            <dd>{candidate.reuse_candidate ? "예" : "아니요"}</dd>
          </div>
        </dl>
      </FieldGroup>

      <FieldGroup title="후속 검토 항목" description={subtype}>
        <FieldList fields={followUpFields} />
      </FieldGroup>

      {hintRows.length > 0 ? (
        <FieldGroup title="ADK 구현 힌트">
          <div className="flow-node-hints is-open">
            {hintRows.map((hint) => (
              <div className="adk-hint-row" key={hint.key}>
                <span className="adk-hint-key">{hint.label}</span>
                <span className="adk-hint-value">{hint.value}</span>
              </div>
            ))}
          </div>
        </FieldGroup>
      ) : null}

      <FieldGroup title="Risk Gate">
        {candidate.risk_signals.length > 0 ? (
          <div className="risk-signal-list">
            {candidate.risk_signals.map((signal) => (
              <span className="tag compact-tag" key={signal}>
                {formatRiskSignal(signal)}
              </span>
            ))}
          </div>
        ) : (
          <p className="review-muted">등록된 risk signal이 없습니다.</p>
        )}
      </FieldGroup>
    </InspectorPanel>
  );
}

export function approvalReadinessIssues(candidate: ModuleCandidate, catalogEntries: CatalogEntry[]): string[] {
  const issues: string[] = [];
  if (candidate.missing_information.length) {
    issues.push(`정보 필요 항목 ${candidate.missing_information.length}건 — 해결 메모를 남긴 뒤 승인`);
  }
  if (!candidate.inputs.length) issues.push("입력 계약 필요");
  if (!candidate.outputs.length) issues.push("출력 계약 필요");
  const binding = catalogEntries.find(
    (entry) =>
      entry.provenance !== "session_deleted" &&
      entry.module_category === candidate.module_category &&
      entry.name.trim().toLowerCase() === candidate.name.trim().toLowerCase()
  );
  if (!binding) {
    issues.push("신규 구현 TODO로 생성됨");
    return issues;
  }
  return issues;
}

export function candidateReviewIssues(candidate: ModuleCandidate, catalogEntries: CatalogEntry[]): string[] {
  if (candidate.status === "needs_info" || candidate.missing_information.length > 0) {
    return candidateMissingInfoIssues(candidate);
  }
  if (candidate.status === "approved") return approvalReadinessIssues(candidate, catalogEntries);
  return [];
}

function candidateMissingInfoIssues(candidate: ModuleCandidate): string[] {
  if (candidate.missing_information.length > 0) return candidate.missing_information;
  if (candidate.status === "needs_info") {
    return ["정보 필요 상태입니다. 해결 메모를 남긴 뒤 승인하세요."];
  }
  return [];
}

function getAdkHintRows(candidate: ModuleCandidate) {
  const hints = candidate.adk_hints;
  if (!hints) {
    return [];
  }
  return adkHintRows.flatMap(([key, label]) => {
    const value = hints[key];
    return typeof value === "string" && value.trim() ? [{ key, label, value }] : [];
  });
}

function candidateNextFields(candidate: ModuleCandidate): FieldSpec[] {
  if (candidate.module_category === "adapter") {
    if (candidate.adapter_kind === "retrieval") {
      return [
        { name: "출처 표기", type: "required" },
        { name: "근거 연결", type: "required" },
        { name: "원천 접근 권한", type: "required" }
      ];
    }
    if (candidate.adapter_kind === "rule_registry") {
      return [
        { name: "소유자", type: "required" },
        { name: "버전", type: "required" },
        { name: "적용일", type: "required" },
        { name: "감사", type: "required" }
      ];
    }
    return [
      { name: "계약", type: "required" },
      { name: "인증", type: "review" },
      { name: "부수 효과", type: "review" }
    ];
  }
  if (candidate.module_category === "workflow") {
    return [
      { name: "단계 순서", type: "required" },
      { name: "인계", type: "required" }
    ];
  }
  return [
    { name: "입력 계약", type: "required" },
    { name: "eval placeholder", type: "required" }
  ];
}

const remoteA2AFields: FieldSpec[] = [
  { name: "소유자", type: "required" },
  { name: "생명주기", type: "required" },
  { name: "계약", type: "required" },
  { name: "인증", type: "required" },
  { name: "타임아웃", type: "required" },
  { name: "재시도", type: "required" },
  { name: "폴백", type: "required" },
  { name: "감사", type: "required" }
];

function FieldList({ fields }: { fields: FieldSpec[] }) {
  return (
    <div className="field-chip-list">
      {fields.map((field) => (
        <span className="field-chip" key={`${field.name}-${field.type}`}>
          {field.name}
        </span>
      ))}
    </div>
  );
}

function formatRiskSignal(signal: string): string {
  const labels: Record<string, string> = {
    personal_data: "개인정보",
    financial_data: "금융정보",
    credit_decision_support: "신용판단 보조",
    customer_impact: "고객 영향",
    external_message: "외부 메시지",
    transaction_write: "거래 쓰기",
    human_approval_required: "사람 승인",
    audit_required: "감사"
  };

  return labels[signal] ?? signal;
}
