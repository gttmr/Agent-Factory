import type { CatalogEntry } from "../catalog/types";
import type {
  CatalogBinding,
  ComponentSource,
  FieldSpec,
  ModuleCandidate,
  NormalizedRequirement,
  ProcessFlow,
  RiskSignal,
  ScaffoldPlan,
  ScaffoldPlanModule,
  ScaffoldPlanRuntimeContract,
  ScaffoldOutputMode,
  RuntimeContract
} from "./types";
import { runtimeContractReadinessIssues } from "./runtimeContracts";

const DEFAULT_RUNNABLE_MODEL = "gemini-2.5-flash";

export interface BuildScaffoldPlanInput {
  normalizedRequirement: NormalizedRequirement;
  moduleCandidates: ModuleCandidate[];
  processFlow: ProcessFlow;
  catalogEntries: CatalogEntry[];
  runtimeContracts?: RuntimeContract[];
  /** Defaults to `smoke`. `runnable` emits real LlmAgent/MCP wiring from the same approved artifacts. */
  outputMode?: ScaffoldOutputMode;
}

export function buildScaffoldPlan({
  normalizedRequirement,
  moduleCandidates,
  processFlow: _processFlow,
  catalogEntries,
  runtimeContracts = [],
  outputMode = "smoke"
}: BuildScaffoldPlanInput): ScaffoldPlan {
  const activeCatalog = catalogEntries.filter((entry) => entry.provenance !== "session_deleted");
  const modules = moduleCandidates
    .filter((candidate) => candidate.status === "approved")
    .map((candidate) => buildScaffoldModule(candidate, activeCatalog, outputMode));
  const excludedModules = moduleCandidates
    .filter((candidate) => candidate.status !== "approved")
    .map((candidate) => ({
      id: candidate.id,
      name: candidate.name,
      status: candidate.status,
      reason: `status is ${candidate.status}; only approved modules are eligible for scaffold generation`
    }));
  const blockers = collectBlockers(modules, moduleCandidates);
  const runtimeContractPlans = runtimeContracts.map(toScaffoldRuntimeContract);
  blockers.push(...collectRuntimeContractBlockers(runtimeContracts));
  const warnings = collectWarnings(modules, moduleCandidates, runtimeContracts);

  return {
    requirement_id: normalizedRequirement.id,
    source: "approved_workbench_artifact",
    raw_requirement_to_code: false,
    output_mode: outputMode,
    modules,
    runtime_contracts: runtimeContractPlans,
    excluded_modules: excludedModules,
    manifest: {
      catalog_bound_modules: modules.flatMap((module) =>
        module.catalog_binding
          ? [
              {
                module_id: module.id,
                module_name: module.name,
                catalog_id: module.catalog_binding.catalog_id,
                catalog_name: module.catalog_binding.name,
                component_source: module.catalog_binding.component_source
              }
            ]
          : []
      ),
      new_code_required: modules.map((module) => ({
        module_id: module.id,
        module_name: module.name,
        reason: module.catalog_binding
          ? "catalog binding is recorded; runtime wiring remains a reviewed TODO boundary"
          : "no catalog binding was selected for this approved module",
        developer_todos: module.developer_todos
      }))
    },
    validation: {
      can_generate_source: modules.length > 0 && blockers.length === 0,
      blockers,
      warnings
    }
  };
}

export function approvedScaffoldModuleIds(scaffoldPlan: ScaffoldPlan): Set<string> {
  return new Set(scaffoldPlan.modules.map((module) => module.id));
}

