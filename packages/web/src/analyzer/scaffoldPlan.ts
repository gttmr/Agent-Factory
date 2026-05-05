import type { CatalogEntry } from "../catalog/types";
import type {
  CatalogBinding,
  ComponentSource,
  FieldSpec,
  ImportContract,
  ModuleCandidate,
  NormalizedRequirement,
  ProcessFlow,
  RiskSignal,
  ScaffoldPlan,
  ScaffoldPlanModule
} from "./types";

export interface BuildScaffoldPlanInput {
  normalizedRequirement: NormalizedRequirement;
  moduleCandidates: ModuleCandidate[];
  processFlow: ProcessFlow;
  catalogEntries: CatalogEntry[];
}

export function buildScaffoldPlan({
  normalizedRequirement,
  moduleCandidates,
  processFlow: _processFlow,
  catalogEntries
}: BuildScaffoldPlanInput): ScaffoldPlan {
  const activeCatalog = catalogEntries.filter((entry) => entry.provenance !== "session_deleted");
  const modules = moduleCandidates
    .filter((candidate) => candidate.status === "approved")
    .map((candidate) => buildScaffoldModule(candidate, activeCatalog));
  const excludedModules = moduleCandidates
    .filter((candidate) => candidate.status !== "approved")
    .map((candidate) => ({
      id: candidate.id,
      name: candidate.name,
      status: candidate.status,
      reason: `status is ${candidate.status}; only approved modules are eligible for scaffold generation`
    }));
  const blockers = collectBlockers(modules);
  const warnings = collectWarnings(modules);

  return {
    requirement_id: normalizedRequirement.id,
    source: "approved_workbench_artifact",
    raw_requirement_to_code: false,
    modules,
    excluded_modules: excludedModules,
    manifest: {
      imported_components: modules.flatMap((module) =>
        module.catalog_binding && module.import_contract
          ? [
              {
                module_id: module.id,
                module_name: module.name,
                catalog_id: module.catalog_binding.catalog_id,
                ...module.import_contract
              }
            ]
          : []
      ),
      new_code_required: modules
        .filter((module) => !module.import_contract)
        .map((module) => ({
          module_id: module.id,
          module_name: module.name,
          reason: module.catalog_binding
            ? "catalog binding does not provide a python package import contract"
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

function buildScaffoldModule(candidate: ModuleCandidate, catalogEntries: CatalogEntry[]): ScaffoldPlanModule {
  const catalogEntry = findCatalogBinding(candidate, catalogEntries);
  const componentSource = componentSourceFor(catalogEntry);
  const importContract = catalogEntry ? importContractFor(catalogEntry) : undefined;
  const binding: CatalogBinding | undefined = catalogEntry
    ? {
        catalog_id: catalogEntry.id,
        name: catalogEntry.name,
        component_source: componentSource
      }
    : undefined;
  const developerTodos = developerTodosFor(candidate, catalogEntry, importContract);

  return {
    id: candidate.id,
    name: candidate.name,
    module_category: candidate.module_category,
    agent_kind: candidate.agent_kind ?? null,
    workflow_kind: candidate.workflow_kind ?? null,
    adapter_kind: candidate.adapter_kind ?? null,
    remote_contract_kind: candidate.remote_contract_kind ?? null,
    scaffold_output: catalogEntry?.scaffold_output ?? scaffoldOutputFor(candidate),
    no_runnable_business_logic: true,
    catalog_binding: binding,
    import_contract: importContract,
    developer_todos: developerTodos,
    inputs: candidate.inputs,
    outputs: candidate.outputs,
    risk_signals: mergeRiskSignals(candidate.risk_signals, catalogEntry?.risk_signals ?? []),
    required_review_fields: requiredReviewFieldsFor(candidate, catalogEntry, importContract)
  };
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
  if (entry.package_name || entry.import_path || entry.callable_name) return "python_package";
  if (entry.access_protocol === "mcp") return "mcp";
  return "stub";
}

function importContractFor(entry: CatalogEntry): ImportContract | undefined {
  if (componentSourceFor(entry) !== "python_package") return undefined;
  if (!entry.package_name || !entry.import_path || !entry.callable_name) return undefined;
  return {
    package_name: entry.package_name,
    package_version: entry.package_version,
    import_path: entry.import_path,
    callable_name: entry.callable_name
  };
}

function developerTodosFor(
  candidate: ModuleCandidate,
  catalogEntry: CatalogEntry | undefined,
  importContract: ImportContract | undefined
): string[] {
  if (importContract) {
    return [
      "Map ADK node_input into the shared component input contract.",
      "Handle component exceptions and timeout policy without leaking private data.",
      "Validate component output against the reviewed output contract."
    ];
  }
  if (catalogEntry) {
    return [
      "Complete the catalog import contract or replace this placeholder with an approved callable boundary.",
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

function requiredReviewFieldsFor(
  candidate: ModuleCandidate,
  catalogEntry: CatalogEntry | undefined,
  importContract: ImportContract | undefined
): string[] {
  const fields = new Set<string>();
  if (!candidate.inputs.length) fields.add("inputs");
  if (!candidate.outputs.length) fields.add("outputs");
  if (!candidate.developer_todos?.length) fields.add("developer_todos");
  if (catalogEntry && componentSourceFor(catalogEntry) === "python_package" && !importContract) {
    fields.add("package_name");
    fields.add("import_path");
    fields.add("callable_name");
  }
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

function collectBlockers(modules: ScaffoldPlanModule[]): string[] {
  if (!modules.length) {
    return ["approved module is required before ADK source generation"];
  }
  return modules.flatMap((module) => {
    const blockers: string[] = [];
    if (!module.inputs.length) blockers.push(`${module.name}: input contract is missing`);
    if (!module.outputs.length) blockers.push(`${module.name}: output contract is missing`);
    if (!module.developer_todos.length) blockers.push(`${module.name}: developer TODO boundary is missing`);
    if (module.catalog_binding?.component_source === "python_package" && !module.import_contract) {
      blockers.push(`${module.name}: python package import contract is incomplete`);
    }
    return blockers;
  });
}

function collectWarnings(modules: ScaffoldPlanModule[]): string[] {
  return modules.flatMap((module) => {
    if (module.import_contract) return [];
    return [`${module.name}: generated as new-code TODO boundary because no python package import is available`];
  });
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
