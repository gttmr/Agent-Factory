import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { writeBundleFiles } from "../adk-source/bundle-writer.mjs";
import { loadArtifactContext } from "../adk-source/context.mjs";
import { buildFiles } from "../adk-source/file-builder.mjs";

export const scriptsRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
export const repoRoot = join(scriptsRoot, "..");
export const generator = join(scriptsRoot, "generate-adk-source.mjs");

export function targetRequirement(requirementId, patch = {}) {
  return {
    id: requirementId,
    title: requirementId,
    raw_text: `Build ${requirementId}`,
    domain: "domain-neutral",
    requester: { team: "platform", role: "developer" },
    business_goal: `Exercise ${requirementId}`,
    current_process: [],
    inputs: [],
    outputs: [],
    systems: [],
    risk_signals: [],
    missing_information: [],
    contradictions: [],
    status: "approved",
    ...patch
  };
}

export function targetEvidence(requirement) {
  return {
    requested_goal: requirement.business_goal,
    business_domain_hint: requirement.domain,
    user_role: requirement.requester.role,
    input_data: requirement.inputs.map((field) => field.name),
    output_data: requirement.outputs.map((field) => field.name),
    systems_mentioned: requirement.systems.map((system) => system.name),
    decisions_implied: [],
    risk_signals: [...requirement.risk_signals],
    missing_information: [...requirement.missing_information],
    contradictions: [...requirement.contradictions],
    assumptions: []
  };
}

export function targetAsset(assetId, assetType, patch = {}) {
  return {
    asset_id: assetId,
    source_requirement_id: patch.source_requirement_id ?? "req-target",
    catalog_entry_id: null,
    name: assetId,
    asset_type: assetType,
    domain_scope: "domain_neutral",
    business_domains: [],
    owner: "platform",
    reuse_status: "project_only",
    capability_tags: [],
    binding: assetType === "tool" ? { kind: "unresolved" } : null,
    connection: assetType === "tool" ? { transport: "unknown" } : null,
    workflow_profile: assetType === "workflow"
      ? { representation: "graph", coordination: "explicit", template_ref: null }
      : null,
    exposure: null,
    confidence: 0.9,
    rationale: `Reviewed ${assetType} asset ${assetId}`,
    inputs: [],
    outputs: [],
    risk_level: "low",
    risk_signals: [],
    status: "approved",
    missing_information: [],
    developer_todos: ["review"],
    smoke_spec: {
      sample_user_message: "hello",
      synthetic_inputs: {},
      expected_output_shape: {},
      expected_event_markers: [],
      mock_sources: [],
      ready: true
    },
    ...patch
  };
}

export function targetGraph({ requirementId, nodes, edges, regions = [], workflowRef = null }) {
  return {
    graph_id: `graph.${requirementId.replace(/^req-/, "")}`,
    source_requirement_id: requirementId,
    workflow_ref: workflowRef,
    nodes: nodes.map((node) => ({ label: node.label ?? node.id, ...node })),
    edges,
    regions
  };
}

export function targetEdge(from, to, kind = "next", patch = {}) {
  return {
    id: `edge.${from}.${to}`,
    from,
    to,
    channel: null,
    ...patch,
    control: {
      kind,
      condition: null,
      accepted_aliases: [],
      default: false,
      ...(patch.control ?? {})
    }
  };
}

