import { randomBytes } from "node:crypto";
import { appendFile, mkdir, readdir, readFile, stat, writeFile } from "node:fs/promises";
import { join, relative, resolve, sep } from "node:path";
import { Codex, type ThreadEvent, type ThreadItem, type Usage } from "@openai/codex-sdk";
import type {
  AfRunManifest,
  AfRunStageId,
  AfStageRunManifestEntry,
  AfStageRunStatus
} from "../src/analyzer/afRunManifest";
import { normalizeAnalysisResultForWorkbench } from "../src/analyzer/analysisResultNormalization";
import type { AnalysisResult, CodexAnalyzerModel, ModuleCandidate, ModuleSmokeSpec } from "../src/analyzer/types";
import {
  ArtifactConflictError,
  ArtifactRootStore,
  ArtifactValidationError,
  computeEtag
} from "./artifactRootStore";
import { loadServerScaffoldCatalog } from "./artifactSyncCatalog";
import { runRuntimeStubBuild, type RuntimeStubBuildResult } from "./afRuntimeStubApi";
import {
  normalizeVerifyCommandKey,
  runVerifyCommand,
  type VerifyCommandKey,
  type VerifyCommandResult
} from "./afVerifyRunApi";
import { validateAnalysisResult } from "./validators";

export const skillRunnerStages = ["analyze", "design", "build", "verify"] as const;
export type SkillRunnerStage = (typeof skillRunnerStages)[number];

const RUN_ID_PATTERN = /^\d{8}T\d{6}Z-(analyze|design|build|verify)-[a-f0-9]{6}$/;
const ALLOWED_MODELS = new Set(["gpt-5.5", "gpt-5.4", "gpt-5.4-mini", "gpt-5.3-codex", "gpt-5.3-codex-spark"]);
const DEFAULT_MODEL = "gpt-5.5";

type StageRunnerKind = "codex" | "runtime_stub" | "verify";
type StageCodexMetadataBehavior = "execution_mode_backend" | "none";
type StageApplyAvailability = "diff_artifacts" | "no_artifacts";

interface StageDefinition {
  readonly skillName: string;
  readonly skillPath: string;
  readonly runnerKind: StageRunnerKind;
  readonly proposedArtifactFiles: readonly string[];
  readonly diffAvailable: boolean;
  readonly applyAvailability: StageApplyAvailability;
  readonly requiresDesignReady: boolean;
  readonly commandLabel: (body: StageRunRequestBody) => string;
  readonly codexMetadata: StageCodexMetadataBehavior;
  readonly proposedMessage: string;
  readonly codexOutputInstruction: string;
}

const SERVER_PRIMITIVE_CODEX_INSTRUCTION = "This stage is handled by server-side primitives; do not edit canonical artifacts.";

const STAGE_DEFINITIONS = {
  analyze: {
    skillName: "af-analyze-requirement",
    skillPath: ".agents/skills/af-analyze-requirement/SKILL.md",
    runnerKind: "codex",
    proposedArtifactFiles: ["analysis-result.json"],
    diffAvailable: true,
    applyAvailability: "diff_artifacts",
    requiresDesignReady: false,
    commandLabel: (body) => (body.execution_mode === "fake" ? "fake-runner" : "codex sdk"),
    codexMetadata: "execution_mode_backend",
    proposedMessage: "proposed artifact 생성이 완료되었습니다.",
    codexOutputInstruction: "Write the proposed analysis artifact to proposed-artifacts/analysis-result.json only. Do not edit canonical artifacts."
  },
  design: {
    skillName: "af-design-boundaries",
    skillPath: ".agents/skills/af-design-boundaries/SKILL.md",
    runnerKind: "codex",
    proposedArtifactFiles: ["analysis-result.json", "boundary-design.md"],
    diffAvailable: true,
    applyAvailability: "diff_artifacts",
    requiresDesignReady: true,
    commandLabel: (body) => (body.execution_mode === "fake" ? "fake-runner" : "codex sdk"),
    codexMetadata: "execution_mode_backend",
    proposedMessage: "proposed artifact 생성이 완료되었습니다.",
    codexOutputInstruction:
      "Write proposed-artifacts/analysis-result.json and proposed-artifacts/boundary-design.md only. Do not edit canonical artifacts or approval gates."
  },
  build: {
    skillName: "runtime-stub/build",
    skillPath: "scripts/generate-adk-source.mjs",
    runnerKind: "runtime_stub",
    proposedArtifactFiles: [],
    diffAvailable: false,
    applyAvailability: "no_artifacts",
    requiresDesignReady: false,
    commandLabel: () => "node scripts/generate-adk-source.mjs",
    codexMetadata: "none",
    proposedMessage: "runtime-stub 생성이 완료되었습니다.",
    codexOutputInstruction: SERVER_PRIMITIVE_CODEX_INSTRUCTION
  },
  verify: {
    skillName: "verify/run",
    skillPath: "packages/web/server/afVerifyRunApi.ts",
    runnerKind: "verify",
    proposedArtifactFiles: ["validation-report.md", "catalog-delta.yaml"],
    diffAvailable: true,
    applyAvailability: "diff_artifacts",
    requiresDesignReady: false,
    commandLabel: (body) => `verify ${body.verifyCommand ?? "validate_artifact_root"}`,
    codexMetadata: "none",
    proposedMessage: "proposed artifact 생성이 완료되었습니다.",
    codexOutputInstruction: SERVER_PRIMITIVE_CODEX_INSTRUCTION
  }
} satisfies Record<SkillRunnerStage, StageDefinition>;

export interface StageRunRequestBody {
  execution_mode?: "codex" | "fake";
  model?: string;
  input?: {
    rawText?: string;
    domain?: string;
  };
  catalog?: unknown[];
  verifyCommand?: string;
  streamProgress?: boolean;
}

export interface StageRunEvent {
  phase: "started" | "codex_event" | "process_event" | "proposed" | "validation" | "completed" | "failed" | "canceled";
  message: string;
  at: string;
  elapsedMs: number;
  title?: string;
  snippet?: string;
  rawEventType?: string;
  itemType?: string;
  status?: string;
  toolName?: string;
}

