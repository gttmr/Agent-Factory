---
name: feedback-codex-incremental-review
description: During large tasks, delegate a Codex review at every commit boundary and every large source-code change — not only at the final audit
metadata:
  node_type: memory
  type: feedback
  originSessionId: e986ae23-a376-418b-9137-839076826e23
---

While executing a large/multi-workstream task, delegate a Codex review (`codex:rescue` / `codex:codex-rescue`) at **every commit boundary and every large source-code change**, as the work lands — not only at the end. Goal is a robust program built incrementally, with an independent pass catching defects before they compound. Keep documentation updated in lockstep with each change (same standing expectation).

**Why:** The user explicitly asked for this on the Agent Factory ADK-runnable-graph task ("커밋 단위 혹은 커다란 소스코드 변경이 있을 때 마다 코덱스에게 리뷰를 시키면서 강건한 프로그램을 만들기 위해 노력해라") and tied it to the same in-lockstep documentation discipline.

**How to apply:** After completing a workstream/commit-sized chunk (or any sizable generator/schema/server rewrite), hand the diff to Codex for review before moving on; integrate findings, re-run validator+build, then proceed. This is in addition to — not a replacement for — the final whole-repo audit in [[feedback-worktree-merge-and-final-audit]]. Do not retry on a wrapper-level "limit" message ([[feedback-codex-retry-loop]]); implement directly. See also [[feedback-codex-usage]], [[feedback-subagent-opus-xhigh]], [[feedback-commit-per-pr]].