export function writeTargetArtifacts(dir, { requirement, assets, graph, runnable, a2aContracts = [], runtimeContracts = [] }) {
  const strictRequirement = targetRequirement(requirement.id, requirement);
  const strictAssets = assets.map((asset) => ({ ...asset, source_requirement_id: strictRequirement.id }));
  writeJson(join(dir, "analysis-result.json"), {
    contract_version: "2.0",
    normalizedRequirement: strictRequirement,
    evidence: targetEvidence(strictRequirement),
    assetCandidates: structuredClone(strictAssets),
    a2aContracts,
    runtimeContracts,
    graph
  });
  writeJson(join(dir, "af-run-manifest.json"), {
    requirement_id: strictRequirement.id,
    artifact_root: `artifacts/af/${strictRequirement.id}`,
    current_stage: "build",
    stages: {
      analyze: { status: "complete", outputs: ["analysis-result.json"] },
      design: { status: "complete", outputs: ["scaffold-plan.json"] },
      build: { status: "pending", outputs: [] },
      verify: { status: "pending", outputs: [] }
    },
    approvals: {
      analysis_reviewed: true,
      boundaries_approved: true,
      runtime_contracts_approved: true,
      stub_ready_for_followup: false
    },
    validation: { commands: [], last_result: "not_run" }
  });
  writeJson(join(dir, "scaffold-plan.json"), {
    contract_version: "2.0",
    requirement_id: requirement.id,
    source: "approved_workbench_artifact",
    raw_requirement_to_code: false,
    output_mode: runnable ? "runnable" : "smoke",
    assets: structuredClone(strictAssets),
    graph,
    runtime_contracts: runtimeContracts,
    excluded_assets: [],
    manifest: { catalog_bound_assets: [], new_code_required: [] },
    validation: { can_generate_source: true, blockers: [], warnings: [] }
  });
}

export function targetA2aContract({ contractId = "a2a-001", agentRef, name = "Remote", url }) {
  return {
    contract_id: contractId,
    agent_ref: agentRef,
    target_agent_name: name,
    target_agent_purpose: `Delegate reviewed work to ${name}`,
    contract_status: "approved",
    agent_card: { discovery_method: "well-known", agent_card_url: url, version: "1.0", notes: "Reviewed fixture" },
    supported_interfaces: [{ url, protocol_binding: "jsonrpc", protocol_version: "1.0", tenant_policy: "single-tenant fixture" }],
    input_modes: ["text/plain"],
    output_modes: ["text/plain"],
    security_schemes: [],
    security_requirements: [],
    skills: ["reviewed-fixture"],
    extensions: [],
    message_contract: { allowed_part_fields: ["text"], allowed_roles: ["ROLE_USER", "ROLE_AGENT"] },
    task_lifecycle: {
      states: ["TASK_STATE_SUBMITTED", "TASK_STATE_WORKING", "TASK_STATE_COMPLETED", "TASK_STATE_FAILED"],
      allowed_transitions: [
        { from: "TASK_STATE_SUBMITTED", to: "TASK_STATE_WORKING" },
        { from: "TASK_STATE_WORKING", to: "TASK_STATE_COMPLETED" },
        { from: "TASK_STATE_WORKING", to: "TASK_STATE_FAILED" }
      ],
      terminal_states: ["TASK_STATE_COMPLETED", "TASK_STATE_FAILED"],
      input_required_followup: "Return input-required to the caller",
      auth_required_followup: "Return auth-required to the caller"
    },
    streaming: { supported: false, wrappers: [], non_streaming_fallback: "Use SendMessage" },
    operations: ["SendMessage", "GetTask", "CancelTask"],
    http_paths: ["/message:send", "/tasks/{id}", "/tasks/{id}:cancel"],
    artifact_contract: { mutation_rules: "Artifacts are immutable", chunking_policy: "No chunking" },
    adk_host_mapping: "RemoteA2aAgent",
    adk_runtime_policy: {
      timeout_seconds: 30,
      auth: { mode: "none", env_var: null, metadata_key: null },
      retry_handoff: { max_attempts: null, backoff_seconds: null, retry_on: [] },
      fallback_handoff: { mode: "none", message: null }
    },
    timeout: "30 seconds",
    retry: "No automatic retry",
    fallback: "Return the remote failure",
    cancellation: "Forward cancellation",
    unsupported_operation: "Return unsupported operation",
    get_task_fallback: "Return the last known task",
    push_notification_policy: null,
    auth: "No authentication in fixture",
    token_handling: "No tokens",
    audit: "Record contract and task identifiers",
    data_policy: "Synthetic fixture data only"
  };
}

