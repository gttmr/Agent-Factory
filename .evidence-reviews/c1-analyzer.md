# C1 Analyzer Core Review

Scope: `packages/web/src/analyzer/**` including tests, `schemas/*.json`, `scripts/validate-artifacts.mjs`, and `scripts/artifact-validation/**`.

Mode: findings only. Source files were not edited.

## Dead or unused — exports/functions/files with zero call sites

### 1. Delete `packages/web/src/analyzer/commonization.ts` entirely

Evidence:

```bash
$ rg -n "\b(buildCommonizationNotes|buildMermaidProcessFlow|buildCatalogDeltaYaml)\b" . --glob '!node_modules/**'
./packages/web/src/analyzer/commonization.ts:4:export function buildCommonizationNotes(moduleCandidates: ModuleCandidate[]): CommonizationNotes {
./packages/web/src/analyzer/commonization.ts:30:export function buildMermaidProcessFlow(processFlow: ProcessFlow): string {
./packages/web/src/analyzer/commonization.ts:43:export function buildCatalogDeltaYaml(moduleCandidates: ModuleCandidate[]): string {
```

There are no references outside the defining file, including `packages/web/server` and `scripts`. The file is 73 lines and only imports `getCandidateSubtype` plus analyzer types ([packages/web/src/analyzer/commonization.ts:1](/home/ilmaswsl/work/Agent-Factory/packages/web/src/analyzer/commonization.ts:1), [packages/web/src/analyzer/commonization.ts:4](/home/ilmaswsl/work/Agent-Factory/packages/web/src/analyzer/commonization.ts:4), [packages/web/src/analyzer/commonization.ts:30](/home/ilmaswsl/work/Agent-Factory/packages/web/src/analyzer/commonization.ts:30), [packages/web/src/analyzer/commonization.ts:43](/home/ilmaswsl/work/Agent-Factory/packages/web/src/analyzer/commonization.ts:43)).

Recommendation: delete the file and its three unused helpers. Expected delta: about -73 lines. Risk: low, because repo-wide search found zero callers and there is no test file for this module.

### 2. Delete `packages/web/src/analyzer/analysisArtifactExport.ts` or move its two-line behavior into the only test

Evidence:

```bash
$ rg -n "\b(buildAnalysisResultArtifact|serializeAnalysisResultArtifact)\b" . --glob '!node_modules/**'
./packages/web/src/analyzer/analysisArtifactImport.test.ts:3:import { buildAnalysisResultArtifact, serializeAnalysisResultArtifact } from "./analysisArtifactExport.ts";
./packages/web/src/analyzer/analysisArtifactImport.test.ts:17:const reviewedArtifact = buildAnalysisResultArtifact({
./packages/web/src/analyzer/analysisArtifactImport.test.ts:24:const serialized = serializeAnalysisResultArtifact({
./packages/web/src/analyzer/analysisArtifactExport.ts:10:export function buildAnalysisResultArtifact({
./packages/web/src/analyzer/analysisArtifactExport.ts:24:export function serializeAnalysisResultArtifact(input: BuildAnalysisResultArtifactInput): string {
./packages/web/src/analyzer/analysisArtifactExport.ts:25:  return `${JSON.stringify(buildAnalysisResultArtifact(input), null, 2)}\n`;
```

The only consumer is `analysisArtifactImport.test.ts`; no production route, state hook, server file, or script imports it. The implementation just spreads `analysis`, replaces three arrays, and stringifies with a trailing newline ([packages/web/src/analyzer/analysisArtifactExport.ts:10](/home/ilmaswsl/work/Agent-Factory/packages/web/src/analyzer/analysisArtifactExport.ts:10), [packages/web/src/analyzer/analysisArtifactExport.ts:24](/home/ilmaswsl/work/Agent-Factory/packages/web/src/analyzer/analysisArtifactExport.ts:24)). The test uses it only to manufacture an approved fixture and assert newline serialization ([packages/web/src/analyzer/analysisArtifactImport.test.ts:17](/home/ilmaswsl/work/Agent-Factory/packages/web/src/analyzer/analysisArtifactImport.test.ts:17), [packages/web/src/analyzer/analysisArtifactImport.test.ts:24](/home/ilmaswsl/work/Agent-Factory/packages/web/src/analyzer/analysisArtifactImport.test.ts:24)).

Recommendation: delete `analysisArtifactExport.ts`; in the importer test, build the reviewed fixture inline with object spread and use `JSON.stringify(..., null, 2) + "\n"` if that newline assertion is still useful. Expected delta: about -26 source lines, with a small test edit. Risk: low; it is test-only helper code.

### 3. Delete the unused `classificationRules` text map

Evidence:

```bash
$ rg -n --pcre2 "(?<![/])\bclassificationRules\b" packages/web/src packages/web/server scripts --glob '*.ts' --glob '*.tsx' --glob '*.mjs' --glob '!node_modules/**'
./packages/web/src/analyzer/classificationRules.ts:65:export const classificationRules: Record<ModuleCategory, string> = {
```

The file's label maps and `getCandidateSubtype` are live via `CategoryBadge` and currently `commonization.ts`, but the `classificationRules` object at [packages/web/src/analyzer/classificationRules.ts:65](/home/ilmaswsl/work/Agent-Factory/packages/web/src/analyzer/classificationRules.ts:65)-[packages/web/src/analyzer/classificationRules.ts:74](/home/ilmaswsl/work/Agent-Factory/packages/web/src/analyzer/classificationRules.ts:74) has no code caller.

