---
name: browser-tooling-priority
description: UI 검증 시 chrome-devtools MCP를 우선하고 Playwright는 MCP 단절 시 임시 폴백으로만 사용
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 6ef56522-fa2c-43be-9642-50cc4046a2a6
---

For UI/screenshot verification in the Agent Factory workbench, prefer the chrome-devtools MCP tools whenever they are connected. Playwright (via the globally cached playwright-core + ms-playwright chromium) is acceptable only as a temporary fallback when the chrome-devtools MCP is disconnected.

**Why:** On 2026-06-12 the chrome-devtools MCP dropped mid-session and Playwright was used to finish verification; the user explicitly said this was fine temporarily but chrome-devtools must stay the default going forward.

**How to apply:** Before UI verification, check whether `mcp__chrome-devtools__*` tools are available (ToolSearch). Use them if so; only fall back to Playwright when they are disconnected, and mention the fallback in the report. See [[feedback_codex_usage]] for the related delegation flow.
