---
name: feedback-worktree-merge-and-final-audit
description: Finishing discipline for large/worktree changes — verify clean merge-back and run a whole-repo doc+contract correctness audit before reporting done
metadata: 
  node_type: memory
  type: feedback
  originSessionId: e986ae23-a376-418b-9137-839076826e23
---

When work is done in a git worktree, before reporting done: verify (read-only) that the worktree branch merges cleanly back into the current cwd branch (`git merge-base --is-ancestor`, `git merge-tree` / `--no-commit --no-ff` dry run). Surface any divergence as a blocker; do not merge or push without an explicit ask.

For large changes, add an explicit final step: a whole-repo correctness audit checking that all docs AND repository contents are consistent with the new behavior (no stale claims, enums/schemas/validator stay aligned, no leaked secrets/throwaway artifacts). This is context-heavy, so fan it out to read-only subagents and delegate a final review to Codex.

**Why:** The user asked for both explicitly on the Agent Factory ADK-runnable-graph task and treats them as standing expectations for big work.

**How to apply:** Keep documentation a first-class, in-lockstep deliverable (same commit as the behavior). End big tasks with the subagent+Codex audit, fix findings, re-run validator+build, then report. See [[feedback-codex-usage]], [[feedback-subagent-opus-xhigh]], [[feedback-commit-per-pr]].
