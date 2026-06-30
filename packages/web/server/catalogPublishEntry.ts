import type { CatalogCategory, PublishProposal } from "./catalogPublishValidation";

export function buildPublishedEntry(proposal: PublishProposal, version: number, reqId: string): Record<string, unknown> {
  const category = proposal.category as CatalogCategory;
  const name = (proposal.name as string).trim();
  const entry: Record<string, unknown> = {
    id: `${category}-${name}`.toLowerCase().replace(/[^a-z0-9-_]/g, "-"),
    name,
    version,
    status: "published",
    provenance: "catalog_published",
    owner_domain: (proposal.owner_domain as string).trim(),
    published_at: new Date().toISOString(),
    published_from: reqId,
    module_category: category
  };

  if (typeof proposal.source_candidate_id === "string" && proposal.source_candidate_id.trim()) {
    entry.source_candidate_id = proposal.source_candidate_id.trim();
  }
  copyOptionalString(entry, "component_source", proposal.component_source);
  copyOptionalString(entry, "runtime_binding", proposal.runtime_binding);
  copyOptionalString(entry, "a2a_provider_req_id", proposal.a2a_provider_req_id);
  if (category === "agent") entry.agent_kind = proposal.agent_kind;
  if (category === "workflow") entry.workflow_kind = proposal.workflow_kind;
  if (category === "adapter") entry.adapter_kind = proposal.adapter_kind;
  if (category === "remote_a2a") entry.remote_contract_kind = proposal.remote_contract_kind;
  copyOptionalString(entry, "responsibility", proposal.responsibility);
  copyOptionalArray(entry, "inputs", proposal.inputs);
  copyOptionalArray(entry, "outputs", proposal.outputs);
  copyOptionalArray(entry, "composition", proposal.composition);
  copyOptionalArray(entry, "risk_signals", proposal.risk_signals);
  copyOptionalArray(entry, "required_before_approval", proposal.required_before_approval);
  copyOptionalString(entry, "contract_status", proposal.contract_status);
  copyOptionalString(entry, "notes", proposal.notes);
  return entry;
}

export function deepEqualPublishedFields(entry: Record<string, unknown>, proposal: PublishProposal): boolean {
  return JSON.stringify(publishedFieldSnapshot(entry)) === JSON.stringify(proposalFieldSnapshot(proposal));
}

function publishedFieldSnapshot(entry: Record<string, unknown>): Record<string, unknown> {
  const category = typeof entry.module_category === "string" ? entry.module_category : entry.category;
  return omitUndefined({
    category,
    subtype: subtypeFor(category, entry),
    component_source: readTrimmedString(entry.component_source),
    runtime_binding: readTrimmedString(entry.runtime_binding),
    a2a_provider_req_id: readTrimmedString(entry.a2a_provider_req_id),
    contract_status: readTrimmedString(entry.contract_status),
    owner_domain: readTrimmedString(entry.owner_domain),
    responsibility: readTrimmedString(entry.responsibility),
    inputs: readNonEmptyArray(entry.inputs),
    outputs: readNonEmptyArray(entry.outputs),
    composition: readNonEmptyArray(entry.composition),
    risk_signals: readStringArray(entry.risk_signals),
    required_before_approval: readStringArray(entry.required_before_approval),
    notes: readTrimmedString(entry.notes)
  });
}

function proposalFieldSnapshot(proposal: PublishProposal): Record<string, unknown> {
  const category = proposal.category;
  return omitUndefined({
    category,
    subtype: subtypeFor(category, proposal),
    component_source: readTrimmedString(proposal.component_source),
    runtime_binding: readTrimmedString(proposal.runtime_binding),
    a2a_provider_req_id: readTrimmedString(proposal.a2a_provider_req_id),
    contract_status: readTrimmedString(proposal.contract_status),
    owner_domain: readTrimmedString(proposal.owner_domain),
    responsibility: readTrimmedString(proposal.responsibility),
    inputs: readNonEmptyArray(proposal.inputs),
    outputs: readNonEmptyArray(proposal.outputs),
    composition: readNonEmptyArray(proposal.composition),
    risk_signals: readStringArray(proposal.risk_signals),
    required_before_approval: readStringArray(proposal.required_before_approval),
    notes: readTrimmedString(proposal.notes)
  });
}

function subtypeFor(category: unknown, entry: PublishProposal | Record<string, unknown>): unknown {
  if (category === "agent") return entry.agent_kind;
  if (category === "workflow") return entry.workflow_kind;
  if (category === "adapter") return entry.adapter_kind;
  if (category === "remote_a2a") return entry.remote_contract_kind;
  return undefined;
}

function readTrimmedString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function readNonEmptyArray(value: unknown): unknown[] | undefined {
  return Array.isArray(value) && value.length > 0 ? value : undefined;
}

function readStringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const strings = value.filter((item): item is string => typeof item === "string" && Boolean(item.trim())).map((item) => item.trim());
  return strings.length > 0 ? strings : undefined;
}

function omitUndefined(source: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(source).filter(([, value]) => value !== undefined));
}

function copyOptionalString(target: Record<string, unknown>, key: string, value: unknown): void {
  if (typeof value === "string" && value.trim()) target[key] = value.trim();
}

function copyOptionalArray(target: Record<string, unknown>, key: string, value: unknown): void {
  if (Array.isArray(value) && value.length > 0) target[key] = value;
}
