// Pure normalization helpers for A2A 1.0 contract data. Imported by both the
// server analyzer middleware (Node) and the client analyzer provider boundary
// (Vite-bundled). Must stay zero-dependency and avoid `node:` imports.
//
// Responsibilities (spec §5, §6, §11):
// - Ensure `a2aContracts` is an array on every AnalysisResult.
// - For every remote_a2a candidate, fill required candidate contract-summary
//   fields with the literal `"needs_info"` and append the field name to
//   `missing_information`. Never overwrite a real value.
// - Mint a paired A2AContract (a2a-NNN) when a remote_a2a candidate has no
//   contract yet, using a placeholder shape that satisfies the schema.
// - For each existing contract, fill any missing required string fields with
//   `"needs_info"` and report which fields were filled in a diagnostic event.
// - Drop orphan contracts whose `remote_module_id` does not match any
//   candidate, and report each removal.

import type { AnalysisResult, A2AContract, ModuleCandidate } from "./types";

// Required candidate fields that must carry a non-empty string per spec §5.
// `a2a_contract_id` is included so candidates link to their contract.
export const A2A_CANDIDATE_REQUIRED_FIELDS = [
  "owner",
  "agent_card",
  "auth",
  "task_lifecycle",
  "timeout",
  "retry",
  "fallback",
  "audit",
  "data_policy",
  "a2a_contract_id"
] as const;

// Required top-level scalar string fields on a contract. Matches the
// validator's `a2aContractRequiredStringFields` list. `contract_id` and
// `remote_module_id` are validated separately because they have format rules.
export const A2A_CONTRACT_REQUIRED_STRING_FIELDS = [
  "target_agent_name",
  "target_agent_purpose",
  "adk_host_mapping",
  "timeout",
  "retry",
  "fallback",
  "cancellation",
  "unsupported_operation",
  "get_task_fallback",
  "auth",
  "token_handling",
  "audit",
  "data_policy"
] as const;

export interface A2ANormalizationDiagnostic {
  /** "candidate_filled" | "contract_filled" | "contract_minted" | "contract_orphan_removed" */
  kind: "candidate_filled" | "contract_filled" | "contract_minted" | "contract_orphan_removed";
  /** Human-readable summary suitable for SSE/console diagnostic emission. */
  message: string;
  /** Module/contract id this diagnostic is about. */
  subjectId: string;
  /** Field names that were placeholder-set (when applicable). */
  fields?: string[];
}

export interface A2ANormalizationResult {
  result: AnalysisResult;
  diagnostics: A2ANormalizationDiagnostic[];
}

/**
 * Default placeholder shape for a freshly minted A2AContract. The validator
 * accepts the literal `"needs_info"` as presence-satisfying for required
 * string fields. `task_lifecycle.states` defaults to a single submitted state
 * to satisfy the non-empty rule. `streaming.supported` defaults to false and
 * `streaming.wrappers` to empty. `push_notification_policy` defaults to null
 * (spec §5 explicitly allows null). The `remote_module_id` and `contract_id`
 * are filled by the caller.
 */
export function buildPlaceholderContract(contractId: string, remoteModuleId: string): A2AContract {
  return {
    contract_id: contractId,
    remote_module_id: remoteModuleId,
    target_agent_name: "needs_info",
    target_agent_purpose: "needs_info",
    contract_status: "needs_info",
    agent_card: {
      discovery_method: "needs_info",
      agent_card_url: "needs_info",
      version: "needs_info",
      notes: "needs_info"
    },
    supported_interfaces: [],
    input_modes: [],
    output_modes: [],
    security_schemes: [],
    security_requirements: [],
    skills: [],
    extensions: [],
    message_contract: {
      allowed_part_fields: [],
      allowed_roles: []
    },
    task_lifecycle: {
      states: ["TASK_STATE_SUBMITTED"],
      allowed_transitions: [],
      terminal_states: [],
      input_required_followup: "needs_info",
      auth_required_followup: "needs_info"
    },
    streaming: {
      supported: false,
      wrappers: [],
      non_streaming_fallback: "needs_info"
    },
    operations: [],
    http_paths: [],
    artifact_contract: {
      mutation_rules: "needs_info",
      chunking_policy: "needs_info"
    },
    adk_host_mapping: "needs_info",
    timeout: "needs_info",
    retry: "needs_info",
    fallback: "needs_info",
    cancellation: "needs_info",
    unsupported_operation: "needs_info",
    get_task_fallback: "needs_info",
    push_notification_policy: null,
    auth: "needs_info",
    token_handling: "needs_info",
    audit: "needs_info",
    data_policy: "needs_info"
  };
}

