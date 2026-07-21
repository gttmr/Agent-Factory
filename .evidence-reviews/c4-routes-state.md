# C4 routes/state/layout review

Scope: `packages/web/src/routes/**`, `packages/web/src/state/**`, `packages/web/src/layout/**`, `packages/web/src/App.tsx`, `packages/web/src/routes/router.tsx`.

Mode: findings only. No builds, no dev server, no source edits. Evidence is from direct file inspection and consumer searches.

## Dead or unreachable

1. `useAnalyze.ts` is now a type-only state module, not a hook.
   - Evidence: [packages/web/src/state/useAnalyze.ts](/home/ilmaswsl/work/Agent-Factory/packages/web/src/state/useAnalyze.ts:1) only exports `AnalyzeCatalogEntry`.
   - Consumer check across routes, components, layout, state, and server:
     `rg -n "useAnalyze|AnalyzeCatalogEntry|AnalyzeRequest|AnalyzeResult|AnalyzeResponse" packages/web/src/routes packages/web/src/components packages/web/src/layout packages/web/src/state packages/web/server`
     returned only [AnalyzeRunStep.tsx](/home/ilmaswsl/work/Agent-Factory/packages/web/src/routes/analyze/AnalyzeRunStep.tsx:3) and [analyzeStageModel.tsx](/home/ilmaswsl/work/Agent-Factory/packages/web/src/routes/analyze/analyzeStageModel.tsx:3), both type imports.
   - DELETE/SIMPLIFY: move `AnalyzeCatalogEntry` next to `flattenCatalogForAnalyzer` or a catalog-facing type module, then delete the misleading `useAnalyze.ts` file.

2. `fetchRuntimeA2aAgentCard` is an exported client function with no current consumer.
   - Evidence: [useRuntimeA2a.ts](/home/ilmaswsl/work/Agent-Factory/packages/web/src/state/useRuntimeA2a.ts:140) exports `fetchRuntimeA2aAgentCard`.
   - Consumer check across routes, components, catalog-hub, layout, state, and server:
     `rg -n "fetchRuntimeA2aAgentCard|RuntimeA2aAgentCardResult|agent-card|Agent Card|agentCard" ...`
     found the exported function, but the route action uses a private fetcher instead: [designWorkbenchActions.ts](/home/ilmaswsl/work/Agent-Factory/packages/web/src/routes/design/designWorkbenchActions.ts:209).
   - Server route is live: [afRuntimeA2aApi.ts](/home/ilmaswsl/work/Agent-Factory/packages/web/server/afRuntimeA2aApi.ts:31) handles `runtime-a2a/agent-card`.
   - DELETE/SIMPLIFY: either use the exported state helper in `designWorkbenchActions.ts` or delete the exported helper and keep the type export only.

3. No dead route mount found in the scoped route table.
   - Evidence: [router.tsx](/home/ilmaswsl/work/Agent-Factory/packages/web/src/routes/router.tsx:6) lazily imports all page modules, and [router.tsx](/home/ilmaswsl/work/Agent-Factory/packages/web/src/routes/router.tsx:27) mounts landing, catalog, mock-lab, analyze, design, build, verify, run, plus redirects.
   - Consumer check: route-link search found inbound links/nav for `/catalog`, `/mock-lab`, `/af/:reqId/*`, and `/af/:reqId/run` from `WorkbenchLayout`, `LandingPage`, stage next-actions, and build/catalog surfaces.

4. `/run` no longer has the old home-grown chat transcript state, but the live ADK runtime seam still carries chat-era naming.
   - Evidence: [RunSandbox.tsx](/home/ilmaswsl/work/Agent-Factory/packages/web/src/routes/RunSandbox.tsx:7) imports `useRuntimeChat*` hooks, and [RunSandbox.tsx](/home/ilmaswsl/work/Agent-Factory/packages/web/src/routes/RunSandbox.tsx:33) names the process status `chatStatus`.
   - Server consumer check: [afArtifactsApi.ts](/home/ilmaswsl/work/Agent-Factory/packages/web/server/afArtifactsApi.ts:144) still routes `/runtime-chat/*` to [afRuntimeChatApi.ts](/home/ilmaswsl/work/Agent-Factory/packages/web/server/afRuntimeChatApi.ts:6), so this is not dead code.
   - HYPOTHESIS: a compatibility-preserving internal rename from `RuntimeChat` to `RuntimeProcess` would reduce chat-era slop, but deleting the server route would be a behavior change.

## Duplication across stage screens

