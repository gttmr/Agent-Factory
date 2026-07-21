import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import * as rootEnums from "./artifact-validation/constants.mjs";

const validator = new URL("./validate-artifacts.mjs", import.meta.url).pathname;
const schemaRoot = new URL("../schemas/", import.meta.url);
const webTypesSource = readFileSync(new URL("../packages/web/src/analyzer/types.ts", import.meta.url), "utf8");
const webValidatorSource = readFileSync(new URL("../packages/web/src/analyzer/targetContract.ts", import.meta.url), "utf8");
const contractIdentityFixture = JSON.parse(
  readFileSync(new URL("../templates/skill-scenarios/S07-a2a-consuming/context/analysis-result.json", import.meta.url), "utf8")
);
const asyncResumeFixture = JSON.parse(
  readFileSync(new URL("../templates/skill-scenarios/S11-human-input-resume/context/analysis-result.json", import.meta.url), "utf8")
);

test("schema, root validator registry, and web analyzer agree on strict enums and required keys", () => {
  const analysis = schema("analysis-result.schema.json");
  const candidate = schema("asset-candidate.schema.json");
  const graph = schema("graph.schema.json");
  const normalized = schema("normalized-requirement.schema.json");
  const enumAgreements = [
    ["assetTypes", rootEnums.assetTypes, candidate.properties.asset_type.enum],
    ["domainScopes", rootEnums.domainScopes, candidate.properties.domain_scope.enum],
    ["reuseStatuses", rootEnums.reuseStatuses, candidate.properties.reuse_status.enum],
    ["bindingKinds", rootEnums.bindingKinds, bindingKinds(candidate)],
    ["transportKinds", rootEnums.transportKinds, candidate.$defs.connection.properties.transport.enum],
    ["workflowRepresentations", rootEnums.workflowRepresentations, candidate.$defs.workflowProfile.properties.representation.enum],
    ["workflowCoordinations", rootEnums.workflowCoordinations, candidate.$defs.workflowProfile.properties.coordination.enum],
    ["graphNodeKinds", rootEnums.graphNodeKinds, graph.$defs.nodeBase.properties.node_kind.enum],
    ["graphControlKinds", rootEnums.graphControlKinds, graph.$defs.control.properties.kind.enum],
    ["graphRegionKinds", rootEnums.graphRegionKinds, graph.$defs.region.properties.kind.enum],
    ["functionRoles", rootEnums.functionRoles, graph.$defs.node.oneOf[3].properties.role.enum]
  ];
  for (const [name, rootValues, schemaValues] of enumAgreements) {
    assert.deepEqual(sorted(rootValues), sorted(schemaValues), `${name}: root/schema`);
    assert.deepEqual(sorted(tsConstArray(webTypesSource, name)), sorted(schemaValues), `${name}: web/schema`);
  }
  const schemaChannels = [null, ...graph.$defs.edge.properties.channel.oneOf[0].enum];
  assert.deepEqual(sorted(rootEnums.graphChannels), sorted(schemaChannels), "graphChannels: root/schema");
  assert.deepEqual(sorted(tsConstArray(webTypesSource, "graphChannels")), sorted(schemaChannels.filter(Boolean)), "graphChannels: web/schema");

  assert.deepEqual(tsConstArray(webValidatorSource, "TOP_LEVEL_KEYS"), analysis.required);
  assert.deepEqual(tsConstArray(webValidatorSource, "REQUIRED_CANDIDATE_KEYS"), candidate.required);
  assert.deepEqual(tsConstArray(webValidatorSource, "NORMALIZED_REQUIREMENT_KEYS"), normalized.required);
  assert.deepEqual(tsConstArray(webValidatorSource, "EVIDENCE_KEYS"), Object.keys(analysis.$defs.evidence.properties));
  assert.deepEqual(analysis.$defs.evidence.required, tsConstArray(webValidatorSource, "EVIDENCE_KEYS").filter((key) => key !== "accepted_missing_information"));
  assert.deepEqual(inlineRequiredKeys(webValidatorSource, "validateGraph"), graph.required);
  assert.deepEqual(inlineRequiredKeys(webValidatorSource, "validateEdge"), graph.$defs.edge.required);
  assert.deepEqual(inlineRequiredKeys(webValidatorSource, "validateRegions"), graph.$defs.region.required);
});

