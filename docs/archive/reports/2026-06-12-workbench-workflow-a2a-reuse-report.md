# Workbench Workflow/A2A Reuse Report

Date: 2026-06-12
Scope: read-only architecture analysis of the current Workbench code, schemas, catalog, ADK runtime handoff path, and latest ADK documentation fetched through `adk-docs-mcp`.

> Status note (2026-06-28): this report is a historical evidence snapshot, not
> current behavior spec. Since it was written, Reuse Hub gained an
> approval-gated `POST /api/catalog/publish` path, Design gained active bottom
> tab Remote A2A contract editing and catalog workflow insertion, and runnable
> Runtime Handoff gained reviewed `RemoteA2aAgent` lowering when an approved A2A
> contract supplies an Agent Card URL. Use active specs in
> `docs/workbench/agent-factory-harness.md`, `docs/workbench/validation.md`,
> `docs/workbench/taxonomy.md`, and `docs/workbench/process-flow.md` for current
> implementation work. The analysis below remains useful for historical context
> and for understanding why Workflow reuse is separate from Remote A2A.

## Executive Summary

현재 Workbench에서 새로 만든 Workflow를 다른 Workbench session에서 재사용하는 일은 first-class 기능이 아니다. 가능한 경로는 전체 `analysis-result.json` import, Reuse Hub의 active-root pin, active root의 `catalog-delta.yaml` 등록 제안뿐이다. 전역 catalog에 승인/버전 관리된 reusable workflow를 publish하고 다른 root에서 graph로 import하거나 runtime으로 consume하는 흐름은 아직 없다.

A2A는 "다른 session에서 재사용"의 기본 해법이 아니라 독립 배포/소유/네트워크 경계를 가진 remote agent/service와 통신할 때 쓰는 계약이어야 한다. 최신 ADK 문서도 A2A를 experimental로 표시하고, local sub-agent는 같은 process 내부 모듈, remote A2A agent는 별도 service/network 계약으로 구분한다. Workbench에서 A2A 계약을 설정해야 할 1차 위치는 Design stage의 `analysis-result.json.a2aContracts`와 Graph IR의 `remote_a2a` edge linkage이며, 전역 catalog/registry 승격은 승인된 계약 이후 단계가 맞다.

Agent로 등록하는 것은 가능하지만 taxonomy 기준상 multi-step orchestration/topology가 핵심이면 Agent가 아니라 Workflow다. Agent는 판단, 요약, 분류, 추천, triage 같은 reasoning responsibility의 소유자이고, Workflow는 Agent/Adapter/Workflow를 언제 어떤 graph 경로로 실행할지 조율하는 경계다. 공통 Workflow가 remote로 호출될 수는 있지만 이 경우에도 `module_category: workflow`와 `runtime_binding: remote_a2a` 조합으로 표현해야 하며, 독립 remote agent 자체가 확인되지 않으면 `module_category: remote_a2a`로 승격하지 않는다.

## Current State

### Cross-session reuse

- Landing import는 파일 전체를 `analysis-result.json`으로 파싱하고 `normalizedRequirement.id` 기준 artifact root를 만든 뒤 저장한다. 부분 workflow/processFlow import가 아니라 full analysis artifact import다. Evidence: `packages/web/src/routes/LandingPage.tsx:38`, `packages/web/src/routes/LandingPage.tsx:46`, `packages/web/src/routes/LandingPage.tsx:56`.
- Analyze import도 현재 root의 `analysis-result.json`을 full replace한다. Evidence: `packages/web/src/routes/AnalyzeWorkbench.tsx:96`, `packages/web/src/routes/AnalyzeWorkbench.tsx:105`, `packages/web/src/routes/AnalyzeWorkbench.tsx:106`.
- import parser는 `normalizedRequirement`, `evidence`, `moduleCandidates`, `processFlow`가 모두 있는 AnalysisResult shape만 받는다. Graph IR나 Workflow만 가져오는 parser가 아니다. Evidence: `packages/web/src/analyzer/analysisArtifactImport.ts:17`, `packages/web/src/analyzer/analysisArtifactImport.ts:22`, `packages/web/src/analyzer/analysisArtifactImport.ts:55`.
- Design canvas는 current root의 `analysis.processFlow`에서 Graph IR을 derive한다. 다른 catalog workflow를 선택해 graph에 import/expand하는 path는 없다. Evidence: `packages/web/src/state/useGraphIR.ts:11`, `packages/web/src/state/useGraphIR.ts:18`, `packages/web/src/routes/DesignWorkbench.tsx:499`.

### Reuse Hub and catalog registration

