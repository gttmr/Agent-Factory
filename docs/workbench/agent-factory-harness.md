# Agent Factory Harness

This document is the project-specific operating harness for Agent Factory work. It is separate from the user-level global development constitution and applies only inside this repository.

## Purpose

Agent Factory should turn vague requirements into reviewed, reusable planning artifacts before any implementation step begins.
The preferred operating path is skill-led: `.agents/skills/af-analyze-requirement`, `af-design-boundaries`, `af-build-runtime-stub`, and `af-verify-feedback` produce and verify schema artifacts, while the web workbench visualizes and supports guided partial edits.

The goal is repeatable agent design review, not one-off code generation. Coding agents working in this repository must preserve a controlled pipeline:

```text
raw requirement
  -> af-analyze-requirement
  -> normalized requirement
  -> evidence and missing-information review
  -> module candidates
  -> workflow/process flow
  -> af-design-boundaries
  -> runtime contract review for callback, legacy, Context Manager, and async resume behavior
  -> catalog reuse and registration review
  -> reviewed catalog and Graph IR decisions
  -> approved scaffold-plan and ADK Runtime Handoff
  -> af-build-runtime-stub
  -> af-verify-feedback
```

Raw requirements must not directly generate code.

## Documentation impact comes first

Before changing source code, check whether the change affects active `docs/` Markdown.

Update docs in the same change set when a change affects:

- taxonomy or enum meaning
- catalog semantics or runtime binding
- schemas, validator behavior, or required verification commands
- analyzer prompts, output shape, or review flow
- Workflow/Graph IR rules
- UI behavior that users or future agents rely on
- operating policy in `AGENTS.md` or `CLAUDE.md`

When a change alters a design decision (interface, schema, gate, or UX contract), also append an entry to `docs/decision-log.md` (date · PR · decision · rationale · impact). The decision log records history only; behavior specs stay in the active docs.

Do not update `docs/archive/**` for current behavior unless the task explicitly asks for archival or migration work.

## Classification first

Before building implementation plans, classify each requested capability into the active taxonomy. For skill-led runs, `af-analyze-requirement` creates first-pass candidates and `af-design-boundaries` performs the review/approval pass.

Top-level categories:

- `agent`: reasoning responsibility such as judgment, summarization, classification, recommendation, or policy interpretation.
- `workflow`: broad Workflow Agent boundary, classified as `orchestration`, `graph`, `dynamic`, or `unknown`; sequence, fan-out/fan-in, loop, and human input live inside Graph IR.
- `adapter`: callable capability used by agents or workflows; includes legacy APIs, retrieval, rule registries, data queries, templates, computation, and external services.
- `remote_a2a`: independent remote agent boundary with protocol-level contract.

Do not promote retrieval, rule registry, or tool/adapter back into top-level categories. They remain adapter subtypes.

## Remote A2A is high-friction

Remote A2A must not be inferred merely because a process has multiple steps or multiple local modules.

Use `remote_a2a` only when there is an independent remote agent boundary with explicit ownership and protocol responsibility.

Reusable catalog workflows stay local by default. A normal workflow entry inserts as a `workflow_call`; it becomes A2A-capable only through the explicit Reuse Hub `A2A 가능하게 변경` proposal and `등록 승인` publish path. Analyze and Design must not silently reclassify a local workflow as `remote_a2a` because it is complex or reused by another root.

A Remote A2A candidate must include:

- `risk_level: high`
- owner
- agent card or equivalent discovery metadata
- auth model
- task lifecycle
- timeout policy
- retry policy
- fallback behavior
- audit requirements

If those fields are unknown, mark the candidate as needing review instead of inventing them.

## Scaffold and runtime handoff gate

ADK Runtime Handoff is part of the current workbench, but it is review-gated. Scaffold-plan generation and source handoff must consume only approved artifacts:

- reviewed `AnalysisResult`
- approved module candidates
- approved required runtime contracts in `AnalysisResult.runtimeContracts`
- reviewed A2A contracts where Remote A2A is involved
- reviewed catalog decisions
- `scaffold-plan` data with `source: approved_workbench_artifact`

Do not scaffold directly from:

- raw user requests
- unreviewed analyzer output
- incomplete module candidates
- missing Remote A2A contract details
- private or organization-specific runtime assumptions

