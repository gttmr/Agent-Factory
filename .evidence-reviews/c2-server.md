# C2 Server Review

Scope reviewed: `packages/web/server/**/*.ts`, server tests in that tree, and Vite middleware attachment in `packages/web/vite.config.ts`. Inspection only; no source edits, builds, tests, or server starts.

Initial route registration evidence:

- `packages/web/vite.config.ts:37-42` registers dev middleware for `/api/analyze-requirement`, `/api/af-collab`, `/api/af`, `/api/catalog`, and `/api/mock-lab`.
- `packages/web/vite.config.ts:44-49` registers the same middleware set for preview.
- Command evidence: `find packages/web/server packages/web/vite -type f -name '*.ts' -print | sort` showed `packages/web/vite` does not exist in this checkout; Vite wiring is in `packages/web/vite.config.ts`.

## Dead or unreachable (with rg evidence incl. route registration checks)

1. `runtimeChat.install()` and its result type are dead server API surface; keep or inline the 405 route, delete the manager method/type.
   - Route evidence: `/api/af` is mounted by `packages/web/vite.config.ts:40` and dispatches `runtime-chat` through `packages/web/server/afArtifactsApi.ts:144-146`.
   - The install subroute never calls `runtimeChat.install`; it always returns 405 plus status from `runtimeChat.status` in `packages/web/server/afRuntimeChatApi.ts:22-28`.
   - Dead definitions: `RuntimeChatInstallResult` is defined in `packages/web/server/runtimeChat.ts:56-62`, and `RuntimeChatManager.install()` is defined in `packages/web/server/runtimeChat.ts:174-183`.
   - Command evidence: `rg -n "runtime-chat/install|useInstall|installRuntime|RuntimeChatInstallResult" packages/web/server packages/web/src --glob '*.ts' --glob '*.tsx'` found the route string only in `packages/web/server/afArtifactsApi.streaming.test.ts:133`; production references are the server/client result types only.

2. `extractFinalTextFromAdkEvents()` is now test-only leftover from the removed home-grown chat transcript path.
   - Definition: `packages/web/server/runtimeChat.ts:430-441`.
   - Sole observed call: `packages/web/server/runtimeChat.test.ts:100-104`.
   - Command evidence: `rg -n "extractFinalTextFromAdkEvents|RuntimeChatInstallResult|install\\(" packages/web/server packages/web/src --glob '*.ts' --glob '*.tsx'` found no production caller.
   - Expected deletion: remove the export and the test assertion; ADK Web UI launch remains covered by `buildAdkServerCommand()` assertions in `packages/web/server/runtimeChat.test.ts:83-98`.

3. HYPOTHESIS: the fallback branch in `buildCodexStagePrompt()` for build/verify is unreachable in current Stage Runner routing.
   - `runStageSkill()` handles `stage === "build"` before Codex runner construction in `packages/web/server/stageRunner.ts:289-300`, handles `stage === "verify"` in `packages/web/server/stageRunner.ts:301-313`, and only constructs `SdkCodexStageRunner` in the analyze/design path at `packages/web/server/stageRunner.ts:314-328`.
   - The prompt builder still has a generic "server-side primitives" fallback at `packages/web/server/stageRunner.ts:825-831`.
   - Simplification: type the Codex prompt path as analyze/design-only or use a stage config that makes primitive stages non-Codex by construction.

