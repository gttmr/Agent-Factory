import type { AssetCandidate, AssetSmokeSpec } from "./types";
import { candidateSemanticReadinessIssues } from "./targetContract";

export function resolveMissingItem(candidate: AssetCandidate, item: string, note?: string): AssetCandidate {
  const resolved = new Set(candidate.resolved_missing_information ?? []);
  resolved.add(item);
  const remaining = candidate.missing_information.filter((entry) => !resolved.has(entry));
  return {
    ...candidate,
    resolved_missing_information: [...resolved],
    missing_information_resolution: note?.trim() || candidate.missing_information_resolution,
    status: remaining.length ? "needs_info" : candidate.status
  };
}

export function approveCandidate(candidate: AssetCandidate, now = new Date()): AssetCandidate {
  if (candidateSemanticReadinessIssues(candidate).length) return candidate;
  return {
    ...candidate,
    status: "approved",
    resolution_applied_at: candidate.resolution_applied_at ?? now.toISOString(),
    smoke_spec: candidate.smoke_spec ?? buildManualSmokeSpec(candidate)
  };
}

export function buildManualSmokeSpec(candidate: AssetCandidate): AssetSmokeSpec {
  return {
    sample_user_message: `${candidate.name} synthetic smoke request`,
    synthetic_inputs: {},
    expected_output_shape: { type: "object" },
    expected_event_markers: [],
    mock_sources: [],
    ready: false
  };
}

export function setCandidateStatus(candidate: AssetCandidate, status: "deferred" | "rejected"): AssetCandidate {
  return { ...candidate, status };
}
