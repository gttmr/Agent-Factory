import type { GraphIR, ModuleCandidate, ModuleSmokeSpec, ModuleStatus } from "./types";

const DEFAULT_RESOLUTION_NOTE = "모듈 검토에서 누락 항목 해소 후 승인";

export function resolveMissingItem(candidate: ModuleCandidate, item: string, note?: string): ModuleCandidate {
  const resolvedItems = dedupeStrings([...(candidate.resolved_missing_information ?? []), item]);
  const trimmedNote = note?.trim() ?? "";
  const existingResolution = candidate.missing_information_resolution?.trim() ?? "";

  return {
    ...candidate,
    missing_information: candidate.missing_information.filter((missingItem) => missingItem !== item),
    resolved_missing_information: resolvedItems,
    missing_information_resolution: trimmedNote
      ? existingResolution
        ? `${existingResolution}\n${trimmedNote}`
        : trimmedNote
      : candidate.missing_information_resolution ?? ""
  };
}

export function approveCandidate(candidate: ModuleCandidate, now = new Date()): ModuleCandidate {
  if (candidate.missing_information.length > 0) return candidate;

  return {
    ...candidate,
    status: "approved",
    missing_information_resolution:
      candidate.missing_information_resolution?.trim() || DEFAULT_RESOLUTION_NOTE,
    resolved_missing_information: dedupeStrings(candidate.resolved_missing_information ?? []),
    resolution_applied_at: now.toISOString(),
    schema_review_state: "applied",
    smoke_spec: candidate.smoke_spec ?? buildManualSmokeSpec(candidate)
  };
}

export function buildManualSmokeSpec(candidate: ModuleCandidate): ModuleSmokeSpec {
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

export function setCandidateStatus(candidate: ModuleCandidate, status: "deferred" | "rejected"): ModuleCandidate {
  return { ...candidate, status };
}

export function applyNodeReviewStatus(graph: GraphIR, candidateId: string, status: ModuleStatus): GraphIR {
  return {
    ...graph,
    nodes: graph.nodes.map((node) =>
      node.module_id === candidateId ? { ...node, review_status: status } : node
    )
  };
}

function dedupeStrings(items: string[]): string[] {
  const seen = new Set<string>();
  const deduped: string[] = [];
  for (const item of items) {
    if (!item.trim()) continue;
    if (seen.has(item)) continue;
    seen.add(item);
    deduped.push(item);
  }
  return deduped;
}