4. Do not delete `codexAnalyzer.ts` wholesale: it is still route-mounted and its validator is imported by active server modules.
   - Vite mounts `/api/analyze-requirement` in dev and preview at `packages/web/vite.config.ts:38` and `packages/web/vite.config.ts:45`.
   - Middleware entry point and POST handling are in `packages/web/server/codexAnalyzer.ts:94-153`.
   - Active validator imports: `packages/web/server/validators.ts:1` re-exports from `codexAnalyzer`, `packages/web/server/afArtifactCrudApi.ts:9-10` imports the validator path for artifact PUT validation, `packages/web/server/artifactSync.ts:1-4` imports it for canonical sync validation, and `packages/web/server/stageRunner.ts:27` imports it for proposed artifact validation.
   - Command evidence: `rg -n "analyze-requirement|useAnalyze|analyzeRequirement|createCodexAnalyzerMiddleware|runCodexAnalyzer|validateAnalysisResult" packages/web/src packages/web/server packages/web/vite.config.ts docs/workbench docs/decision-log.md --glob '*.ts' --glob '*.tsx' --glob '*.md'` found the UI using Stage Runner (`packages/web/src/routes/analyze/AnalyzeRunStep.tsx:41-117`) and only type imports from `useAnalyze`, while docs explicitly keep `/api/analyze-requirement` as an internal/direct primitive (`docs/workbench/validation.md:55`, `docs/workbench/agent-factory-harness.md:192`, `docs/decision-log.md:33-34`).

## Duplication

1. Stage Runner stage behavior is spread across multiple stage switch tables and branches; collapse into one data-driven stage definition.
   - Existing stage metadata: `SKILL_BY_STAGE` maps skill names/paths in `packages/web/server/stageRunner.ts:35-52`.
   - Execution branching repeats stage knowledge in `packages/web/server/stageRunner.ts:285-328`.
   - Command names repeat it again in `packages/web/server/stageRunner.ts:623-627`.
   - Diff allow-lists repeat it again with nested ternaries in `packages/web/server/stageRunner.ts:1201-1208`.
   - UI behavior also encodes the build exception: `packages/web/src/routes/build/BuildRunStep.tsx:199-214` passes `stage="build"` and `applyMode="none"`, while the server skips build diffs in `packages/web/server/stageRunner.ts:358-361`.
   - Simplification: one `STAGE_DEFINITIONS` object can own `skillName`, `skillPath`, runner kind (`codex`, `runtime_stub`, `verify`), allowed proposed files, diff/apply mode, command label, and codex metadata behavior. Expected delta: medium, roughly 80-150 LOC after tests are adjusted. Risk: medium because build's canonical runtime-stub side effect and verify's proposed evidence artifacts must stay unchanged.

2. HTTP middleware helpers are duplicated despite an existing shared helper module.
   - Shared helpers already exist in `packages/web/server/httpApi.ts:3-30` (`readJsonBody`, `readRawBody`, `sendJson`, `ifMatchHeader`, `isRecord`), and many server routes import them: command evidence `rg -n "from \\\"\\./httpApi\\\"|from \\\"\\.\\./server/httpApi\\\"|httpApi" packages/web/server packages/mock-lab/server` found imports in `afArtifactCrudApi`, `afStageRunnerApi`, `afRuntimeA2aApi`, `afVerifyRunApi`, `artifactSyncRunApi`, and others.
   - Local duplicates remain in mounted middlewares: `packages/web/server/afCatalogApi.ts:266-293`, `packages/web/server/afCollaborationApi.ts:449-467`, `packages/mock-lab/server/mockLabApi.ts:251-282`, and `packages/web/server/codexAnalyzer.ts:1794-1830`.
   - Parse-path logic is also duplicated between `packages/web/server/afArtifactsApi.ts:193-205`, `packages/web/server/afCollaborationApi.ts:414-426`, and `packages/mock-lab/server/mockLabApi.ts:240-249`.
   - Caveat: `packages/web/server/codexAnalyzer.ts:1798-1825` has a 1 MB body limit, unlike `httpApi.readJsonBody()` at `packages/web/server/httpApi.ts:3-7`; preserve that limit if centralizing.
   - Expected delta: low/medium, roughly 60-120 LOC. Risk: low if behavior-specific error wording and the analyzer size cap are retained.

3. Runtime process-control helpers are duplicated between `runtimeChat.ts` and `runtimeProcessControl.ts`.
   - Shared process helpers exist in `packages/web/server/runtimeProcessControl.ts:40-159`.
   - `RuntimeA2aManager` already consumes the shared helpers in `packages/web/server/runtimeA2a.ts:12-24`.
   - `runtimeChat.ts` keeps local copies of JSON/file/process/port/tail/fingerprint helpers in `packages/web/server/runtimeChat.ts:457-692`, including `readJson`, `isFile`, process record read/write/clear, `isPidAlive`, `terminatePid`, `waitForPidExit`, `isTcpPortListening`, `tail`, `runtimeStubFingerprint`, and `isRecord`.
   - Keep the chat-specific port-owner/adoption logic in `packages/web/server/runtimeChat.ts:537-612`; it is not present in the shared helper. Expected delta: medium, roughly 80-120 LOC. Risk: medium because stop/adopt behavior around existing port owners is user-visible on the Run screen.