test("validator accepts strict Target-only v2 files and target filenames", () => {
  withRoot((root, analysis) => {
    writeJson(join(root, "analysis-result.json"), analysis);
    writeJson(join(root, "asset-candidates.json"), analysis.assetCandidates);
    writeJson(join(root, "graph-ir.json"), analysis.graph);
    assert.match(run(root), /Artifact validation OK/);
  });
});

test("validator rejects duplicate embedded asset candidate IDs", () => {
  withRoot((root, analysis) => {
    analysis.assetCandidates.push(structuredClone(analysis.assetCandidates[0]));
    writeJson(join(root, "analysis-result.json"), analysis);
    assert.match(fail(root), /assetCandidates\[1\]\.asset_id duplicates agent\.writer/);
  });
});

test("validator rejects duplicate embedded A2A and runtime contract IDs", () => {
  for (const [key, expected] of [
    ["a2aContracts", /a2aContracts\[1\]\.contract_id duplicates a2a-207/],
    ["runtimeContracts", /runtimeContracts\[1\]\.contract_id duplicates rtc-s07-a2a-connection/]
  ]) {
    withRoot((root) => {
      const analysis = structuredClone(contractIdentityFixture);
      analysis[key].push(structuredClone(analysis[key][0]));
      writeJson(join(root, "analysis-result.json"), analysis);
      assert.match(fail(root), expected);
    });
  }
});

test("validator accepts the reviewed typed async-resume contract", () => {
  withRoot((root) => {
    writeJson(join(root, "analysis-result.json"), asyncResumeFixture);
    assert.match(run(root), /Artifact validation OK/);
  });
});

test("validator rejects dangling async-resume Human Input and side-effect Tool references", () => {
  for (const [field, value, expected] of [
    ["human_input_node_id", "node-missing-human", /human_input_node_id must reference an existing Human Input Node/],
    ["side_effect_tool_node_id", "node-missing-tool", /side_effect_tool_node_id must reference the Tool Node/]
  ]) {
    withRoot((root) => {
      const analysis = structuredClone(asyncResumeFixture);
      analysis.runtimeContracts[0].graph_ir_annotations[field] = value;
      writeJson(join(root, "analysis-result.json"), analysis);
      assert.match(fail(root), expected);
    });
  }
});

test("validator rejects async-resume guards with unknown idempotency inputs", () => {
  withRoot((root) => {
    const analysis = structuredClone(asyncResumeFixture);
    analysis.runtimeContracts[0].side_effect_guard.idempotency_key_input = "missing_input";
    writeJson(join(root, "analysis-result.json"), analysis);
    assert.match(fail(root), /idempotency_key_input must reference an input/);
  });
});

test("validator rejects duplicate approved async-resume interrupt IDs", () => {
  withRoot((root) => {
    const analysis = structuredClone(asyncResumeFixture);
    analysis.runtimeContracts.push({
      ...structuredClone(analysis.runtimeContracts[0]),
      contract_id: "rtc-s11-async-resume-copy",
      title: "Synthetic duplicate interrupt contract"
    });
    writeJson(join(root, "analysis-result.json"), analysis);
    assert.match(fail(root), /resume_policy\.interrupt_id duplicates synthetic-approval-001/);
  });
});

test("validator validates normalized-requirement.json when present", () => {
  withRoot((root, analysis) => {
    const normalized = structuredClone(analysis.normalizedRequirement);
    delete normalized.raw_text;
    writeJson(join(root, "analysis-result.json"), analysis);
    writeJson(join(root, "normalized-requirement.json"), normalized);
    assert.match(fail(root), /normalized-requirement\.json\.raw_text is required/);
  });
});