/**
 * Normalize the A2A portion of an AnalysisResult. Pure function. Returns a
 * shallow-cloned result plus a list of diagnostics. The caller is responsible
 * for emitting diagnostics into its preferred channel (SSE, console, etc.).
 */
export function normalizeA2A(input: AnalysisResult | null | undefined): A2ANormalizationResult {
  if (!input || typeof input !== "object") {
    return { result: input as unknown as AnalysisResult, diagnostics: [] };
  }
  const diagnostics: A2ANormalizationDiagnostic[] = [];

  // Defensive: ensure a2aContracts is an array regardless of upstream shape.
  const contracts: A2AContract[] = Array.isArray(input.a2aContracts) ? [...input.a2aContracts] : [];
  const candidates: ModuleCandidate[] = Array.isArray(input.moduleCandidates)
    ? input.moduleCandidates.map((candidate) => ({ ...candidate }))
    : [];

  // Used contract ids — for minting fresh ones without colliding.
  const usedContractIds = new Set<string>();
  for (const contract of contracts) {
    if (contract && typeof contract.contract_id === "string") {
      usedContractIds.add(contract.contract_id);
    }
  }
  for (const candidate of candidates) {
    if (candidate && typeof candidate.a2a_contract_id === "string") {
      usedContractIds.add(candidate.a2a_contract_id);
    }
  }

  // Pass 1: drop orphan contracts whose remote_module_id does not match any
  // remote_a2a candidate. Spec §6/§11: every contract must pair 1:1 with a
  // remote candidate; a contract pointing at a missing/non-remote candidate
  // is unusable and must be removed from the artifact.
  const remoteCandidateIds = new Set(
    candidates
      .filter((candidate) => candidate && candidate.module_category === "remote_a2a" && typeof candidate.id === "string")
      .map((candidate) => candidate.id as string)
  );
  const keptContracts: A2AContract[] = [];
  for (const contract of contracts) {
    if (!contract || typeof contract !== "object") continue;
    const moduleId = typeof contract.remote_module_id === "string" ? contract.remote_module_id : "";
    if (!remoteCandidateIds.has(moduleId)) {
      diagnostics.push({
        kind: "contract_orphan_removed",
        subjectId: typeof contract.contract_id === "string" ? contract.contract_id : "(unknown)",
        message: `orphan A2A contract removed: ${
          typeof contract.contract_id === "string" ? contract.contract_id : "(unknown)"
        }`
      });
      continue;
    }
    keptContracts.push(contract);
  }

  // Index contracts by remote_module_id for quick lookup.
  const contractByModuleId = new Map<string, A2AContract>();
  for (const contract of keptContracts) {
    if (typeof contract.remote_module_id === "string") {
      // Keep first occurrence; downstream validator catches duplicates.
      if (!contractByModuleId.has(contract.remote_module_id)) {
        contractByModuleId.set(contract.remote_module_id, contract);
      }
    }
  }

  // Pass 2: fill candidate-side required fields and ensure contract pairing.
  for (let i = 0; i < candidates.length; i += 1) {
    const candidate = candidates[i];
    if (!candidate || candidate.module_category !== "remote_a2a") continue;

    const filled: string[] = [];
    const missingInfo = Array.isArray(candidate.missing_information)
      ? [...candidate.missing_information]
      : [];

    const candidateRecord = candidate as unknown as Record<string, unknown>;
    for (const field of A2A_CANDIDATE_REQUIRED_FIELDS) {
      if (field === "a2a_contract_id") continue; // handled below after contract resolution
      const current = candidateRecord[field];
      if (typeof current !== "string" || !current.trim()) {
        candidateRecord[field] = "needs_info";
        filled.push(field);
        if (!missingInfo.includes(field)) missingInfo.push(field);
      }
    }

    // Resolve / mint contract pairing.
    let pairedContract = typeof candidate.id === "string" ? contractByModuleId.get(candidate.id) : undefined;
    if (!pairedContract) {
      // No paired contract exists. Either the candidate already references
      // a contract id we lost (orphan-dropped, schema mismatch) or we need
      // to mint a new one.
      const existingId =
        typeof candidate.a2a_contract_id === "string" && /^a2a-\d{3,}$/.test(candidate.a2a_contract_id)
          ? candidate.a2a_contract_id
          : mintNextContractId(usedContractIds);
      usedContractIds.add(existingId);
      const minted = buildPlaceholderContract(existingId, typeof candidate.id === "string" ? candidate.id : "");
      keptContracts.push(minted);
      contractByModuleId.set(typeof candidate.id === "string" ? candidate.id : "", minted);
      pairedContract = minted;
      diagnostics.push({
        kind: "contract_minted",
        subjectId: existingId,
        message: `synthesized placeholder A2A contract ${existingId} for remote candidate ${
          candidate.id ?? "(unknown)"
        }`
      });
    }

    // Ensure candidate.a2a_contract_id matches the paired contract id.
    if (candidate.a2a_contract_id !== pairedContract.contract_id) {
      candidate.a2a_contract_id = pairedContract.contract_id;
      if (!filled.includes("a2a_contract_id")) filled.push("a2a_contract_id");
      // a2a_contract_id is a presence requirement; if it was missing before
      // surface it in missing_information so the reviewer sees the link.
      if (!missingInfo.includes("a2a_contract_id")) missingInfo.push("a2a_contract_id");
    }

    candidate.missing_information = dedupe(missingInfo);

    if (filled.length > 0) {
      diagnostics.push({
        kind: "candidate_filled",
        subjectId: typeof candidate.id === "string" ? candidate.id : "(unknown)",
        fields: filled,
        message: `placeholder needs_info applied to remote candidate ${
          candidate.id ?? "(unknown)"
        }: ${filled.join(", ")}`
      });
    }
  }

  // Pass 3: fill required string fields on contracts (do not overwrite real values).
  for (const contract of keptContracts) {
    const filled: string[] = [];
    const contractRecord = contract as unknown as Record<string, unknown>;
    for (const field of A2A_CONTRACT_REQUIRED_STRING_FIELDS) {
      const current = contractRecord[field];
      if (typeof current !== "string" || !current.trim()) {
        contractRecord[field] = "needs_info";
        filled.push(field);
      }
    }
    if (filled.length > 0) {
      diagnostics.push({
        kind: "contract_filled",
        subjectId: typeof contract.contract_id === "string" ? contract.contract_id : "(unknown)",
        fields: filled,
        message: `placeholder needs_info applied to A2A contract ${
          contract.contract_id ?? "(unknown)"
        }: ${filled.join(", ")}`
      });
    }
  }

  const normalized: AnalysisResult = {
    ...input,
    moduleCandidates: candidates,
    a2aContracts: keptContracts
  };

  return { result: normalized, diagnostics };
}

