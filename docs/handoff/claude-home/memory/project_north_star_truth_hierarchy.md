---
name: project-north-star-truth-hierarchy
description: Agent Factory north-star goal (collab graph tool + adk web real demo) and truth hierarchy (runtime > adk.dev > code > repo docs)
metadata: 
  node_type: memory
  type: project
  originSessionId: 0704deb0-6f93-4873-a8d5-dcb5f581eac7
---

Agent Factory loop-until-goal criteria (set 2026-07-02): the workbench must let developers + business users (1) collaborate over the visualized graph (review/comments/approvals), (2) create nodes/edges with natural-language help via the existing skill path (explicitly NOT a new in-canvas NL assistant), (3) manually edit the canvas, (4) with friendly UI/UX, (5) run a real demo of the generated workflow through adk web (`adk api_server --with_ui`, port 8765) including real Gemini calls.

**Why:** Repo docs are NOT authoritative — many sessions left stale md (347 repo md; `.omo/**` alone is 221 session-residue files). Truth hierarchy for contradictions: ① actual runtime behavior ② adk.dev official docs (adk-docs MCP) ③ code ④ repo docs (docs get updated to match reality). Verdicts go to docs/decision-log.md.

**How to apply:** Iterate fix clusters until the 5 criteria pass as a live E2E demo. Cluster branches `codex/<topic>` from main, 1 commit per PR boundary, codex review at each commit boundary, ask before push. Session-residue md (.omo/**, follow-ups briefs, root STATUS.md conflict): read thoroughly, salvage useful info into the backlog, then move to docs/archive/. Backlog/plan lives at ~/.claude/plans/adk-concurrent-deer.md. Related: [[project-adk-runtime-env]], [[feedback-codex-first-delegation]]