Recommendation: delete only the `classificationRules` export. Expected delta: about -10 lines. Risk: low.

## Duplication — logic or constant lists maintained in 2+ places

### 1. Analyzer/schema/validator enum alignment is mostly convention, not enforced by a dedicated alignment test

Evidence that repo docs require alignment:

```bash
$ rg -n "alignment|aligned|moduleCategories|adapterKinds|workflowKinds|GRAPH_NODE_KINDS|GRAPH_INVOKE_BINDINGS|A2A_RUNTIME_AUTH_MODES|constants\.mjs|schemas/.*schema|schema\.json" packages/web/src/analyzer/*.test.ts packages/web/server/*.test.ts scripts/**/*.test.mjs scripts/*.test.mjs docs/workbench docs/decision-log.md
docs/workbench/agent-factory-harness.md:264:- schemas, validator, analyzer types, and UI labels remain aligned when any enum changes
```

The same search did not find a test that mechanically compares `packages/web/src/analyzer/types.ts`, `schemas/*.json`, and `scripts/artifact-validation/constants.mjs`; it found only scenario/regression tests and docs/decision-log mentions. The local policy also says analyzer enums must stay aligned with schemas and validator ([packages/web/src/analyzer/AGENTS.md:21](/home/ilmaswsl/work/Agent-Factory/packages/web/src/analyzer/AGENTS.md:21)); schema policy says the same ([schemas/AGENTS.md:20](/home/ilmaswsl/work/Agent-Factory/schemas/AGENTS.md:20)); script policy says validator constants are duplicated and must be updated together ([scripts/AGENTS.md:19](/home/ilmaswsl/work/Agent-Factory/scripts/AGENTS.md:19)).

Direct enum duplication evidence:

```bash
$ rg -n "moduleCategories|adapterKinds|agentKinds|workflowKinds|remoteContractKinds|riskSignals|graphNodeKinds|graphEdgeKinds|graphInvokeBindings|a2aRuntimeAuthModes|a2aRuntimeFallbackModes" scripts/artifact-validation/constants.mjs packages/web/src/analyzer/types.ts schemas/*.json
scripts/artifact-validation/constants.mjs:2:export const adapterKinds = new Set([
scripts/artifact-validation/constants.mjs:12:export const agentKinds = new Set(["specialist", "shared"]);
scripts/artifact-validation/constants.mjs:13:export const workflowKinds = new Set([
scripts/artifact-validation/constants.mjs:33:export const graphNodeKinds = new Set([
scripts/artifact-validation/constants.mjs:60:export const graphEdgeKinds = new Set([
scripts/artifact-validation/constants.mjs:99:export const graphInvokeBindings = new Set([
scripts/artifact-validation/constants.mjs:187:export const a2aRuntimeAuthModes = new Set(["none", "bearer_env", "metadata_env"]);
scripts/artifact-validation/constants.mjs:188:export const a2aRuntimeFallbackModes = new Set(["none", "manual_review", "local_event"]);
packages/web/src/analyzer/types.ts:1:export const moduleCategories = ["agent", "workflow", "adapter", "remote_a2a"] as const;
packages/web/src/analyzer/types.ts:3:export const adapterKinds = [
packages/web/src/analyzer/types.ts:14:export const agentKinds = ["specialist", "shared"] as const;
packages/web/src/analyzer/types.ts:16:export const workflowKinds = [
packages/web/src/analyzer/types.ts:23:export const remoteContractKinds = ["a2a", "unknown"] as const;
packages/web/src/analyzer/types.ts:30:export const riskSignals = [
packages/web/src/analyzer/types.ts:172:export type ModuleCategory = (typeof moduleCategories)[number];
packages/web/src/analyzer/types.ts:173:export type AdapterKind = (typeof adapterKinds)[number];
packages/web/src/analyzer/types.ts:174:export type AgentKind = (typeof agentKinds)[number];
packages/web/src/analyzer/types.ts:175:export type WorkflowKind = (typeof workflowKinds)[number];
packages/web/src/analyzer/types.ts:176:export type RemoteContractKind = (typeof remoteContractKinds)[number];
packages/web/src/analyzer/types.ts:180:export type RiskSignal = (typeof riskSignals)[number];
```

Representative schema enum evidence:

```bash
$ rg -n '"enum": \["agent", "workflow", "adapter", "remote_a2a"\]|"enum": \["orchestration", "graph", "dynamic", "unknown"\]|"legacy_api"|"remote_agent_call"|"mcp_toolset"' schemas/analysis-result.schema.json schemas/module-candidate.schema.json schemas/process-flow.schema.json
schemas/process-flow.schema.json:70:        "remote_agent_call",
schemas/process-flow.schema.json:147:        "mcp_toolset",
schemas/module-candidate.schema.json:315:      "enum": ["agent", "workflow", "adapter", "remote_a2a"]
schemas/module-candidate.schema.json:323:      "enum": ["orchestration", "graph", "dynamic", "unknown"]
schemas/module-candidate.schema.json:328:        "legacy_api",
schemas/module-candidate.schema.json:420:      "adapter_kind": "legacy_api",
schemas/analysis-result.schema.json:399:          "enum": ["agent", "workflow", "adapter", "remote_a2a"]
schemas/analysis-result.schema.json:408:              "enum": ["orchestration", "graph", "dynamic", "unknown"]
schemas/analysis-result.schema.json:418:                "legacy_api",
schemas/analysis-result.schema.json:861:            "remote_agent_call",
schemas/analysis-result.schema.json:911:                "mcp_toolset",
```