- Reuse Hub는 Agent/Workflow/Adapter/Remote A2A tab을 제공하고, 등록 컴포넌트를 active root에 pin하거나 등록 제안을 남기는 UI다. Evidence: `packages/web/src/routes/ReuseHubPage.tsx:12`, `packages/web/src/routes/ReuseHubPage.tsx:77`, `packages/web/src/routes/ReuseHubPage.tsx:100`.
- Pin은 current root의 `analysis-result.json` 안에서 matching category의 module candidate에 `catalog_entry_id`, `name`, `reuse_candidate`, optional I/O를 채우는 root-local mutation이다. Evidence: `packages/web/src/catalog-hub/PinTargetDialog.tsx:42`, `packages/web/src/catalog-hub/PinTargetDialog.tsx:49`, `packages/web/src/catalog-hub/PinTargetDialog.tsx:55`.
- 등록 제안은 active root의 `catalog-delta.yaml`에만 append된다. UI도 `catalog/*.yaml`은 직접 편집하지 않고 별도 PR로 merge한다고 안내한다. Evidence: `packages/web/src/catalog-hub/RegisterProposalDrawer.tsx:49`, `packages/web/src/catalog-hub/RegisterProposalDrawer.tsx:73`, `packages/web/src/catalog-hub/RegisterProposalDrawer.tsx:103`.
- catalog API는 `GET`만 지원하고 seed `catalog/*.yaml`과 `catalog/contracts`를 read한다. Workbench UI에서 전역 catalog publish를 수행하는 API가 아니다. Evidence: `packages/web/server/afCatalogApi.ts:19`, `packages/web/server/afCatalogApi.ts:28`, `packages/web/server/afCatalogApi.ts:45`.

### A2A review surface

- Design에는 `Remote A2A` tab이 있고, remote candidates와 matching contract/readiness issue를 표로 보여준다. Evidence: `packages/web/src/routes/DesignWorkbench.tsx:55`, `packages/web/src/routes/DesignWorkbench.tsx:649`, `packages/web/src/design/A2AContractPanel.tsx:29`.
- A2A contract editor/save handler는 존재하지만 우측 inspector가 `INSPECTOR_ENABLED = false`로 비활성화되어 현재 화면에 렌더링되지 않는다. Evidence: `packages/web/src/routes/DesignWorkbench.tsx:68`, `packages/web/src/routes/DesignWorkbench.tsx:80`, `packages/web/src/routes/DesignWorkbench.tsx:522`, `packages/web/src/routes/DesignWorkbench.tsx:535`.
- Graph edit UI는 `remote_a2a` edge에 기존 `a2a_contract_id`를 선택해 연결할 수 있지만, edge editor 자체가 contract를 생성하지는 않는다. Evidence: `packages/web/src/components/GraphElementEditor.tsx:287`, `packages/web/src/components/GraphElementEditor.tsx:290`, `packages/web/src/components/GraphElementEditor.tsx:297`.

## Taxonomy Answer

이 프로젝트의 taxonomy는 ADK component 이름과 실행 binding을 섞지 않도록 설계되어 있다.

- 허용 `module_category`는 `agent`, `workflow`, `adapter`, `remote_a2a`뿐이다. Evidence: `docs/workbench/taxonomy.md:20`, `packages/web/src/analyzer/types.ts:1`.
- `module_category`는 책임의 종류이고 `runtime_binding`은 실행/연결 방식이다. 따라서 같은 Workflow도 remote로 호출될 수 있다. Evidence: `docs/workbench/taxonomy.md:36`, `docs/workbench/taxonomy.md:42`, `packages/web/src/catalog/types.ts:15`.
- Agent는 reasoning boundary다. 판단/요약/분류/추천/triage 같은 책임이 핵심이면 `module_category: agent`로 등록할 수 있다. Evidence: `docs/workbench/taxonomy.md:57`, `docs/workbench/taxonomy.md:64`.
- Workflow는 큰 의미의 Workflow Agent boundary이며, sequence/parallel/loop/human-review 같은 세부 흐름은 `workflow_kind`가 아니라 Graph IR node/container/edge semantics로 표현한다. Evidence: `docs/workbench/taxonomy.md:66`, `docs/workbench/taxonomy.md:75`, `docs/workbench/taxonomy.md:77`.
- Remote A2A는 workflow pattern이 아니다. 독립 remote agent 계약이 확인될 때만 사용한다. Evidence: `docs/workbench/workflow-decision-guide.md:8`, `docs/workbench/workflow-decision-guide.md:12`, `docs/workbench/taxonomy.md:108`.

판단 규칙은 다음처럼 두면 된다.