1. The four run-step surfaces mostly pass config into the same `StageRunnerPanel`.
   - Analyze wrapper: [AnalyzeRunStep.tsx](/home/ilmaswsl/work/Agent-Factory/packages/web/src/routes/analyze/AnalyzeRunStep.tsx:41).
   - Design wrapper: [DesignRunStep.tsx](/home/ilmaswsl/work/Agent-Factory/packages/web/src/routes/design/DesignRunStep.tsx:32).
   - Build wrapper: [BuildRunStep.tsx](/home/ilmaswsl/work/Agent-Factory/packages/web/src/routes/build/BuildRunStep.tsx:199).
   - Verify wrapper: [VerifyWorkbench.tsx](/home/ilmaswsl/work/Agent-Factory/packages/web/src/routes/VerifyWorkbench.tsx:168).
   - Important difference to preserve: Build sets `applyMode="none"` at [BuildRunStep.tsx](/home/ilmaswsl/work/Agent-Factory/packages/web/src/routes/build/BuildRunStep.tsx:211); Analyze, Design, and Verify use the default proposed-artifact apply mode from [StageRunnerPanel.tsx](/home/ilmaswsl/work/Agent-Factory/packages/web/src/components/StageRunnerPanel.tsx:49).
   - DELETE/SIMPLIFY: extract a small stage-runner config/helper for `stage`, `skillName`, labels, metrics, disabled reason, and `buildRunBody`; keep per-stage controls and `applyMode` explicit.

2. Verify has two execution surfaces for the same allowlisted command path.
   - Stage Runner path: [VerifyWorkbench.tsx](/home/ilmaswsl/work/Agent-Factory/packages/web/src/routes/VerifyWorkbench.tsx:168) renders `StageRunnerPanel` with `stage="verify"` and [VerifyWorkbench.tsx](/home/ilmaswsl/work/Agent-Factory/packages/web/src/routes/VerifyWorkbench.tsx:194) passes `verifyCommand`.
   - Older direct path: [VerifyWorkbench.tsx](/home/ilmaswsl/work/Agent-Factory/packages/web/src/routes/VerifyWorkbench.tsx:78) calls `runVerify.mutate`, and [VerifyRunStep.tsx](/home/ilmaswsl/work/Agent-Factory/packages/web/src/routes/verify/VerifyRunStep.tsx:15) renders separate command cards/log output.
   - Server evidence: Stage Runner verify calls the same primitive [stageRunner.ts](/home/ilmaswsl/work/Agent-Factory/packages/web/server/stageRunner.ts:221) -> `runVerifyCommand`, while the direct API also calls `runVerifyCommand` at [afVerifyRunApi.ts](/home/ilmaswsl/work/Agent-Factory/packages/web/server/afVerifyRunApi.ts:102).
   - DELETE/SIMPLIFY: make Verify use one execution surface. If Stage Runner is canonical, keep command selection as `StageRunnerPanel.controls` and delete the direct `VerifyRunStep` execution lane.

3. Build and Verify duplicate identical process-stream formatting.
   - Build copy: [processLog.ts](/home/ilmaswsl/work/Agent-Factory/packages/web/src/routes/build/processLog.ts:40).
   - Verify copy: [verifyStreamLog.ts](/home/ilmaswsl/work/Agent-Factory/packages/web/src/routes/verify/verifyStreamLog.ts:8).
   - Consumer check: `rg -n "formatProcessStreamLogLine|ProcessStreamEvent|valueToString|\\[error\\]" packages/web/src/routes packages/web/src/state packages/web/src/components` shows both helpers formatting `stdout`, `stderr`, `start`, `done`, and `error` the same way.
   - DELETE/SIMPLIFY: move `formatProcessStreamLogLine`, `StreamLogEntry`, and tiny string helpers to one shared route helper or `state/useStreamingProcess.ts`.

## Over-abstraction & slop

1. Graph IR save-success is duplicated as a string sentinel.
   - Exported source: [designStageModelCore.ts](/home/ilmaswsl/work/Agent-Factory/packages/web/src/routes/design/designStageModelCore.ts:9).
   - Local duplicate: [designWorkbenchActions.ts](/home/ilmaswsl/work/Agent-Factory/packages/web/src/routes/design/designWorkbenchActions.ts:12).
   - String-equality consumer: [designWorkbenchChrome.tsx](/home/ilmaswsl/work/Agent-Factory/packages/web/src/routes/design/designWorkbenchChrome.tsx:60) shows the Build-sync CTA only when `actionMessage === GRAPH_IR_SAVE_SUCCESS_MESSAGE`.
   - DELETE/SIMPLIFY: import the exported constant into `designWorkbenchActions.ts` or replace string-sentinel UI branching with an explicit action state.