A scaffold plan should make boundaries explicit before code exists. Generated source defaults to a TODO/runtime-wiring smoke handoff. A reviewed `output_mode: runnable` scaffold plan (this approved capability) instead emits a runnable ADK 2.x graph `Workflow` — `LlmAgent` nodes using runtime-env-selected LLMs (vLLM/OpenAI-compatible through `LiteLlm` when `AF_VLLM_*` is set, otherwise Gemini fallback), reviewed agent-owned MCP toolsets lowered with ADK 2.3.0 `LlmAgent(..., tools=[McpToolset(...)])`, adapter nodes calling synthetic Mock Lab MCP servers, and reviewed Remote A2A nodes lowered through `RemoteA2aAgent` when an approved A2A contract supplies the agent card URL — but it is still generated only from approved workbench artifacts (`raw_requirement_to_code` stays `false`), never from raw requirements. The ADK constructor path uses `tools`, not `toolsets`: `agent` + `mcp_toolset` + `selected_by_llm` is the LLM-selected tool path for agent-owned MCP toolsets, while `adapter_call` + `mcp_tool` + `fixed_by_workflow` remains the fixed workflow adapter path and `adapter_call` + `selected_by_llm` remains invalid/out of scope. Runnable lowering covers DAG graphs with parallel fan-out + `JoinNode` fan-in, `human_input` nodes (ADK 2.x `RequestInput`: at runtime the workflow pauses with a long-running `adk_request_input` call and resumes when the caller sends a matching `functionResponse`), static reviewed `router` route maps (`route` selects the branch, `Event.output` carries the payload), reviewed loop/dynamic shapes via an internal ADK dynamic workflow builder (`@node` + `ctx.run_node(...)` + bounded `while`), and contract-backed `remote_a2a` / `remote_agent_call` boundaries. Loop decision edges (`loop_control`, `loop_back`, `loop_exit`) require reviewed `route_condition`/`route_aliases` or an explicit default exit/back edge; production business-loop policy remains a TODO boundary. In either mode it must not include private banking endpoints, credentials, deployment scripts, real customer data, or organization-specific runtime code. The default stub output location for skill-led runs is `artifacts/af/<req-id>/runtime-stub/`.

Workbench Build uses one server-owned compound path for artifact root sync and regeneration: `POST /api/af/:reqId/artifact-sync/run`. The contract order is fixed: save reviewed Graph IR into `analysis-result.json.processFlow`; sync derived split artifacts from `analysis-result.json`; derive and write `scaffold-plan.json`; regenerate `runtime-stub/`; run `validate-artifacts.mjs`; then let the reviewer separately decide approval gates. This path must not auto-toggle `analysis_reviewed`, `boundaries_approved`, `runtime_contracts_approved`, or `stub_ready_for_followup`. Existing manual Build and Verify controls remain separate advanced paths and must not become a competing source of artifact order. Build/Verify Stage Runner panels wrap those same primitives to add run history, cancellation, and proposed report/delta review without changing the canonical artifact order.

### Missing-information two-layer gate

Triage of missing information after analysis follows a two-layer rule.

- Requirement-level `evidence.missing_information` is a soft gate. `/af/:reqId/analyze` (AnalyzeWorkbench) exposes a per-row "수용" toggle persisted to `evidence.accepted_missing_information` in `analysis-result.json` (the artifact root is the canonical store, so acceptance survives reloads). This is reviewer attestation only and does not block scaffold-plan generation; the `analysis_reviewed` approval becomes enable-able once every item is accepted.
- Candidate-level `ModuleCandidate.missing_information` and unresolved `status === "needs_info"` are hard gates. In `/af/:reqId/design`, candidates are approved in the 하단 `모듈` 탭: each missing item must be resolved, optionally with a reviewer note, before the `승인` action becomes available.
- Applied state copies resolved items into `resolved_missing_information`, clears `missing_information`, stores the reviewer note or default resolution in `missing_information_resolution`, records `resolution_applied_at`, marks `schema_review_state: applied`, and stores `smoke_spec`. Candidate `status` is then set to `approved`, and matching Graph IR node `review_status` values mirror the candidate status so DesignWorkbench can flip `boundaries_approved`.
- `buildScaffoldPlan` (called from BuildWorkbench) surfaces unresolved candidates as an actionable blocker ("정보 필요 후보 N개를 모듈 검토에서 Resolution Draft를 반영하고 승인하세요.") and appends "정보 필요 후보 N개 — 모듈 검토에서 Resolution Draft 반영 필요" to warnings.