function buildScaffoldModule(
  candidate: ModuleCandidate,
  catalogEntries: CatalogEntry[],
  outputMode: ScaffoldOutputMode
): ScaffoldPlanModule {
  const catalogEntry = findCatalogBinding(candidate, catalogEntries);
  const componentSource = componentSourceFor(catalogEntry);
  const binding: CatalogBinding | undefined = catalogEntry
    ? {
        catalog_id: catalogEntry.id,
        name: catalogEntry.name,
        component_source: componentSource
      }
    : undefined;
  const developerTodos = developerTodosFor(candidate, catalogEntry);
  const runnable = outputMode === "runnable";

  // MCP binding: prefer the reviewed candidate, fall back to the bound catalog entry.
  const accessProtocol = candidate.access_protocol ?? catalogEntry?.access_protocol ?? null;
  const mcpServer = candidate.mcp_server ?? catalogEntry?.mcp_server ?? null;
  const mcpToolName = candidate.mcp_tool_name ?? catalogEntry?.mcp_tool_name ?? null;
  const mcpSchemaRef = candidate.mcp_schema_ref ?? catalogEntry?.mcp_schema_ref ?? null;
  const mcpAuthMode = candidate.mcp_auth_mode ?? catalogEntry?.mcp_auth_mode ?? null;
  const runtimeBinding = catalogEntry?.runtime_binding ?? null;

  const isAgent = candidate.module_category === "agent";

  return {
    id: candidate.id,
    name: candidate.name,
    module_category: candidate.module_category,
    agent_kind: candidate.agent_kind ?? null,
    workflow_kind: candidate.workflow_kind ?? null,
    adapter_kind: candidate.adapter_kind ?? null,
    remote_contract_kind: candidate.remote_contract_kind ?? null,
    scaffold_output: runnable ? "runnable" : catalogEntry?.scaffold_output ?? scaffoldOutputFor(candidate),
    no_runnable_business_logic: !runnable,
    catalog_binding: binding,
    developer_todos: developerTodos,
    inputs: candidate.inputs,
    outputs: candidate.outputs,
    risk_signals: mergeRiskSignals(candidate.risk_signals, catalogEntry?.risk_signals ?? []),
    required_review_fields: requiredReviewFieldsFor(candidate),
    smoke_spec: candidate.smoke_spec ?? null,
    runtime_mock: catalogEntry?.runtime_mock ?? null,
    // Runnable-mode wiring only. Smoke mode keeps the module shape minimal
    // (everything null) so its output stays identical to the legacy stub plan.
    instruction: runnable && isAgent ? seedAgentInstruction(candidate, catalogEntry) : null,
    model: runnable && isAgent ? DEFAULT_RUNNABLE_MODEL : null,
    access_protocol: runnable ? accessProtocol : null,
    mcp_server: runnable ? mcpServer : null,
    mcp_tool_name: runnable ? mcpToolName : null,
    mcp_schema_ref: runnable ? mcpSchemaRef : null,
    mcp_auth_mode: runnable ? mcpAuthMode : null,
    runtime_binding: runnable ? runtimeBinding : null
  };
}

/**
 * Auto-seed an LlmAgent instruction from reviewed-artifact fields only
 * (catalog responsibility / candidate rationale / reviewed I/O field names /
 * the synthetic smoke sample) — never from raw requirement text, so the
 * "raw requirements never drive code" invariant holds. The seed is a starting
 * point the developer reviews and edits in the generated bundle's
 * `agents.config.yaml` before any live run; the prompt itself instructs the
 * model to use only the synthetic inputs and never invent private data or
 * credentials.
 */
function seedAgentInstruction(candidate: ModuleCandidate, catalogEntry: CatalogEntry | undefined): string {
  const responsibility = catalogEntry?.responsibility?.trim() || candidate.rationale?.trim() || candidate.name;
  const inputNames = candidate.inputs.map((field) => field.name).filter(Boolean).join(", ") || "(none specified)";
  const outputNames = candidate.outputs.map((field) => field.name).filter(Boolean).join(", ") || "(none specified)";
  const lines = [
    `You are "${candidate.name}".`,
    `Responsibility: ${responsibility}`,
    `Inputs you receive: ${inputNames}.`,
    `Outputs you must produce: ${outputNames}.`,
    "Operate only on the synthetic inputs provided in session state. Never invent private data, real endpoints, or credentials."
  ];
  const sample = candidate.smoke_spec?.sample_user_message?.trim();
  if (sample) lines.push(`Example user message: ${sample}`);
  return lines.join("\n");
}

function findCatalogBinding(candidate: ModuleCandidate, entries: CatalogEntry[]): CatalogEntry | undefined {
  const normalizedName = normalizeName(candidate.name);
  return entries.find(
    (entry) => entry.module_category === candidate.module_category && normalizeName(entry.name) === normalizedName
  );
}

function componentSourceFor(entry: CatalogEntry | undefined): ComponentSource {
  if (!entry) return "stub";
  if (entry.component_source) return entry.component_source;
  if (entry.runtime_binding === "remote_a2a") return "remote_a2a";
  if (entry.access_protocol === "mcp") return "mcp";
  return "stub";
}

function developerTodosFor(
  candidate: ModuleCandidate,
  catalogEntry: CatalogEntry | undefined
): string[] {
  if (catalogEntry) {
    return [
      "Review the catalog runtime contract and configure its runtime binding before invocation.",
      "Map reviewed inputs and outputs before wiring runtime behavior."
    ];
  }
  if (candidate.module_category === "remote_a2a") {
    return [
      "Fill the remote agent card or discovery contract.",
      "Implement authentication, timeout, retry, fallback, audit, and data policy handling before runtime use."
    ];
  }
  return [
    "Implement this module in TODO_IMPLEMENT_HERE after the design is approved.",
    "Map reviewed inputs, validate outputs, and keep business credentials out of generated code."
  ];
}