2. `useStageRunner` invalidates every possible stage artifact for every stage.
   - Start success invalidates runtime stub, validation report, and catalog delta regardless of `stage`: [useStageRunner.ts](/home/ilmaswsl/work/Agent-Factory/packages/web/src/state/useStageRunner.ts:49).
   - Apply success invalidates analysis result, boundary design, validation report, catalog delta, runtime stub, and manifest regardless of `stage`: [useStageRunner.ts](/home/ilmaswsl/work/Agent-Factory/packages/web/src/state/useStageRunner.ts:85).
   - Server output contract is stage-specific: [stageRunner.ts](/home/ilmaswsl/work/Agent-Factory/packages/web/server/stageRunner.ts:1201) allows `analysis-result.json` for analyze, `analysis-result.json`/`boundary-design.md` for design, and `validation-report.md`/`catalog-delta.yaml` for verify; build is `runtime-stub` side-effect oriented.
   - DELETE/SIMPLIFY: make invalidation stage-specific to reduce unnecessary refetch and make artifact ownership clearer.

3. Mock Lab prerequisite typing is repeated across runtime-chat, runtime-a2a, and the route component.
   - Runtime chat shape: [useRuntimeChat.ts](/home/ilmaswsl/work/Agent-Factory/packages/web/src/state/useRuntimeChat.ts:38).
   - Runtime A2A shape: [useRuntimeA2a.ts](/home/ilmaswsl/work/Agent-Factory/packages/web/src/state/useRuntimeA2a.ts:54).
   - Component-local subset: [MockLabPrerequisiteRows.tsx](/home/ilmaswsl/work/Agent-Factory/packages/web/src/routes/run/MockLabPrerequisiteRows.tsx:5).
   - HYPOTHESIS: this is harmless today because the component only needs the subset, but a shared minimal `MockLabPrerequisiteEntry` type would remove three parallel definitions without changing runtime behavior.

4. `useStageStep` forces mutable arrays at the type boundary.
   - Hook signature: [StageShell.tsx](/home/ilmaswsl/work/Agent-Factory/packages/web/src/layout/StageShell.tsx:59) accepts `string[]`.
   - Build has to spread a readonly constant just to satisfy it: [BuildStageState.tsx](/home/ilmaswsl/work/Agent-Factory/packages/web/src/routes/build/BuildStageState.tsx:41).
   - DELETE/SIMPLIFY: change the hook parameter to `readonly string[]`; behavior stays the same and one spread disappears.

## Contract drift (localStorage, gate derivation, stage_runs vs approvals)

1. Contract drift: Design step status is derived from module candidate status.
   - Route computes candidate-derived readiness: [DesignWorkbench.tsx](/home/ilmaswsl/work/Agent-Factory/packages/web/src/routes/DesignWorkbench.tsx:91) counts `candidate.status === "approved"`, [DesignWorkbench.tsx](/home/ilmaswsl/work/Agent-Factory/packages/web/src/routes/DesignWorkbench.tsx:92) derives `allCandidatesApproved`, and [DesignWorkbench.tsx](/home/ilmaswsl/work/Agent-Factory/packages/web/src/routes/DesignWorkbench.tsx:97) folds that into `reviewReady`.
   - Stepper status consumes that value: [DesignWorkbench.tsx](/home/ilmaswsl/work/Agent-Factory/packages/web/src/routes/DesignWorkbench.tsx:176) passes `reviewReady` to `buildDesignSteps`, and [designStageModelCore.ts](/home/ilmaswsl/work/Agent-Factory/packages/web/src/routes/design/designStageModelCore.ts:37) marks Review `done`/`blocked` from `reviewReady`; [designStageModelCore.ts](/home/ilmaswsl/work/Agent-Factory/packages/web/src/routes/design/designStageModelCore.ts:44) marks Approve status from `reviewReady`/`bothApproved`.
   - Server runner evidence: Stage Runner writes `manifest.stage_runs` only at [stageRunner.ts](/home/ilmaswsl/work/Agent-Factory/packages/web/server/stageRunner.ts:1274), and `handlePatchApprovals` projects approval gates into `manifest.stages` at [afArtifactCrudApi.ts](/home/ilmaswsl/work/Agent-Factory/packages/web/server/afArtifactCrudApi.ts:99).
   - Fix direction: keep candidate status for approval-button enablement and explanatory metrics, but compute step status from artifact presence plus `manifest.approvals.*`.

