---
name: feedback-commit-per-pr
description: "For the multi-PR Agent Factory workbench refactor, create a git commit at the end of every PR boundary"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 0d79bfa3-bd81-4e20-8d5d-505bcc7e066a
---

When working through the Agent Factory `packages/web` 4-skill workbench refactor (plan file: `/home/ilmaswsl/.claude/plans/agent-factory-synthetic-hummingbird.md`, tasks PR1–PR6), create a git commit at the end of every PR boundary — do not batch multiple PRs into one commit, and do not leave a completed PR uncommitted.

**Why:** User explicitly asked on 2026-05-26 ("PR이 완료될 때마다 커밋을 하도록 하라") because each plan PR is sized as one reviewable unit and they want git history to mirror that. Reviewing 6 PRs worth of churn as a single commit defeats the staged-migration design.

**How to apply:**
- After verification passes for a PR (build + smoke tests per the plan's §8 validation table), stage the relevant files and create a commit before starting the next PR.
- Use Conventional-style commit subjects scoped to the PR number, e.g. `PR1: server/storage foundation for /api/af` so the audit trail matches the plan.
- Don't push without explicit instruction — the user has only authorized local commits so far.
- This rule covers PR2–PR6 in the current plan. If the plan changes (new PR breakdown), apply the same per-PR commit cadence.
- Do not bypass hooks with `--no-verify`; if a pre-commit hook fails, fix the issue and create a new commit (don't `--amend` the failed attempt, since the original commit didn't land).