export interface StageRunArtifactDiff {
  path: string;
  proposed_path: string;
  status: "created" | "changed" | "unchanged";
  valid: boolean;
  validation_errors: string[];
  base_etag: string | null;
  proposed_etag: string;
  before_summary: string;
  after_summary: string;
  bytes: number;
}

export interface StageRunDiffSummary {
  files: StageRunArtifactDiff[];
}

export interface StageRunCodexUsage {
  input_tokens: number;
  cached_input_tokens: number;
  output_tokens: number;
  reasoning_output_tokens: number;
}

export interface StageRunCodexMetadata {
  backend: "sdk" | "fake";
  thread_id: string | null;
  event_count: number;
  usage: StageRunCodexUsage | null;
}

export interface StageRunCatalogContext {
  source: "request" | "server_default" | "absent";
  count: number;
  diagnostics: string[];
}

export interface StageRunSummary {
  run_id: string;
  stage: SkillRunnerStage;
  status: AfStageRunStatus;
  skill_name: string;
  model: string;
  started_at: string;
  finished_at: string | null;
  elapsed_ms: number | null;
  output_artifacts: string[];
  validation: {
    ok: boolean;
    errors: string[];
  };
  last_error: string | null;
  catalog_context?: StageRunCatalogContext;
  codex?: StageRunCodexMetadata;
}

export interface StageRunDetail {
  request: unknown;
  summary: StageRunSummary;
  diff_summary: StageRunDiffSummary;
  events: StageRunEvent[];
  proposed_artifacts: Array<{
    path: string;
    canonical_path: string;
    content_type: "application/json" | "text/markdown" | "text/plain";
    preview: string;
    bytes: number;
  }>;
  diagnostics: string | null;
}

export interface RunStageSkillInput {
  repoRoot: string;
  store: ArtifactRootStore;
  reqId: string;
  stage: string;
  body: StageRunRequestBody;
  onEvent?: (event: StageRunEvent) => void;
  codexRunner?: CodexStageRunner;
  primitiveRunner?: StagePrimitiveRunner;
  signal?: AbortSignal;
}

export interface CodexStageRunnerInput {
  repoRoot: string;
  rootDir: string;
  runDir: string;
  proposedDir: string;
  stage: SkillRunnerStage;
  skillPath: string;
  model: string;
  signal?: AbortSignal;
  emit: (event: Omit<StageRunEvent, "at" | "elapsedMs">) => Promise<void>;
}

export interface CodexStageRunner {
  run(input: CodexStageRunnerInput): Promise<StageRunCodexMetadata>;
}

export interface StagePrimitiveRunnerInput {
  repoRoot: string;
  store: ArtifactRootStore;
  reqId: string;
  rootDir: string;
  runDir: string;
  proposedDir: string;
  stage: SkillRunnerStage;
  model: string;
  body: StageRunRequestBody;
  signal?: AbortSignal;
  emit: (event: Omit<StageRunEvent, "at" | "elapsedMs">) => Promise<void>;
}

export interface StagePrimitiveVerifyInput extends StagePrimitiveRunnerInput {
  commandKey: VerifyCommandKey;
}

export interface StagePrimitiveRunner {
  build(input: StagePrimitiveRunnerInput): Promise<RuntimeStubBuildResult>;
  verify(input: StagePrimitiveVerifyInput): Promise<VerifyCommandResult>;
}

class StageRunCanceledError extends Error {
  constructor() {
    super("stage run canceled");
    this.name = "StageRunCanceledError";
  }
}

const defaultPrimitiveRunner: StagePrimitiveRunner = {
  async build(input) {
    return await runRuntimeStubBuild({
      repoRoot: input.repoRoot,
      store: input.store,
      reqId: input.reqId,
      signal: input.signal,
      onStdout: (chunk) =>
        void input.emit({ phase: "process_event", title: "stdout", message: "runtime-stub stdout", snippet: chunk }),
      onStderr: (chunk) =>
        void input.emit({ phase: "process_event", title: "stderr", message: "runtime-stub stderr", snippet: chunk })
    });
  },
  async verify(input) {
    return await runVerifyCommand({
      repoRoot: input.repoRoot,
      store: input.store,
      reqId: input.reqId,
      commandKey: input.commandKey,
      signal: input.signal,
      onStdout: (chunk) =>
        void input.emit({ phase: "process_event", title: "stdout", message: "verify stdout", snippet: chunk }),
      onStderr: (chunk) =>
        void input.emit({ phase: "process_event", title: "stderr", message: "verify stderr", snippet: chunk })
    });
  }
};