```bash
$ rg -n '"bearer_env"|"metadata_env"|"manual_review"|"local_event"' schemas/analysis-result.schema.json schemas/a2a-contract.schema.json packages/web/src/analyzer/types.ts scripts/artifact-validation/constants.mjs
scripts/artifact-validation/constants.mjs:187:export const a2aRuntimeAuthModes = new Set(["none", "bearer_env", "metadata_env"]);
scripts/artifact-validation/constants.mjs:188:export const a2aRuntimeFallbackModes = new Set(["none", "manual_review", "local_event"]);
packages/web/src/analyzer/types.ts:98:export const A2A_RUNTIME_AUTH_MODES = ["none", "bearer_env", "metadata_env"] as const;
packages/web/src/analyzer/types.ts:99:export const A2A_RUNTIME_FALLBACK_MODES = ["none", "manual_review", "local_event"] as const;
schemas/a2a-contract.schema.json:217:            "mode": { "type": "string", "enum": ["none", "bearer_env", "metadata_env"] },
schemas/a2a-contract.schema.json:248:            "mode": { "type": "string", "enum": ["none", "manual_review", "local_event"] },
schemas/analysis-result.schema.json:686:                "mode": { "type": "string", "enum": ["none", "bearer_env", "metadata_env"] },
schemas/analysis-result.schema.json:717:                "mode": { "type": "string", "enum": ["none", "manual_review", "local_event"] },
```

Recommendation: keep validator-side duplication deliberate because root scripts must not import web package build output ([scripts/AGENTS.md:14](/home/ilmaswsl/work/Agent-Factory/scripts/AGENTS.md:14)), but add a small dependency-free alignment check or fixture that compares exported analyzer arrays to validator constants and selected schema enums. Canonical owner should be `packages/web/src/analyzer/types.ts` for web code and generated checked snapshots for `scripts/artifact-validation/constants.mjs`/schemas. Risk: low to medium, because this changes tests/scripts rather than runtime behavior.

### 2. `codexAnalyzer.ts` duplicates taxonomy sets that already exist in `types.ts`

Evidence:

```bash
$ rg -n "\b(moduleCategories|adapterKinds|agentKinds|workflowKinds|remoteContractKinds|riskSignals)\b" packages/web/server/codexAnalyzer.ts packages/web/src/analyzer/types.ts
packages/web/src/analyzer/types.ts:1:export const moduleCategories = ["agent", "workflow", "adapter", "remote_a2a"] as const;
packages/web/src/analyzer/types.ts:3:export const adapterKinds = [
packages/web/src/analyzer/types.ts:14:export const agentKinds = ["specialist", "shared"] as const;
packages/web/src/analyzer/types.ts:16:export const workflowKinds = [
packages/web/src/analyzer/types.ts:23:export const remoteContractKinds = ["a2a", "unknown"] as const;
packages/web/src/analyzer/types.ts:30:export const riskSignals = [
packages/web/server/codexAnalyzer.ts:24:const moduleCategories = new Set(["agent", "workflow", "adapter", "remote_a2a"]);
packages/web/server/codexAnalyzer.ts:25:const adapterKinds = new Set([
packages/web/server/codexAnalyzer.ts:35:const agentKinds = new Set(["specialist", "shared"]);
packages/web/server/codexAnalyzer.ts:36:const workflowKinds = new Set(["orchestration", "graph", "dynamic", "unknown"]);
packages/web/server/codexAnalyzer.ts:37:const remoteContractKinds = new Set(["a2a", "unknown"]);
packages/web/server/codexAnalyzer.ts:50:const riskSignals = new Set([
```

`codexAnalyzer.ts` already imports graph constants from `types.ts` ([packages/web/server/codexAnalyzer.ts:5](/home/ilmaswsl/work/Agent-Factory/packages/web/server/codexAnalyzer.ts:5)), then locally redeclares taxonomy/risk sets at [packages/web/server/codexAnalyzer.ts:23](/home/ilmaswsl/work/Agent-Factory/packages/web/server/codexAnalyzer.ts:23)-[packages/web/server/codexAnalyzer.ts:59](/home/ilmaswsl/work/Agent-Factory/packages/web/server/codexAnalyzer.ts:59). That duplication is not necessary inside `packages/web`; dependency-free constraints apply to root scripts, not this server module.

Recommendation: import the existing arrays from `types.ts` and construct local `ReadonlySet`s from them. Canonical copy: `packages/web/src/analyzer/types.ts`. Expected delta: about -25 lines. Risk: low.

### 3. `scaffoldPlan.ts` redeclares Graph metadata sets already exported by `types.ts`

Evidence:

