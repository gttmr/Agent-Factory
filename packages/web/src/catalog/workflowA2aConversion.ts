import type { WorkflowKind } from "../analyzer/types";
import type { ProposedAddition } from "./catalogDelta";
import type { CatalogCategory, CatalogHubEntry, CatalogIO } from "./catalogIndex";

export interface WorkflowA2aAgentCard {
  readonly provider_req_id: string;
  readonly app_name: string;
}

export type WorkflowA2aConversionError =
  | {
      readonly code: "not_workflow";
      readonly message: string;
      readonly category: CatalogCategory;
    }
  | {
      readonly code: "missing_provider_req_id";
      readonly message: string;
    }
  | {
      readonly code: "provider_card_mismatch";
      readonly message: string;
      readonly provider_req_id: string;
    };

export type WorkflowA2aConversionResult =
  | {
      readonly ok: true;
      readonly proposal: ProposedAddition;
    }
  | {
      readonly ok: false;
      readonly error: WorkflowA2aConversionError;
    };

export function buildWorkflowA2aConversionProposal(
  entry: CatalogHubEntry,
  providerReqId: string,
  agentCard: WorkflowA2aAgentCard
): WorkflowA2aConversionResult {
  if (entry.category !== "workflow") {
    return {
      ok: false,
      error: {
        code: "not_workflow",
        message: "Workflow A2A conversion requires a workflow catalog entry.",
        category: entry.category
      }
    };
  }

  const trimmedProviderReqId = providerReqId.trim();
  if (!trimmedProviderReqId) {
    return {
      ok: false,
      error: {
        code: "missing_provider_req_id",
        message: "Workflow A2A conversion requires a provider artifact root id."
      }
    };
  }

  const cardProviderReqId = agentCard.provider_req_id.trim();
  if (cardProviderReqId !== trimmedProviderReqId) {
    return {
      ok: false,
      error: {
        code: "provider_card_mismatch",
        message: "Runtime A2A Agent Card does not match the selected provider artifact root id.",
        provider_req_id: agentCard.provider_req_id
      }
    };
  }

  const proposal: ProposedAddition = {
    module_category: "workflow",
    name: entry.name,
    workflow_kind: toWorkflowKind(entry.workflow_kind),
    owner_domain: entry.owner_domain,
    responsibility: entry.responsibility,
    inputs: copyIoFields(entry.inputs),
    outputs: copyIoFields(entry.outputs),
    composition: entry.composition ? [...entry.composition] : undefined,
    risk_signals: entry.risk_signals ? [...entry.risk_signals] : undefined,
    required_before_approval: entry.required_before_approval ? [...entry.required_before_approval] : undefined,
    contract_status: "a2a_ready",
    component_source: "remote_a2a",
    runtime_binding: "remote_a2a",
    a2a_provider_req_id: trimmedProviderReqId,
    notes: `A2A-capable version of ${entry.name} using provider ${trimmedProviderReqId} (${agentCard.app_name}).`
  };

  return {
    ok: true,
    proposal
  };
}

function copyIoFields(fields: readonly CatalogIO[] | undefined): CatalogIO[] | undefined {
  if (!fields) return undefined;
  return fields.map((field) => ({ ...field }));
}

function toWorkflowKind(value: string | undefined): WorkflowKind {
  switch (value) {
    case "orchestration":
    case "graph":
    case "dynamic":
    case "unknown":
      return value;
    default:
      return "unknown";
  }
}