BuildWorkbench refuses to spawn `scripts/generate-adk-source.mjs` while these blockers remain — the operator must update the analysis artifact, typically by applying a reviewed Design Stage Runner proposal, before retrying.

### Artifact root persistence

There is no in-browser save record any more. The artifact root directory `artifacts/af/<req-id>/` is the single store: `af-run-manifest.json` (stage status + approval gates + last validation result), `analysis-result.json` plus its split conveniences, `commonization-notes.json`, `boundary-design.md`, `a2a-contracts.json`, `scaffold-plan.json`, `runtime-stub/`, `implementation-handoff.md`, `validation-report.md`, `catalog-delta.yaml`, and `collaboration/{comments,highlights}.json`. The workbench reads and writes those paths through `/api/af/*` and `/api/af-collab/*`; `localStorage` only caches the recent-artifact-root list and the comment-composer author identity. The `artifacts/` tree is local-only and ignored by Git, including generated runtime bundles and per-run `catalog-delta.yaml` proposals.

Saved-analysis fixtures under `templates/saved-analysis-fixtures/` are now only consumed by `scripts/validate-artifacts.mjs` regression smoke. They should still mirror the canonical `analysis-result.json` shape.

### Graph IR regeneration from module review

When the module review surface (currently the DesignWorkbench module tab plus any upstream `af-design-boundaries` run) regenerates Graph IR, it preserves reviewed edge metadata from the previous Graph IR whenever edge endpoints can be mapped back to active module candidates. If the previous graph contains only partial edges, regeneration must not leave active module candidates isolated. The workbench adds fallback `event_output` edges in module review order for candidates that lack incoming or outgoing connections, while `rejected` candidates remain excluded.

Graph IR validation treats any module-bound node without at least one incoming edge and one outgoing edge as an error. A graph that merely renders disconnected nodes is not scaffold-ready.

### Catalog contract registry

Catalog entries remain runtime contracts. Canonical seed catalog files under `catalog/` stay versioned because the workbench and Mock Lab read them as source inputs. Generated catalog proposals must stay under ignored artifact roots such as `artifacts/af/<req-id>/catalog-delta.yaml`. `catalog/*.yaml` is never edited directly; the approval-gated `POST /api/catalog/publish` path in Reuse Hub `등록 승인` is the only app write path, publishing versioned entries from active-root `catalog-delta.yaml` proposals. Publish reads and dumps the target YAML canonically with `js-yaml`: semantics are preserved, but formatting may change and must be reviewed via git diff in the human PR that eventually merges catalog changes. Human PR merge remains valid for bulk or seed changes. For local smoke, a seed contract may include deterministic synthetic `runtime_mock` output that is carried into generated ADK source as a test double. Rich MCP/A2A contract bodies are still driven by registry files under `catalog/contracts/`.

Workflow catalog entries may have an opt-in A2A-capable version without changing their `module_category`: the published row remains `workflow` and carries `component_source: remote_a2a`, `runtime_binding: remote_a2a`, `a2a_provider_req_id: <provider-root>`, and an A2A-ready `contract_status`. `a2a_provider_req_id` is the provider artifact root pointer; `published_from` remains provenance and must not be overloaded as a provider id. Publish must reject a converted workflow when the provider root is missing or its runtime-a2a Agent Card file is not already present and valid; this validation is read-only and must not create or refresh provider `runtime-stub/**/agent.json` files. This conversion never writes a workflow facade into `catalog/remote-a2a-contracts.yaml`; that registry remains for independent Remote A2A contracts.

- MCP registry files define the `mcp_schema_ref` contract body: `inputSchema`, `outputSchema`, success/error examples, and a deterministic `mock_response.structuredContent`.
- A2A registry files define Agent Card, supported interfaces, message/task/artifact contract, auth, timeout, retry, fallback, audit, data policy, and synthetic task examples.