```bash
$ rg -n "\b(GRAPH_INVOKE_BINDINGS|GRAPH_DECISION_OWNERS|GRAPH_CALL_CONTROLS|GRAPH_SIDE_EFFECTS|GRAPH_POLICIES|GRAPH_FLOW_KINDS)\b" packages/web/src/analyzer/scaffoldPlan.ts packages/web/src/analyzer/types.ts
packages/web/src/analyzer/types.ts:739:export const GRAPH_INVOKE_BINDINGS = [
packages/web/src/analyzer/types.ts:753:export const GRAPH_DECISION_OWNERS = [
packages/web/src/analyzer/types.ts:762:export const GRAPH_CALL_CONTROLS = [
packages/web/src/analyzer/types.ts:772:export const GRAPH_FLOW_KINDS = [
packages/web/src/analyzer/types.ts:786:export const GRAPH_SIDE_EFFECTS = [
packages/web/src/analyzer/types.ts:795:export const GRAPH_POLICIES = [
packages/web/src/analyzer/scaffoldPlan.ts:242:const GRAPH_INVOKE_BINDINGS = new Set([
packages/web/src/analyzer/scaffoldPlan.ts:256:const GRAPH_DECISION_OWNERS = new Set(["workflow_code", "llm", "human", "remote_agent", "system", "unknown"]);
packages/web/src/analyzer/scaffoldPlan.ts:258:const GRAPH_CALL_CONTROLS = new Set([
packages/web/src/analyzer/scaffoldPlan.ts:268:const GRAPH_SIDE_EFFECTS = new Set(["none", "read", "write", "external_message", "transaction", "unknown"]);
packages/web/src/analyzer/scaffoldPlan.ts:270:const GRAPH_POLICIES = new Set([
packages/web/src/analyzer/scaffoldPlan.ts:284:const GRAPH_FLOW_KINDS = new Set([
```

The duplicate sets drive the normalizers at [packages/web/src/analyzer/scaffoldPlan.ts:298](/home/ilmaswsl/work/Agent-Factory/packages/web/src/analyzer/scaffoldPlan.ts:298)-[packages/web/src/analyzer/scaffoldPlan.ts:324](/home/ilmaswsl/work/Agent-Factory/packages/web/src/analyzer/scaffoldPlan.ts:324). `graphMigration.ts` already follows the better pattern: import arrays from `types.ts` and construct local sets ([packages/web/src/analyzer/graphMigration.ts:7](/home/ilmaswsl/work/Agent-Factory/packages/web/src/analyzer/graphMigration.ts:7), [packages/web/src/analyzer/graphMigration.ts:45](/home/ilmaswsl/work/Agent-Factory/packages/web/src/analyzer/graphMigration.ts:45)-[packages/web/src/analyzer/graphMigration.ts:50](/home/ilmaswsl/work/Agent-Factory/packages/web/src/analyzer/graphMigration.ts:50)).

Recommendation: replace local literal sets with imports from `types.ts` and local `ReadonlySet`s. Canonical copy: `types.ts`. Expected delta: about -45 lines. Risk: low.

### 4. `a2aNormalize.ts` redeclares A2A runtime-policy mode arrays already exported by `types.ts`

Evidence:

```bash
$ rg -n "\b(A2A_RUNTIME_AUTH_MODES|A2A_RUNTIME_FALLBACK_MODES)\b" . --glob '!node_modules/**'
./packages/web/src/analyzer/a2aNormalize.ts:53:const A2A_RUNTIME_AUTH_MODES = ["none", "bearer_env", "metadata_env"] as const;
./packages/web/src/analyzer/a2aNormalize.ts:54:const A2A_RUNTIME_FALLBACK_MODES = ["none", "manual_review", "local_event"] as const;
./packages/web/src/analyzer/types.ts:98:export const A2A_RUNTIME_AUTH_MODES = ["none", "bearer_env", "metadata_env"] as const;
./packages/web/src/analyzer/types.ts:99:export const A2A_RUNTIME_FALLBACK_MODES = ["none", "manual_review", "local_event"] as const;
./packages/web/src/design/A2AContractPanel.tsx:10:  A2A_RUNTIME_AUTH_MODES,
./packages/web/src/design/a2aContractValidator.ts:2:import { A2A_RUNTIME_AUTH_MODES, A2A_RUNTIME_FALLBACK_MODES } from "../analyzer/types";
```

`a2aNormalize.ts` uses its local arrays to normalize `adk_runtime_policy` ([packages/web/src/analyzer/a2aNormalize.ts:359](/home/ilmaswsl/work/Agent-Factory/packages/web/src/analyzer/a2aNormalize.ts:359)-[packages/web/src/analyzer/a2aNormalize.ts:360](/home/ilmaswsl/work/Agent-Factory/packages/web/src/analyzer/a2aNormalize.ts:360)); the UI and validator code use the canonical exported values.

Recommendation: import `A2A_RUNTIME_AUTH_MODES` and `A2A_RUNTIME_FALLBACK_MODES` from `types.ts`. Canonical copy: `types.ts`. Expected delta: -2 local declarations, +import names. Risk: low.

### 5. Graph IR structural validation is maintained twice with drift risk

Evidence:

```bash
$ rg -n "validateGraphIR|validateOptionalEnumValue|route_aliases|human_input_contract|callback_wait|llm_toolset_requires_agent_node|remote_link_incoherent|parallel_region" scripts/validate-artifacts.mjs packages/web/src/analyzer/graphMigration.ts
packages/web/src/analyzer/graphMigration.ts:756: * Soft structural validation. Mirrors validate-artifacts.mjs `validateGraphIR`
packages/web/src/analyzer/graphMigration.ts:761:export function validateGraphIRSoft(
scripts/validate-artifacts.mjs:200:function validateGraphIR(graph, label, candidatesById, contractsById) {
scripts/validate-artifacts.mjs:292:    validateOptionalEnumValue(node.invoke_binding, graphInvokeBindings, `${label}.nodes[${index}] (${node.id}).invoke_binding`);
scripts/validate-artifacts.mjs:533:  // callback_wait nodes are design-time pause/resume controls. They must point
scripts/validate-artifacts.mjs:607:  if (node.node_kind !== "human_input" && node.human_input_contract !== undefined && node.human_input_contract !== null) {
scripts/validate-artifacts.mjs:841:  if (Array.isArray(edge.route_aliases)) {
```

