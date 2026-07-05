---
name: project-adk-runtime-env
description: "ADK baseline 2.3 — venv path, runtime.env holds GOOGLE_API_KEY, requirements floor still >=2.1.0"
metadata: 
  node_type: memory
  type: project
  originSessionId: 0704deb0-6f93-4873-a8d5-dcb5f581eac7
---

Agent Factory targets ADK 2.3 (user decision 2026-07-02). Installed: google-adk 2.3.0 in `~/work/Agent-Factory/.agent-factory/runtime/.venv`. `GOOGLE_API_KEY` lives in `~/work/Agent-Factory/.agent-factory/runtime.env` — check presence with grep -q, never print the value. As of 2026-07-02 `requirements/adk-runtime.txt` still floors at `google-adk[a2a,mcp]>=2.1.0` and docs said "ADK 2.0 baseline" (backlog C3 aligns docs + requirements + 2.2/2.3 compat comments to the 2.3 baseline).

**Why:** Version claims were inconsistent across docs (2.0), requirements (>=2.1), and generator comments (2.2/2.3 patches); the user fixed the baseline at 2.3.

**How to apply:** Verify ADK API claims against the installed 2.3.0 via venv introspection first, adk.dev docs second. Related: [[project-north-star-truth-hierarchy]]
