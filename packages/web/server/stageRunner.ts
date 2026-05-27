import { randomBytes } from "node:crypto";
import { spawn } from "node:child_process";
import { mkdir, readdir, readFile, stat, writeFile } from "node:fs/promises";
import { join, relative, resolve, sep } from "node:path";
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
import { validateAnalysisResult } from "./validators";

export const skillRunnerStages = ["analyze", "design"] as const;
export type SkillRunnerStage = (typeof skillRunnerStages)[number];

const RUN_ID_PATTERN = /^\d{8}T\d{6}Z-(analyze|design)-[a-f0-9]{6}$/;
const ALLOWED_MODELS = new Set(["gpt-5.5", "gpt-5.4", "gpt-5.4-mini", "gpt-5.3-codex", "gpt-5.3-codex-spark"]);
const DEFAULT_MODEL = "gpt-5.5";
const SKILL_BY_STAGE: Record<SkillRunnerStage, { skillName: string; skillPath: string }> = {
  analyze: {
    skillName: "af-analyze-requirement",
    skillPath: ".agents/skills/af-analyze-requirement/SKILL.md"
  },
  design: {
    skillName: "af-design-boundaries",
    skillPath: ".agents/skills/af-design-boundaries/SKILL.md"
  }
};

export interface StageRunRequestBody {
  execution_mode?: "codex" | "fake";
  model?: string;
  input?: {
    rawText?: string;
    domain?: string;
  };
  catalog?: unknown[];
  streamProgress?: boolean;
}

export interface StageRunEvent {
  phase: "started" | "cli_event" | "proposed" | "validation" | "completed" | "failed";
  message: string;
  at: string;
  elapsedMs: number;
  title?: string;
  snippet?: string;
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
}