The root validator enforces native Graph IR and rejects legacy node/edge keys ([scripts/validate-artifacts.mjs:259](/home/ilmaswsl/work/Agent-Factory/scripts/validate-artifacts.mjs:259)-[scripts/validate-artifacts.mjs:263](/home/ilmaswsl/work/Agent-Factory/scripts/validate-artifacts.mjs:263), [scripts/validate-artifacts.mjs:421](/home/ilmaswsl/work/Agent-Factory/scripts/validate-artifacts.mjs:421)-[scripts/validate-artifacts.mjs:424](/home/ilmaswsl/work/Agent-Factory/scripts/validate-artifacts.mjs:424)). The soft validator duplicates most checks as structured UI issues ([packages/web/src/analyzer/graphMigration.ts:761](/home/ilmaswsl/work/Agent-Factory/packages/web/src/analyzer/graphMigration.ts:761)-[packages/web/src/analyzer/graphMigration.ts:1272](/home/ilmaswsl/work/Agent-Factory/packages/web/src/analyzer/graphMigration.ts:1272)). Some differences are deliberate: root validator can use candidate/contract maps and hard-fail remote mismatches ([scripts/validate-artifacts.mjs:455](/home/ilmaswsl/work/Agent-Factory/scripts/validate-artifacts.mjs:455)-[scripts/validate-artifacts.mjs:497](/home/ilmaswsl/work/Agent-Factory/scripts/validate-artifacts.mjs:497)); soft validator emits `remote_link_incoherent` as a warning when endpoint coherence is incomplete ([packages/web/src/analyzer/graphMigration.ts:1149](/home/ilmaswsl/work/Agent-Factory/packages/web/src/analyzer/graphMigration.ts:1149)-[packages/web/src/analyzer/graphMigration.ts:1159](/home/ilmaswsl/work/Agent-Factory/packages/web/src/analyzer/graphMigration.ts:1159)).

Recommendation: keep separate outputs (string CLI errors vs UI `GraphValidationIssue`) but extract a shared rule inventory/name table inside `scripts/artifact-validation` or generated checked fixtures, so new rule codes and enum lists are asserted in both surfaces. Canonical behavior should remain root validator for persisted artifacts; soft validator consumes the same rule metadata. Risk: medium, because error severity/message differences are intentional.

## Over-abstraction / slop — layers, wrappers, option flags, or generalized helpers

### 1. `localA2aGraph.ts` is a one-caller helper module

Evidence:

```bash
$ rg -n "\b(buildRemoteA2ANode|withLocalA2AGraph)\b" . --glob '!node_modules/**'
./packages/web/src/analyzer/localA2aGraph.ts:3:export function buildRemoteA2ANode(label: string, candidateId: string, nodeId: string): GraphNode {
./packages/web/src/analyzer/localA2aGraph.ts:28:export function withLocalA2AGraph(graph: GraphIR, node: GraphNode, contractId: string): GraphIR {
./packages/web/src/analyzer/localA2aProvider.ts:2:import { buildRemoteA2ANode, withLocalA2AGraph } from "./localA2aGraph";
./packages/web/src/analyzer/localA2aProvider.ts:49:  const node = buildRemoteA2ANode(provider.card.name || provider.appName, candidateId, nodeId);
./packages/web/src/analyzer/localA2aProvider.ts:55:      processFlow: withLocalA2AGraph(analysis.processFlow, node, contractId)
```

`localA2aGraph.ts` is 136 lines and exists only for `localA2aProvider.ts`. The helper is not a reusable graph library; it encodes this one import workflow's remote node shape, direct input/output edge split, remote lane, and remote container ([packages/web/src/analyzer/localA2aGraph.ts:3](/home/ilmaswsl/work/Agent-Factory/packages/web/src/analyzer/localA2aGraph.ts:3)-[packages/web/src/analyzer/localA2aGraph.ts:136](/home/ilmaswsl/work/Agent-Factory/packages/web/src/analyzer/localA2aGraph.ts:136)).

Concrete simpler form: inline the two exported functions and private helpers into `localA2aProvider.ts`, or make them private in the same module. Expected delta: likely -15 to -25 lines after removing cross-file imports/exports. Risk: low; the only caller and tests are the provider path.

### 2. Several helpers are exported despite having no external production caller

Evidence:

```bash
$ rg -n "\b(backfillCandidateReviewFields|buildPlaceholderContract|buildRuntimeContractsForCandidate|legacyStageToGraphIR)\b" . --glob '!node_modules/**'
./packages/web/src/analyzer/analysisResultNormalization.ts:14:    moduleCandidates: backfillCandidateReviewFields(withContracts.moduleCandidates)
./packages/web/src/analyzer/analysisResultNormalization.ts:18:export function backfillCandidateReviewFields(candidates: ModuleCandidate[]): ModuleCandidate[] {
./packages/web/src/analyzer/a2aNormalize.ts:101:export function buildPlaceholderContract(contractId: string, remoteModuleId: string): A2AContract {
./packages/web/src/analyzer/a2aNormalize.ts:258:      const minted = buildPlaceholderContract(existingId, typeof candidate.id === "string" ? candidate.id : "");
./packages/web/src/analyzer/a2aNormalize.ts:340:  const contract = buildPlaceholderContract(contractId, candidate.id);
./packages/web/src/analyzer/graphMigration.ts:457:export function legacyStageToGraphIR(input: unknown, requirementId: string): GraphIR {
./packages/web/src/analyzer/graphMigration.ts:671:  const graphIR = legacyStageToGraphIR(input, requirementId);
./packages/web/src/analyzer/runtimeContracts.ts:88:      for (const contract of buildRuntimeContractsForCandidate(candidate, normalizedRequirement)) {
./packages/web/src/analyzer/runtimeContracts.ts:109:export function buildRuntimeContractsForCandidate(
```

