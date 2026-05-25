export const afRunStageIds = ["analyze", "design", "build", "verify"] as const;
export const afRunStageStatuses = ["pending", "complete", "blocked"] as const;
export const afRunValidationResults = ["not_run", "passed", "failed"] as const;

export type AfRunStageId = (typeof afRunStageIds)[number];
export type AfRunStageStatus = (typeof afRunStageStatuses)[number];
export type AfRunValidationResult = (typeof afRunValidationResults)[number];

export interface AfRunStage {
  status: AfRunStageStatus;
  outputs: string[];
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
  const requirementId = stringField(parsed, "requirement_id", fileName);
  if (!requirementId.trim()) {
    throw new Error(`${fileName} requirement_id가 비어 있습니다.`);
  }
  const currentStage = normalizeStageId(parsed.current_stage);

  return {
    requirement_id: requirementId,
    artifact_root: optionalString(parsed.artifact_root) || `artifacts/af/${requirementId}`,
    current_stage: currentStage,
    stages: normalizeStages(parsed.stages),
    approvals: normalizeApprovals(parsed.approvals),
    validation: normalizeValidation(parsed.validation)
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

function normalizeStages(value: unknown): Record<AfRunStageId, AfRunStage> {
  const record = isRecord(value) ? value : {};
  return {
    analyze: normalizeStage(record.analyze),
    design: normalizeStage(record.design),
    build: normalizeStage(record.build),
    verify: normalizeStage(record.verify)
  };
}

function normalizeStage(value: unknown): AfRunStage {
  const record = isRecord(value) ? value : {};
  return {
    status: normalizeStageStatus(record.status),
    outputs: Array.isArray(record.outputs) ? record.outputs.filter((item): item is string => typeof item === "string") : []
  };
}

function normalizeApprovals(value: unknown): AfRunManifest["approvals"] {
  const record = isRecord(value) ? value : {};
  return {
    analysis_reviewed: record.analysis_reviewed === true,
    boundaries_approved: record.boundaries_approved === true,
    runtime_contracts_approved: record.runtime_contracts_approved === true,
    stub_ready_for_followup: record.stub_ready_for_followup === true
  };
}

function normalizeValidation(value: unknown): AfRunManifest["validation"] {
  const record = isRecord(value) ? value : {};
  return {
    commands: Array.isArray(record.commands) ? record.commands.filter((item): item is string => typeof item === "string") : [],
    last_result: normalizeValidationResult(record.last_result)
  };
}

function normalizeStageId(value: unknown): AfRunStageId {
  return typeof value === "string" && afRunStageIds.includes(value as AfRunStageId)
    ? (value as AfRunStageId)
    : "analyze";
}

function normalizeStageStatus(value: unknown): AfRunStageStatus {
  return typeof value === "string" && afRunStageStatuses.includes(value as AfRunStageStatus)
    ? (value as AfRunStageStatus)
    : "pending";
}

function normalizeValidationResult(value: unknown): AfRunValidationResult {
  return typeof value === "string" && afRunValidationResults.includes(value as AfRunValidationResult)
    ? (value as AfRunValidationResult)
    : "not_run";
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

function optionalString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