test("validator requires normalized requirement, candidates, and Graph IR splits to equal embedded analysis values", () => {
  for (const [name, embedded, mutate, expected] of [
    [
      "normalized-requirement.json",
      (analysis) => analysis.normalizedRequirement,
      (split) => { split.title = "Split drift"; },
      /normalized-requirement\.json must equal analysis-result\.json\.normalizedRequirement/
    ],
    [
      "asset-candidates.json",
      (analysis) => analysis.assetCandidates,
      (split) => { split[0].rationale = "Split drift"; },
      /asset-candidates\.json must equal analysis-result\.json\.assetCandidates/
    ],
    [
      "graph-ir.json",
      (analysis) => analysis.graph,
      (split) => { split.graph_id = "graph.split-drift"; },
      /graph-ir\.json must equal analysis-result\.json\.graph/
    ]
  ]) {
    withRoot((root, analysis) => {
      const split = structuredClone(embedded(analysis));
      mutate(split);
      writeJson(join(root, "analysis-result.json"), analysis);
      writeJson(join(root, name), split);
      assert.match(fail(root), expected);
    });
  }
});

test("validator split equality ignores JSON object key order", () => {
  withRoot((root, analysis) => {
    const reorderedCandidates = analysis.assetCandidates.map((asset) => Object.fromEntries(Object.entries(asset).reverse()));
    const reorderedGraph = Object.fromEntries(Object.entries(analysis.graph).reverse());
    writeJson(join(root, "analysis-result.json"), analysis);
    writeJson(join(root, "asset-candidates.json"), reorderedCandidates);
    writeJson(join(root, "graph-ir.json"), reorderedGraph);
    assert.match(run(root), /Artifact validation OK/);
  });
});

test("validator rejects missing strict required fields and nested unknown properties", () => {
  for (const [label, mutate, expected] of [
    ["normalized requirement", (analysis) => { delete analysis.normalizedRequirement.raw_text; }, /normalizedRequirement\.raw_text is required/],
    ["evidence", (analysis) => { delete analysis.evidence.requested_goal; }, /evidence\.requested_goal is required/],
    ["candidate", (analysis) => { delete analysis.assetCandidates[0].confidence; }, /assetCandidates\[0\]\.confidence is required/],
    ["node", (analysis) => { delete analysis.graph.nodes[1].label; }, /nodes\[1\]\.label is required/],
    ["control", (analysis) => { delete analysis.graph.edges[0].control.condition; }, /control\.condition is required/],
    ["unknown candidate field", (analysis) => { analysis.assetCandidates[0].unexpected = true; }, /assetCandidates\[0\]\.unexpected is not allowed/],
    ["unknown edge field", (analysis) => { analysis.graph.edges[0].channel_key = "legacy"; }, /edges\[0\]\.channel_key is not allowed/]
  ]) {
    withRoot((root, analysis) => {
      mutate(analysis);
      writeJson(join(root, "analysis-result.json"), analysis);
      assert.match(fail(root), expected, label);
    });
  }
});

test("validator permits standalone workflow_ref null and validates non-null Workflow refs", () => {
  withRoot((root, analysis) => {
    writeJson(join(root, "analysis-result.json"), analysis);
    assert.match(run(root), /Artifact validation OK/);
  });
  withRoot((root, analysis) => {
    analysis.graph.workflow_ref = "agent.writer";
    writeJson(join(root, "analysis-result.json"), analysis);
    assert.match(fail(root), /graph\.workflow_ref must reference a workflow asset/);
  });
  withRoot((root, analysis) => {
    analysis.assetCandidates.unshift(assetCandidate({
      asset_id: "workflow.target",
      asset_type: "workflow",
      binding: null,
      connection: null,
      workflow_profile: { representation: "graph", coordination: "explicit", template_ref: null },
      rationale: "Owns the reviewed graph"
    }));
    analysis.graph.workflow_ref = "workflow.target";
    writeJson(join(root, "analysis-result.json"), analysis);
    assert.match(run(root), /Artifact validation OK/);
  });
});

test("validator rejects duplicate Graph node and edge IDs", () => {
  withRoot((root, analysis) => {
    analysis.graph.nodes.push({ id: "writer", label: "Duplicate writer", node_kind: "join" });
    writeJson(join(root, "analysis-result.json"), analysis);
    assert.match(fail(root), /graph\.nodes\[3\]\.id duplicates writer/);
  });
  withRoot((root, analysis) => {
    analysis.graph.edges.push({
      id: "edge.input.writer",
      from: "input",
      to: "output",
      control: control("next"),
      channel: null
    });
    writeJson(join(root, "analysis-result.json"), analysis);
    assert.match(fail(root), /graph\.edges\[2\]\.id duplicates edge\.input\.writer/);
  });
});