The registry must use synthetic data only. Do not add private banking endpoints, credentials, deployment scripts, or real customer data.

### Runtime stub smoke bridge

The pre-PR6 Runtime Handoff screen used to ship a `Smoke 일괄 실행` macro (`generate → install → start-web → check-web → chat-smoke`) plus an in-iframe `adk web` embedding. Do not reintroduce that macro or iframe surface. PR6 split the flow into BuildWorkbench (`/af/:reqId/build`) and VerifyWorkbench (`/af/:reqId/verify`), and VerifyWorkbench still only runs the fixed `validate-artifacts.mjs` / `npm run build` / `npm run test:analyzer` allow-list.

The ADK runtime connection bridge now lives on the gate-less `실행` screen (`/af/:reqId/run`, `RunSandbox`), not BuildWorkbench. After `runtime-stub/` exists it uses one shared ADK venv (`.agent-factory/runtime/.venv`, overrideable with `AF_ADK_VENV_DIR`) instead of artifact-local `.venv` folders, starts local `adk api_server --with_ui` on the runtime-smoke port (8765), records the launched PID plus started runtime-stub fingerprint under the stub's local `.adk/` runtime registry so a Workbench restart can re-adopt/stop the same process, and **links to ADK's own official dev UI (`web_url`) — it does not re-implement chat.** The same RunSandbox screen can expose a generated runtime-stub as a local ADK A2A provider on port 8001: generated bundles include `agent.json` plus `af_adk_a2a_server.py`, and the Workbench starts that launcher with the shared Python venv, ADK's FastAPI/Web runner, and ADK's A2A executor. The launcher only applies an in-memory compatibility patch for ADK CLI versions whose `api_server --a2a` path fails before registering `agent.json`; it does not patch site-packages on disk. A provider start is successful only when the Agent Card URL returns a valid card, not merely when the process listens on the port, but Agent Card health is still separate from semantic `message/send` readiness. Passive status polling checks process, Agent Card, stale fingerprint, and Mock Lab prerequisites only; it must not send JSON-RPC `message/send` or create A2A tasks. Local prerequisites such as `wf-page-recommendation-mock` must be visible as prerequisite/blocked status and start actions when missing; they must not be hidden behind `server.status: running`. A2A `input-required` is an interactive task state, not a final answer. When the event includes task id, context id, interrupt id, and function name, Workbench resume may send a JSON-RPC `message/send` DataPart with `metadata.adk_type = "function_response"` and `{ id, name, response: { result } }` through `POST /api/af/:reqId/runtime-a2a/resume`; plain ADK Web text chat is still not a verified remote HITL resume bridge. The task/context/interrupt ids are runtime-state only: they may live in runtime event payloads, local runtime registries, and API transcripts, but must not be persisted into catalog rows, `analysis-result.json`, Graph IR, scaffold-plan, or generated source. If the current runtime-stub fingerprint changes while a chat or A2A process is running, RunSandbox shows a stale warning and an explicit restart button; it must not auto-restart the ADK process. The web UI does not install Python dependencies; prepare the shared venv manually with `requirements/adk-runtime.txt`. Because `--with_ui` already serves ADK's polished chat/session/event/trace UI, the previous AF home-grown chat (client session/message hooks + transcript surface) was removed; the screen surfaces start/stop + status and an "ADK 웹 UI 열기" link (a new browser tab, never an iframe embed). The generated app runs over synthetic inputs only: in smoke mode it surfaces reviewed `runtime_mock` test doubles and TODO metadata; in `runnable` mode it executes a real ADK `Workflow` whose `LlmAgent` nodes select vLLM/OpenAI-compatible or Gemini from `.agent-factory/runtime.env`, plus synthetic Mock Lab MCP adapters. In both modes it must not include private endpoints, credentials, deployment scripts, or real customer data.

## Workbench surface

