import { useState } from "react";
import { Button } from "../ui/primitives";
import type { AuthorRole } from "../state/useAuthor";
import type { CommentAnchor, CommentRecord, CommentStage } from "../state/useCollaboration";

interface CommentThreadProps {
  reqId: string;
  comments: CommentRecord[];
  anchor: CommentAnchor | null;
  authorName: string;
  authorRole: AuthorRole;
  isMutating: boolean;
  onAuthorNameChange: (next: string) => void;
  onAuthorRoleChange: (next: AuthorRole) => void;
  onCreate: (input: { stage: CommentStage; anchor: CommentAnchor; body_md: string }) => void;
  onUpdate: (id: string, body: Partial<Pick<CommentRecord, "body_md" | "status">>) => void;
  onDelete: (id: string) => void;
  emptyHint?: string;
}

const ROLE_OPTIONS: Array<{ value: AuthorRole; label: string }> = [
  { value: "developer", label: "개발자" },
  { value: "business", label: "업무 담당자" },
  { value: "reviewer", label: "리뷰어" },
  { value: "unknown", label: "미지정" }
];

const STATUS_LABEL: Record<CommentRecord["status"], string> = {
  open: "열림",
  resolved: "해결됨",
  wontfix: "보류"
};

export function CommentThread({
  reqId,
  comments,
  anchor,
  authorName,
  authorRole,
  isMutating,
  onAuthorNameChange,
  onAuthorRoleChange,
  onCreate,
  onUpdate,
  onDelete,
  emptyHint
}: CommentThreadProps) {
  const [draft, setDraft] = useState("");
  const filtered = anchor ? comments.filter((entry) => matchesAnchor(entry.anchor, anchor)) : comments;

  function submitDraft() {
    if (!anchor) return;
    const text = draft.trim();
    if (!text) return;
    onCreate({ stage: "design", anchor, body_md: text });
    setDraft("");
  }

  return (
    <div className="af-comment-thread">
      <div className="af-comment-author-row">
        <label>
          <span>이름</span>
          <input
            type="text"
            value={authorName}
            onChange={(event) => onAuthorNameChange(event.target.value)}
            placeholder="예: 홍길동"
            aria-label="작성자 이름"
          />
        </label>
        <label>
          <span>역할</span>
          <select
            value={authorRole}
            onChange={(event) => onAuthorRoleChange(event.target.value as AuthorRole)}
            aria-label="작성자 역할"
          >
            {ROLE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      {anchor ? (
        <form
          className="af-comment-form"
          onSubmit={(event) => {
            event.preventDefault();
            submitDraft();
          }}
        >
          <textarea
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder={anchorHint(anchor)}
            rows={3}
            aria-label="코멘트 본문"
            maxLength={4000}
          />
          <div className="af-comment-form-actions">
            <span className="af-comment-anchor-tag">{anchorTag(anchor)}</span>
            <Button type="submit" variant="primary" disabled={!draft.trim() || isMutating || !authorName.trim()}>
              코멘트 남기기
            </Button>
          </div>
          {!authorName.trim() ? (
            <p className="af-comment-warn">이름을 입력해야 코멘트를 남길 수 있습니다.</p>
          ) : null}
        </form>
      ) : (
        <p className="af-comment-anchor-hint">{emptyHint ?? "Graph IR 또는 사이드바에서 항목을 선택하면 코멘트를 작성할 수 있습니다."}</p>
      )}

      <ul className="af-comment-list">
        {filtered.length === 0 ? (
          <li className="af-comment-empty">아직 코멘트가 없습니다.</li>
        ) : (
          filtered.map((entry) => (
            <CommentEntry key={entry.id} entry={entry} onUpdate={onUpdate} onDelete={onDelete} />
          ))
        )}
      </ul>

      <p className="af-comment-footnote">
        artifacts/af/{reqId}/collaboration/comments.json — git 에 그대로 들어갑니다.
      </p>
    </div>
  );
}

interface CommentEntryProps {
  entry: CommentRecord;
  onUpdate: CommentThreadProps["onUpdate"];
  onDelete: CommentThreadProps["onDelete"];
}

function CommentEntry({ entry, onUpdate, onDelete }: CommentEntryProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(entry.body_md);

  function save() {
    const text = draft.trim();
    if (!text) return;
    onUpdate(entry.id, { body_md: text });
    setEditing(false);
  }

  function toggleResolved() {
    onUpdate(entry.id, { status: entry.status === "resolved" ? "open" : "resolved" });
  }

  return (
    <li className={`af-comment-entry af-comment-entry-${entry.status}`}>
      <header className="af-comment-entry-header">
        <span className="af-comment-author">{entry.author}</span>
        <span className="af-comment-role">{entry.author_role}</span>
        <span className="af-comment-tag">{anchorTag(entry.anchor)}</span>
        <span className={`af-comment-status af-comment-status-${entry.status}`}>{STATUS_LABEL[entry.status]}</span>
        <time dateTime={entry.created_at}>{new Date(entry.created_at).toLocaleString()}</time>
      </header>
      {editing ? (
        <textarea value={draft} onChange={(event) => setDraft(event.target.value)} rows={3} aria-label="코멘트 수정" />
      ) : (
        <p className="af-comment-body">{entry.body_md}</p>
      )}
      <div className="af-comment-entry-actions">
        {editing ? (
          <>
            <Button type="button" variant="primary" onClick={save}>
              저장
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setDraft(entry.body_md);
                setEditing(false);
              }}
            >
              취소
            </Button>
          </>
        ) : (
          <>
            <Button type="button" variant="ghost" onClick={() => setEditing(true)}>
              수정
            </Button>
            <Button type="button" variant="ghost" onClick={toggleResolved}>
              {entry.status === "resolved" ? "다시 열기" : "해결로 표시"}
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                if (window.confirm("이 코멘트를 삭제할까요?")) onDelete(entry.id);
              }}
            >
              삭제
            </Button>
          </>
        )}
      </div>
    </li>
  );
}

