---
name: project-campaign3-2026-07
description: Campaign 3 state (2026-07-12) — Phase M merged PR
metadata: 
  node_type: memory
  type: project
  originSessionId: 8d0f6daf-49f0-4ede-9fac-7e66428536df
---

Campaign 3 (backlog 3건, decisions 2026-07-12: 순서 ②→③→①, run-manifest 옵션2, 파일분할 UI 3종, dynamic 2-PR):

- **Phase M done**: PR #70 merged — generator CLI is pure file generation; caller (server Build primitive + artifact-sync) records only `stages.build.outputs` + `current_stage`; approvals/stage status untouched by generation.
- **Phase D PR-A merged**: PR #71 (2d1154e→521a764) — edge-topological dynamic lowering, join barriers, loop edge-path closure, coverage ledger, deterministic run IDs (D8 real-ADK RED/GREEN resume proof passed). Approved design (12 decisions) at `docs/handoff/claude-home/evidence/d0-dynamic-design.md`.
- **Security follow-up done (2026-07-17)**: PR #72 merged — terminal-output node id bound via `toPyStr` local (`_node_id`), hostile-id py_compile regression, `terminal_output_node_id` allowlisted; also fixed PR-A latent defect (env-dependent README rows excluded from SHA-256 pinning). Review clean.
- **Phase S started**: A2AContractPanel.tsx split (branch `codex/a2a-panel-split`) in flight 2026-07-17; GraphCanvas/GraphElementEditor splits remain.
- **Next**: PR-B (single node/edge-kind dispatch unifying 3 resolvers, smoke/static byte-identity via SHA-256 manifests), then remaining Phase S splits.
- Cross-host continuation: see `docs/handoff/claude-home/STATUS-2026-07-12.md` (plan checkboxes in `plans/af-campaign3-2026-07-12.md`).

Related: [[project-integration-branch-2026-07]], [[feedback-codex-first-delegation]], [[feedback-generator-extensible-structure]]
