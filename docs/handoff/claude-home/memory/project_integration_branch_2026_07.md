---
name: project-integration-branch-2026-07
description: 2026-07 doc/code contradiction audit landed as PR #56 (merged to main 23dd34b); next-session backlog lives in ~/.claude/plans/af-next-steps-2026-07-04.md
metadata:
  node_type: memory
  type: project
  originSessionId: 0704deb0-6f93-4873-a8d5-dcb5f581eac7
---

**MERGED 2026-07-03T15:53Z as PR #56** → main `23dd34b` (local main pulled, in sync). Contents: 15 verified fix clusters from the docs↔code contradiction audit (C1 validator run-ids, C2 approval-revoke two-way projection, C3/C4/C5 docs ADK-2.3/CLAUDE.md/taxonomy, C6 residue archive, C8 ×3, C9 A2A interceptor 3-arg contract, C10 per-node symbols, C11a/b generator runtime robustness — real-adk verified, C12 design step-status, C13 keyboard move persist, C14 Mock Lab prereq row, prepush fixes) **plus Stage Runner progress narrative** (running-only 진행 메모 + 할 일 N/M block from live agent_message/todo_list snippets; fake runner emits the same codex_event shapes with short delays; browser-verified against a real gpt-5.5 SDK run).

Cleanup done: af-wt-* worktrees removed, 17 cluster branches + integration/c1-c9-c10 + PR branch (local & remote) deleted. Kept: `docs/edge-data-passing-followups` (unmerged pre-audit branch, disposition pending — see backlog P6) and `backup/taxonomy-axis-prework-20260620`.

**Next-session backlog with rationale: `~/.claude/plans/af-next-steps-2026-07-04.md`** (P1 parked contract inspector — new requirements can't pass `runtime_contracts_approved` via UI alone; P2 long-run partial re-run UX; P3 skills/adk-2.md skill-sync needs explicit instruction; P4 test hardening; P5 HMR orphan mock processes; P6 unmerged branch disposition; P7 demo replay guide). History: ~/.claude/plans/adk-concurrent-deer.md. Related: [[project-north-star-truth-hierarchy]], [[project-adk-runtime-env]]