/** Mint the next free `a2a-NNN` id given a set of used ids. */
export function mintNextContractId(used: Set<string>): string {
  let n = 1;
  // Cap at 999_999 to avoid accidental infinite loops; way more than realistic.
  while (n < 1_000_000) {
    const id = `a2a-${String(n).padStart(3, "0")}`;
    if (!used.has(id)) return id;
    n += 1;
  }
  // Fallback (extremely unlikely): timestamp-based id that still matches the
  // a2a-NNN pattern is impossible since the pattern requires only digits.
  // Return the first id to surface a deterministic collision rather than
  // silently corrupting data; the validator will catch the duplicate.
  return "a2a-001";
}

function dedupe(list: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of list) {
    if (typeof item !== "string") continue;
    if (seen.has(item)) continue;
    seen.add(item);
    out.push(item);
  }
  return out;
}

// Lightweight non-production sanity checks. These run once at module import
// time when NODE_ENV !== "production". They do not require a test framework.
if (typeof process !== "undefined" && process.env && process.env.NODE_ENV !== "production") {
  // mintNextContractId picks 001 when nothing is used.
  const empty = new Set<string>();
  if (mintNextContractId(empty) !== "a2a-001") {
    console.warn("[a2aNormalize] sanity: mintNextContractId(empty) should be a2a-001");
  }
  // mintNextContractId skips over taken ids.
  const taken = new Set<string>(["a2a-001", "a2a-002"]);
  if (mintNextContractId(taken) !== "a2a-003") {
    console.warn("[a2aNormalize] sanity: mintNextContractId should skip taken ids");
  }
  // normalizeA2A on empty result returns an empty array.
  const baseline = normalizeA2A({
    normalizedRequirement: {} as never,
    evidence: {} as never,
    moduleCandidates: [],
    a2aContracts: [],
    processFlow: {} as never
  });
  if (!Array.isArray(baseline.result.a2aContracts) || baseline.result.a2aContracts.length !== 0) {
    console.warn("[a2aNormalize] sanity: empty input should produce empty contracts array");
  }
}
