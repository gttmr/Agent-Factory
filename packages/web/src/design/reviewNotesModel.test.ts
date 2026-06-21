import assert from "node:assert/strict";
import { describeHighlightTarget, reviewNotesBadgeCount } from "./reviewNotesModel.ts";
import type { HighlightRecord, HighlightTarget } from "../state/useCollaboration.ts";

function highlight(kind: HighlightRecord["kind"], target: HighlightTarget): HighlightRecord {
  return {
    id: "hl-1",
    stage: "design",
    kind,
    label: "검토 경로",
    color_token: "neutral",
    target,
    author: "리뷰어",
    created_at: "2026-06-21T00:00:00.000Z"
  };
}

// describeHighlightTarget — one branch per target shape, with documented precedence.
assert.equal(
  describeHighlightTarget(highlight("path", { node_path: ["node-a", "node-b", "node-c"] })),
  "path:node-a -> node-b -> node-c",
  "path target is rendered as an arrow-joined path"
);
// node_path wins even when node_ids are also present (creation precedence).
assert.equal(
  describeHighlightTarget(highlight("path", { node_path: ["node-a"], node_ids: ["node-z"] })),
  "path:node-a",
  "node_path takes precedence over node_ids"
);
assert.equal(
  describeHighlightTarget(highlight("node_group", { node_ids: ["node-a", "node-b"] })),
  "nodes:node-a, node-b",
  "node group target lists node ids"
);
assert.equal(
  describeHighlightTarget(highlight("edge_group", { edge_ids: ["edge-1", "edge-2"] })),
  "edges:edge-1, edge-2",
  "edge group target lists edge ids"
);
assert.equal(
  describeHighlightTarget(highlight("container_focus", { container_id: "container-root" })),
  "container:container-root",
  "container target names the container"
);
// Empty target falls back to the highlight kind.
assert.equal(
  describeHighlightTarget(highlight("node_group", {})),
  "node_group",
  "an empty target falls back to the highlight kind"
);
// Empty arrays are treated as absent (length 0), so they also fall back to kind.
assert.equal(
  describeHighlightTarget(highlight("path", { node_path: [], node_ids: [] })),
  "path",
  "empty arrays fall through to the kind fallback"
);

// reviewNotesBadgeCount — combined comment + highlight count for the tab badge.
assert.equal(reviewNotesBadgeCount(0, 0), 0);
assert.equal(reviewNotesBadgeCount(2, 3), 5);

console.log("reviewNotesModel tests passed");
