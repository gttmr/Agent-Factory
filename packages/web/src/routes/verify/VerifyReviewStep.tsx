import { Button, Panel, SectionHeader } from "../../ui/primitives";

interface VerifyReviewStepProps {
  readonly deltaDraft: string;
  readonly deltaDirty: boolean;
  readonly deltaExists: boolean;
  readonly isDeltaSaving: boolean;
  readonly isReportSaving: boolean;
  readonly onDeltaChange: (value: string) => void;
  readonly onDeltaSave: () => void;
  readonly onReportChange: (value: string) => void;
  readonly onReportSave: () => void;
  readonly reportDraft: string;
  readonly reportDirty: boolean;
  readonly reportExists: boolean;
}

export function VerifyReviewStep({
  deltaDraft,
  deltaDirty,
  deltaExists,
  isDeltaSaving,
  isReportSaving,
  onDeltaChange,
  onDeltaSave,
  onReportChange,
  onReportSave,
  reportDraft,
  reportDirty,
  reportExists
}: VerifyReviewStepProps) {
  return (
    <div className="af-verify-recording-grid">
      <Panel className="af-verify-recording-panel">
        <SectionHeader
          title="validation-report.md"
          description="검증 명령 결과와 잔존 위험을 markdown 으로 정리합니다."
          action={
            <Button type="button" variant="primary" disabled={!reportDirty || isReportSaving} onClick={onReportSave}>
              {isReportSaving ? "저장 중…" : "저장"}
            </Button>
          }
        />
        <div className="af-verify-editor-meta">
          <span>{reportExists ? "기존 report 로드됨" : "새 report 작성"}</span>
          <strong>{reportDirty ? "수정 중" : reportExists ? "저장됨" : "미작성"}</strong>
        </div>
        <textarea
          value={reportDraft}
          onChange={(event) => onReportChange(event.target.value)}
          rows={10}
          className="af-markdown-editor"
          placeholder="# Validation report&#10;&#10;- 명령: …&#10;- 결과: …&#10;- 잔존 위험: …"
        />
      </Panel>

      <Panel className="af-verify-recording-panel">
        <SectionHeader
          title="catalog-delta.yaml"
          description="catalog 변경 제안만 기록합니다 (실제 catalog/*.yaml 은 절대 직접 편집하지 않습니다)."
          action={
            <Button type="button" variant="primary" disabled={!deltaDirty || isDeltaSaving} onClick={onDeltaSave}>
              {isDeltaSaving ? "저장 중…" : "저장"}
            </Button>
          }
        />
        <div className="af-verify-editor-meta">
          <span>{deltaExists ? "기존 delta 로드됨" : "제안 없음"}</span>
          <strong>{deltaDirty ? "수정 중" : deltaExists ? "저장됨" : "미작성"}</strong>
        </div>
        <textarea
          value={deltaDraft}
          onChange={(event) => onDeltaChange(event.target.value)}
          rows={10}
          className="af-markdown-editor af-yaml-editor"
          placeholder={`proposed_additions:\n  - category: tool\n    asset_type: tool\n    name: …\n    domain_scope: domain_neutral\n    business_domains: []\n    owner: …\n    reuse_status: publish_candidate\n    capability_tags: []\n    binding: { kind: unresolved, server_ref: null, tool_name: null }\n    connection: { transport: unknown }\n    workflow_profile: null\n    exposure: null\n`}
        />
      </Panel>
    </div>
  );
}