| 등록하려는 단위 | category | 이유 |
|---|---|---|
| 하나의 판단자/분류기/추천자 | `agent` | 단일 reasoning responsibility가 핵심 |
| 여러 Agent/Adapter/Workflow의 실행 순서/route/loop/human gate | `workflow` | graph topology나 orchestration이 핵심 |
| callable tool, retrieval, rule registry, data query | `adapter` | Agent/Workflow가 호출하는 capability |
| 독립 배포된 remote agent/service와 A2A protocol로 통신 | `remote_a2a` 또는 `workflow + runtime_binding: remote_a2a` | 독립 remote boundary와 agent card/contract가 핵심 |

## ADK Alignment

Fetched ADK docs:

- `https://adk.dev/a2a/index.md`
- `https://adk.dev/a2a/intro/index.md`
- `https://adk.dev/a2a/quickstart-exposing/index.md`
- `https://adk.dev/a2a/quickstart-consuming/index.md`
- `https://adk.dev/workflows/index.md`
- `https://adk.dev/graphs/index.md`
- `https://adk.dev/agents/index.md`
- `https://adk.dev/tools-custom/mcp-tools/index.md`
- `https://adk.dev/integrations/agent-registry/index.md`

External evidence note: these pages were fetched live on 2026-06-12 through `adk-docs-mcp`. ADK support status and API details are time-sensitive, so implementation work should refetch these same official pages before changing runtime code.

ADK의 A2A docs는 Python/Go/Java support와 함께 experimental로 표시된다. Intro는 local sub-agents를 same process 내부 모듈로, Remote Agents(A2A)를 network로 통신하는 independent service로 구분한다. Exposing docs는 `to_a2a(root_agent)` 또는 `adk api_server --a2a` + agent card 방식을 설명하고, Consuming docs는 `RemoteA2aAgent(name, description, agent_card=..., use_legacy=False)`를 root agent의 sub-agent로 붙이는 방식을 설명한다.

ADK Workflows/Graphs docs는 workflow를 multi-agent, multi-node application으로 설명하고, graph-based workflow가 Agent, Tool, function, nested Workflow를 node/edge로 조합할 수 있다고 설명한다. 이것은 "이미 만든 Workflow를 graph에 import해서 nested workflow node로 쓰는 기능"이 ADK 개념상 가능하다는 뜻이다. 그러나 현재 Workbench UI에는 catalog workflow를 Graph IR에 import/expand하는 path가 없고, runtime generator도 catalog workflow를 실제 nested ADK `Workflow`로 import하지 않는다.

ADK MCP docs는 MCP를 tool/resource/prompt server-client protocol로 설명하고, ADK에서는 `McpToolset`이 tools list에 들어가 MCP server의 tool discovery/call을 proxy한다고 설명한다. 따라서 MCP는 reusable adapter/tool 연결에는 맞지만, 독립 remote agent protocol인 A2A를 대체하지 않는다.

ADK Agent Registry docs는 Google Cloud registry에서 remote A2A agents와 MCP servers를 discover하고 `get_remote_a2a_agent`/`get_mcp_toolset`으로 조합하는 preview 기능을 설명한다. 이 프로젝트가 "다른 session"을 넘어 organization-wide governed reuse를 목표로 한다면 자체 catalog publish flow와 함께 Agent Registry adapter를 검토할 수 있지만, 현재 repo에는 해당 integration이 없다.

## Runtime Handoff Limits

현재 Build/Runtime Handoff는 승인된 artifact에서 scaffold plan을 만들고, runnable mode에서는 local ADK `Workflow`와 Gemini `LlmAgent`, Mock Lab MCP-connected adapter를 생성하는 경로에 집중한다.

- scaffold plan은 approved module만 포함한다. Evidence: `packages/web/src/analyzer/scaffoldPlan.ts:30`, `packages/web/src/analyzer/scaffoldPlan.ts:39`.
- runnable mode wiring은 Agent instruction/model과 Adapter MCP fields를 채운다. `runtime_binding` field는 존재하지만 Remote A2A invocation wiring은 없다. Evidence: `packages/web/src/analyzer/scaffoldPlan.ts:115`, `packages/web/src/analyzer/scaffoldPlan.ts:145`, `packages/web/src/analyzer/scaffoldPlan.ts:152`.
- generator의 hard invariant는 approved workbench artifact 기반 생성이며 raw requirement to code를 금지한다. Evidence: `scripts/generate-adk-source.mjs:22`, `scripts/generate-adk-source.mjs:24`.
- runnable generator는 Agent module을 agent node로, MCP-connected adapter를 function node로, 그 외 module을 stub function으로 만든다. Evidence: `scripts/generate-adk-source.mjs:227`, `scripts/generate-adk-source.mjs:236`, `scripts/generate-adk-source.mjs:238`, `scripts/generate-adk-source.mjs:242`.
- runnable support guard는 `remote_a2a` edge, `remote_a2a` node, `remote_boundary` container, boundary crossing을 명시적으로 reject한다. Evidence: `scripts/generate-adk-source.mjs:1283`, `scripts/generate-adk-source.mjs:1290`, `scripts/generate-adk-source.mjs:1310`, `scripts/generate-adk-source.mjs:1340`, `scripts/generate-adk-source.mjs:1357`.
- generator의 connection detection은 adapter + MCP만 executable connection으로 본다. Evidence: `scripts/generate-adk-source.mjs:1442`.