These functions have internal call sites but no production callers outside their defining modules. `buildRuntimeContractsForCandidate` is also imported by `scaffoldPlan.test.ts` only, not by runtime code, from the earlier search output:

```bash
$ rg -n "\b(ensureRuntimeContracts|buildRuntimeContracts|buildRuntimeContractsForCandidate|runtimeContractReadinessIssues)\b" . --glob '!node_modules/**'
./packages/web/src/analyzer/scaffoldPlan.test.ts:3:import { buildRuntimeContracts, runtimeContractReadinessIssues } from "./runtimeContracts.ts";
./packages/web/src/analyzer/runtimeContracts.ts:88:      for (const contract of buildRuntimeContractsForCandidate(candidate, normalizedRequirement)) {
./packages/web/src/analyzer/runtimeContracts.ts:109:export function buildRuntimeContractsForCandidate(
```

Concrete simpler form: remove `export` from internal helpers and test through public boundaries (`normalizeAnalysisResultForWorkbench`, `normalizeA2A`, `buildRuntimeContracts`, `normalizeGraphIRForRuntime`) unless a test truly needs the smaller seam. Risk: low for export removal if no external package API is promised; medium for `buildRuntimeContractsForCandidate` if reviewers rely on direct helper tests.

## Simplifications — behavior-preserving rewrites worth doing

### 1. `runtimeContracts.ts`: hoist repeated heuristic calls in `buildAdkCallbackContract`

At [packages/web/src/analyzer/runtimeContracts.ts:550](/home/ilmaswsl/work/Agent-Factory/packages/web/src/analyzer/runtimeContracts.ts:550)-[packages/web/src/analyzer/runtimeContracts.ts:572](/home/ilmaswsl/work/Agent-Factory/packages/web/src/analyzer/runtimeContracts.ts:572), `buildAdkCallbackContract` calls `needsAsyncRuntimeSupport(candidate, _requirement)` twice and `isWriteLike(candidate, _requirement)` three times. Both helpers recompute `evidenceText` ([packages/web/src/analyzer/runtimeContracts.ts:373](/home/ilmaswsl/work/Agent-Factory/packages/web/src/analyzer/runtimeContracts.ts:373)-[packages/web/src/analyzer/runtimeContracts.ts:384](/home/ilmaswsl/work/Agent-Factory/packages/web/src/analyzer/runtimeContracts.ts:384), [packages/web/src/analyzer/runtimeContracts.ts:663](/home/ilmaswsl/work/Agent-Factory/packages/web/src/analyzer/runtimeContracts.ts:663)-[packages/web/src/analyzer/runtimeContracts.ts:672](/home/ilmaswsl/work/Agent-Factory/packages/web/src/analyzer/runtimeContracts.ts:672)).

Rewrite: compute `const async = needsAsyncRuntimeSupport(...)` and `const write = isWriteLike(...)` once at the top of `buildAdkCallbackContract`, mirroring `buildLegacyAdapterContract` ([packages/web/src/analyzer/runtimeContracts.ts:387](/home/ilmaswsl/work/Agent-Factory/packages/web/src/analyzer/runtimeContracts.ts:387)-[packages/web/src/analyzer/runtimeContracts.ts:390](/home/ilmaswsl/work/Agent-Factory/packages/web/src/analyzer/runtimeContracts.ts:390)). Effort: S. Risk: low. Expected delta: neutral to -3.

### 2. `scaffoldPlan.ts`: avoid three full edge scans per loop-control node

At [packages/web/src/analyzer/scaffoldPlan.ts:553](/home/ilmaswsl/work/Agent-Factory/packages/web/src/analyzer/scaffoldPlan.ts:553)-[packages/web/src/analyzer/scaffoldPlan.ts:583](/home/ilmaswsl/work/Agent-Factory/packages/web/src/analyzer/scaffoldPlan.ts:583), `collectRunnableDynamicBlockers` filters all edges once for outgoing edges, then filters outgoing edges twice more for back/exit edges, then allocates a combined array for missing-decision checks.

Rewrite: single-pass group outgoing edges by `from`, then for each loop control accumulate `hasBack`, `hasExit`, and `missingDecision` in one loop. Effort: S. Risk: low; this is behavior-preserving and only changes local iteration. Expected delta: neutral to -8 lines.

### 3. `graphMigration.ts`: make legacy-stage conversion private or remove after fixture cleanup

`legacyStageToGraphIR` is exported at [packages/web/src/analyzer/graphMigration.ts:457](/home/ilmaswsl/work/Agent-Factory/packages/web/src/analyzer/graphMigration.ts:457) but the only non-test call is `normalizeGraphIRForRuntime` ([packages/web/src/analyzer/graphMigration.ts:670](/home/ilmaswsl/work/Agent-Factory/packages/web/src/analyzer/graphMigration.ts:670)-[packages/web/src/analyzer/graphMigration.ts:671](/home/ilmaswsl/work/Agent-Factory/packages/web/src/analyzer/graphMigration.ts:671)).

