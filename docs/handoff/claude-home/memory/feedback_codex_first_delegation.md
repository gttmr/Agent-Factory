---
name: feedback-codex-first-delegation
description: Delegate exploration and implementation to Codex gpt-5.5 (high/xhigh); Claude subagents only for MCP-bound work
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 0704deb0-6f93-4873-a8d5-dcb5f581eac7
---

For Agent Factory work, delegate most exploration, investigation, and implementation to Codex (subagent_type `codex:codex-rescue` or the codex skill) running gpt-5.5 with reasoning effort high — xhigh for hard/multi-artifact tasks. Do NOT default to Opus subagents (supersedes the old opus-xhigh rule from 2026-05-26; user corrected this on 2026-07-02).

**Why:** User explicitly redirected: don't explore with Opus subagents — use codex gpt-5.5 high, or xhigh by difficulty, for most cases. The main Claude session is orchestrator/judge only on large efforts: it plans, verifies, integrates, and must not generate code itself.

**How to apply:**
- Main-session model: the user keeps the orchestrator session on **Fable 5** and asked (2026-07-03) that important judgments run on Fable 5 — don't downgrade the main session; codex still does implementation/exploration.
- `Agent(subagent_type: "codex:codex-rescue")` with model/effort stated in the prompt, or the codex:rescue skill.
- Claude subagents remain for MCP-bound work only (adk-docs fetch, chrome-devtools UI verification) since Codex cannot reach MCP servers.
- The codex-rescue subagent is a single-call forwarder: it cannot poll or fetch its background codex result. Retrieve results from the parent session: job state + logs live under `~/.claude/plugins/data/codex-openai-codex/state/agent-<id>-*/jobs/task-*.{json,log}`; session-local task output files may also exist (grep for "Turn completed." to find the final report).
- **Worktree isolation does NOT propagate to codex**: `Agent(isolation: "worktree")` puts the forwarder in a worktree, but codex runs at the broker cwd (primary checkout) and will refuse "work only in the worktree" instructions. Instead: create a sibling worktree yourself (`git worktree add -b <branch> /home/ilmaswsl/work/af-wt-<x> main`) and start the forwarded request with routing flags `--cwd /path/to/worktree --model gpt-5.5 --effort high` — codex-companion `task` parses `--cwd`. Never let codex switch branches in the primary checkout while dev servers/walkthroughs run there.
- Local `main` can lag `origin/main` in this repo (pulls often happen on feature branches); base worktrees on a fast-forwarded main (`git branch -f main origin/main` when main isn't checked out).
- Related: [[feedback-codex-usage]], [[feedback-codex-incremental-review]]
