---
name: ""
metadata: 
  node_type: memory
  originSessionId: e986ae23-a376-418b-9137-839076826e23
---

When a Codex call (`codex:rescue` / `codex:codex-rescue` agent) comes back with **"You've hit your session limit · resets HH:mm"**, that is **Claude's own session limit**, not Codex's. The whole Claude session pauses at that boundary and resumes later; when the user says "이어서 진행"/"continue", the session HAS resumed and there is no remaining limit. So re-invoking Codex's review or code-writing functions after that point works fine — do NOT treat the message as "Codex is unavailable" and do NOT permanently fall back to doing everything in Claude for the rest of the task.

**Why:** The user explicitly corrected this — "세션한도에 달한 것은 클로드 너 자신의 세션이다 … 이어서 진행하라고 했을 때 코덱스의 리뷰/코드 작성 기능을 다시 사용해도 아무 문제가 없다." A previous note misread this as a Codex/wrapper limit and abandoned Codex; that was wrong.

**How to apply:**
1. See "hit your session limit · resets <time>" from a Codex call → it's your own session cap. The session resumes on the next user turn; on resume, simply re-run the Codex review/codegen you intended.
2. Do not loop-retry within the SAME turn (the cap is real until reset), and don't keep doing Claude-only work for the rest of the task — pick Codex back up after the resume.
3. Optional sanity check that Codex actually ran on a normal (non-limit) call: `ls -la ~/.codex/history.jsonl` mtime / `~/.codex/sessions/`.
4. Still honor [[feedback-codex-usage]] and [[feedback-codex-incremental-review]] — Codex is the preferred reviewer/drafter on the happy path.