The workbench is a router-driven, artifact-root-first React app (`packages/web/src/routes/router.tsx`) — skill-scoped routes: `/` Landing, `/af/:reqId/analyze`, `/af/:reqId/design`, `/af/:reqId/build`, `/af/:reqId/verify`, the gate-less tool route `/af/:reqId/run` (ADK runtime), `/catalog` Reuse Hub, and `/mock-lab` Adapter runtime lab. The four skill stages render through the shared `StageShell` (left step rail 실행·검토·승인, always-visible summary strip, "다음에 할 일" guide, next-action CTA); the active step is a shallow `?step=` query param and never recomputes the gates. `실행` and `Mock Lab` are auxiliary nav entries only — they are **not** in `afRunStageIds` (which defines the manifest stage schema and the four gate chips). State sits on `@tanstack/react-query`; `manifest.approvals.*` from `af-run-manifest.json` is the single source of truth for gate UI. All reads/writes go through Vite middleware (`/api/af/*`, `/api/af-collab/*`, `/api/catalog`, `/api/mock-lab/*`) against local `artifacts/` on the file system. Analyze and Design now start from Stage Runner panels that call `/api/af/:reqId/stages/:stage/run`; the server runs Codex through the `@openai/codex-sdk` TypeScript SDK with workspace-write sandboxing, approval policy `never`, and network access disabled. Run outputs are proposed artifacts first and canonical files change only after explicit diff/preview apply. Browser import of an `analysis-result.json` produced by `af-analyze-requirement` or an equivalent producer remains valid.

Active stages:
- Landing creates `artifacts/af/<req-id>/` plus an empty `af-run-manifest.json`, or imports `analysis-result.json`.
- `/af/:reqId/analyze` accepts raw requirement text and seed catalog payload for the `af-analyze-requirement` Stage Runner, supports `analysis-result.json` import, renders the applied analysis through the existing `AnalysisResult` component, and toggles `analysis_reviewed`.
- `/af/:reqId/design` runs `af-design-boundaries` only when `analysis_reviewed === true`, then mounts the Design workbench with module review, Graph IR, Runtime contract review, and comments. The review step is currently 2-pane (left selection/editor panel + a wide graph canvas) with a bottom tab strip; the `모듈` tab resolves candidate missing-information items, approves/defers/rejects candidates, and mirrors status to matching Graph IR node `review_status`. Catalog workflow insertion is available from the graph canvas toolbar: selecting a normal catalog workflow appends one reusable `workflow_call` node plus one workflow module candidate and saves immediately to `analysis-result.json`; it is not a fragment expansion of the catalog workflow internals. A workflow catalog entry with `component_source: remote_a2a` or `runtime_binding: remote_a2a` is the explicit exception: Design reads `a2a_provider_req_id`, fetches the provider Agent Card, and reuses the local A2A provider import path to insert a consumer `remote_a2a` facade candidate, draft A2A contract, and `remote_agent_call` Graph IR node. If the provider id is missing or the Agent Card fetch fails, the UI shows the error and leaves `analysis-result.json` unchanged. The right Inspector pane's contract editors are parked via `INSPECTOR_ENABLED=false` to give the graph full width — the bottom tabs still list/select, write comments, and toggle gates. Remote A2A contract editing is active in the bottom `Remote A2A` tab, including placeholder contract creation for a selected remote candidate with no matching contract. The same tab can import a local provider artifact that already has `stub_ready_for_followup`: it reads the provider Agent Card through `/runtime-a2a/agent-card`, adds a draft `remote_a2a` candidate, draft A2A contract, and `remote_agent_call` Graph IR node, and only rewires a trivial single `input -> output` placeholder graph into `input -> remote -> output`. Import never approves the candidate or contract. The bottom `검토 메모` tab uses the current Graph IR selection as the node/edge comment anchor, so reviewers can select a graph item and create/update/delete comments without restoring the parked 3-pane Inspector. The Graph canvas exposes an explicit edit mode for reviewed Graph IR shape edits: node/edge add, selected delete, handle or sequential-click edge creation, dragged node positions persisted as optional `node.position`, and selected node/edge field editing in the left panel. The add menu is workflow-first (`agent`, `adapter_call`, `router`, `human_input`, `join`, `loop_control`, `workflow_call`, `remote_agent_call`, `callback_wait`) and the Inspector/Editor separates 책임 분류, 계약, 실행 설정, 정책·리스크, Mock Lab, ADK Skeleton sections. New local nodes default into the root `graph_workflow`/`dynamic_workflow` container and update its `contains_node_ids`; remote agent call nodes stay outside that local root by default. Saving edit mode updates only `analysis-result.json.processFlow`; it must not auto-toggle `manifest.approvals.*`, and the next operator action is Build의 `계약 동기화 + runtime-stub 재생성` flow so derived split artifacts, `scaffold-plan.json`, and `runtime-stub/` catch up to the canonical Graph IR. Graph IR soft validation includes `node_missing_module_id` for module-bound `agent`/`workflow`/`workflow_call`/`adapter`/`adapter_call`/`remote_a2a`/`remote_agent_call` nodes without `module_id`, validates `invoke_binding`/`decision_owner`/`call_control`/`flow_kind`, and checks `callback_wait` review metadata. `remote_link_incoherent` warnings remain for remote edges that lack a usable remote endpoint module link. The `boundaries_approved` gate enables only when every module candidate is `status === "approved"` and Graph IR validation errors are zero; the review next-action hint enumerates only the unmet conditions such as 미승인 모듈, Graph IR errors, or Runtime/A2A readiness issues. `runtime_contracts_approved` is reviewer-driven from the Runtime contract readiness UI and still stored only in `manifest.approvals.*`.
  When a reviewer deletes a catalog-inserted reusable workflow node from Graph edit mode, the save path also prunes the matching inserted workflow candidate if no Graph IR node or `root_workflow_module_id` still references it. This cleanup is limited to `reuse_candidate` workflow candidates whose `catalog_entry_id` starts with `workflow:`; analyzer-produced/root workflow candidates are preserved. In the bottom `모듈` tab, the candidate list owns the independent scrollbar while the selected module detail stays visible and only scrolls inside its own pane when its content overflows.
