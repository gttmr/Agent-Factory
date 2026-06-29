import { Link } from "react-router-dom";
import type { ModuleCandidate } from "../../analyzer/types";
import type { AuthorRole } from "../../state/useAuthor";
import type { CommentAnchor, CommentStage } from "../../state/useCollaboration";
import { EmptyState, Panel } from "../../ui/primitives";
import { DesignSummaryItem, GRAPH_IR_SAVE_SUCCESS_MESSAGE } from "./designStageModel";

interface DesignSummaryProps {
  analysis: { moduleCandidates: ModuleCandidate[] } | null;
  graphNodes: number;
  errorCount: number;
  runtimeCount: number;
  a2aCount: number;
  boundariesApproved: boolean;
  runtimeApproved: boolean;
}

type CreateCommentMutate = (
  input: { stage: CommentStage; anchor: CommentAnchor; body_md: string; author: string; author_role: AuthorRole },
  options: { onError?: (error: unknown) => void }
) => void;

export function DesignSummary({
  analysis,
  graphNodes,
  errorCount,
  runtimeCount,
  a2aCount,
  boundariesApproved,
  runtimeApproved
}: DesignSummaryProps) {
  const approved = analysis?.moduleCandidates.filter((item) => item.status === "approved").length ?? 0;
  return (
    <>
      <DesignSummaryItem label="모듈" value={analysis ? `approved ${approved}/${analysis.moduleCandidates.length}` : "—"} />
      <DesignSummaryItem label="Graph IR" value={`nodes ${graphNodes} · err ${errorCount}`} />
      <DesignSummaryItem label="Runtime/A2A" value={`runtime ${runtimeCount} · A2A ${a2aCount}`} />
      <DesignSummaryItem
        label="게이트"
        value={`${boundariesApproved ? "경계✓" : "경계·"} ${runtimeApproved ? "계약✓" : "계약·"}`}
      />
    </>
  );
}

export function DesignNotice({
  reqId,
  loading,
  actionMessage
}: {
  reqId: string;
  loading: boolean;
  actionMessage: string | null;
}) {
  if (!loading && !actionMessage) return null;
  return (
    <div className="af-stage-notice" role="status">
      {loading ? <span>데이터 불러오는 중…</span> : null}
      {actionMessage ? <span>{actionMessage}</span> : null}
      {actionMessage === GRAPH_IR_SAVE_SUCCESS_MESSAGE ? (
        <Link className="ui-button ui-button-secondary" to={`/af/${reqId}/build?step=run`}>
          Build 동기화로 이동
        </Link>
      ) : null}
    </div>
  );
}

export function MissingRequirement() {
  return (
    <Panel>
      <EmptyState title="requirement_id 가 없습니다" description="Landing 에서 artifact root 를 먼저 선택하세요." />
      <Link className="ui-button ui-button-secondary" to="/">
        Landing 으로
      </Link>
    </Panel>
  );
}

export function MissingAnalysis({ reqId }: { reqId: string }) {
  return (
    <Panel>
      <EmptyState title="analysis-result.json 이 없습니다" description="Analyze 단계에서 분석 결과를 먼저 import 하세요." />
      <Link className="ui-button ui-button-primary" to={`/af/${reqId}/analyze`}>
        Analyze 로 이동
      </Link>
    </Panel>
  );
}

export function createDesignComment({
  input,
  authorName,
  authorRole,
  mutate,
  setActionMessage
}: {
  input: { stage: CommentStage; anchor: CommentAnchor; body_md: string };
  authorName: string;
  authorRole: AuthorRole;
  mutate: CreateCommentMutate;
  setActionMessage: (message: string | null) => void;
}) {
  if (!authorName.trim()) return;
  mutate(
    {
      stage: input.stage,
      anchor: input.anchor,
      body_md: input.body_md,
      author: authorName.trim(),
      author_role: authorRole
    },
    {
      onError: (error) => setActionMessage(error instanceof Error ? error.message : "comment 생성 실패")
    }
  );
}