4. Stage Runner response/request contracts are duplicated between server and client.
   - Server types: `packages/web/server/stageRunner.ts:54-148`.
   - Client mirror types: `packages/web/src/state/apiClient.ts:26-120`.
   - Command evidence: `rg -n "type StageRunStage|interface StageRun(RequestBody|Event|Summary|Detail|ArtifactDiff)|StageRunCodexMetadata|StageRunCatalogContext" packages/web/server/stageRunner.ts packages/web/src/state/apiClient.ts` shows parallel declarations for request body, events, metadata, summaries, diffs, and details.
   - Simplification: move pure JSON contract types to a shared dependency-free module if this surface keeps changing. Expected delta: small/neutral LOC, lower drift risk. Risk: low/medium because importing server modules into client directly would pull Node-only dependencies; use a pure shared type file.

## Over-abstraction & slop

1. `codexAnalyzer.ts` mixes three concerns that now have different lifecycles: legacy direct route, SDK prompt/hydration runner, and shared `analysis-result` validation.
   - Direct route and SDK path: `packages/web/server/codexAnalyzer.ts:94-153` and `packages/web/server/codexAnalyzer.ts:281-380`.
   - Shared validation implementation begins at `packages/web/server/codexAnalyzer.ts:1210`, but other server modules reach it through `packages/web/server/validators.ts:1`.
   - Active non-analyzer consumers: `packages/web/server/afArtifactCrudApi.ts:9-10`, `packages/web/server/artifactSync.ts:1-4`, and `packages/web/server/stageRunner.ts:27`.
   - Simplification: move `validateAnalysisResult` and its helper-only dependencies to a real validation module, then let `codexAnalyzer.ts` import it. This does not delete behavior, but it stops CRUD/sync/Stage Runner validation from depending on the analyzer route module and SDK/prompt surface.

2. `StageRunRequestBody.execution_mode` is accepted for all stages, but build/verify ignore it.
   - Parser accepts `execution_mode` generically in `packages/web/server/afStageRunnerApi.ts:140-155`.
   - `runStageSkill()` branches into build/verify primitives before checking `body.execution_mode === "fake"` in `packages/web/server/stageRunner.ts:289-317`.
   - Test evidence shows the slop explicitly: build is invoked with `body: { execution_mode: "fake", model: "gpt-5.5" }` in `packages/web/server/stageRunner.test.ts:282-288`, yet the primitive path still runs and succeeds.
   - Simplification: either document/normalize `execution_mode` as analyze/design-only, or move stage-specific request normalization into the proposed stage definition table. Expected delta: small. Risk: low if request snapshots intentionally preserve ignored fields.

3. `StageRunnerPanel.applyMode` is a UI-only guard; the server still exposes apply for any stage with a completed run and valid diff files.
   - UI apply gate: `packages/web/src/components/StageRunnerPanel.tsx:80-85`.
   - Build screen disables apply with `applyMode="none"` in `packages/web/src/routes/build/BuildRunStep.tsx:199-214`.
   - Server apply has no stage-level apply-mode concept; it checks status and diff validity in `packages/web/server/stageRunner.ts:568-607`.
   - This is not currently a bug because build runs have empty diffs (`packages/web/server/stageRunner.ts:358-361`, `packages/web/server/stageRunner.test.ts:294-295`). Simplification: centralize stage apply semantics in server stage definitions so UI and server do not need separate knowledge.