2. Stage Runner success does not auto-toggle approvals in the server path.
   - Completion writes `result-summary.json` and then `stage_runs`: [stageRunner.ts](/home/ilmaswsl/work/Agent-Factory/packages/web/server/stageRunner.ts:422).
   - Apply updates run summary to `applied` and updates `stage_runs`: [stageRunner.ts](/home/ilmaswsl/work/Agent-Factory/packages/web/server/stageRunner.ts:600).
   - Regression evidence in server test: design run leaves `boundaries_approved` and `runtime_contracts_approved` false while recording `stage_runs.design.latest_run_id`: [stageRunner.test.ts](/home/ilmaswsl/work/Agent-Factory/packages/web/server/stageRunner.test.ts:123).
   - No action unless route UI starts deriving approval truth from `stage_runs`; current issue is route step status, not server mutation.

3. `localStorage` contract is clean in current scope.
   - Command: `rg -n "\\blocalStorage\\b|\\bsessionStorage\\b" packages/web/src packages/web/server`.
   - Allowed recent-root key: [useRecentRoots.ts](/home/ilmaswsl/work/Agent-Factory/packages/web/src/state/useRecentRoots.ts:3), reads/writes at [useRecentRoots.ts](/home/ilmaswsl/work/Agent-Factory/packages/web/src/state/useRecentRoots.ts:14) and [useRecentRoots.ts](/home/ilmaswsl/work/Agent-Factory/packages/web/src/state/useRecentRoots.ts:33).
   - Allowed author keys: [useAuthor.ts](/home/ilmaswsl/work/Agent-Factory/packages/web/src/state/useAuthor.ts:3), reads/writes at [useAuthor.ts](/home/ilmaswsl/work/Agent-Factory/packages/web/src/state/useAuthor.ts:11), [useAuthor.ts](/home/ilmaswsl/work/Agent-Factory/packages/web/src/state/useAuthor.ts:20), [useAuthor.ts](/home/ilmaswsl/work/Agent-Factory/packages/web/src/state/useAuthor.ts:33), and [useAuthor.ts](/home/ilmaswsl/work/Agent-Factory/packages/web/src/state/useAuthor.ts:40).
   - No extra `localStorage` or `sessionStorage` usage found in `packages/web/src` or `packages/web/server`.

4. Verify still mixes direct validation state and Stage Runner state.
   - Direct route state: [VerifyWorkbench.tsx](/home/ilmaswsl/work/Agent-Factory/packages/web/src/routes/VerifyWorkbench.tsx:63) derives `lastResult` from `manifest.validation.last_result`, and [VerifyWorkbench.tsx](/home/ilmaswsl/work/Agent-Factory/packages/web/src/routes/VerifyWorkbench.tsx:64) derives `ranSomething` from local `lastRun` or `lastResult`.
   - Stage Runner metadata exists separately: [stageRunner.ts](/home/ilmaswsl/work/Agent-Factory/packages/web/server/stageRunner.ts:1274) records `stage_runs.verify` like other stages.
   - HYPOTHESIS: because Verify Stage Runner also calls `runVerifyCommand`, the validation result generally persists; the slop is that the route has two parallel notions of "run happened" (`manifest.validation`/`lastRun` and Stage Runner history). Collapse to one source when simplifying the Verify run surface.

## Ranked action list (top 10)

1. Fix Design stepper status derivation so step status comes from artifact presence plus `manifest.approvals`, not `candidate.status`.
2. Collapse Verify to one execution surface; prefer the Stage Runner path if stage history/proposed artifacts are now canonical.
3. Extract shared StageRunnerPanel config for Analyze/Design/Build/Verify while preserving Build `applyMode="none"`.
4. Delete or consume the dead exported `fetchRuntimeA2aAgentCard` helper.
5. Move `AnalyzeCatalogEntry` out of the misleading `state/useAnalyze.ts` type-only shell and delete that file.
6. Deduplicate process-stream log formatting between Build and Verify.
7. Deduplicate `GRAPH_IR_SAVE_SUCCESS_MESSAGE` or replace the string sentinel with explicit action state.
8. Make `useStageRunner` cache invalidation stage-specific.
9. Consider a shared `MockLabPrerequisiteEntry` type across runtime chat, runtime A2A, and `MockLabPrerequisiteRows`.
10. Change `useStageStep(stepIds)` to accept `readonly string[]` and remove the Build spread workaround.
