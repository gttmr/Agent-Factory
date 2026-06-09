# Validation Report

## Result

Passed on 2026-06-08.

## Commands

- `node scripts/validate-artifacts.mjs artifacts/af/req-page-selection-analysis-smoke`
  - Result: `Artifact validation OK`
- `node scripts/validate-artifacts.mjs catalog/contracts/mcp`
  - Result: `Artifact validation OK`
- `cd packages/mock-lab && node --experimental-strip-types --loader ./scripts/ts-extension-loader.mjs -e "<validate page-analysis-mcp mock spec>"`
  - Result: `ok: true`
  - Tools: `search_page_candidates`, `analyze_user_flow`, `recommend_behavior_scenarios`, `execute_page_customer_sql`
- Host execution smoke for `artifacts/mock-lab/page-analysis-mcp/generated/server.mjs`
  - Result: `ok: true`
  - `tools/list`: 4 tools
  - `tools/call`: 4 successful synthetic calls
  - Audit records: 4

## Notes

The nested `spawnSync` smoke failed inside the Codex sandbox with `EPERM`; the same smoke passed with host execution permissions. Direct shell-pipe execution also showed `tools/list` output from the generated server. No production endpoint, credential, or private data was used.