Rewrite: short term, remove the export and cover it through `normalizeGraphIRForRuntime`; longer term, delete the old stage-flow conversion branch once old artifacts are no longer accepted (see graphMigration assessment). Effort: S for export cleanup; M for conversion removal. Risk: low for export cleanup, medium for conversion removal.

### 4. `analysisArtifactImport.test.ts`: remove export-helper dependency

The importer test currently imports exporter helpers only to create a modified artifact and check trailing newline serialization ([packages/web/src/analyzer/analysisArtifactImport.test.ts:3](/home/ilmaswsl/work/Agent-Factory/packages/web/src/analyzer/analysisArtifactImport.test.ts:3), [packages/web/src/analyzer/analysisArtifactImport.test.ts:17](/home/ilmaswsl/work/Agent-Factory/packages/web/src/analyzer/analysisArtifactImport.test.ts:17)-[packages/web/src/analyzer/analysisArtifactImport.test.ts:29](/home/ilmaswsl/work/Agent-Factory/packages/web/src/analyzer/analysisArtifactImport.test.ts:29)).

Rewrite: inline the fixture object and, if newline behavior matters, assert it in whichever production exporter actually writes artifacts. If there is no production exporter, remove the newline assertion with the helper file. Effort: S. Risk: low.

## graphMigration assessment — artifact vintages and removable migration steps

### What vintages it migrates or validates

1. Pre-Graph IR/non-record or legacy stage-flow shapes: `legacyStageToGraphIR` returns empty Graph IR for non-record input and warns with `migrated_from_legacy_stage_shape` ([packages/web/src/analyzer/graphMigration.ts:457](/home/ilmaswsl/work/Agent-Factory/packages/web/src/analyzer/graphMigration.ts:457)-[packages/web/src/analyzer/graphMigration.ts:479](/home/ilmaswsl/work/Agent-Factory/packages/web/src/analyzer/graphMigration.ts:479)), or converts old `nodes[].type`, `edges[].data_channel`, `edges[].edge_type`, and `edges[].data` into native fields ([packages/web/src/analyzer/graphMigration.ts:499](/home/ilmaswsl/work/Agent-Factory/packages/web/src/analyzer/graphMigration.ts:499)-[packages/web/src/analyzer/graphMigration.ts:600](/home/ilmaswsl/work/Agent-Factory/packages/web/src/analyzer/graphMigration.ts:600)).

2. Early native Graph IR missing containers/lanes: `normalizeGraphIRForRuntime` accepts Graph-IR-shaped inputs and canonicalizes nodes/edges/containers ([packages/web/src/analyzer/graphMigration.ts:482](/home/ilmaswsl/work/Agent-Factory/packages/web/src/analyzer/graphMigration.ts:482)-[packages/web/src/analyzer/graphMigration.ts:483], [packages/web/src/analyzer/graphMigration.ts:670](/home/ilmaswsl/work/Agent-Factory/packages/web/src/analyzer/graphMigration.ts:670)-[packages/web/src/analyzer/graphMigration.ts:752]). Two template regression scenarios still have native `node_kind`/`edge_kind` but empty `containers`/`lanes`:

```bash
$ rg -n '"containers"\s*:\s*\[\]|"lanes"\s*:\s*\[\]' artifacts/af/*/analysis-result.json artifacts/af/*/process-flow.json templates --glob '*.json'
templates/regression-scenarios/scenario-k-reused-adapter-module/analysis-result.json:298:    "containers": [],
templates/regression-scenarios/scenario-k-reused-adapter-module/analysis-result.json:299:    "lanes": [],
templates/regression-scenarios/scenario-j-workflow-call-mock-lab/analysis-result.json:310:    "containers": [],
templates/regression-scenarios/scenario-j-workflow-call-mock-lab/analysis-result.json:311:    "lanes": [],
```

3. Current Graph IR metadata normalization: positions, `human_input_contract`, route aliases/default routes, remote-agent call nodes, and reviewed ADK fields are present in active artifacts/templates, so the corresponding normalization/soft validation is still live.

```bash
$ rg -n '"position"\s*:|"human_input_contract"\s*:|"route_aliases"\s*:|"is_default_route"\s*:|"callback_wait"|"mcp_toolset"|"remote_agent_call"' artifacts/af/*/analysis-result.json artifacts/af/*/process-flow.json templates/process-flow.json templates/regression-scenarios/*/analysis-result.json templates/regression-scenarios/*/scaffold-plan.json --glob '*.json'
templates/process-flow.json:20:      "human_input_contract": null
templates/process-flow.json:87:      "route_aliases": [],
templates/process-flow.json:88:      "is_default_route": false
templates/regression-scenarios/wf-page-recommendation-required/analysis-result.json:1321:        "position": {
templates/regression-scenarios/wf-page-recommendation-required/analysis-result.json:1358:        "human_input_contract": {
templates/regression-scenarios/scenario-d-graph-workflow/analysis-result.json:788:        "route_aliases": [
artifacts/af/req-page-recommendation-a2a-consumer/process-flow.json:90:      "node_kind": "remote_agent_call",
artifacts/af/req-page-recommendation-required/process-flow.json:72:      "human_input_contract": {
artifacts/af/req-page-recommendation-required/process-flow.json:965:      "route_aliases": [
```

