export const afRunStageIds = ["analyze", "design", "build", "verify"] as const;
export const afRunStageStatuses = ["pending", "complete", "blocked"] as const;
export const afRunValidationResults = ["not_run", "passed", "failed"] as const;
export const afStageRunStatuses = ["running", "completed", "failed", "applied", "canceled"] as const;

export type AfRunStageId = (typeof afRunStageIds)[number];
export type AfRunStageStatus = (typeof afRunStageStatuses)[number];
export type AfRunValidationResult = (typeof afRunValidationResults)[number];
export type AfStageRunStatus = (typeof afStageRunStatuses)[number];

export interface AfRunStage {
  status: AfRunStageStatus;
  outputs: string[];
}

export interface AfStageRunCodexMetadata {
  backend: "sdk" | "fake";
  thread_id: string | null;
  event_count: number;
}

export interface AfStageRunManifestEntry {
  latest_run_id: string;
  status: AfStageRunStatus;
  started_at: string;
  finished_at: string | null;
  skill_name: string;
  model: string;
  output_artifacts: string[];
  last_error: string | null;
  codex?: AfStageRunCodexMetadata;
}

export interface AfRunManifest {
  requirement_id: string;
  artifact_root: string;
  current_stage: AfRunStageId;
  stages: Record<AfRunStageId, AfRunStage>;
  approvals: {
    analysis_reviewed: boolean;
    boundaries_approved: boolean;
    runtime_contracts_approved: boolean;
    stub_ready_for_followup: boolean;
  };
  validation: {
    commands: string[];
    last_result: AfRunValidationResult;
  };
  stage_runs?: Partial<Record<AfRunStageId, AfStageRunManifestEntry>>;
}

export interface AfRunManifestSummary {
  requirementId: string;
  artifactRoot: string;
  stageLabel: string;
  stageStatus: AfRunStageStatus;
  stageStatusLabel: string;
  completedStages: number;
  totalStages: number;
  approvalCount: number;
  validationLabel: AfRunValidationResult;
  validationStatusLabel: string;
}

const stageLabels: Record<AfRunStageId, string> = {
  analyze: "분석",
  design: "설계",
  build: "개발",
  verify: "검증"
};

const stageStatusLabels: Record<AfRunStageStatus, string> = {
  pending: "대기",
  complete: "완료",
  blocked: "차단"
};

const validationResultLabels: Record<AfRunValidationResult, string> = {
  not_run: "미실행",
  passed: "통과",
  failed: "실패"
};

export function parseAfRunManifest(source: string, fileName = "af-run-manifest.json"): AfRunManifest {
  if (!source.trim()) {
    throw new Error(`${fileName} 파일이 비어 있습니다.`);
  }

  const parsed = parseJsonObject(source, fileName);
  assertExactKeys(
    parsed,
    ["requirement_id", "artifact_root", "current_stage", "stages", "approvals", "validation", "stage_runs"],
    fileName
  );
  const requirementId = stringField(parsed, "requirement_id", fileName);
  if (!requirementId.trim()) {
    throw new Error(`${fileName} requirement_id가 비어 있습니다.`);
  }
  const artifactRoot = requiredNonEmptyString(parsed.artifact_root, `${fileName} artifact_root`);
  const currentStage = requiredEnum(parsed.current_stage, afRunStageIds, `${fileName} current_stage`);

  const stageRuns = parseStageRuns(parsed.stage_runs, fileName);
  return {
    requirement_id: requirementId,
    artifact_root: artifactRoot,
    current_stage: currentStage,
    stages: parseStages(parsed.stages, fileName),
    approvals: parseApprovals(parsed.approvals, fileName),
    validation: parseValidation(parsed.validation, fileName),
    ...(stageRuns ? { stage_runs: stageRuns } : {})
  };
}