test("validator requires each Graph edge endpoint to reference an existing node", () => {
  for (const endpoint of ["from", "to"]) {
    withRoot((root, analysis) => {
      analysis.graph.edges[0][endpoint] = "missing";
      writeJson(join(root, "analysis-result.json"), analysis);
      assert.match(fail(root), new RegExp(`graph\\.edges\\[0\\]\\.${endpoint} must reference an existing node`));
    });
  }
});

test("validator accepts valid Graph regions", () => {
  withRoot((root, analysis) => {
    analysis.graph.regions = [graphRegion()];
    writeJson(join(root, "analysis-result.json"), analysis);
    assert.match(run(root), /Artifact validation OK/);
  });
});

test("validator rejects dangling Graph region node references", () => {
  for (const key of ["node_ids", "entry_node_ids", "exit_node_ids"]) {
    withRoot((root, analysis) => {
      analysis.graph.regions = [graphRegion({ [key]: ["missing"] })];
      writeJson(join(root, "analysis-result.json"), analysis);
      assert.match(fail(root), new RegExp(`graph\\.regions\\[0\\]\\.${key} must reference existing nodes`));
    });
  }
});

test("validator requires Graph region entry and exit nodes to belong to node_ids", () => {
  for (const key of ["entry_node_ids", "exit_node_ids"]) {
    withRoot((root, analysis) => {
      analysis.graph.regions = [graphRegion({ node_ids: ["writer"], [key]: ["input"] })];
      writeJson(join(root, "analysis-result.json"), analysis);
      assert.match(fail(root), new RegExp(`graph\\.regions\\[0\\]\\.${key} must be contained in node_ids`));
    });
  }
});

test("validator rejects duplicate Graph region IDs and dangling parents", () => {
  withRoot((root, analysis) => {
    analysis.graph.regions = [graphRegion(), graphRegion({ node_ids: ["output"], entry_node_ids: ["output"], exit_node_ids: ["output"] })];
    writeJson(join(root, "analysis-result.json"), analysis);
    assert.match(fail(root), /graph\.regions\[1\]\.id duplicates region\.main/);
  });
  withRoot((root, analysis) => {
    analysis.graph.regions = [graphRegion({ parent_region_id: "region.missing" })];
    writeJson(join(root, "analysis-result.json"), analysis);
    assert.match(fail(root), /graph\.regions\[0\]\.parent_region_id must reference an existing region/);
  });
});

test("validator rejects cyclic Graph region parents", () => {
  withRoot((root, analysis) => {
    analysis.graph.regions = [
      graphRegion({ id: "region.first", parent_region_id: "region.second" }),
      graphRegion({ id: "region.second", parent_region_id: "region.first" })
    ];
    writeJson(join(root, "analysis-result.json"), analysis);
    assert.match(fail(root), /region\.first has a cyclic parent_region_id chain/);
  });
});

test("validator preserves source requirement and typed asset reference consistency", () => {
  withRoot((root, analysis) => {
    analysis.assetCandidates[0].source_requirement_id = "req-other";
    analysis.graph.source_requirement_id = "req-other";
    writeJson(join(root, "analysis-result.json"), analysis);
    const stderr = fail(root);
    assert.match(stderr, /assetCandidates\[0\]\.source_requirement_id must equal normalizedRequirement\.id/);
    assert.match(stderr, /graph\.source_requirement_id must equal normalizedRequirement\.id/);
  });
  withRoot((root, analysis) => {
    analysis.assetCandidates.push(assetCandidate({ asset_id: "tool.writer", asset_type: "tool" }));
    analysis.graph.nodes[1].agent_ref = "tool.writer";
    writeJson(join(root, "analysis-result.json"), analysis);
    assert.match(fail(root), /graph\.nodes\[1\]\.agent_ref must reference a agent asset/);
  });
  withRoot((root, analysis) => {
    analysis.graph.nodes[1].available_tools = [{ tool_ref: "agent.writer", invocation_control: "agent" }];
    writeJson(join(root, "analysis-result.json"), analysis);
    assert.match(fail(root), /available_tools\[0\]\.tool_ref must reference a tool asset/);
  });
});