export async function runStageSkill(input: RunStageSkillInput): Promise<StageRunSummary> {
  const stage = assertSkillRunnerStage(input.stage);
  const model = normalizeModel(input.body.model);
  const definition = STAGE_DEFINITIONS[stage];
  const runId = createRunId(stage);
  const rootDir = input.store.resolveRootDir(input.reqId);
  const runDir = resolveRunDir(input.store, input.reqId, stage, runId);
  const proposedDir = join(runDir, "proposed-artifacts");
  const startedAt = new Date();
  const catalogSnapshot = await hydrateStageRunCatalog(input.repoRoot, input.body);
  const body = catalogSnapshot.body;
  const request = buildRequestSnapshot({
    reqId: input.reqId,
    stage,
    runId,
    model,
    skillName: definition.skillName,
    body,
    catalogContext: catalogSnapshot.context
  });
  const events: StageRunEvent[] = [];
  let appendChain: Promise<void> = Promise.resolve();
  const emit = async (event: Omit<StageRunEvent, "at" | "elapsedMs">) => {
    const full: StageRunEvent = {
      ...event,
      at: new Date().toISOString(),
      elapsedMs: Date.now() - startedAt.getTime()
    };
    events.push(full);
    input.onEvent?.(full);
    appendChain = appendChain.then(() => appendEvent(runDir, full));
    await appendChain;
  };

  await mkdir(proposedDir, { recursive: true });
  await writeJsonFile(join(runDir, "request.json"), request);
  await emit({
    phase: "started",
    message: `${definition.skillName} 실행을 시작했습니다.`,
    title: "stage run started"
  });

  let status: AfStageRunStatus = "completed";
  let lastError: string | null = null;
  let diagnostics: string | null = null;
  let codexMetadata = createInitialCodexMetadata(definition, body);
  let outputArtifacts: string[] = [];
  let validationErrors: string[] = [];
  try {
    assertNotCanceled(input.signal);
    if (definition.requiresDesignReady) {
      await assertDesignReady(input.store, input.reqId);
    }

    switch (definition.runnerKind) {
      case "runtime_stub": {
        const result = await runBuildPrimitiveStage({
          input,
          body,
          stage,
          model,
          rootDir,
          runDir,
          proposedDir,
          emit
        });
        outputArtifacts = result.files.map((file) => `runtime-stub/${file.path}`);
        break;
      }
      case "verify": {
        const result = await runVerifyPrimitiveStage({
          input,
          body,
          stage,
          model,
          rootDir,
          runDir,
          proposedDir,
          emit
        });
        validationErrors = result.ok ? [] : [`verify command failed with exit code ${result.exit_code}`];
        await writeVerifyProposedArtifacts({ proposedDir, reqId: input.reqId, runId, result });
        break;
      }
      case "codex":
        if (body.execution_mode === "fake") {
          await runFakeStage({ store: input.store, reqId: input.reqId, stage, body, proposedDir, emit });
        } else {
          const runner = input.codexRunner ?? new SdkCodexStageRunner();
          codexMetadata = await runner.run({
            repoRoot: input.repoRoot,
            rootDir,
            runDir,
            proposedDir,
            stage,
            skillPath: definition.skillPath,
            model,
            signal: input.signal,
            emit
          });
        }
        break;
      default:
        assertNever(definition);
    }
    assertNotCanceled(input.signal);
    await emit({
      phase: "proposed",
      message: definition.proposedMessage,
      title: "proposed artifacts"
    });
  } catch (error) {
    const canceled = error instanceof StageRunCanceledError;
    status = canceled ? "canceled" : "failed";
    lastError = canceled ? "stage run canceled" : error instanceof Error ? error.message : "stage run failed";
    diagnostics = formatDiagnostics({
      reqId: input.reqId,
      stage,
      model,
      skillName: definition.skillName,
      command: commandNameForStage(stage, body),
      startedAt,
      finishedAt: new Date(),
      error: lastError
    });
    await writeFile(join(runDir, "diagnostics.md"), diagnostics, "utf8");
    await emit({
      phase: canceled ? "canceled" : "failed",
      message: lastError,
      title: canceled ? "stage run canceled" : "stage run failed"
    });
  }

  let diffSummary: StageRunDiffSummary = { files: [] };
  if (status === "completed" && definition.diffAvailable) {
    diffSummary = await buildDiffSummary(input.store, input.reqId, stage, runId);
  }
  if (status === "completed") {
    const artifactValidationErrors = diffSummary.files.flatMap((file) => file.validation_errors);
    validationErrors = [...validationErrors, ...artifactValidationErrors];
    if (artifactValidationErrors.length) {
      status = "failed";
      lastError = `proposed artifact 검증 실패: ${artifactValidationErrors.join("; ")}`;
      diagnostics = formatDiagnostics({
        reqId: input.reqId,
        stage,
        model,
        skillName: definition.skillName,
        command: commandNameForStage(stage, body),
        startedAt,
        finishedAt: new Date(),
        error: lastError
      });
      await writeFile(join(runDir, "diagnostics.md"), diagnostics, "utf8");
      await emit({
        phase: "validation",
        message: lastError,
        title: "validation failed"
      });
    } else {
      if (validationErrors.length) {
        await emit({
          phase: "validation",
          message: validationErrors.join("; "),
          title: "validation failed"
        });
      }
      await emit({
        phase: "completed",
        message: "stage run 이 완료되었습니다. canonical artifact 는 아직 변경되지 않았습니다.",
        title: "stage run completed"
      });
    }
  }

  await writeJsonFile(join(runDir, "diff-summary.json"), diffSummary);
  const finishedAt = new Date();
  const summary: StageRunSummary = {
    run_id: runId,
    stage,
    status,
    skill_name: definition.skillName,
    model,
    started_at: startedAt.toISOString(),
    finished_at: finishedAt.toISOString(),
    elapsed_ms: finishedAt.getTime() - startedAt.getTime(),
    output_artifacts: outputArtifacts.length
      ? outputArtifacts
      : diffSummary.files.map((file) => `runs/${stage}/${runId}/${file.proposed_path}`),
    validation: {
      ok: status === "completed" && validationErrors.length === 0,
      errors: validationErrors
    },
    last_error: lastError,
    catalog_context: catalogSnapshot.context,
    codex: codexMetadata
  };
  await writeJsonFile(join(runDir, "result-summary.json"), summary);
  await updateStageRunManifest(input.store, input.reqId, stage, summary);
  return summary;
}

async function runBuildPrimitiveStage({
  input,
  body,
  stage,
  model,
  rootDir,
  runDir,
  proposedDir,
  emit
}: {
  input: RunStageSkillInput;
  body: StageRunRequestBody;
  stage: SkillRunnerStage;
  model: string;
  rootDir: string;
  runDir: string;
  proposedDir: string;
  emit: (event: Omit<StageRunEvent, "at" | "elapsedMs">) => Promise<void>;
}): Promise<RuntimeStubBuildResult> {
  assertNotCanceled(input.signal);
  const runner = input.primitiveRunner ?? defaultPrimitiveRunner;
  const result = await runner.build({
    repoRoot: input.repoRoot,
    store: input.store,
    reqId: input.reqId,
    rootDir,
    runDir,
    proposedDir,
    stage,
    model,
    body,
    signal: input.signal,
    emit
  });
  assertNotCanceled(input.signal);
  if (!result.ok) {
    throw new Error(`runtime-stub 생성 실패 (exit ${result.exit_code ?? "?"})`);
  }
  return result;
}