export function summarizeAfRunManifest(manifest: AfRunManifest): AfRunManifestSummary {
  const stageStatus = manifest.stages[manifest.current_stage]?.status ?? "pending";
  const approvalValues = Object.values(manifest.approvals);
  return {
    requirementId: manifest.requirement_id,
    artifactRoot: manifest.artifact_root,
    stageLabel: stageLabels[manifest.current_stage],
    stageStatus,
    stageStatusLabel: stageStatusLabels[stageStatus],
    completedStages: afRunStageIds.filter((stage) => manifest.stages[stage].status === "complete").length,
    totalStages: afRunStageIds.length,
    approvalCount: approvalValues.filter(Boolean).length,
    validationLabel: manifest.validation.last_result,
    validationStatusLabel: validationResultLabels[manifest.validation.last_result]
  };
}

export function serializeAfRunManifest(manifest: AfRunManifest): string {
  return `${JSON.stringify(manifest, null, 2)}\n`;
}

function parseStages(value: unknown, fileName: string): Record<AfRunStageId, AfRunStage> {
  const record = requiredRecord(value, `${fileName} stages`);
  assertExactKeys(record, afRunStageIds, `${fileName} stages`);
  return {
    analyze: parseStage(record.analyze, `${fileName} stages.analyze`),
    design: parseStage(record.design, `${fileName} stages.design`),
    build: parseStage(record.build, `${fileName} stages.build`),
    verify: parseStage(record.verify, `${fileName} stages.verify`)
  };
}

function parseStage(value: unknown, label: string): AfRunStage {
  const record = requiredRecord(value, label);
  assertExactKeys(record, ["status", "outputs"], label);
  return {
    status: requiredEnum(record.status, afRunStageStatuses, `${label}.status`),
    outputs: requiredStringArray(record.outputs, `${label}.outputs`)
  };
}

function parseApprovals(value: unknown, fileName: string): AfRunManifest["approvals"] {
  const record = requiredRecord(value, `${fileName} approvals`);
  assertExactKeys(
    record,
    ["analysis_reviewed", "boundaries_approved", "runtime_contracts_approved", "stub_ready_for_followup"],
    `${fileName} approvals`
  );
  const approvals: AfRunManifest["approvals"] = {
    analysis_reviewed: requiredBoolean(record.analysis_reviewed, `${fileName} approvals.analysis_reviewed`),
    boundaries_approved: requiredBoolean(record.boundaries_approved, `${fileName} approvals.boundaries_approved`),
    runtime_contracts_approved: requiredBoolean(
      record.runtime_contracts_approved,
      `${fileName} approvals.runtime_contracts_approved`
    ),
    stub_ready_for_followup: requiredBoolean(
      record.stub_ready_for_followup,
      `${fileName} approvals.stub_ready_for_followup`
    )
  };
  if (approvals.boundaries_approved && !approvals.analysis_reviewed) {
    throw new Error(`${fileName} approvals.boundaries_approved=true에는 analysis_reviewed=true가 필요합니다.`);
  }
  if (approvals.runtime_contracts_approved && !approvals.boundaries_approved) {
    throw new Error(`${fileName} approvals.runtime_contracts_approved=true에는 boundaries_approved=true가 필요합니다.`);
  }
  if (approvals.stub_ready_for_followup && !approvals.runtime_contracts_approved) {
    throw new Error(`${fileName} approvals.stub_ready_for_followup=true에는 runtime_contracts_approved=true가 필요합니다.`);
  }
  return approvals;
}

function parseValidation(value: unknown, fileName: string): AfRunManifest["validation"] {
  const record = requiredRecord(value, `${fileName} validation`);
  assertExactKeys(record, ["commands", "last_result"], `${fileName} validation`);
  return {
    commands: requiredStringArray(record.commands, `${fileName} validation.commands`),
    last_result: requiredEnum(record.last_result, afRunValidationResults, `${fileName} validation.last_result`)
  };
}

function parseStageRuns(value: unknown, fileName: string): AfRunManifest["stage_runs"] | undefined {
  if (value === undefined) return undefined;
  const record = requiredRecord(value, `${fileName} stage_runs`);
  assertExactKeys(record, afRunStageIds, `${fileName} stage_runs`);
  const result: Partial<Record<AfRunStageId, AfStageRunManifestEntry>> = {};
  for (const stage of afRunStageIds) {
    if (record[stage] === undefined) continue;
    const entry = parseStageRunEntry(record[stage], `${fileName} stage_runs.${stage}`);
    if (entry) result[stage] = entry;
  }
  return result;
}