4. Test-only runner interfaces are exported from production `stageRunner.ts`.
   - Command evidence: `rg -n "\\bskillRunnerStages\\b|\\bCodexStageRunner\\b|\\bStagePrimitiveRunner\\b|\\bStageRunRequestBody\\b|\\bStageRunEvent\\b" packages/web/server packages/web/src --glob '*.ts' --glob '*.tsx'` found `CodexStageRunner` and `StagePrimitiveRunner` imported only by `packages/web/server/stageRunner.test.ts:10-11`, with test implementations at `packages/web/server/stageRunner.test.ts:130` and `packages/web/server/stageRunner.test.ts:241`.
   - Production uses the interfaces internally in `packages/web/server/stageRunner.ts:150-208`.
   - Simplification options: keep as `@internal`, move fake runner construction behind test helpers, or accept this as a test seam. Expected delta: small. Risk: low.

## Correctness-robustness flags

1. Mock Lab can orphan child mock-server processes across Vite HMR/module reloads.
   - Vite mounts Mock Lab in dev and preview at `packages/web/vite.config.ts:42` and `packages/web/vite.config.ts:49`.
   - Each `createMockLabMiddleware(repoRoot)` call creates a fresh `MockProcessRegistry` in `packages/mock-lab/server/mockLabApi.ts:14-18`.
   - Running child process ownership is instance-local: `packages/mock-lab/server/mockProcessRegistry.ts:32-41` stores `private readonly processes = new Map<string, ProcessEntry>()`, and `start()` stores the spawned child in that map at `packages/mock-lab/server/mockProcessRegistry.ts:43-82`.
   - After a new registry generation is created, `stop()` cannot see old children; when no in-memory entry exists it only reads stored status and returns a stopped shape in `packages/mock-lab/server/mockProcessRegistry.ts:110-115`.
   - `status()` also falls back to stored state when no in-memory entry exists in `packages/mock-lab/server/mockProcessRegistry.ts:132-142`, and `readStoredStatus()` rewrites stored `running`/`starting` states to `stopped` with `pid: null` in `packages/mock-lab/server/mockProcessRegistry.ts:204-212`.
   - Fix feasibility: anchor the process registry on `globalThis` by `repoRoot` inside `createMockLabMiddleware`, and consider an HMR dispose hook only if the intended behavior is to kill children on reload. A global anchor preserves live dev children and lets `/server/stop` find them after HMR. Risk: medium; it changes dev lifecycle semantics and should be covered by a registry-generation test.

2. HYPOTHESIS: Verify runs with failed commands can still expose an applyable proposed-artifact diff.
   - Failed verify command behavior is intentional in tests: `packages/web/server/stageRunner.test.ts:298-320` asserts `verifyRun.status === "completed"` while `verifyRun.validation.ok === false`, and still expects `validation-report.md` plus `catalog-delta.yaml` proposed artifacts.
   - The server apply path checks only completed/applied status and per-file validity in `packages/web/server/stageRunner.ts:568-607`; it does not check `summary.validation.ok`.
   - The UI apply gate checks `summary.status === "completed"` and `file.valid` only in `packages/web/src/components/StageRunnerPanel.tsx:80-85`.
   - The generated failed-verify report accurately records `result: failed` in `packages/web/server/stageRunner.ts:855-881`, and the generated catalog delta is an empty template in `packages/web/server/stageRunner.ts:884-892`, so this may be deliberate evidence capture. If "apply" is meant to mean "verification passed", add `summary.validation.ok` to the apply gate or rename the action for failed verify evidence.

## Test portability

