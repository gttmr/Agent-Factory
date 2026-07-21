import { isDeepStrictEqual } from "node:util";
import type { PublishProposal } from "./catalogPublishValidation";

export function buildPublishedEntry(proposal: PublishProposal, version: number, reqId: string): Record<string, unknown> {
  return omitUndefined({
    asset_id: proposal.asset_id,
    asset_type: proposal.asset_type,
    name: proposal.name,
    version,
    status: "published",
    provenance: "catalog_published",
    published_at: new Date().toISOString(),
    published_from: reqId,
    domain_scope: proposal.domain_scope,
    business_domains: proposal.business_domains,
    owner: proposal.owner,
    reuse_status: "reuse_existing",
    capability_tags: proposal.capability_tags,
    binding: proposal.binding,
    connection: proposal.connection,
    workflow_profile: proposal.workflow_profile,
    exposure: proposal.exposure,
    source_candidate_id: proposal.source_candidate_id,
    responsibility: proposal.responsibility,
    inputs: proposal.inputs,
    outputs: proposal.outputs,
    composition: proposal.composition,
    risk_signals: proposal.risk_signals,
    runtime_mock: proposal.runtime_mock,
    required_before_approval: proposal.required_before_approval,
    contract_status: proposal.contract_status,
    notes: proposal.notes
  });
}

export function deepEqualPublishedFields(entry: Record<string, unknown>, proposal: PublishProposal): boolean {
  return isDeepStrictEqual(publishedSnapshot(entry), proposalSnapshot(proposal));
}

function publishedSnapshot(entry: Record<string, unknown>): Record<string, unknown> {
  return omitUndefined({
    asset_id: entry.asset_id,
    asset_type: entry.asset_type,
    name: entry.name,
    domain_scope: entry.domain_scope,
    business_domains: entry.business_domains,
    owner: entry.owner,
    reuse_status: entry.reuse_status,
    capability_tags: entry.capability_tags,
    binding: entry.binding,
    connection: entry.connection,
    workflow_profile: entry.workflow_profile,
    exposure: entry.exposure,
    source_candidate_id: entry.source_candidate_id,
    responsibility: entry.responsibility,
    inputs: entry.inputs,
    outputs: entry.outputs,
    composition: entry.composition,
    risk_signals: entry.risk_signals,
    runtime_mock: entry.runtime_mock,
    required_before_approval: entry.required_before_approval,
    contract_status: entry.contract_status,
    notes: entry.notes
  });
}

function proposalSnapshot(proposal: PublishProposal): Record<string, unknown> {
  return publishedSnapshot({ ...proposal, reuse_status: "reuse_existing" });
}

function omitUndefined(value: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(value).filter(([, entry]) => entry !== undefined));
}