4. Soft validation mirrors root validator checks for UI: duplicate/dangling IDs, invalid enum metadata, module-bound connectivity, route aliases/default route rules, human input contract shape, remote A2A edges, container IDs, dynamic/parallel/loop regions ([packages/web/src/analyzer/graphMigration.ts:761](/home/ilmaswsl/work/Agent-Factory/packages/web/src/analyzer/graphMigration.ts:761)-[packages/web/src/analyzer/graphMigration.ts:1272]).

### What appears removable now

The oldest stage-flow conversion appears removable from live artifacts/templates:

```bash
$ rg -n '"data_channel"\s*:|"edge_type"\s*:|"type"\s*:\s*"(input|output|agent|workflow|adapter|remote_a2a)"' artifacts/af/*/analysis-result.json artifacts/af/*/process-flow.json templates --glob '*.json'
# no output
```

Root validation already rejects these legacy keys in persisted Graph IR ([scripts/validate-artifacts.mjs:259](/home/ilmaswsl/work/Agent-Factory/scripts/validate-artifacts.mjs:259)-[scripts/validate-artifacts.mjs:263], [scripts/validate-artifacts.mjs:421](/home/ilmaswsl/work/Agent-Factory/scripts/validate-artifacts.mjs:421)-[scripts/validate-artifacts.mjs:424]). If importer compatibility with older external saved files is no longer required, delete `legacyStageToGraphIR`'s old `type`/`data_channel`/`edge_type` conversion and let `normalizeGraphIRForRuntime` accept only native Graph IR. Expected delta: roughly -180 lines from [packages/web/src/analyzer/graphMigration.ts:448](/home/ilmaswsl/work/Agent-Factory/packages/web/src/analyzer/graphMigration.ts:448)-[packages/web/src/analyzer/graphMigration.ts:663]. Risk: medium because browser import may still accept out-of-repo old artifacts.

### What should stay for now

Keep current Graph IR normalization for route aliases/default routes, human input contracts, node positions, remote-agent calls, and callback/toolset validation. Active roots and templates contain these fields, and tests target them directly ([packages/web/src/analyzer/graphMigration.test.ts:379](/home/ilmaswsl/work/Agent-Factory/packages/web/src/analyzer/graphMigration.test.ts:379)-[packages/web/src/analyzer/graphMigration.test.ts:421], [packages/web/src/analyzer/graphMigration.test.ts:645](/home/ilmaswsl/work/Agent-Factory/packages/web/src/analyzer/graphMigration.test.ts:645)-[packages/web/src/analyzer/graphMigration.test.ts:721]).

HYPOTHESIS: after rewriting the two regression fixtures with empty `containers`/`lanes`, some container/lane fallback logic in `normalizeGraphIRForRuntime` becomes removable, but I would not delete it until those fixtures are updated and `process-flow.json`/active roots are revalidated.

## Ranked action list — top 10 by value/effort

1. Delete `packages/web/src/analyzer/commonization.ts`.
   Files: `packages/web/src/analyzer/commonization.ts`. Expected line delta: -73. Risk: low.

2. Remove the legacy stage-flow conversion branch from `graphMigration.ts` after confirming no external imported artifacts need it.
   Files: `packages/web/src/analyzer/graphMigration.ts`, `packages/web/src/analyzer/graphMigration.test.ts`. Expected line delta: about -180 source, -40 to -80 tests. Risk: medium because browser import compatibility may be broader than in-repo fixtures.

3. Replace `scaffoldPlan.ts` local Graph metadata literals with imports from `types.ts`.
   Files: `packages/web/src/analyzer/scaffoldPlan.ts`. Expected line delta: about -45. Risk: low.

4. Replace `codexAnalyzer.ts` local taxonomy/risk literals with imported analyzer arrays.
   Files: `packages/web/server/codexAnalyzer.ts`. Expected line delta: about -25. Risk: low.

5. Delete `analysisArtifactExport.ts` and inline its test fixture construction.
   Files: `packages/web/src/analyzer/analysisArtifactExport.ts`, `packages/web/src/analyzer/analysisArtifactImport.test.ts`. Expected line delta: about -20 to -26 net. Risk: low.

6. Add a focused enum alignment check for analyzer types, validator constants, and schema enums.
   Files: likely `scripts/validate-artifacts.test.mjs` or a new small root script/test, plus possibly `scripts/artifact-validation/constants.mjs`. Expected line delta: +40 to +90. Risk: low; this adds enforcement rather than runtime behavior.

7. Collapse `localA2aGraph.ts` into `localA2aProvider.ts`.
   Files: `packages/web/src/analyzer/localA2aGraph.ts`, `packages/web/src/analyzer/localA2aProvider.ts`, `packages/web/src/analyzer/localA2aProvider.test.ts`. Expected line delta: -15 to -25 net. Risk: low.

8. Delete the unused `classificationRules` text map.
   Files: `packages/web/src/analyzer/classificationRules.ts`. Expected line delta: -10. Risk: low.

9. Remove unnecessary `export` from internal helpers that have no outside production caller.
   Files: `analysisResultNormalization.ts`, `a2aNormalize.ts`, `runtimeContracts.ts`, `graphMigration.ts`, maybe `moduleReview.ts`. Expected line delta: small, mostly API surface reduction. Risk: low to medium depending on test seam choices.

10. Hoist repeated runtime-contract heuristics and simplify loop-control scanning.
    Files: `packages/web/src/analyzer/runtimeContracts.ts`, `packages/web/src/analyzer/scaffoldPlan.ts`. Expected line delta: -5 to -12. Risk: low.