function parseStageRunEntry(value: unknown, label: string): AfStageRunManifestEntry {
  const record = requiredRecord(value, label);
  assertExactKeys(
    record,
    ["latest_run_id", "status", "started_at", "finished_at", "skill_name", "model", "output_artifacts", "last_error", "codex"],
    label
  );
  const entry: AfStageRunManifestEntry = {
    latest_run_id: requiredNonEmptyString(record.latest_run_id, `${label}.latest_run_id`),
    status: requiredEnum(record.status, afStageRunStatuses, `${label}.status`),
    started_at: requiredNonEmptyString(record.started_at, `${label}.started_at`),
    finished_at: requiredNullableString(record.finished_at, `${label}.finished_at`),
    skill_name: requiredNonEmptyString(record.skill_name, `${label}.skill_name`),
    model: requiredNonEmptyString(record.model, `${label}.model`),
    output_artifacts: requiredStringArray(record.output_artifacts, `${label}.output_artifacts`),
    last_error: requiredNullableString(record.last_error, `${label}.last_error`)
  };
  const codex = parseStageRunCodex(record.codex, `${label}.codex`);
  if (codex) entry.codex = codex;
  return entry;
}

function parseStageRunCodex(value: unknown, label: string): AfStageRunCodexMetadata | undefined {
  if (value === undefined) return undefined;
  const record = requiredRecord(value, label);
  assertExactKeys(record, ["backend", "thread_id", "event_count"], label);
  const backend = requiredEnum(record.backend, ["sdk", "fake"] as const, `${label}.backend`);
  if (!Number.isInteger(record.event_count) || (record.event_count as number) < 0) {
    throw new Error(`${label}.event_count 필드는 0 이상의 정수여야 합니다.`);
  }
  return {
    backend,
    thread_id: requiredNullableString(record.thread_id, `${label}.thread_id`),
    event_count: record.event_count as number
  };
}

function requiredRecord(value: unknown, label: string): Record<string, unknown> {
  if (!isRecord(value)) throw new Error(`${label} 필드는 객체여야 합니다.`);
  return value;
}

function assertExactKeys(record: Record<string, unknown>, allowed: readonly string[], label: string): void {
  const allowedKeys = new Set(allowed);
  const unknown = Object.keys(record).filter((key) => !allowedKeys.has(key));
  if (unknown.length) throw new Error(`${label}에 알 수 없는 필드가 있습니다: ${unknown.join(", ")}`);
}

function requiredNonEmptyString(value: unknown, label: string): string {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${label} 필드는 비어 있지 않은 문자열이어야 합니다.`);
  return value;
}

function requiredNullableString(value: unknown, label: string): string | null {
  if (value === null || typeof value === "string") return value;
  throw new Error(`${label} 필드는 문자열 또는 null이어야 합니다.`);
}

function requiredBoolean(value: unknown, label: string): boolean {
  if (typeof value !== "boolean") throw new Error(`${label} 필드는 boolean이어야 합니다.`);
  return value;
}

function requiredStringArray(value: unknown, label: string): string[] {
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) {
    throw new Error(`${label} 필드는 문자열 배열이어야 합니다.`);
  }
  return [...value];
}

function requiredEnum<const T extends readonly string[]>(value: unknown, values: T, label: string): T[number] {
  if (typeof value !== "string" || !values.includes(value)) {
    throw new Error(`${label} 값이 올바르지 않습니다: ${String(value)}`);
  }
  return value as T[number];
}

function parseJsonObject(source: string, fileName: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(source);
    if (!isRecord(parsed)) {
      throw new Error("top-level value is not an object");
    }
    return parsed;
  } catch (error) {
    const detail = error instanceof Error ? error.message : "unknown parse failure";
    throw new Error(`${fileName} JSON을 읽을 수 없습니다: ${detail}`);
  }
}

function stringField(value: Record<string, unknown>, field: string, fileName: string): string {
  const fieldValue = value[field];
  if (typeof fieldValue !== "string") {
    throw new Error(`${fileName} ${field} 필드가 필요합니다.`);
  }
  return fieldValue;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