1. `catalogPublishProposal.test.ts` depends on an active repo artifact that may not exist in a fresh clone.
   - Direct dependency: `packages/web/src/catalog/catalogPublishProposal.test.ts:77-80` reads `../../../../artifacts/af/req-page-recommendation-required/catalog-delta.yaml`.
   - The current live workspace artifact content used by that assertion is in `artifacts/af/req-page-recommendation-required/catalog-delta.yaml:1-37`.
   - Assertions bind to the active artifact values at `packages/web/src/catalog/catalogPublishProposal.test.ts:87-103`, including `page_recommendation_required_workflow`, `a2a_ready`, `remote_a2a`, and `req-page-recommendation-a2a-consumer`.
   - Command evidence: `rg -n "readFileSync\\(|new URL\\(.*artifacts|new URL\\(.*\\.agent-factory|process\\.cwd\\(\\).*artifacts|join\\(process\\.cwd\\(\\).*artifacts|readFile\\(.*artifacts/af|stat\\(.*artifacts/af|access\\(.*artifacts/af" packages/web --glob '*test.ts' --glob '*test.tsx'` found this direct repo-root artifact URL plus temp-root reads in server tests such as `packages/web/server/stageRunner.test.ts:59`, `packages/web/server/stageRunner.test.ts:94`, and `packages/web/server/stageRunner.test.ts:193`.
   - Command evidence: `rg -n "\\.agent-factory|artifacts/af" packages/web --glob '*test.ts' --glob '*test.tsx'` shows `.agent-factory` usage in tests is under temporary roots, e.g. `packages/web/server/runtimeChat.test.ts:51-53` and `packages/web/server/runtimeEnv.test.ts:19-30`, not live repo state.
   - Smallest fix: move the required YAML into a tracked fixture next to the catalog tests (for example `packages/web/src/catalog/__fixtures__/workflow-a2a-catalog-delta.yaml`) and update the test path. Prefer fixture relocation over a skip guard; a skip would hide the publish-proposal regression in clean checkouts.

## Ranked action list (top 10: action, files, expected delta, risk)

1. Fix Mock Lab HMR process ownership with a `globalThis`-anchored registry keyed by `repoRoot`.
   - Files: `packages/mock-lab/server/mockLabApi.ts`, `packages/mock-lab/server/mockProcessRegistry.ts`, focused Mock Lab registry/API tests.
   - Evidence: fresh registry construction at `packages/mock-lab/server/mockLabApi.ts:14-18`, instance-local process map at `packages/mock-lab/server/mockProcessRegistry.ts:32-41`, orphaned stop/status behavior at `packages/mock-lab/server/mockProcessRegistry.ts:110-142` and `packages/mock-lab/server/mockProcessRegistry.ts:204-212`.
   - Expected delta: small/medium. Risk: medium.

2. Relocate the live `catalog-delta.yaml` dependency into a tracked test fixture.
   - Files: `packages/web/src/catalog/catalogPublishProposal.test.ts`, new catalog fixture.
   - Evidence: direct artifact read at `packages/web/src/catalog/catalogPublishProposal.test.ts:77-80`, live artifact content at `artifacts/af/req-page-recommendation-required/catalog-delta.yaml:1-37`, assertions at `packages/web/src/catalog/catalogPublishProposal.test.ts:87-103`.
   - Expected delta: small. Risk: low.

3. Delete dead runtime-chat install implementation/types while preserving the explicit 405 route response.
   - Files: `packages/web/server/runtimeChat.ts`, `packages/web/src/state/useRuntimeChat.ts`, `packages/web/server/afRuntimeChatApi.ts` only if inlining/typing is needed.
   - Evidence: route returns 405 without calling manager at `packages/web/server/afRuntimeChatApi.ts:22-28`, dead server type/method at `packages/web/server/runtimeChat.ts:56-62` and `packages/web/server/runtimeChat.ts:174-183`, client type at `packages/web/src/state/useRuntimeChat.ts:50-56`.
   - Expected delta: small, about 20-35 LOC. Risk: low.

4. Delete the test-only ADK event final-text parser.
   - Files: `packages/web/server/runtimeChat.ts`, `packages/web/server/runtimeChat.test.ts`.
   - Evidence: parser definition at `packages/web/server/runtimeChat.ts:430-441`, sole observed call at `packages/web/server/runtimeChat.test.ts:100-104`, ADK Web UI command still asserted at `packages/web/server/runtimeChat.test.ts:83-98`.
   - Expected delta: small, about 10-20 LOC. Risk: low.