- `/af/:reqId/build` mounts a BuildWorkbench whose primary run action is `계약 동기화 + runtime-stub 재생성`. It calls `POST /api/af/:reqId/artifact-sync/run`, which syncs split artifacts from canonical `analysis-result.json`, derives and writes `scaffold-plan.json`, optionally regenerates `runtime-stub/`, optionally runs `validate-artifacts.mjs`, and reports drift/written artifacts/generation/validation results. The `smoke`/`runnable` output mode still controls scaffold output; in runnable mode the reviewer explicitly binds adapter modules to running Mock Lab MCP tools when adapter targets exist, otherwise the Mock Lab binding panel stays hidden with a target-none message. Existing manual scaffold/runtime controls may remain as advanced paths, and the Build Stage Runner panel may wrap `runtime-stub/build` to record run history, but the server-owned compound endpoint is the documented order. Generated files are listed and previewed (text only, < 500KB). `implementation-handoff.md` is edited inline. The `stub_ready_for_followup` toggle is reviewer-driven and gated on the stub directory being non-empty; sync, generation, and validation do not auto-toggle it. ADK runtime connection + the dev-UI link live on the separate gate-less `실행` screen (see "Runtime stub smoke bridge"), not on BuildWorkbench.
- `/af/:reqId/run` mounts `RunSandbox`, a gate-less tool screen. After `runtime-stub/` exists it uses the shared ADK venv (`.agent-factory/runtime/.venv`, or `AF_ADK_VENV_DIR`) to start/stop `adk api_server --with_ui` (8765) for ADK Web chat/trace. The A2A provider panel resolves an approved Remote A2A local-provider owner (`owner: local artifact:<reqId>`) before falling back to the current artifact, so a consumer run screen controls the provider artifact it actually calls instead of reporting the consumer artifact's own A2A status. It starts/stops `python af_adk_a2a_server.py ... --with_ui` (8001) for that local ADK A2A provider. It re-adopts recorded PIDs when the Workbench process restarts, polls passive status, compares started/current runtime-stub fingerprints for stale warnings, links to ADK's official dev UI (`web_url`) in a new tab, and exposes the Agent Card/RPC URLs only after the card health check succeeds. Provider status must keep Agent Card health, the cached result of explicit semantic `message/send` readiness checks, Mock Lab prerequisite status, and `input-required` interactive state distinct. Passive status must not create A2A tasks. When input-required metadata is complete, the panel shows `Workbench resume` and posts function_response DataPart resume payloads to the provider RPC endpoint; unsupported states keep the warning and render no submit control. Runtime task ids remain runtime-only and are never written into design/catalog/scaffold artifacts. No web-side Python install, no approval gate, no AF home-grown chat.
- `/af/:reqId/verify` mounts a VerifyWorkbench that runs a hard-coded allow-list of three commands (`validate-artifacts.mjs <root>`, `npm run build --prefix packages/web`, `npm run test:analyzer --prefix packages/web`) via child_process, captures stdout/stderr, and writes `manifest.validation.{commands,last_result}`. The Verify Stage Runner wraps the same allow-list primitive and proposes `validation-report.md` plus an empty `catalog-delta.yaml` template; catalog changes are not inferred automatically. `validation-report.md` and `catalog-delta.yaml` are edited inline; **catalog/*.yaml is never edited directly** — the approval-gated `POST /api/catalog/publish` path in Reuse Hub `등록 승인` is the only app write path from reviewed delta proposals.
- `/catalog` mounts a Reuse Hub that surfaces the catalog YAML index (`GET /api/catalog`) as searchable category-tabbed cards. Two write paths exist, both targeting the active artifact root (selected via dropdown or `?req=` query param):
  * "현재 root 에 핀" opens a dialog listing the root's module candidates filtered to the same `module_category` as the catalog entry; on save the workbench PUTs `analysis-result.json` with `catalog_entry_id`, `reuse_candidate=true`, the catalog name, and (when the candidate has empty I/O) the catalog's inputs/outputs.
  * "신규 등록 제안" opens a drawer that appends a `proposed_additions[]` entry to the root's `catalog-delta.yaml`.
  * Workflow cards expose `A2A 가능하게 변경` as an opt-in conversion action. It requires an eligible provider artifact root with `stub_ready_for_followup`, reads that root's runtime-a2a Agent Card, and appends a workflow proposal carrying `component_source: remote_a2a`, `runtime_binding: remote_a2a`, `a2a_provider_req_id`, and contract readiness metadata. It does not mutate the current catalog row or the active analysis artifact.
  * "등록 승인" opens a drawer that parses the active root's `catalog-delta.yaml`; reviewers approve entries one at a time, and `POST /api/catalog/publish` verifies the matching proposal before appending a versioned entry to the matching `catalog/*.yaml` file while marking prior same-name entries deprecated. The target YAML is re-serialized canonically, so formatting may change while semantics are preserved. The delta file is not rewritten in v1.
  * Adapter cards link to `/mock-lab?adapter=<catalog-name>&req=<reqId>` so runtime mock work starts from the selected catalog contract without moving Reuse Hub's catalog-governance responsibility into Mock Lab.
- `/mock-lab` mounts the Mock Lab UI inside the same Workbench shell. It owns Adapter MCP `MockSpec` editing, optional Codex prompt-to-spec drafts, saved-spec server start/stop/status, smoke helpers, audit log, and network MCP discovery under `/api/mock-lab/*`. Codex is not a required server-run path: `Run saved spec` starts the package-owned generic stdio runtime from `artifacts/mock-lab/<mock-id>/mock-spec.json`. The standalone `packages/mock-lab` 5176 app remains available for package-local development only.

Stage status mirroring: when `PATCH /api/af/:id/manifest/approvals` flips an approval, the server also marks the matching `stages.<stage>.status = "complete"` (analyze ↔ `analysis_reviewed`, design ↔ `boundaries_approved && runtime_contracts_approved`, build ↔ `stub_ready_for_followup`). `scripts/generate-adk-source.mjs` reads `stages.design.status === "complete"` as a hard precondition, so the design gate must be flipped before runtime-stub generation will succeed.

Collaboration layer (`/api/af-collab/:reqId/{comments,highlights}`) writes `artifacts/af/<req-id>/collaboration/{comments,highlights}.json`. Comments are entry-anchored (`node` / `edge` / `container` / `path` / `section`), keyed by `created_at` order on disk, with `merge=union` configured in `.gitattributes` to keep PR diffs clean. Author identity is held in `localStorage(agent-factory:author-name|role)` only — there is no auth, and comments must never carry secrets, real customer data, or private endpoints. Highlights follow the same shape (`path` / `node_group` / `edge_group` / `container_focus`) but the canvas-overlay rendering is deferred to a follow-up; the current shell ships only persistence and CRUD.

When adding a stage workbench, do not bypass approval gates derived from the manifest, do not invent new artifact files outside the write whitelist in `packages/web/server/artifactRootStore.ts`, and do not persist stage state to `localStorage` — `localStorage` is reserved for the recent-artifact-roots cache and the author-identity preferences only.

## Required artifact posture

For Agent Factory work, produce or preserve reviewable artifacts rather than only code.

Expected artifact families:

- normalized requirements
- evidence and assumptions
- missing-information records
- module candidates with category and subtype
- process flow nodes and edges
- runtime contracts for MCP/EAI/Legacy adapters, Context Manager, Callback Broker, ADK callback, and async resume when applicable
- catalog reuse decisions and registration changes
- documentation impact decisions
- risk gates
- catalog change decisions
- scaffold-plan fixture and runtime handoff validation when schema work touches them
- validation output
- decision notes when taxonomy or boundary choices change

Stage Runner pipeline note: Analyze/Design/Build/Verify runs write `runs/<stage>/<run-id>/request.json`, `events.jsonl`, `result-summary.json`, `diff-summary.json`, proposed artifacts, and failure diagnostics. Build/Verify use the same run ledger but wrap server-side primitives instead of DLC skill execution: Build records `runtime-stub/` outputs, Verify records proposed `validation-report.md` and `catalog-delta.yaml`. `af-run-manifest.json.stage_runs` is optional execution metadata and never replaces `manifest.approvals.*`. Proposed `analysis-result.json` files are validated with `validateAnalysisResult`; apply is blocked on validation failure or canonical ETag conflict. The legacy `/api/analyze-requirement` compact-draft analyzer remains available as an internal/direct primitive, but reviewable Stage Runner output is the default workbench path.

## Local/offline-friendly assistant behavior

Assume restricted-internet or enterprise environments may exist downstream.

Good assistant tasks:

- normalize intake text
- extract capabilities
- classify module candidates
- draft adapter, agent, workflow, and Remote A2A specs
- maintain scaffold-plan validation fixtures and runtime handoff checks when schema work touches them
- generate validation cases
- update catalogs and documentation
- produce review checklists
- produce `artifacts/af/<req-id>/` skill artifacts and `af-run-manifest.json`
- propose `catalog-delta.yaml` feedback without directly editing runtime catalogs, then use the approval-gated Reuse Hub `등록 승인` publish path for reviewed app writes

Human-governed decisions:

- final architecture classification
- high-risk automation approval
- Remote A2A dependency approval
- customer-impacting or money-impacting behavior
- compliance-sensitive decision rules
- private deployment/runtime integration

## Repository source-of-truth boundaries

Active source-of-truth areas:

- `.agents/skills`: AF DLC operating skills and shared stage references
- `packages/web`: live workbench UI, artifact visualization, guided edits, and analyzer flow
- `schemas`: artifact contracts
- `catalog`: reusable capability, domain-owner, and risk-gate catalogs
- `templates`: reviewed artifact templates and scaffold-plan fixtures
- `docs/workbench`: active operating guidance
- `docs/visualization`: visual design and graph/display guidance

Archive material under `docs/archive` is historical. Do not revive old taxonomy or scaffold assumptions from archive notes unless the task explicitly asks for migration analysis.

For live analyzer work, keep `schemas/analysis-draft.schema.json` aligned with the server hydration logic and keep `schemas/analysis-result.schema.json` as the final artifact contract.

## Verification expectations

After TypeScript, React, analyzer, schema, or validator changes, run the relevant verification.

Minimum build check for web changes:

```bash
cd packages/web
npm run build
```

Artifact validation from repo root:

```bash
node scripts/validate-artifacts.mjs
node scripts/validate-artifacts.mjs path/to/artifacts
```

UI changes require visual verification. Use the example requirement flow because it exercises all major categories and markers.

## Done means for Agent Factory work

Work is done only if:

- raw requirements are not used as scaffold inputs
- module classification follows the active taxonomy
- subtype fields are present where required
- Remote A2A remains high-friction and contract-backed
- schemas, validator, analyzer types, and UI labels remain aligned when any enum changes
- review artifacts and deferred fixtures pass validation where applicable
- changed UI behavior is visually checked when applicable
- no private banking data, credentials, endpoints, deployment scripts, or organization-specific runtime code were added
