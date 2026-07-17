import { buildDefaultA2ARuntimePolicy } from "../analyzer/a2aNormalize";
import type { A2AContract, ModuleCandidate } from "../analyzer/types";
import { a2aContractReadinessIssues, findMatchingA2AContract, remoteA2ACandidates } from "./a2aContractValidator";

export interface A2AReviewRow {
  candidate: ModuleCandidate;
  contract: A2AContract | null;
  issues: string[];
}

export function buildA2AReviewRows(candidates: ModuleCandidate[], contracts: A2AContract[]): A2AReviewRow[] {
  return remoteA2ACandidates(candidates).map((candidate) => {
    const contract = findMatchingA2AContract(candidate, contracts);
    return {
      candidate,
      contract,
      issues: contract ? a2aContractReadinessIssues(contract) : ["matching A2A contract is missing"]
    };
  });
}

export function createA2AContractDraft(contract: A2AContract): A2AContract {
  return {
    ...contract,
    adk_runtime_policy: contract.adk_runtime_policy ?? buildDefaultA2ARuntimePolicy()
  };
}

export function hasA2AContractDraftChanges(contract: A2AContract, draft: A2AContract): boolean {
  return JSON.stringify(draft) !== JSON.stringify(contract);
}

export function isA2AContractApprovalBlocked(contract: A2AContract, issues: readonly string[]): boolean {
  return contract.contract_status === "approved" && issues.some((issue) => !issue.startsWith("contract_status"));
}

export function splitA2ATextList(value: string): string[] {
  return value
    .split(/[,\n]/)
    .map((entry) => entry.trim())
    .filter(Boolean);
}

export function nullableA2AText(value: string): string | null {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

export function formatA2ANullableNumber(value: number | null): string {
  return value === null ? "" : String(value);
}

export function parseA2ANullableNumber(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

export function createEmptyA2AInterface(): A2AContract["supported_interfaces"][number] {
  return {
    url: "needs_info",
    protocol_binding: "HTTP+JSON",
    protocol_version: "A2A 1.0",
    tenant_policy: "needs_info"
  };
}