export function targetRuntimeContract({
  contractId,
  contractKind,
  assetId = null,
  operationType = "read",
  sideEffectLevel = "read_only",
  humanApprovalRequired = false,
  asyncResumeRequired = false,
  resumePolicy = null,
  sideEffectGuard = null,
  graphIrAnnotations = {}
}) {
  const contract = {
    contract_id: contractId,
    contract_kind: contractKind,
    asset_id: assetId,
    title: `Reviewed runtime contract ${contractId}`,
    contract_status: "approved",
    summary: `Synthetic runtime boundary for ${contractId}`,
    required_review_fields: [],
    reviewer_notes: "Approved synthetic generator fixture.",
    runtime_support: {
      context_manager_required: false,
      callback_broker_required: false,
      human_approval_required: humanApprovalRequired,
      idempotency_required: sideEffectLevel !== "none" && sideEffectLevel !== "read_only",
      audit_required: true,
      compensation_required: false
    },
    operation: {
      operation_type: operationType,
      side_effect_level: sideEffectLevel,
      callback_expected: false,
      async_resume_required: asyncResumeRequired
    },
    identifiers: [contractId],
    policies: {
      auth_policy: "Synthetic fixture only.",
      timeout_policy: "Bounded by the fixture.",
      retry_policy: "No implicit retry.",
      fallback_policy: "Fail visibly.",
      masking_policy: "Synthetic identifiers only.",
      data_policy: "Synthetic fixture data only."
    },
    graph_ir_annotations: graphIrAnnotations,
    synthetic_examples: [],
    developer_todos: []
  };
  if (contractKind === "async_resume") {
    contract.resume_policy = resumePolicy ?? {
      interrupt_id: `${contractId}-interrupt`,
      correlation_scope: "invocation",
      timeout_seconds: 60,
      on_timeout: "expire_without_side_effect",
      duplicate_response: "return_recorded_result",
      conflicting_response: "reject",
      restart_policy: "resume_incomplete_replay_completed"
    };
    contract.side_effect_guard = sideEffectGuard;
  }
  return contract;
}

export function generateBundle(artifactRoot, outputRoot) {
  const files = buildFiles({ artifactRoot, outputRoot, ...loadArtifactContext(artifactRoot) });
  writeBundleFiles(outputRoot, files);
}

export function discoverGeneratedPackage(root) {
  const packages = readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && existsSync(join(root, entry.name, "workflow_manifest.json")))
    .map((entry) => entry.name);
  if (packages.length !== 1) throw new Error(`expected one generated ADK package, found ${packages.join(", ") || "none"}`);
  return packages[0];
}

export function readBundle(outputRoot) {
  const packageName = discoverGeneratedPackage(outputRoot);
  const packageRoot = join(outputRoot, packageName);
  return {
    packageName,
    manifest: readJson(join(packageRoot, "workflow_manifest.json")),
    agentSource: readFileSync(join(packageRoot, "agent.py"), "utf8"),
    contractTest: readFileSync(join(packageRoot, "tests", "test_workflow_contract.py"), "utf8")
  };
}

export function collectFiles(root) {
  const entries = readdirSync(root, { withFileTypes: true }).sort((left, right) => left.name.localeCompare(right.name));
  return entries.flatMap((entry) => {
    const path = join(root, entry.name);
    return entry.isDirectory() ? collectFiles(path) : entry.isFile() ? [path] : [];
  });
}

export function collectGeneratorSourceFiles() {
  const sourceRoot = join(scriptsRoot, "adk-source");
  return [generator, ...collectFiles(sourceRoot).filter((path) => path.endsWith(".mjs"))]
    .sort((left, right) => relative(repoRoot, left).localeCompare(relative(repoRoot, right)));
}

export function temporaryTargetFixture(data) {
  const artifactRoot = mkdtempSync(join(tmpdir(), "af-target-fixture-"));
  writeTargetArtifacts(artifactRoot, data);
  return { artifactRoot, cleanup: () => rmSync(artifactRoot, { recursive: true, force: true }) };
}

export function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

export function writeJson(path, value) {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}