test("validator rejects removed artifact filenames", () => {
  for (const [name, replacement, value] of [
    ["module-candidates.json", "asset-candidates.json", []],
    ["process-flow.json", "graph-ir.json", {}],
    ["commonization-notes.json", "analysis-result.json", {}]
  ]) {
    withRoot((root) => {
      writeJson(join(root, name), value);
      assert.match(fail(root), new RegExp(`${name.replace(".", "\\.")} is removed; use ${replacement.replace(".", "\\.")}`));
    });
  }
});

test("validator rejects every removed legacy key on assets, nodes, and edges", () => {
  for (const [surface, key, value] of [
    ["asset", "module_category", "agent"],
    ["asset", "adapter_kind", "retrieval"],
    ["asset", "runtime_binding", "local_function"],
    ["asset", "mcp_server", "old-server"],
    ["node", "module_id", "agent.writer"],
    ["node", "invoke_binding", "local_python"],
    ["node", "decision_owner", "llm"],
    ["edge", "edge_kind", "event_output"],
    ["edge", "flow_kind", "sequence"]
  ]) {
    withRoot((root, analysis) => {
      const target = surface === "asset"
        ? analysis.assetCandidates[0]
        : surface === "node"
          ? analysis.graph.nodes[1]
          : analysis.graph.edges[0];
      target[key] = value;
      writeJson(join(root, "analysis-result.json"), analysis);
      assert.match(fail(root), new RegExp(`${key} is retired vocabulary`), `${surface}.${key}`);
    });
  }
});

test("validator treats embedded payload schemas as opaque to retired Agent Factory vocabulary", () => {
  withRoot((root, analysis) => {
    analysis.assetCandidates[0].inputs = [{
      name: "payload",
      type: "object",
      schema: {
        type: "object",
        properties: {
          module_id: { type: "string" }
        }
      }
    }];
    writeJson(join(root, "analysis-result.json"), analysis);
    assert.match(run(root), /Artifact validation OK/);
  });
});

test("validator rejects removed legacy values as asset, node, and edge selectors", () => {
  withRoot((root, analysis) => {
    analysis.assetCandidates[0].asset_type = "remote_a2a";
    analysis.graph.nodes[1].node_kind = "remote_a2a";
    analysis.graph.edges[0].control.kind = "remote_a2a";
    writeJson(join(root, "analysis-result.json"), analysis);
    const stderr = fail(root);
    assert.match(stderr, /asset_type has invalid enum value/);
    assert.match(stderr, /nodes\[1\].*(?:schema shape|node_kind)/);
    assert.match(stderr, /control.kind has invalid enum value/);
  });
});

test("validator requires A2A contracts to point to an A2A Agent through agent_ref", () => {
  withRoot((root, analysis) => {
    analysis.a2aContracts = [{ contract_id: "a2a-001", remote_module_id: "agent.writer", contract_status: "approved" }];
    writeJson(join(root, "analysis-result.json"), analysis);
    const stderr = fail(root);
    assert.match(stderr, /remote_module_id is retired vocabulary/);
    assert.match(stderr, /agent_ref is required/);
  });
});

test("validator requires every Agent A2A binding or exposure ref to resolve to a contract", () => {
  withRoot((root) => {
    const analysis = structuredClone(contractIdentityFixture);
    analysis.a2aContracts = [];
    writeJson(join(root, "analysis-result.json"), analysis);
    assert.match(fail(root), /binding\.contract_ref a2a-207 must reference an A2A contract/);
  });
});