5. Reuse `runtimeProcessControl.ts` from `runtimeChat.ts`, preserving chat-specific port-owner adoption.
   - Files: `packages/web/server/runtimeChat.ts`, maybe `packages/web/server/runtimeProcessControl.ts` if helper signatures need a narrow extension.
   - Evidence: shared helpers at `packages/web/server/runtimeProcessControl.ts:40-159`, A2A import/use at `packages/web/server/runtimeA2a.ts:12-24`, duplicated chat helpers at `packages/web/server/runtimeChat.ts:457-692`, chat-only adoption logic at `packages/web/server/runtimeChat.ts:537-612`.
   - Expected delta: medium, about 80-120 LOC. Risk: medium.

6. Collapse Stage Runner stage switches into a data-driven stage definition table.
   - Files: `packages/web/server/stageRunner.ts`, `packages/web/server/stageRunner.test.ts`, possibly `packages/web/src/components/StageRunnerPanel.tsx` if apply semantics move into the contract.
   - Evidence: stage metadata at `packages/web/server/stageRunner.ts:35-52`, execution branches at `packages/web/server/stageRunner.ts:285-328`, command labels at `packages/web/server/stageRunner.ts:623-627`, diff allow-list at `packages/web/server/stageRunner.ts:1201-1208`, UI build exception at `packages/web/src/routes/build/BuildRunStep.tsx:199-214`.
   - Expected delta: medium, about 80-150 LOC after tests. Risk: medium.

7. Split `validateAnalysisResult` out of `codexAnalyzer.ts`.
   - Files: `packages/web/server/codexAnalyzer.ts`, `packages/web/server/validators.ts`, new or renamed validation module, validator tests.
   - Evidence: validator re-export at `packages/web/server/validators.ts:1`, validator implementation begins at `packages/web/server/codexAnalyzer.ts:1210`, non-analyzer consumers at `packages/web/server/afArtifactCrudApi.ts:9-10`, `packages/web/server/artifactSync.ts:1-4`, and `packages/web/server/stageRunner.ts:27`.
   - Expected delta: LOC neutral/small positive; dependency boundary improves. Risk: medium.

8. Centralize duplicated HTTP/path helpers while preserving analyzer body-size behavior and route-specific error wording.
   - Files: `packages/web/server/httpApi.ts`, `packages/web/server/afCatalogApi.ts`, `packages/web/server/afCollaborationApi.ts`, `packages/mock-lab/server/mockLabApi.ts`, selectively `packages/web/server/codexAnalyzer.ts`.
   - Evidence: shared helpers at `packages/web/server/httpApi.ts:3-30`, local duplicates at `packages/web/server/afCatalogApi.ts:266-293`, `packages/web/server/afCollaborationApi.ts:449-467`, `packages/mock-lab/server/mockLabApi.ts:240-282`, and analyzer size-capped parser at `packages/web/server/codexAnalyzer.ts:1798-1825`.
   - Expected delta: small/medium, about 60-120 LOC. Risk: low.

9. Decide and encode failed-verify apply semantics.
   - Files: `packages/web/server/stageRunner.ts`, `packages/web/src/components/StageRunnerPanel.tsx`, `packages/web/server/stageRunner.test.ts`.
   - Evidence: failed verify can be `completed` with `validation.ok === false` in `packages/web/server/stageRunner.test.ts:298-320`, server apply ignores `summary.validation.ok` at `packages/web/server/stageRunner.ts:568-607`, UI apply gate also ignores it at `packages/web/src/components/StageRunnerPanel.tsx:80-85`.
   - Expected delta: small. Risk: low/medium because current behavior may be intentional evidence capture.

10. Move Stage Runner JSON contract types to a pure shared type module if the API continues changing.
    - Files: `packages/web/server/stageRunner.ts`, `packages/web/src/state/apiClient.ts`, new shared type module under a client-safe path.
    - Evidence: server contracts at `packages/web/server/stageRunner.ts:54-148`, client mirrors at `packages/web/src/state/apiClient.ts:26-120`, command evidence from `rg -n "type StageRunStage|interface StageRun(RequestBody|Event|Summary|Detail|ArtifactDiff)|StageRunCodexMetadata|StageRunCatalogContext" packages/web/server/stageRunner.ts packages/web/src/state/apiClient.ts`.
    - Expected delta: small/neutral. Risk: low/medium because the shared module must not import Node-only server code.