function requiredReviewFieldsFor(candidate: ModuleCandidate): string[] {
  const fields = new Set<string>();
  if (!candidate.inputs.length) fields.add("inputs");
  if (!candidate.outputs.length) fields.add("outputs");
  if (!candidate.developer_todos?.length) fields.add("developer_todos");
  if (candidate.module_category === "remote_a2a") {
    [
      "owner",
      "agent_card",
      "auth",
      "task_lifecycle",
      "timeout",
      "retry",
      "fallback",
      "audit",
      "data_policy"
    ].forEach((field) => fields.add(field));
  }
  return [...fields];
}

function collectBlockers(modules: ScaffoldPlanModule[], candidates: ModuleCandidate[]): string[] {
  const unresolvedCandidates = countUnresolvedMissingInfoCandidates(candidates);
  const blockers: string[] = [];
  if (unresolvedCandidates > 0) {
    blockers.push(`정보 필요 후보 ${unresolvedCandidates}개를 모듈 검토에서 Resolution Draft를 반영하고 승인하세요.`);
  }
  if (!modules.length) {
    blockers.push("approved module is required before ADK source generation");
    return blockers;
  }
  return [
    ...blockers,
    ...modules.flatMap((module) => {
      const moduleBlockers: string[] = [];
      if (!module.inputs.length) moduleBlockers.push(`${module.name}: input contract is missing`);
      if (!module.outputs.length) moduleBlockers.push(`${module.name}: output contract is missing`);
      if (!module.developer_todos.length) moduleBlockers.push(`${module.name}: developer TODO boundary is missing`);
      return moduleBlockers;
    })
  ];
}

function collectRuntimeContractBlockers(contracts: RuntimeContract[]): string[] {
  return contracts.flatMap((contract) => {
    const issues = runtimeContractReadinessIssues(contract);
    if (!issues.length) return [];
    return [`${contract.title}: Runtime 계약 검토/승인이 필요합니다 (${issues.join("; ")})`];
  });
}

function collectWarnings(
  modules: ScaffoldPlanModule[],
  candidates: ModuleCandidate[],
  runtimeContracts: RuntimeContract[]
): string[] {
  const moduleWarnings = modules.flatMap((module) => {
    if (module.catalog_binding) {
      return [`${module.name}: catalog binding is emitted with a reviewed runtime-wiring TODO until configuration is approved`];
    }
    return [`${module.name}: generated as new-code TODO boundary because no catalog binding is selected`];
  });
  const unresolvedCandidates = countUnresolvedMissingInfoCandidates(candidates);
  if (unresolvedCandidates > 0) {
    moduleWarnings.push(`정보 필요 후보 ${unresolvedCandidates}개 — 모듈 검토에서 Resolution Draft 반영 필요`);
  }
  if (runtimeContracts.length > 0) {
    moduleWarnings.push(`Runtime 계약 ${runtimeContracts.length}개가 scaffold-plan에 포함됩니다.`);
  }
  return moduleWarnings;
}

function toScaffoldRuntimeContract(contract: RuntimeContract): ScaffoldPlanRuntimeContract {
  return {
    contract_id: contract.contract_id,
    contract_kind: contract.contract_kind,
    module_id: contract.module_id,
    title: contract.title,
    contract_status: contract.contract_status,
    required_review_fields: contract.required_review_fields,
    runtime_support: contract.runtime_support,
    operation: contract.operation,
    identifiers: contract.identifiers,
    policies: contract.policies,
    graph_ir_annotations: contract.graph_ir_annotations,
    developer_todos: contract.developer_todos
  };
}

function countUnresolvedMissingInfoCandidates(candidates: ModuleCandidate[]): number {
  return candidates.filter((candidate) => {
    if (candidate.missing_information.length > 0) return true;
    return candidate.status === "needs_info" && !candidateResolutionReady(candidate);
  }).length;
}

function candidateResolutionReady(candidate: ModuleCandidate): boolean {
  return Boolean(
    candidate.resolution_applied_at &&
      candidate.schema_review_state === "applied" &&
      candidate.smoke_spec?.ready &&
      candidate.inputs.length > 0 &&
      candidate.outputs.length > 0
  );
}

function scaffoldOutputFor(candidate: ModuleCandidate): string {
  if (candidate.module_category === "adapter") return "contract_or_stub_only";
  if (candidate.module_category === "agent") return "agent_shell_only";
  if (candidate.module_category === "workflow") return "orchestration_shell_only";
  return "contract_placeholder_only";
}

function mergeRiskSignals(primary: RiskSignal[], secondary: RiskSignal[]): RiskSignal[] {
  return [...new Set([...primary, ...secondary])];
}

function normalizeName(value: string): string {
  return value.trim().toLowerCase();
}