async function runVerifyPrimitiveStage({
  input,
  body,
  stage,
  model,
  rootDir,
  runDir,
  proposedDir,
  emit
}: {
  input: RunStageSkillInput;
  body: StageRunRequestBody;
  stage: SkillRunnerStage;
  model: string;
  rootDir: string;
  runDir: string;
  proposedDir: string;
  emit: (event: Omit<StageRunEvent, "at" | "elapsedMs">) => Promise<void>;
}): Promise<VerifyCommandResult> {
  assertNotCanceled(input.signal);
  const commandKey = normalizeVerifyCommandKey(body.verifyCommand) ?? "validate_artifact_root";
  const runner = input.primitiveRunner ?? defaultPrimitiveRunner;
  const result = await runner.verify({
    repoRoot: input.repoRoot,
    store: input.store,
    reqId: input.reqId,
    rootDir,
    runDir,
    proposedDir,
    stage,
    model,
    body,
    commandKey,
    signal: input.signal,
    emit
  });
  assertNotCanceled(input.signal);
  return result;
}

export async function listStageRuns({
  store,
  reqId,
  stage
}: {
  store: ArtifactRootStore;
  reqId: string;
  stage: string;
}): Promise<StageRunSummary[]> {
  const safeStage = assertSkillRunnerStage(stage);
  const stageDir = resolveStageRunDir(store, reqId, safeStage);
  const entries = await readdir(stageDir, { withFileTypes: true }).catch((error) => {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  });
  const runs: StageRunSummary[] = [];
  for (const entry of entries) {
    if (!entry.isDirectory() || !RUN_ID_PATTERN.test(entry.name)) continue;
    const summary = await readJsonFile<StageRunSummary>(join(stageDir, entry.name, "result-summary.json")).catch(() => null);
    if (summary) runs.push(summary);
  }
  runs.sort((a, b) => b.started_at.localeCompare(a.started_at));
  return runs;
}

export async function readStageRunDetail({
  store,
  reqId,
  stage,
  runId
}: {
  store: ArtifactRootStore;
  reqId: string;
  stage: string;
  runId: string;
}): Promise<StageRunDetail> {
  const safeStage = assertSkillRunnerStage(stage);
  const runDir = resolveRunDir(store, reqId, safeStage, runId);
  const request = await readJsonFile<unknown>(join(runDir, "request.json"));
  const summary = await readJsonFile<StageRunSummary>(join(runDir, "result-summary.json"));
  const diffSummary = await readJsonFile<StageRunDiffSummary>(join(runDir, "diff-summary.json"));
  const eventsText = await readFile(join(runDir, "events.jsonl"), "utf8").catch(() => "");
  const events = eventsText
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => JSON.parse(line) as StageRunEvent);
  const diagnostics = await readFile(join(runDir, "diagnostics.md"), "utf8").catch(() => null);
  const proposed_artifacts = await readProposedArtifacts(runDir, diffSummary);
  return { request, summary, diff_summary: diffSummary, events, proposed_artifacts, diagnostics };
}

export async function applyStageRun({
  store,
  reqId,
  stage,
  runId,
  ifMatch
}: {
  store: ArtifactRootStore;
  reqId: string;
  stage: string;
  runId: string;
  ifMatch?: string | null;
}): Promise<{ ok: true; applied_artifacts: string[] }> {
  const safeStage = assertSkillRunnerStage(stage);
  const runDir = resolveRunDir(store, reqId, safeStage, runId);
  const summary = await readJsonFile<StageRunSummary>(join(runDir, "result-summary.json"));
  if (summary.status !== "completed" && summary.status !== "applied") {
    throw new ArtifactValidationError(422, "완료되지 않은 run 은 적용할 수 없습니다.");
  }
  const diffSummary = await readJsonFile<StageRunDiffSummary>(join(runDir, "diff-summary.json"));
  const invalid = diffSummary.files.find((file) => !file.valid);
  if (invalid) {
    throw new ArtifactValidationError(422, `${invalid.path} 검증 실패 run 은 적용할 수 없습니다.`);
  }

  const applied: string[] = [];
  for (const file of diffSummary.files) {
    const content = await readFile(join(runDir, file.proposed_path), "utf8");
    const current = await store.readArtifact(reqId, file.path).catch((error) => {
      if (error instanceof ArtifactValidationError && error.statusCode === 404) return null;
      throw error;
    });
    const expected = ifMatch && diffSummary.files.length === 1 ? ifMatch : file.base_etag;
    const actual = current?.etag ?? "0";
    if ((expected ?? "0") !== actual) {
      throw new ArtifactConflictError(expected ?? "0", actual);
    }
    await store.writeArtifact(reqId, file.path, content, current?.etag ?? "0");
    applied.push(file.path);
  }

  const nextSummary: StageRunSummary = {
    ...summary,
    status: "applied",
    finished_at: new Date().toISOString()
  };
  await writeJsonFile(join(runDir, "result-summary.json"), nextSummary);
  await updateStageRunManifest(store, reqId, safeStage, nextSummary);
  return { ok: true, applied_artifacts: applied };
}

export function assertSkillRunnerStage(stage: string): SkillRunnerStage {
  if (skillRunnerStages.includes(stage as SkillRunnerStage)) return stage as SkillRunnerStage;
  throw new ArtifactValidationError(400, `지원하지 않는 stage 입니다: ${stage}`);
}

function assertNotCanceled(signal: AbortSignal | undefined): void {
  if (signal?.aborted) throw new StageRunCanceledError();
}

function normalizeModel(value: unknown): CodexAnalyzerModel {
  return typeof value === "string" && ALLOWED_MODELS.has(value) ? (value as CodexAnalyzerModel) : DEFAULT_MODEL;
}

function createInitialCodexMetadata(
  definition: StageDefinition,
  body: StageRunRequestBody
): StageRunCodexMetadata | undefined {
  if (definition.codexMetadata === "none") return undefined;
  return createCodexMetadata(body.execution_mode === "fake" ? "fake" : "sdk");
}

function commandNameForStage(stage: SkillRunnerStage, body: StageRunRequestBody): string {
  return STAGE_DEFINITIONS[stage].commandLabel(body);
}

function assertNever(value: never): never {
  throw new Error(`Unhandled stage runner variant: ${String(value)}`);
}

function createRunId(stage: SkillRunnerStage): string {
  return `${formatRunTimestamp(new Date())}-${stage}-${randomBytes(3).toString("hex")}`;
}

function formatRunTimestamp(value: Date): string {
  const iso = value.toISOString();
  return `${iso.slice(0, 4)}${iso.slice(5, 7)}${iso.slice(8, 10)}T${iso.slice(11, 13)}${iso.slice(14, 16)}${iso.slice(17, 19)}Z`;
}