function anchorHint(anchor: CommentAnchor): string {
  switch (anchor.kind) {
    case "node":
      return `노드 ${anchor.node_id} 에 코멘트를 남기세요…`;
    case "edge":
      return `엣지 ${anchor.edge_id} 에 코멘트를 남기세요…`;
    case "container":
      return `컨테이너 ${anchor.container_id} 에 코멘트를 남기세요…`;
    case "path":
      return "경로에 코멘트를 남기세요…";
    case "section":
      return `${anchor.section} 섹션에 코멘트를 남기세요…`;
    default:
      return "코멘트를 남기세요…";
  }
}

function anchorTag(anchor: CommentAnchor): string {
  switch (anchor.kind) {
    case "node":
      return `node:${anchor.node_id ?? "?"}`;
    case "edge":
      return `edge:${anchor.edge_id ?? "?"}`;
    case "container":
      return `container:${anchor.container_id ?? "?"}`;
    case "path":
      return `path:${(anchor.node_path ?? []).join("→") || "?"}`;
    case "section":
      return `section:${anchor.section ?? "?"}`;
    default:
      return anchor.kind;
  }
}

function matchesAnchor(a: CommentAnchor, b: CommentAnchor): boolean {
  if (a.kind !== b.kind) return false;
  if (a.kind === "node") return a.node_id === b.node_id;
  if (a.kind === "edge") return a.edge_id === b.edge_id;
  if (a.kind === "container") return a.container_id === b.container_id;
  if (a.kind === "section") return a.section === b.section;
  if (a.kind === "path") {
    const ap = a.node_path ?? [];
    const bp = b.node_path ?? [];
    return ap.length === bp.length && ap.every((id, idx) => id === bp[idx]);
  }
  return false;
}
