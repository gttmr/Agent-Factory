import type { GraphIR } from "../analyzer/types";
import { Button } from "../ui/primitives";
import type { AuthorRole } from "../state/useAuthor";
import type {
  CommentAnchor,
  CommentRecord,
  CommentStage,
  CreateHighlightInput,
  HighlightRecord
} from "../state/useCollaboration";
import { CommentThread } from "./CommentThread";
import { PathTracePanel } from "./PathTracePanel";
import { describeHighlightTarget } from "./reviewNotesModel";

interface ReviewNotesPanelProps {
  reqId: string;
  graphIR: GraphIR | null;
  comments: CommentRecord[];
  highlights: HighlightRecord[];
  authorName: string;
  authorRole: AuthorRole;
  isCommentMutating: boolean;
  isHighlightMutating: boolean;
  onAuthorNameChange: (next: string) => void;
  onAuthorRoleChange: (next: AuthorRole) => void;
  onCreateComment: (input: { stage: CommentStage; anchor: CommentAnchor; body_md: string }) => void;
  onUpdateComment: (id: string, body: Partial<Pick<CommentRecord, "body_md" | "status">>) => void;
  onDeleteComment: (id: string) => void;
  onSelectNode: (id: string) => void;
  onCreateHighlight: (input: CreateHighlightInput) => void;
  onDeleteHighlight: (id: string) => void;
}

export function ReviewNotesPanel({
  reqId,
  graphIR,
  comments,
  highlights,
  authorName,
  authorRole,
  isCommentMutating,
  isHighlightMutating,
  onAuthorNameChange,
  onAuthorRoleChange,
  onCreateComment,
  onUpdateComment,
  onDeleteComment,
  onSelectNode,
  onCreateHighlight,
  onDeleteHighlight
}: ReviewNotesPanelProps) {
  return (
    <div className="af-review-notes-panel">
      <section className="af-review-notes-section" aria-labelledby="review-notes-comments-title">
        <div className="af-review-notes-header">
          <div>
            <h4 id="review-notes-comments-title">코멘트</h4>
            <p>설계 검토 중 남긴 노드, 엣지, 섹션 단위 메모입니다.</p>
          </div>
          <span className="af-review-notes-count">{comments.length}건</span>
        </div>
        <CommentThread
          reqId={reqId}
          comments={comments}
          anchor={null}
          authorName={authorName}
          authorRole={authorRole}
          isMutating={isCommentMutating}
          onAuthorNameChange={onAuthorNameChange}
          onAuthorRoleChange={onAuthorRoleChange}
          onCreate={onCreateComment}
          onUpdate={onUpdateComment}
          onDelete={onDeleteComment}
          emptyHint="그래프에서 노드나 엣지를 선택하면 해당 항목에 코멘트를 남길 수 있습니다."
        />
      </section>

      <section className="af-review-notes-section" aria-labelledby="review-notes-path-title">
        <div className="af-review-notes-header">
          <div>
            <h4 id="review-notes-path-title">경로 하이라이트</h4>
            <p>시작 노드와 종료 노드를 선택해 검토 경로를 저장합니다.</p>
          </div>
          <span className="af-review-notes-count">{highlights.length}건</span>
        </div>
        <PathTracePanel
          graphIR={graphIR}
          author={authorName}
          saving={isHighlightMutating}
          onSelectNode={onSelectNode}
          onCreateHighlight={onCreateHighlight}
        />
        <HighlightList highlights={highlights} onDelete={onDeleteHighlight} />
      </section>
    </div>
  );
}

function HighlightList({ highlights, onDelete }: { highlights: HighlightRecord[]; onDelete: (id: string) => void }) {
  if (highlights.length === 0) {
    return <p className="af-review-highlight-empty">저장된 경로 하이라이트가 없습니다.</p>;
  }

  return (
    <ul className="af-review-highlight-list" aria-label="저장된 경로 하이라이트">
      {highlights.map((highlight) => (
        <li key={highlight.id} className="af-review-highlight-entry">
          <div>
            <strong>{highlight.label}</strong>
            <span>{describeHighlightTarget(highlight)}</span>
            <small>
              {highlight.author} · {new Date(highlight.created_at).toLocaleString()}
            </small>
          </div>
          <Button
            type="button"
            variant="ghost"
            onClick={() => {
              if (window.confirm("이 경로 하이라이트를 삭제할까요?")) onDelete(highlight.id);
            }}
          >
            삭제
          </Button>
        </li>
      ))}
    </ul>
  );
}