function resolveStageRunDir(store: ArtifactRootStore, reqId: string, stage: SkillRunnerStage): string {
  const rootDir = store.resolveRootDir(reqId);
  return resolve(rootDir, "runs", stage);
}

function resolveRunDir(store: ArtifactRootStore, reqId: string, stage: SkillRunnerStage, runId: string): string {
  if (!RUN_ID_PATTERN.test(runId) || !runId.includes(`-${stage}-`)) {
    throw new ArtifactValidationError(400, "run_id 형식이 올바르지 않습니다.");
  }
  const stageDir = resolveStageRunDir(store, reqId, stage);
  const abs = resolve(stageDir, runId);
  if (!abs.startsWith(stageDir + sep) && abs !== stageDir) {
    throw new ArtifactValidationError(403, "허용되지 않은 run 경로입니다.");
  }
  return abs;
}

async function hydrateStageRunCatalog(repoRoot: string, body: StageRunRequestBody): Promise<{
  body: StageRunRequestBody;
  context: StageRunCatalogContext;
}> {
  if (Array.isArray(body.catalog)) {
    return {
      body,
      context: { source: "request", count: body.catalog.length, diagnostics: [] }
    };
  }
  try {
    const catalog = await loadServerScaffoldCatalog(repoRoot);
    if (catalog.length) {
      return {
        body: { ...body, catalog },
        context: { source: "server_default", count: catalog.length, diagnostics: [] }
      };
    }
    return {
      body: { ...body, catalog: [] },
      context: {
        source: "absent",
        count: 0,
        diagnostics: ["request.catalog was omitted and active server catalog resolved to 0 entries."]
      }
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown catalog hydration failure";
    return {
      body: { ...body, catalog: [] },
      context: {
        source: "absent",
        count: 0,
        diagnostics: [`request.catalog was omitted and active server catalog hydration failed: ${message}`]
      }
    };
  }
}

function buildRequestSnapshot(input: {
  reqId: string;
  stage: SkillRunnerStage;
  runId: string;
  model: string;
  skillName: string;
  body: StageRunRequestBody;
  catalogContext: StageRunCatalogContext;
}): unknown {
  return redactSecrets({
    requirement_id: input.reqId,
    stage: input.stage,
    run_id: input.runId,
    model: input.model,
    skill_name: input.skillName,
    execution_mode: input.body.execution_mode ?? "codex",
    verify_command: input.body.verifyCommand ?? null,
    input: input.body.input ?? null,
    catalog_context: input.catalogContext,
    catalog: Array.isArray(input.body.catalog) ? input.body.catalog.slice(0, 200) : []
  });
}

async function runFakeStage(input: {
  store: ArtifactRootStore;
  reqId: string;
  stage: SkillRunnerStage;
  body: StageRunRequestBody;
  proposedDir: string;
  emit: (event: Omit<StageRunEvent, "at" | "elapsedMs">) => Promise<void>;
}): Promise<void> {
  const todoText = {
    first: "입력과 현재 artifact 확인",
    second: "제안 artifact 초안 작성",
    third: "검토 메모 정리"
  };
  await input.emit({
    phase: "codex_event",
    title: "todo list",
    message: "todo list in_progress",
    rawEventType: "item.started",
    itemType: "todo_list",
    status: "in_progress",
    snippet: [`todo ${todoText.first}`, `todo ${todoText.second}`, `todo ${todoText.third}`].join("\n")
  });
  await new Promise<void>((resolveDelay) => setTimeout(resolveDelay, 275));
  await input.emit({
    phase: "codex_event",
    title: "agent message",
    message: "agent message completed",
    rawEventType: "item.completed",
    itemType: "agent_message",
    status: "completed",
    snippet: "현재 입력과 artifact를 확인하며 제안 초안을 준비하고 있습니다."
  });
  await new Promise<void>((resolveDelay) => setTimeout(resolveDelay, 275));
  await input.emit({
    phase: "codex_event",
    title: "todo list",
    message: "todo list in_progress",
    rawEventType: "item.updated",
    itemType: "todo_list",
    status: "in_progress",
    snippet: [`done ${todoText.first}`, `todo ${todoText.second}`, `todo ${todoText.third}`].join("\n")
  });
  await new Promise<void>((resolveDelay) => setTimeout(resolveDelay, 275));

  if (input.stage === "analyze") {
    const rawText = input.body.input?.rawText?.trim();
    if (!rawText) throw new ArtifactValidationError(400, "Analyze run 에는 rawText 가 필요합니다.");
    const canonical = await readCanonicalAnalysis(input.store, input.reqId).catch(() => null);
    const base = canonical ?? createMinimalAnalysis(input.reqId, rawText, input.body.input?.domain ?? "공통");
    const proposed = normalizeAnalysisResultForWorkbench({
      ...base,
      normalizedRequirement: {
        ...base.normalizedRequirement,
        id: input.reqId,
        raw_text: rawText,
        domain: input.body.input?.domain?.trim() || base.normalizedRequirement.domain || "공통",
        title: base.normalizedRequirement.title || "Skill Runner 분석 제안"
      }
    });
    await writeJsonFile(join(input.proposedDir, "analysis-result.json"), proposed);
    await input.emit({
      phase: "codex_event",
      title: "todo list",
      message: "todo list completed",
      rawEventType: "item.completed",
      itemType: "todo_list",
      status: "completed",
      snippet: [`done ${todoText.first}`, `done ${todoText.second}`, `done ${todoText.third}`].join("\n")
    });
    return;
  }

  const canonical = await readCanonicalAnalysis(input.store, input.reqId);
  const proposed = normalizeAnalysisResultForWorkbench({
    ...canonical,
    moduleCandidates: canonical.moduleCandidates.map((candidate) => resolveCandidateForDesign(candidate)),
    processFlow: {
      ...canonical.processFlow,
      nodes: canonical.processFlow.nodes?.map((node) =>
        node.module_id ? { ...node, review_status: "approved" } : node
      )
    }
  });
  await writeJsonFile(join(input.proposedDir, "analysis-result.json"), proposed);
  await writeFile(
    join(input.proposedDir, "boundary-design.md"),
    [
      `# ${input.reqId} boundary design proposal`,
      "",
      "`af-design-boundaries` fake runner output.",
      "",
      "- Module candidates with candidate-level missing_information are proposed as resolved.",
      "- approval gate values are intentionally unchanged.",
      "- Review this diff before applying canonical artifacts."
    ].join("\n"),
    "utf8"
  );
  await input.emit({
    phase: "codex_event",
    title: "todo list",
    message: "todo list completed",
    rawEventType: "item.completed",
    itemType: "todo_list",
    status: "completed",
    snippet: [`done ${todoText.first}`, `done ${todoText.second}`, `done ${todoText.third}`].join("\n")
  });
}

function buildCodexStagePrompt(input: Pick<CodexStageRunnerInput, "rootDir" | "runDir" | "stage" | "skillPath">): string {
  const outputInstruction = STAGE_DEFINITIONS[input.stage].codexOutputInstruction;
  return [
    `Read ${input.skillPath} and execute the ${input.stage} stage for this artifact root.`,
    `Artifact root: ${input.rootDir}`,
    `Run folder: ${input.runDir}`,
    `Stage request snapshot: ${join(input.runDir, "request.json")}`,
    outputInstruction,
    "Preserve Agent Factory taxonomy and review-gated behavior.",
    "Do not write credentials, private endpoints, deployment scripts, or production business logic.",
    "Return a concise final status after files are written."
  ].join("\n");
}

async function writeVerifyProposedArtifacts({
  proposedDir,
  reqId,
  runId,
  result
}: {
  proposedDir: string;
  reqId: string;
  runId: string;
  result: VerifyCommandResult;
}): Promise<void> {
  await writeFile(
    join(proposedDir, "validation-report.md"),
    [
      `# ${reqId} validation report`,
      "",
      `- run_id: ${runId}`,
      `- command_key: ${result.command_key}`,
      `- command: \`${result.command}\``,
      `- result: ${result.ok ? "passed" : "failed"}`,
      `- exit_code: ${result.exit_code}`,
      "",
      "## stdout",
      "",
      "```text",
      truncate(result.stdout || "(empty)", 20_000),
      "```",
      "",
      "## stderr",
      "",
      "```text",
      truncate(result.stderr || "(empty)", 20_000),
      "```",
      "",
      "## reviewer notes",
      "",
      "- Fill in reviewer conclusions before treating this report as final."
    ].join("\n"),
    "utf8"
  );
  await writeFile(
    join(proposedDir, "catalog-delta.yaml"),
    [
      "proposed_additions: []",
      "proposed_updates: []",
      "notes:",
      `  - \"Template generated from verify run ${runId}; add reviewed catalog changes manually.\"`
    ].join("\n"),
    "utf8"
  );
}

export class SdkCodexStageRunner implements CodexStageRunner {
  async run(input: CodexStageRunnerInput): Promise<StageRunCodexMetadata> {
    const metadata = createCodexMetadata("sdk");
    const codex = new Codex();
    const thread = codex.startThread({
      model: input.model,
      workingDirectory: input.repoRoot,
      sandboxMode: "workspace-write",
      approvalPolicy: "never",
      networkAccessEnabled: false
    });
    const { events } = await thread.runStreamed(buildCodexStagePrompt(input));
    let turnFailure: string | null = null;

    for await (const event of events) {
      assertNotCanceled(input.signal);
      metadata.event_count += 1;
      if (event.type === "thread.started") {
        metadata.thread_id = event.thread_id;
      } else if (event.type === "turn.completed") {
        metadata.usage = normalizeCodexUsage(event.usage);
      } else if (event.type === "turn.failed") {
        turnFailure = event.error.message;
      }
      if (!metadata.thread_id) metadata.thread_id = thread.id;
      await appendRawCodexEvent(input.runDir, event);
      await input.emit(mapCodexEvent(event));
    }

    assertNotCanceled(input.signal);
    if (turnFailure) throw new Error(turnFailure);
    return copyCodexMetadata(metadata);
  }
}

function createCodexMetadata(backend: StageRunCodexMetadata["backend"]): StageRunCodexMetadata {
  return {
    backend,
    thread_id: null,
    event_count: 0,
    usage: null
  };
}

function copyCodexMetadata(metadata: StageRunCodexMetadata): StageRunCodexMetadata {
  return {
    backend: metadata.backend,
    thread_id: metadata.thread_id,
    event_count: metadata.event_count,
    usage: metadata.usage ? { ...metadata.usage } : null
  };
}

function normalizeCodexUsage(usage: Usage | null | undefined): StageRunCodexUsage | null {
  if (!usage) return null;
  return {
    input_tokens: usage.input_tokens,
    cached_input_tokens: usage.cached_input_tokens,
    output_tokens: usage.output_tokens,
    reasoning_output_tokens: usage.reasoning_output_tokens
  };
}

async function appendRawCodexEvent(runDir: string, event: ThreadEvent): Promise<void> {
  await mkdir(runDir, { recursive: true });
  await appendFile(join(runDir, "codex-events.jsonl"), `${JSON.stringify(redactSecrets(event))}\n`, "utf8");
}

function mapCodexEvent(event: ThreadEvent): Omit<StageRunEvent, "at" | "elapsedMs"> {
  switch (event.type) {
    case "thread.started":
      return {
        phase: "codex_event",
        message: "Codex SDK thread started.",
        title: "thread started",
        rawEventType: event.type,
        status: "started",
        snippet: event.thread_id
      };
    case "turn.started":
      return {
        phase: "codex_event",
        message: "Codex turn started.",
        title: "turn started",
        rawEventType: event.type,
        status: "started"
      };
    case "turn.completed":
      return {
        phase: "codex_event",
        message: "Codex turn completed.",
        title: "turn completed",
        rawEventType: event.type,
        status: "completed",
        snippet: formatUsage(event.usage)
      };
    case "turn.failed":
      return {
        phase: "codex_event",
        message: event.error.message,
        title: "turn failed",
        rawEventType: event.type,
        status: "failed"
      };
    case "error":
      return {
        phase: "codex_event",
        message: event.message,
        title: "codex stream error",
        rawEventType: event.type,
        status: "failed"
      };
    case "item.started":
    case "item.updated":
    case "item.completed":
      return mapCodexItemEvent(event.type, event.item);
  }
}

function mapCodexItemEvent(rawEventType: "item.started" | "item.updated" | "item.completed", item: ThreadItem): Omit<StageRunEvent, "at" | "elapsedMs"> {
  const itemStatus = getItemStatus(item) ?? (rawEventType === "item.completed" ? "completed" : undefined);
  const title = getItemTitle(item);
  return {
    phase: "codex_event",
    message: itemStatus ? `${title} ${itemStatus}` : title,
    title,
    rawEventType,
    itemType: item.type,
    status: itemStatus,
    toolName: getItemToolName(item),
    snippet: getItemSnippet(item)
  };
}

function getItemTitle(item: ThreadItem): string {
  switch (item.type) {
    case "command_execution":
      return "command execution";
    case "file_change":
      return "file change";
    case "mcp_tool_call":
      return "mcp tool call";
    case "agent_message":
      return "agent message";
    case "reasoning":
      return "reasoning";
    case "web_search":
      return "web search";
    case "todo_list":
      return "todo list";
    case "error":
      return "error";
  }
}

function getItemStatus(item: ThreadItem): string | undefined {
  return "status" in item && typeof item.status === "string" ? item.status : undefined;
}

function getItemToolName(item: ThreadItem): string | undefined {
  switch (item.type) {
    case "command_execution":
      return "command";
    case "mcp_tool_call":
      return `${item.server}.${item.tool}`;
    case "web_search":
      return "web_search";
    default:
      return undefined;
  }
}

function getItemSnippet(item: ThreadItem): string | undefined {
  switch (item.type) {
    case "command_execution":
      return truncate([item.command, item.aggregated_output].filter(Boolean).join("\n"), 1000);
    case "file_change":
      return truncate(item.changes.map((change) => `${change.kind} ${change.path}`).join(", "), 1000);
    case "mcp_tool_call":
      return truncate(item.error?.message ?? stringifySnippet(item.result ?? item.arguments), 1000);
    case "agent_message":
    case "reasoning":
      return truncate(item.text, 1000);
    case "web_search":
      return truncate(item.query, 1000);
    case "todo_list":
      return truncate(item.items.map((todo) => `${todo.completed ? "done" : "todo"} ${todo.text}`).join("\n"), 1000);
    case "error":
      return truncate(item.message, 1000);
  }
}

function stringifySnippet(value: unknown): string {
  if (typeof value === "string") return value;
  return JSON.stringify(redactSecrets(value)) ?? "";
}

function formatUsage(usage: Usage): string {
  return [
    `input ${usage.input_tokens}`,
    `cached ${usage.cached_input_tokens}`,
    `output ${usage.output_tokens}`,
    `reasoning ${usage.reasoning_output_tokens}`
  ].join(" · ");
}

async function assertDesignReady(store: ArtifactRootStore, reqId: string): Promise<void> {
  const { manifest } = await store.readManifest(reqId);
  if (!manifest.approvals.analysis_reviewed) {
    throw new ArtifactValidationError(409, "Design run 은 analysis_reviewed=true 상태에서만 실행할 수 있습니다.");
  }
  await readCanonicalAnalysis(store, reqId);
}

async function readCanonicalAnalysis(store: ArtifactRootStore, reqId: string): Promise<AnalysisResult> {
  const artifact = await store.readArtifact(reqId, "analysis-result.json");
  return JSON.parse(artifact.content) as AnalysisResult;
}

function resolveCandidateForDesign(candidate: ModuleCandidate): ModuleCandidate {
  if (!candidate.missing_information.length && candidate.status === "approved") return candidate;
  const resolved = candidate.missing_information;
  return {
    ...candidate,
    status: "approved",
    missing_information_resolution:
      candidate.missing_information_resolution ||
      "Skill Runner proposal: reviewer must confirm these values before treating the boundary as approved.",
    resolved_missing_information: resolved,
    missing_information: [],
    resolution_applied_at: new Date().toISOString(),
    schema_review_state: "applied",
    smoke_spec: candidate.smoke_spec ?? createSmokeSpec(candidate)
  };
}

function createSmokeSpec(candidate: ModuleCandidate): ModuleSmokeSpec {
  return {
    sample_user_message: `${candidate.name} smoke 입력을 검증한다.`,
    synthetic_inputs: Object.fromEntries(candidate.inputs.map((field) => [field.name, `synthetic_${field.type}`])),
    expected_output_shape: {
      type: "object",
      properties: Object.fromEntries(candidate.outputs.map((field) => [field.name, { type: field.type || "string" }]))
    },
    expected_event_markers: [`${candidate.id}:completed`],
    mock_sources: ["skill-runner-fake"],
    ready: true
  };
}

function createMinimalAnalysis(reqId: string, rawText: string, domain: string): AnalysisResult {
  return {
    normalizedRequirement: {
      id: reqId,
      title: "Skill Runner 분석 제안",
      raw_text: rawText,
      domain,
      requester: { team: "unknown", role: "reviewer" },
      business_goal: rawText.slice(0, 160),
      current_process: [],
      inputs: [{ name: "raw_requirement", type: "text", required: true, schema: {} }],
      outputs: [{ name: "analysis_result", type: "object", required: true, schema: {} }],
      systems: [],
      risk_signals: [],
      missing_information: [],
      contradictions: [],
      status: "draft"
    },
    evidence: {
      requested_goal: rawText.slice(0, 240),
      business_domain_hint: domain,
      user_role: "reviewer",
      input_data: ["raw_requirement"],
      output_data: ["analysis_result"],
      systems_mentioned: [],
      decisions_implied: [],
      risk_signals: [],
      missing_information: [],
      contradictions: [],
      assumptions: ["fake runner proposal"]
    },
    moduleCandidates: [],
    a2aContracts: [],
    runtimeContracts: [],
    processFlow: {
      requirement_id: reqId,
      graph_id: "graph-001",
      root_workflow_module_id: null,
      nodes: [],
      edges: [],
      containers: [],
      lanes: [],
      validation: { ok: true, errors: [], warnings: [] }
    }
  };
}

async function buildDiffSummary(
  store: ArtifactRootStore,
  reqId: string,
  stage: SkillRunnerStage,
  runId: string
): Promise<StageRunDiffSummary> {
  const runDir = resolveRunDir(store, reqId, stage, runId);
  const proposedDir = join(runDir, "proposed-artifacts");
  const definition = STAGE_DEFINITIONS[stage];
  const files: StageRunArtifactDiff[] = [];
  for (const file of definition.proposedArtifactFiles) {
    const proposedPath = join(proposedDir, file);
    const proposedStat = await stat(proposedPath).catch(() => null);
    if (!proposedStat?.isFile()) continue;
    const content = await readFile(proposedPath, "utf8");
    const base = await store.readArtifact(reqId, file).catch((error) => {
      if (error instanceof ArtifactValidationError && error.statusCode === 404) return null;
      throw error;
    });
    const validationErrors = file === "analysis-result.json" ? validateAnalysisResult(JSON.parse(content)) : [];
    const proposedEtag = computeEtag(content);
    files.push({
      path: file,
      proposed_path: `proposed-artifacts/${file}`,
      status: base ? (base.content === content ? "unchanged" : "changed") : "created",
      valid: validationErrors.length === 0,
      validation_errors: validationErrors,
      base_etag: base?.etag ?? null,
      proposed_etag: proposedEtag,
      before_summary: summarizeArtifact(file, base?.content ?? null),
      after_summary: summarizeArtifact(file, content),
      bytes: Buffer.byteLength(content, "utf8")
    });
  }
  if (!files.length && definition.diffAvailable) {
    throw new ArtifactValidationError(422, "proposed artifact 가 생성되지 않았습니다.");
  }
  return { files };
}

function summarizeArtifact(path: string, content: string | null): string {
  if (!content) return "파일 없음";
  if (path.endsWith(".md")) return content.split(/\r?\n/).find((line) => line.trim())?.slice(0, 160) ?? "Markdown";
  try {
    const parsed = JSON.parse(content);
    if (path === "analysis-result.json" && parsed?.normalizedRequirement) {
      const candidates = Array.isArray(parsed.moduleCandidates) ? parsed.moduleCandidates.length : 0;
      return `${parsed.normalizedRequirement.title ?? "analysis"} · module ${candidates}개`;
    }
  } catch {
    return "JSON parse 실패";
  }
  return `${Buffer.byteLength(content, "utf8")} bytes`;
}

async function readProposedArtifacts(
  runDir: string,
  diffSummary: StageRunDiffSummary
): Promise<StageRunDetail["proposed_artifacts"]> {
  const artifacts: StageRunDetail["proposed_artifacts"] = [];
  for (const file of diffSummary.files) {
    const abs = join(runDir, file.proposed_path);
    const content = await readFile(abs, "utf8");
    artifacts.push({
      path: file.proposed_path,
      canonical_path: file.path,
      content_type: file.path.endsWith(".json") ? "application/json" : file.path.endsWith(".md") ? "text/markdown" : "text/plain",
      preview: truncate(content, 80_000),
      bytes: Buffer.byteLength(content, "utf8")
    });
  }
  return artifacts;
}

async function updateStageRunManifest(
  store: ArtifactRootStore,
  reqId: string,
  stage: SkillRunnerStage,
  summary: StageRunSummary
): Promise<void> {
  const { manifest } = await store.readManifest(reqId);
  const entry: AfStageRunManifestEntry = {
    latest_run_id: summary.run_id,
    status: summary.status,
    started_at: summary.started_at,
    finished_at: summary.finished_at,
    skill_name: summary.skill_name,
    model: summary.model,
    output_artifacts: summary.output_artifacts,
    last_error: summary.last_error
  };
  if (summary.codex) {
    entry.codex = {
      backend: summary.codex.backend,
      thread_id: summary.codex.thread_id,
      event_count: summary.codex.event_count
    };
  }
  const next: AfRunManifest = {
    ...manifest,
    stage_runs: {
      ...(manifest.stage_runs ?? {}),
      [stage]: entry
    }
  };
  await store.writeManifest(reqId, next, null);
}

async function appendEvent(runDir: string, event: StageRunEvent): Promise<void> {
  await mkdir(runDir, { recursive: true });
  const path = join(runDir, "events.jsonl");
  await appendFile(path, `${JSON.stringify(redactSecrets(event))}\n`, "utf8");
}

async function writeJsonFile(path: string, value: unknown): Promise<void> {
  await mkdir(path.slice(0, path.lastIndexOf(sep)), { recursive: true });
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

async function readJsonFile<T>(path: string): Promise<T> {
  return JSON.parse(await readFile(path, "utf8")) as T;
}

function formatDiagnostics(input: {
  reqId: string;
  stage: SkillRunnerStage;
  model: string;
  skillName: string;
  command: string;
  startedAt: Date;
  finishedAt: Date;
  error: string;
}): string {
  return [
    `# ${input.stage} run diagnostics`,
    "",
    `- requirement_id: ${input.reqId}`,
    `- stage: ${input.stage}`,
    `- skill_name: ${input.skillName}`,
    `- model: ${input.model}`,
    `- command: ${input.command}`,
    `- started_at: ${input.startedAt.toISOString()}`,
    `- finished_at: ${input.finishedAt.toISOString()}`,
    `- elapsed_ms: ${input.finishedAt.getTime() - input.startedAt.getTime()}`,
    `- error: ${redactSecrets(input.error)}`
  ].join("\n");
}

function redactSecrets<T>(value: T): T {
  if (Array.isArray(value)) return value.map((item) => redactSecrets(item)) as T;
  if (value && typeof value === "object") {
    const result: Record<string, unknown> = {};
    for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
      if (/token|secret|password|credential|authorization|api[_-]?key|private[_-]?key/i.test(key)) {
        result[key] = "[redacted]";
      } else {
        result[key] = redactSecrets(raw);
      }
    }
    return result as T;
  }
  if (typeof value === "string") {
    return value.replace(/(Bearer\s+)[A-Za-z0-9._~+/=-]+/gi, "$1[redacted]") as T;
  }
  return value;
}

function truncate(value: string, max: number): string {
  return value.length > max ? `${value.slice(0, max)}\n[truncated]` : value;
}