따라서 현재 상태에서 A2A로 다른 session의 workflow를 runtime 호출하는 것은 불가능하다. A2A 계약은 review artifact로는 표현되지만, `RemoteA2aAgent` 생성, agent-card fetch, auth/interceptor, task lifecycle handling, fallback/timeout/retry runtime codegen은 없다.

## Contract Weaknesses

1. A2A contract surface가 여러 곳으로 분산되어 있다.

- Candidate에는 `a2a_contract_id`와 remote summary fields가 있고, 별도 `A2AContract` 객체가 있으며, Graph IR edge에도 `a2a_contract_id`와 `is_remote_boundary_crossing`이 있다. Evidence: `schemas/module-candidate.schema.json:225`, `packages/web/src/analyzer/types.ts:401`, `packages/web/src/analyzer/types.ts:702`.
- Validator는 remote candidate와 contract의 1:1 pairing을 확인하고 Graph IR edge가 existing contract id를 참조하는지도 확인한다. Evidence: `scripts/validate-artifacts.mjs:1534`, `scripts/validate-artifacts.mjs:1549`, `scripts/validate-artifacts.mjs:840`.
- 그러나 remote edge의 endpoint node/module이 그 contract의 `remote_module_id`와 실제로 일치하는지는 edge validation에서 확인하지 않는다. 현재 edge validation은 contract id 존재 여부까지만 확인한다. Evidence: `scripts/validate-artifacts.mjs:846`, `scripts/validate-artifacts.mjs:848`.

2. Placeholder contract는 analysis workflow에는 유용하지만 runtime readiness와 다르다.

- Placeholder builder는 `"needs_info"` string과 empty arrays로 contract shape를 만든다. Evidence: `packages/web/src/analyzer/a2aNormalize.ts:69`, `packages/web/src/analyzer/a2aNormalize.ts:78`, `packages/web/src/analyzer/a2aNormalize.ts:91`.
- Readiness gate는 approved status, agent card, supported interfaces, modes, security, skills, lifecycle, streaming fallback, operations/http paths 등을 별도로 검사한다. Evidence: `packages/web/src/design/a2aContractValidator.ts:7`, `packages/web/src/design/a2aContractValidator.ts:11`, `packages/web/src/design/a2aContractValidator.ts:24`, `packages/web/src/design/a2aContractValidator.ts:68`.
- 따라서 schema-valid/shape-normalized와 runtime-ready를 같은 뜻으로 보면 안 된다.

3. Import는 full validation이 아니다.

- `parseAnalysisResultArtifact`는 JSON object와 최소 shape를 확인한 뒤 workbench normalization을 수행한다. Evidence: `packages/web/src/analyzer/analysisArtifactImport.ts:22`, `packages/web/src/analyzer/analysisArtifactImport.ts:25`, `packages/web/src/analyzer/analysisArtifactImport.ts:55`.
- import 시점에 `validate-artifacts.mjs` 수준의 schema/cross-reference 검증을 강제하는 흐름은 보이지 않는다.

4. Catalog contract fixture와 artifact schema가 같은 shape가 아니다.

- standalone A2A schema는 `remote_module_id`가 `^mod-[a-z0-9-]+$` 패턴이어야 한다. Evidence: `schemas/a2a-contract.schema.json:46`.
- catalog fixture `catalog/contracts/a2a/common_document_intake_workflow.v1.json`은 `remote_module_id`로 `catalog-workflow-common_document_intake_workflow`를 사용한다. Evidence: `catalog/contracts/a2a/common_document_intake_workflow.v1.json:2`, `catalog/contracts/a2a/common_document_intake_workflow.v1.json:3`.
- artifact schema의 `task_lifecycle`과 `streaming`은 review/runtime fields를 요구하지만, fixture는 task lifecycle notes와 streaming wrappers 중심이다. Evidence: `schemas/analysis-result.schema.json:505`, `schemas/analysis-result.schema.json:523`, `catalog/contracts/a2a/common_document_intake_workflow.v1.json:41`, `catalog/contracts/a2a/common_document_intake_workflow.v1.json:60`.
- catalog API는 contract files를 read/parse해서 payload에 실어줄 뿐 이 schema 정합성을 보장하지 않는다. Evidence: `packages/web/server/afCatalogApi.ts:45`, `packages/web/server/afCatalogApi.ts:53`, `packages/web/server/afCatalogApi.ts:83`.

