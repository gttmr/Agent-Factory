import { normalizeA2A } from "./a2aNormalize";
import { mergeGraphIRValidation, normalizeGraphIRForRuntime, validateGraphIRSoft } from "./graphMigration";
import { hasModuleCoverageErrors, repairGraphIRModuleCoverage } from "./moduleReviewGraph";
import { ensureRuntimeContracts } from "./runtimeContracts";
import type { AnalysisResult, ModuleCandidate } from "./types";

export function normalizeAnalysisResultForWorkbench(result: AnalysisResult): AnalysisResult {
  if (!result || typeof result !== "object") return result;
  const withGraph = normalizeProcessFlowForWorkbench(result);
  const withA2A = normalizeA2A(withGraph).result;
  const withContracts = ensureRuntimeContracts(withA2A);
  return {
    ...withContracts,
    moduleCandidates: backfillCandidateReviewFields(withContracts.moduleCandidates)
  };
}

function backfillCandidateReviewFields(candidates: ModuleCandidate[]): ModuleCandidate[] {
  return candidates.map((candidate) => ({
    ...candidate,
    missing_information_resolution:
      typeof candidate.missing_information_resolution === "string"
        ? candidate.missing_information_resolution
        : "",
    resolved_missing_information: Array.isArray(candidate.resolved_missing_information)
      ? candidate.resolved_missing_information
      : [],
    resolution_draft: candidate.resolution_draft ?? null,
    resolution_applied_at:
      typeof candidate.resolution_applied_at === "string" ? candidate.resolution_applied_at : null,
    schema_review_state:
      candidate.schema_review_state === "drafted" || candidate.schema_review_state === "applied"
        ? candidate.schema_review_state
        : "not_started",
    smoke_spec: candidate.smoke_spec ?? null
  }));
}

function normalizeProcessFlowForWorkbench(result: AnalysisResult): AnalysisResult {
  const requirementId =
    result.normalizedRequirement && typeof result.normalizedRequirement.id === "string"
      ? result.normalizedRequirement.id
      : "req-001";
  const migrated = normalizeGraphIRForRuntime(result.processFlow, requirementId);
  const soft = validateGraphIRSoft(migrated);
  const validated = {
    ...migrated,
    validation: mergeGraphIRValidation(migrated.validation, soft)
  };
  const processFlow = hasModuleCoverageErrors(validated)
    ? repairGraphIRModuleCoverage(validated, result.moduleCandidates)
    : validated;
  return { ...result, processFlow };
}