test("validator requires a non-empty runtime stub for handoff approval", () => {
  withRoot((root, analysis) => {
    writeJson(join(root, "analysis-result.json"), analysis);
    writeJson(join(root, "af-run-manifest.json"), approvedManifest(root));
    assert.match(fail(root), /stub_ready_for_followup requires a non-empty runtime-stub/);
  });
  withRoot((root, analysis) => {
    writeJson(join(root, "analysis-result.json"), analysis);
    mkdirSync(join(root, "runtime-stub"));
    writeJson(join(root, "af-run-manifest.json"), approvedManifest(root));
    assert.match(fail(root), /stub_ready_for_followup requires a non-empty runtime-stub/);
  });
  withRoot((root, analysis) => {
    writeJson(join(root, "analysis-result.json"), analysis);
    mkdirSync(join(root, "runtime-stub"));
    writeFileSync(join(root, "runtime-stub", "agent.py"), "# generated runtime\n");
    writeJson(join(root, "af-run-manifest.json"), approvedManifest(root));
    assert.match(run(root), /Artifact validation OK/);
  });
});

test("validator rejects scaffold plans that drift from approved Target assets", () => {
  withRoot((root, analysis) => {
    const plan = scaffoldPlan(analysis);
    plan.assets[0].asset_type = "tool";
    plan.assets[0].binding = { kind: "function", server_ref: null, tool_name: "run" };
    plan.assets[0].connection = { transport: "in_process" };
    writeJson(join(root, "analysis-result.json"), analysis);
    writeJson(join(root, "scaffold-plan.json"), plan);
    assert.match(fail(root), /drifts from the approved candidate contract/);
  });
});

test("validator accepts an explicit Mock Lab MCP binding on an approved Tool projection", () => {
  withRoot((root, analysis) => {
    const tool = assetCandidate({
      asset_id: "tool.lookup",
      name: "Lookup",
      asset_type: "tool",
      binding: { kind: "function" },
      connection: { transport: "in_process" }
    });
    analysis.assetCandidates.push(tool);
    const plan = scaffoldPlan(analysis);
    plan.assets[1].binding = { kind: "mcp", server_ref: "mock.lookup", tool_name: "lookup" };
    plan.assets[1].connection = { transport: "stdio" };
    writeJson(join(root, "analysis-result.json"), analysis);
    writeJson(join(root, "scaffold-plan.json"), plan);
    assert.match(run(root), /Artifact validation OK/);
  });
});

function withRoot(callback) {
  const root = mkdtempSync(join(tmpdir(), "af-validator-target-"));
  try { callback(root, targetAnalysis()); }
  finally { rmSync(root, { recursive: true, force: true }); }
}

function run(root) {
  return execFileSync(process.execPath, [validator, root], { encoding: "utf8", stdio: "pipe" });
}

function fail(root) {
  try { run(root); }
  catch (error) { return String(error.stderr ?? error.stdout ?? error.message); }
  assert.fail("validator unexpectedly succeeded");
}

function targetAnalysis() {
  const agent = assetCandidate();
  return {
    contract_version: "2.0",
    normalizedRequirement: {
      id: "req-target",
      title: "Target",
      raw_text: "Build a standalone writing Agent",
      domain: "공통",
      requester: { team: "platform", role: "developer" },
      business_goal: "Produce a reviewed response",
      current_process: [],
      inputs: [],
      outputs: [],
      systems: [],
      risk_signals: [],
      missing_information: [],
      contradictions: [],
      status: "approved"
    },
    evidence: {
      requested_goal: "Produce a reviewed response",
      business_domain_hint: "공통",
      user_role: "developer",
      input_data: [],
      output_data: [],
      systems_mentioned: [],
      decisions_implied: [],
      risk_signals: [],
      missing_information: [],
      contradictions: [],
      assumptions: []
    },
    assetCandidates: [agent],
    a2aContracts: [],
    runtimeContracts: [],
    graph: {
      graph_id: "graph.target",
      source_requirement_id: "req-target",
      workflow_ref: null,
      nodes: [
        { id: "input", label: "Input", node_kind: "input" },
        { id: "writer", label: "Writer", node_kind: "agent", agent_ref: agent.asset_id, available_tools: [] },
        { id: "output", label: "Output", node_kind: "output" }
      ],
      edges: [
        { id: "edge.input.writer", from: "input", to: "writer", control: control("next"), channel: null },
        { id: "edge.writer.output", from: "writer", to: "output", control: control("next"), channel: null }
      ],
      regions: []
    }
  };
}