5. Runtime contract validation is shallow.

- runtime contract object validator checks id/status/module_id type and object/array fields, but does not cross-check `module_id` against a candidate. Evidence: `scripts/validate-artifacts.mjs:1186`, `scripts/validate-artifacts.mjs:1200`, `scripts/validate-artifacts.mjs:1215`.

## Missing Capabilities

To make newly created workflows reusable across Workbench sessions as a real product capability, the missing features are:

1. Global publish/approval flow from `catalog-delta.yaml` into versioned `catalog/workflows.yaml`, `catalog/agents.yaml`, or `catalog/remote-a2a-contracts.yaml`.
2. Reusable workflow identity/versioning model: stable id, version, owner domain, input/output schema refs, contract status, compatibility notes, provenance.
3. Workflow/Graph IR import into Design: select a catalog workflow and insert it as a nested workflow node or expand its Graph IR into the current graph.
4. Artifact import variants: full `analysis-result.json` remains, but add processFlow/Graph IR-only import with validation and conflict handling.
5. A2A contract creation UI in Design: activate or redesign the dormant inspector flow so reviewers can create/edit contract fields, not only inspect readiness or bind existing ids.
6. Contract linkage validation: ensure remote edge -> remote node/module -> candidate -> `A2AContract.remote_module_id` -> catalog/agent-card are coherent.
7. Runtime support for A2A consuming: generator emits ADK `RemoteA2aAgent` with agent-card URL, `use_legacy=false`, auth/client config, timeout/retry/fallback behavior, and lifecycle/event conversion policy.
8. Runtime support for exposing generated workflows: optional `to_a2a(root_agent)` or `adk api_server --a2a` packaging, agent-card generation/hosting, and well-known endpoint verification.
9. Registry integration option: if reuse must cross repository/team boundaries, add a registry adapter layer, potentially backed by Google Cloud Agent Registry for remote A2A agents and MCP servers.
10. Tests for the above: import validation, catalog publish validation, graph import behavior, contract-link validator, generator RemoteA2aAgent output, and A2A smoke test against a local ADK A2A server.

## Recommended Direction

### Near-term: same repo / same Workbench reuse

Do not start with A2A. Add a versioned local catalog publish/import model:

- Treat newly designed Workflow as a reusable `module_category: workflow` catalog entry.
- Store contract metadata in catalog with stable input/output schema refs and optional Graph IR fragment.
- In Design, support "Import catalog workflow" as either a nested workflow node or an expanded graph fragment.
- Keep Runtime Handoff local until the workflow has an approved runnable binding.

This matches the current taxonomy and avoids network/agent-card/auth complexity for same-process reuse.

### When A2A is justified

Use A2A only when the workflow is exposed as an independent remote service, has an agent card/discovery URL, has ownership/lifecycle/auth/retry/fallback/audit/data policy, and should be consumed over a network boundary. In that case:

- Keep the design artifact as source of review truth: `module_category: workflow` if it is a workflow service, plus `runtime_binding: remote_a2a` after approval.
- Use `AnalysisResult.a2aContracts` for reviewed protocol details.
- Bind Graph IR `remote_a2a` edges to the approved contract.
- Generate ADK `RemoteA2aAgent` on the consuming side and `to_a2a`/`adk api_server --a2a` packaging on the exposing side.

### Agent registration rule

Register as Agent only when the reusable unit is a reasoning owner with instructions/tools and no meaningful explicit execution topology. If the reusable unit exists because it sequences, routes, loops, joins, or coordinates multiple Agents/Adapters, register it as Workflow even if the runtime eventually exposes it through A2A.

## Subagent Work Allocation Used

The investigation was split by purpose to keep context bounded:

- Taxonomy/catalog explorer: taxonomy docs, catalog YAML/API, Reuse Hub publish semantics.
- UI/import explorer: Landing/Analyze import, Design Graph IR derivation, A2A tab/editor visibility, graph edge binding.
- Schema/runtime explorer: schemas, validator, scaffold plan, generator support/rejection paths.
- Main orchestrator: ADK docs MCP review, evidence reconciliation, final report writing.

No source/runtime code was changed for this report.
