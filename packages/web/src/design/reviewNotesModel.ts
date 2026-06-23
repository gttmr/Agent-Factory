// Pure, dependency-light helpers for the 검토 메모 (review notes) panel, which
// merges anchored comments and saved path highlights into one review surface.
// Kept separate from ReviewNotesPanel.tsx so the display/derivation logic is
// unit-testable without a React renderer.
import type { CommentAnchor, HighlightRecord } from "../state/useCollaboration";

/**
 * Human-readable one-line description of what a saved highlight targets. Order
 * matters: a path highlight is described as a path even if node_ids are also
 * present, matching how highlights are created.
 */
export function describeHighlightTarget(highlight: HighlightRecord): string {
  if (highlight.target.node_path?.length) return `path:${highlight.target.node_path.join(" -> ")}`;
  if (highlight.target.node_ids?.length) return `nodes:${highlight.target.node_ids.join(", ")}`;
  if (highlight.target.edge_ids?.length) return `edges:${highlight.target.edge_ids.join(", ")}`;
  if (highlight.target.container_id) return `container:${highlight.target.container_id}`;
  return highlight.kind;
}

/** Combined count surfaced on the 검토 메모 tab badge (comments + highlights). */
export function reviewNotesBadgeCount(commentCount: number, highlightCount: number): number {
  return commentCount + highlightCount;
}

export function commentAnchorFromSelection(selection: {
  nodeId: string | null;
  edgeId: string | null;
}): CommentAnchor | null {
  if (selection.nodeId) return { kind: "node", node_id: selection.nodeId };
  if (selection.edgeId) return { kind: "edge", edge_id: selection.edgeId };
  return null;
}