function assetCandidate(overrides = {}) {
  return {
    asset_id: "agent.writer",
    source_requirement_id: "req-target",
    catalog_entry_id: null,
    name: "Writer",
    asset_type: "agent",
    domain_scope: "domain_neutral",
    business_domains: [],
    owner: "platform",
    reuse_status: "project_only",
    capability_tags: [],
    binding: null,
    connection: null,
    workflow_profile: null,
    exposure: null,
    confidence: 0.9,
    rationale: "Produces the reviewed response",
    inputs: [],
    outputs: [],
    risk_level: "low",
    risk_signals: [],
    status: "approved",
    missing_information: [],
    developer_todos: [],
    ...overrides
  };
}

function control(kind, condition = null, acceptedAliases = [], isDefault = false) {
  return { kind, condition, accepted_aliases: acceptedAliases, default: isDefault };
}

function graphRegion(overrides = {}) {
  return {
    id: "region.main",
    kind: "parallel",
    node_ids: ["input", "writer", "output"],
    entry_node_ids: ["input"],
    exit_node_ids: ["output"],
    parent_region_id: null,
    ...overrides
  };
}

function scaffoldPlan(analysis) {
  return {
    contract_version: "2.0",
    requirement_id: analysis.normalizedRequirement.id,
    source: "approved_workbench_artifact",
    raw_requirement_to_code: false,
    output_mode: "runnable",
    assets: structuredClone(analysis.assetCandidates),
    graph: structuredClone(analysis.graph),
    runtime_contracts: [],
    excluded_assets: [],
    manifest: { catalog_bound_assets: [], new_code_required: [] },
    validation: { can_generate_source: true, blockers: [], warnings: [] }
  };
}

function approvedManifest(root) {
  return {
    requirement_id: "req-target",
    artifact_root: root,
    current_stage: "verify",
    stages: {
      analyze: { status: "complete", outputs: ["analysis-result.json"] },
      design: { status: "complete", outputs: ["analysis-result.json", "boundary-design.md"] },
      build: { status: "complete", outputs: ["runtime-stub/agent.py"] },
      verify: { status: "pending", outputs: [] }
    },
    approvals: {
      analysis_reviewed: true,
      boundaries_approved: true,
      runtime_contracts_approved: true,
      stub_ready_for_followup: true
    },
    validation: { commands: [], last_result: "not_run" }
  };
}

function writeJson(path, value) {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
}

function schema(name) {
  return JSON.parse(readFileSync(new URL(name, schemaRoot), "utf8"));
}

function tsConstArray(source, name) {
  const match = new RegExp(`(?:export\\s+)?const\\s+${name}\\s*=\\s*\\[([\\s\\S]*?)\\](?:\\s+as const)?;`).exec(source);
  assert.ok(match, `missing TypeScript array ${name}`);
  return [...match[1].matchAll(/"([^"]+)"/g)].map((entry) => entry[1]);
}

function inlineRequiredKeys(source, functionName) {
  const start = source.indexOf(`function ${functionName}`);
  assert.notEqual(start, -1, `missing web validator function ${functionName}`);
  const next = source.indexOf("\nfunction ", start + 1);
  const section = source.slice(start, next === -1 ? source.length : next);
  const match = /exactKeys\([^,]+,\s*\[[^\]]*\],\s*\[([^\]]*)\]/s.exec(section);
  assert.ok(match, `missing exactKeys required list in ${functionName}`);
  return [...match[1].matchAll(/"([^"]+)"/g)].map((entry) => entry[1]);
}

function bindingKinds(candidateSchema) {
  const values = [];
  for (const rawBranch of candidateSchema.$defs.binding.oneOf) {
    const branch = rawBranch.$ref
      ? candidateSchema.$defs[rawBranch.$ref.split("/").at(-1)]
      : rawBranch;
    const kind = branch.properties.kind;
    if (Array.isArray(kind.enum)) values.push(...kind.enum);
    else if (typeof kind.const === "string") values.push(kind.const);
  }
  return values;
}

function sorted(values) {
  return [...values].sort((left, right) => String(left).localeCompare(String(right)));
}