export async function runStageSkill(input: RunStageSkillInput): Promise<StageRunSummary> {
  const stage = assertSkillRunnerStage(input.stage);
  const model = normalizeModel(input.body.model);
  const skill = SKILL_BY_STAGE[stage];
  const runId = createRunId(stage);
  const rootDir = input.store.resolveRootDir(input.reqId);
  const runDir = resolveRunDir(input.store, input.reqId, stage, runId);
  const proposedDir = join(runDir, "proposed-artifacts");
  const startedAt = new Date();
  const request = buildRequestSnapshot({
    reqId: input.reqId,
    stage,
    runId,
    model,
    skillName: skill.skillName,
    body: input.body
  });
  const events: StageRunEvent[] = [];
  const emit = async (event: Omit<StageRunEvent, "at" | "elapsedMs">) => {
    const full: StageRunEvent = {
      ...event,
      at: new Date().toISOString(),
      elapsedMs: Date.now() - startedAt.getTime()
    };
    events.push(full);
    input.onEvent?.(full);
    await appendEvent(runDir, full);
  };

  await mkdir(proposedDir, { recursive: true });
  await writeJsonFile(join(runDir, "request.json"), request);
  await emit({
    phase: "started",
    message: `${skill.skillName} 실행을 시작했습니다.`,
    title: "stage run started"
  });

  let status: AfStageRunStatus = "completed";
  let lastError: string | null = null;
  let diagnostics: string | null = null;
  try {
    if (stage === "design") {
      await assertDesignReady(input.store, input.reqId);
    }

    if (input.body.execution_mode === "fake") {
      await runFakeStage({ store: input.store, reqId: input.reqId, stage, body: input.body, proposedDir });
    } else {
      await runCodexStage({ repoRoot: input.repoRoot, rootDir, runDir, proposedDir, stage, skillPath: skill.skillPath, model });
    }
    await emit({
      phase: "proposed",
      message: "proposed artifact 생성이 완료되었습니다.",
      title: "proposed artifacts"
    });
  } catch (error) {
    status = "failed";
    lastError = error instanceof Error ? error.message : "stage run failed";
    diagnostics = formatDiagnostics({
      reqId: input.reqId,
      stage,
      model,
      skillName: skill.skillName,
      command: input.body.execution_mode === "fake" ? "fake-runner" : "codex exec",
      startedAt,
      finishedAt: new Date(),
      error: lastError
    });
    await writeFile(join(runDir, "diagnostics.md"), diagnostics, "utf8");
    await emit({
      phase: "failed",
      message: lastError,
      title: "stage run failed"
    });
  }

  let diffSummary: StageRunDiffSummary = { files: [] };
  if (status === "completed") {
    diffSummary = await buildDiffSummary(input.store, input.reqId, stage, runId);
  }
  if (status === "completed") {
    const validationErrors = diffSummary.files.flatMap((file) => file.validation_errors);
    if (validationErrors.length) {
      status = "failed";
      lastError = `proposed artifact 검증 실패: ${validationErrors.join("; ")}`;
      diagnostics = formatDiagnostics({
        reqId: input.reqId,
        stage,
        model,
        skillName: skill.skillName,
        command: input.body.execution_mode === "fake" ? "fake-runner" : "codex exec",
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
    skill_name: skill.skillName,
    model,
    started_at: startedAt.toISOString(),
    finished_at: finishedAt.toISOString(),
    elapsed_ms: finishedAt.getTime() - startedAt.getTime(),
    output_artifacts: diffSummary.files.map((file) => `runs/${stage}/${runId}/${file.proposed_path}`),
    validation: {
      ok: status === "completed",
      errors: diffSummary.files.flatMap((file) => file.validation_errors)
    },
    last_error: lastError
  };
  await writeJsonFile(join(runDir, "result-summary.json"), summary);
  await updateStageRunManifest(input.store, input.reqId, stage, summary);
  return summary;
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

function normalizeModel(value: unknown): CodexAnalyzerModel {
  return typeof value === "string" && ALLOWED_MODELS.has(value) ? (value as CodexAnalyzerModel) : DEFAULT_MODEL;
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

function buildRequestSnapshot(input: {
  reqId: string;
  stage: SkillRunnerStage;
  runId: string;
  model: string;
  skillName: string;
  body: StageRunRequestBody;
}): unknown {
  return redactSecrets({
    requirement_id: input.reqId,
    stage: input.stage,
    run_id: input.runId,
    model: input.model,
    skill_name: input.skillName,
    execution_mode: input.body.execution_mode ?? "codex",
    input: input.body.input ?? null,
    catalog: Array.isArray(input.body.catalog) ? input.body.catalog.slice(0, 200) : []
  });
}

async function runFakeStage(input: {
  store: ArtifactRootStore;
  reqId: string;
  stage: SkillRunnerStage;
  body: StageRunRequestBody;
  proposedDir: string;
}): Promise<void> {
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
}

async function runCodexStage(input: {
  repoRoot: string;
  rootDir: string;
  runDir: string;
  proposedDir: string;
  stage: SkillRunnerStage;
  skillPath: string;
  model: string;
}): Promise<void> {
  const outputInstruction =
    input.stage === "analyze"
      ? "Write the proposed analysis artifact to proposed-artifacts/analysis-result.json only. Do not edit canonical artifacts."
      : "Write proposed-artifacts/analysis-result.json and proposed-artifacts/boundary-design.md only. Do not edit canonical artifacts or approval gates.";
  const prompt = [
    `Read ${input.skillPath} and execute the ${input.stage} stage for this artifact root.`,
    `Artifact root: ${input.rootDir}`,
    `Run folder: ${input.runDir}`,
    outputInstruction,
    "Preserve Agent Factory taxonomy and review-gated behavior.",
    "Do not write credentials, private endpoints, deployment scripts, or production business logic.",
    "Return a concise final status after files are written."
  ].join("\n");
  const result = await runProcess(input.repoRoot, "codex", [
    "exec",
    "--json",
    "--model",
    input.model,
    "--cd",
    input.repoRoot,
    prompt
  ]);
  await writeFile(join(input.runDir, "codex-stdout.jsonl"), truncate(result.stdout, 400_000), "utf8");
  if (result.stderr.trim()) {
    await writeFile(join(input.runDir, "codex-stderr.txt"), truncate(redactSecrets(result.stderr), 100_000), "utf8");
  }
  if (result.code !== 0) {
    throw new Error(`codex exec 실패 (exit ${result.code}): ${truncate(result.stderr || result.stdout, 1000)}`);
  }
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
  const allowed = stage === "analyze" ? ["analysis-result.json"] : ["analysis-result.json", "boundary-design.md"];
  const files: StageRunArtifactDiff[] = [];
  for (const file of allowed) {
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
  if (!files.length) {
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
  const existing = await readFile(path, "utf8").catch(() => "");
  await writeFile(path, `${existing}${JSON.stringify(redactSecrets(event))}\n`, "utf8");
}

async function writeJsonFile(path: string, value: unknown): Promise<void> {
  await mkdir(path.slice(0, path.lastIndexOf(sep)), { recursive: true });
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

async function readJsonFile<T>(path: string): Promise<T> {
  return JSON.parse(await readFile(path, "utf8")) as T;
}

function runProcess(cwd: string, command: string, args: string[]): Promise<{ code: number; stdout: string; stderr: string }> {
  return new Promise((resolvePromise) => {
    const child = spawn(command, args, { cwd, stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk: Buffer) => {
      stdout += chunk.toString("utf8");
      if (stdout.length > 500_000) stdout = stdout.slice(-500_000);
    });
    child.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString("utf8");
      if (stderr.length > 200_000) stderr = stderr.slice(-200_000);
    });
    child.on("error", (error) => resolvePromise({ code: -1, stdout, stderr: `${stderr}\n${error.message}` }));
    child.on("close", (code) => resolvePromise({ code: code ?? -1, stdout, stderr }));
  });
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
