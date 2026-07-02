import { existsSync } from "node:fs";
import { join } from "node:path";
import {
  afRunStageStatuses,
  afRunStages,
  afRunValidationResults,
  afStageRunCodexBackends,
  afStageRunIdPattern,
  afStageRunStatuses
} from "./constants.mjs";
import { readJson } from "./files.mjs";

export function validateAfRunManifest({ dir, errors }) {
  const path = join(dir, "af-run-manifest.json");
  if (!existsSync(path)) {
    return;
  }
  const manifest = readJson(path, errors);
  if (!manifest || typeof manifest !== "object" || Array.isArray(manifest)) {
    errors.push("af-run-manifest.json must contain an object.");
    return;
  }

  const label = "af-run-manifest.json";
  requireNonEmptyString(manifest.requirement_id, `${label}.requirement_id`, errors);
  const artifactRootOk = requireNonEmptyString(manifest.artifact_root, `${label}.artifact_root`, errors);
  if (artifactRootOk && manifest.artifact_root.includes("\\")) {
    errors.push(`${label}.artifact_root must use POSIX-style / separators.`);
  }
  if (!afRunStages.has(manifest.current_stage)) {
    errors.push(`${label}.current_stage must be one of ${Array.from(afRunStages).join(", ")}.`);
  }

  if (!manifest.stages || typeof manifest.stages !== "object" || Array.isArray(manifest.stages)) {
    errors.push(`${label}.stages must be an object.`);
  } else {
    for (const stage of afRunStages) {
      validateAfRunStage(manifest.stages[stage], `${label}.stages.${stage}`, errors);
    }
  }

  if (!manifest.approvals || typeof manifest.approvals !== "object" || Array.isArray(manifest.approvals)) {
    errors.push(`${label}.approvals must be an object.`);
  } else {
    for (const key of [
      "analysis_reviewed",
      "boundaries_approved",
      "runtime_contracts_approved",
      "stub_ready_for_followup"
    ]) {
      if (typeof manifest.approvals[key] !== "boolean") {
        errors.push(`${label}.approvals.${key} must be a boolean.`);
      }
    }
  }

  if (!manifest.validation || typeof manifest.validation !== "object" || Array.isArray(manifest.validation)) {
    errors.push(`${label}.validation must be an object.`);
  } else {
    if (!Array.isArray(manifest.validation.commands)) {
      errors.push(`${label}.validation.commands must be an array.`);
    } else {
      manifest.validation.commands.forEach((command, index) => {
        if (typeof command !== "string" || !command.trim()) {
          errors.push(`${label}.validation.commands[${index}] must be a non-empty string.`);
        }
      });
    }
    if (!afRunValidationResults.has(manifest.validation.last_result)) {
      errors.push(`${label}.validation.last_result must be one of ${Array.from(afRunValidationResults).join(", ")}.`);
    }
  }

  if (manifest.stage_runs !== undefined) {
    validateAfStageRuns(manifest.stage_runs, `${label}.stage_runs`, errors);
  }
}

function validateAfRunStage(stage, label, errors) {
  if (!stage || typeof stage !== "object" || Array.isArray(stage)) {
    errors.push(`${label} must be an object.`);
    return;
  }
  if (!afRunStageStatuses.has(stage.status)) {
    errors.push(`${label}.status must be one of ${Array.from(afRunStageStatuses).join(", ")}.`);
  }
  if (!Array.isArray(stage.outputs)) {
    errors.push(`${label}.outputs must be an array.`);
    return;
  }
  stage.outputs.forEach((output, index) => {
    if (typeof output !== "string" || !output.trim()) {
      errors.push(`${label}.outputs[${index}] must be a non-empty string.`);
      return;
    }
    if (output.includes("\\")) {
      errors.push(`${label}.outputs[${index}] must use POSIX-style / separators.`);
    }
  });
}

function validateAfStageRuns(stageRuns, label, errors) {
  if (!stageRuns || typeof stageRuns !== "object" || Array.isArray(stageRuns)) {
    errors.push(`${label} must be an object when present.`);
    return;
  }
  for (const [stage, entry] of Object.entries(stageRuns)) {
    const entryLabel = `${label}.${stage}`;
    if (!afRunStages.has(stage)) {
      errors.push(`${entryLabel} uses an unknown stage key.`);
      continue;
    }
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
      errors.push(`${entryLabel} must be an object.`);
      continue;
    }
    if (!afStageRunIdPattern.test(entry.latest_run_id) || !entry.latest_run_id.includes(`-${stage}-`)) {
      errors.push(`${entryLabel}.latest_run_id must be a sortable stage run id.`);
    }
    if (!afStageRunStatuses.has(entry.status)) {
      errors.push(`${entryLabel}.status must be one of ${Array.from(afStageRunStatuses).join(", ")}.`);
    }
    requireNonEmptyString(entry.started_at, `${entryLabel}.started_at`, errors);
    if (entry.finished_at !== null && entry.finished_at !== undefined && typeof entry.finished_at !== "string") {
      errors.push(`${entryLabel}.finished_at must be a string or null.`);
    }
    requireNonEmptyString(entry.skill_name, `${entryLabel}.skill_name`, errors);
    requireNonEmptyString(entry.model, `${entryLabel}.model`, errors);
    if (!Array.isArray(entry.output_artifacts)) {
      errors.push(`${entryLabel}.output_artifacts must be an array.`);
    } else {
      entry.output_artifacts.forEach((artifactPath, index) => {
        if (typeof artifactPath !== "string" || !artifactPath.trim()) {
          errors.push(`${entryLabel}.output_artifacts[${index}] must be a non-empty string.`);
          return;
        }
        if (artifactPath.includes("\\") || artifactPath.includes("..")) {
          errors.push(`${entryLabel}.output_artifacts[${index}] must be a safe POSIX-style relative path.`);
        }
      });
    }
    if (entry.last_error !== null && entry.last_error !== undefined && typeof entry.last_error !== "string") {
      errors.push(`${entryLabel}.last_error must be a string or null.`);
    }
    if (entry.codex !== undefined) {
      validateAfStageRunCodex(entry.codex, `${entryLabel}.codex`, errors);
    }
  }
}

function validateAfStageRunCodex(codex, label, errors) {
  if (!codex || typeof codex !== "object" || Array.isArray(codex)) {
    errors.push(`${label} must be an object when present.`);
    return;
  }
  if (!afStageRunCodexBackends.has(codex.backend)) {
    errors.push(`${label}.backend must be one of ${Array.from(afStageRunCodexBackends).join(", ")}.`);
  }
  if (codex.thread_id !== null && typeof codex.thread_id !== "string") {
    errors.push(`${label}.thread_id must be a string or null.`);
  }
  if (!Number.isInteger(codex.event_count) || codex.event_count < 0) {
    errors.push(`${label}.event_count must be a non-negative integer.`);
  }
  if (codex.usage !== undefined) {
    errors.push(`${label}.usage must not be recorded in af-run-manifest.json; keep usage in result-summary.json.`);
  }
}

function requireNonEmptyString(value, label, errors) {
  if (typeof value !== "string" || !value.trim()) {
    errors.push(`${label} must be a non-empty string.`);
    return false;
  }
  return true;
}
