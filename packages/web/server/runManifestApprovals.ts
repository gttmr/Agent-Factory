import { isDeepStrictEqual } from "node:util";
import type { AfRunManifest } from "../src/analyzer/afRunManifest";
import type { AnalysisResult } from "../src/analyzer/types";

export type AnalysisChangeScope = "analyze" | "design";

export function projectApprovalStageStatuses(
  manifest: AfRunManifest,
  approvals: AfRunManifest["approvals"]
): AfRunManifest["stages"] {
  return {
    ...manifest.stages,
    analyze: {
      ...manifest.stages.analyze,
      status: approvals.analysis_reviewed ? "complete" : "pending"
    },
    design: {
      ...manifest.stages.design,
      status: approvals.boundaries_approved && approvals.runtime_contracts_approved ? "complete" : "pending"
    },
    build: {
      ...manifest.stages.build,
      status: approvals.stub_ready_for_followup ? "complete" : "pending"
    }
  };
}

export function classifyAnalysisChange(
  previous: AnalysisResult | null,
  next: AnalysisResult
): AnalysisChangeScope | null {
  if (previous && isDeepStrictEqual(previous, next)) return null;
  if (
    !previous ||
    !isDeepStrictEqual(previous.normalizedRequirement, next.normalizedRequirement) ||
    !isDeepStrictEqual(previous.evidence, next.evidence)
  ) {
    return "analyze";
  }
  return "design";
}

export function invalidateApprovalsForAnalysisChange(
  manifest: AfRunManifest,
  scope: AnalysisChangeScope
): AfRunManifest {
  const approvals: AfRunManifest["approvals"] = {
    analysis_reviewed: scope === "analyze" ? false : manifest.approvals.analysis_reviewed,
    boundaries_approved: false,
    runtime_contracts_approved: false,
    stub_ready_for_followup: false
  };
  const projectedStages = projectApprovalStageStatuses(manifest, approvals);
  return {
    ...manifest,
    current_stage: scope,
    approvals,
    stages: {
      ...projectedStages,
      verify: {
        ...projectedStages.verify,
        status: "pending"
      }
    },
    validation: { commands: [], last_result: "not_run" }
  };
}
