import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import {
  baseModules,
  discoverGeneratedPackage,
  generator,
  remoteGraph,
  remoteModule,
  repoRoot,
  writeRemoteFixture
} from "./fixtures.mjs";

function approvedA2AContract(overrides = {}) {
  const contract = {
    contract_id: "a2a-001",
    remote_module_id: "mod-r",
    target_agent_name: "Partner Prime Agent",
    contract_status: "approved",
    agent_card: {
      discovery_method: "well-known",
      agent_card_url: "http://localhost:8001/a2a/test_agent/.well-known/agent-card.json",
      version: "1.0.0",
      notes: ""
    },
    adk_runtime_policy: {
      timeout_seconds: 60,
      auth: {
        mode: "bearer_env",
        env_var: "AF_A2A_A2A_001_TOKEN",
        metadata_key: null
      },
      retry_handoff: {
        max_attempts: 2,
        backoff_seconds: 5,
        retry_on: ["transient_transport_error"]
      },
      fallback_handoff: {
        mode: "manual_review",
        message: "Route to local human review if the remote agent does not produce a terminal result."
      }
    }
  };
  return { ...contract, ...overrides };
}

test("runnable lowers a remote_a2a node to RemoteA2aAgent from its A2A contract", () => {
  const [agentBase] = baseModules(true);
  const modules = [{ ...agentBase, id: "mod-a", name: "local_dispatcher_agent" }, remoteModule()];
  const a2aContracts = [approvedA2AContract()];
  const artifactRoot = mkdtempSync(join(tmpdir(), "af-gen-remote-"));
  try {
    writeRemoteFixture(artifactRoot, { modules, nodes: remoteGraph.nodes, edges: remoteGraph.edges, a2aContracts });
    const outputRoot = join(artifactRoot, "out");
    execFileSync(process.execPath, [generator, artifactRoot, outputRoot], { stdio: "pipe" });
    const source = readFileSync(join(outputRoot, "req_remote_adk", "agent.py"), "utf8");
    assert.match(source, /from google\.adk\.agents\.remote_a2a_agent import RemoteA2aAgent/, "imports RemoteA2aAgent");
    assert.match(source, /= RemoteA2aAgent\(/, "emits a RemoteA2aAgent node");
    assert.match(source, /agent_card="http:\/\/localhost:8001\/a2a\/test_agent\/\.well-known\/agent-card\.json"/, "agent_card from the contract");
    assert.match(source, /use_legacy=False/);
    const reqs = readFileSync(join(repoRoot, "requirements", "adk-runtime.txt"), "utf8");
    assert.match(reqs, /google-adk\[a2a,mcp\]/, "shared requirements include the ADK extras");
  } finally {
    rmSync(artifactRoot, { recursive: true, force: true });
  }
});

test("runnable maps structured A2A runtime policy to ADK-supported config and handoff files", () => {
  const [agentBase] = baseModules(true);
  const modules = [{ ...agentBase, id: "mod-a", name: "local_dispatcher_agent" }, remoteModule()];
  const a2aContracts = [approvedA2AContract()];
  const artifactRoot = mkdtempSync(join(tmpdir(), "af-gen-remote-policy-"));
  try {
    writeRemoteFixture(artifactRoot, { modules, nodes: remoteGraph.nodes, edges: remoteGraph.edges, a2aContracts });
    const outputRoot = join(artifactRoot, "out");
    execFileSync(process.execPath, [generator, artifactRoot, outputRoot], { stdio: "pipe" });
    const packageName = discoverGeneratedPackage(outputRoot);
    const source = readFileSync(join(outputRoot, packageName, "agent.py"), "utf8");
    assert.match(source, /from google\.adk\.a2a\.agent\.config import A2aRemoteAgentConfig, RequestInterceptor/);
    assert.match(source, /async def _a2a_before_node_mod_r\(ctx, params\):/);
    assert.match(source, /auth_value = os\.environ\.get\("AF_A2A_A2A_001_TOKEN"\)/);
    assert.match(source, /metadata\["authorization"\] = f"Bearer \{auth_value\}"/);
    assert.match(source, /return Event\(/);
    assert.match(source, /timeout=60,/);
    assert.match(source, /config=A2aRemoteAgentConfig\(\s*request_interceptors=\[RequestInterceptor\(before_request=_a2a_before_node_mod_r\)\]/);
    assert.doesNotMatch(source, /max_attempts|retry_on|fallback_handoff/);

    const manifest = JSON.parse(readFileSync(join(outputRoot, packageName, "workflow_manifest.json"), "utf8"));
    assert.deepEqual(manifest.runtime.remote_a2a, [
      {
        module_id: "mod-r",
        module_name: "remote_partner_agent",
        contract_id: "a2a-001",
        target_agent_name: "Partner Prime Agent",
        agent_card_url: "http://localhost:8001/a2a/test_agent/.well-known/agent-card.json",
        adk_runtime_policy: a2aContracts[0].adk_runtime_policy,
        generated_support: {
          timeout: true,
          request_interceptor_auth: true,
          retry_runtime_wrapper: false,
          fallback_runtime_wrapper: false
        }
      }
    ]);

    const envExample = readFileSync(join(outputRoot, ".env.example"), "utf8");
    assert.match(envExample, /# AF_A2A_A2A_001_TOKEN=\.\.\./);
    const readme = readFileSync(join(outputRoot, "README.md"), "utf8");
    assert.match(readme, /Remote A2A runtime policy/);
    assert.match(readme, /retry_handoff and fallback_handoff are reviewed handoff policy/);
    const handoff = readFileSync(join(outputRoot, "implementation-handoff.md"), "utf8");
    assert.match(handoff, /AF_A2A_A2A_001_TOKEN/);
    assert.match(handoff, /Remote A2A retry\/fallback policy is not generated as an ADK retry wrapper/);
  } finally {
    rmSync(artifactRoot, { recursive: true, force: true });
  }
});

test("runnable lowers a remote_agent_call node to RemoteA2aAgent from its A2A contract", () => {
  const [agentBase] = baseModules(true);
  const modules = [{ ...agentBase, id: "mod-a", name: "local_dispatcher_agent" }, remoteModule()];
  const a2aContracts = [approvedA2AContract()];
  const nodes = remoteGraph.nodes.map((node) => node.id === "r" ? { ...node, node_kind: "remote_agent_call" } : node);
  const artifactRoot = mkdtempSync(join(tmpdir(), "af-gen-remote-agent-call-"));
  try {
    writeRemoteFixture(artifactRoot, { modules, nodes, edges: remoteGraph.edges, a2aContracts });
    const outputRoot = join(artifactRoot, "out");
    execFileSync(process.execPath, [generator, artifactRoot, outputRoot], { stdio: "pipe" });
    const source = readFileSync(join(outputRoot, "req_remote_adk", "agent.py"), "utf8");
    assert.match(source, /= RemoteA2aAgent\(/, "emits a RemoteA2aAgent node");
    assert.match(source, /agent_card="http:\/\/localhost:8001\/a2a\/test_agent\/\.well-known\/agent-card\.json"/, "agent_card from the contract");
  } finally {
    rmSync(artifactRoot, { recursive: true, force: true });
  }
});

test("runnable rejects a remote_a2a node whose contract has no agent_card_url", () => {
  const [agentBase] = baseModules(true);
  const modules = [{ ...agentBase, id: "mod-a", name: "local_agent" }, remoteModule()];
  const a2aContracts = [
    approvedA2AContract({
      target_agent_name: "Partner",
      agent_card: { discovery_method: "tbd", agent_card_url: "", version: "", notes: "" }
    })
  ];
  const artifactRoot = mkdtempSync(join(tmpdir(), "af-gen-remote-nocard-"));
  try {
    writeRemoteFixture(artifactRoot, { modules, nodes: remoteGraph.nodes, edges: remoteGraph.edges, a2aContracts });
    assert.throws(
      () => execFileSync(process.execPath, [generator, artifactRoot, join(artifactRoot, "out")], { stdio: "pipe" }),
      /agent_card\.agent_card_url/
    );
  } finally {
    rmSync(artifactRoot, { recursive: true, force: true });
  }
});

test("runnable rejects a mislabeled remote_a2a edge between two local nodes", () => {
  // Two LOCAL nodes joined by a remote_a2a edge with boundary crossing — must be
  // rejected (it would otherwise bypass the boundary-crossing gate). There is no
  // remote_a2a module, so assertRemoteA2aSupported passes; the edge gate must catch it.
  const [agentBase, unconnectedAdapter] = baseModules(true);
  const modules = [{ ...agentBase, id: "mod-a", name: "A_agent" }, { ...unconnectedAdapter, id: "mod-b", name: "B_adapter" }];
  const artifactRoot = mkdtempSync(join(tmpdir(), "af-gen-remote-mislabeled-"));
  try {
    writeRemoteFixture(artifactRoot, {
      modules,
      nodes: [
        { id: "in1", node_kind: "input" },
        { id: "a", node_kind: "agent", module_id: "mod-a" },
        { id: "b", node_kind: "adapter", module_id: "mod-b" },
        { id: "out1", node_kind: "output" }
      ],
      edges: [
        { from: "in1", to: "a", edge_kind: "event_output", execution_semantics: "normal_transition" },
        { from: "a", to: "b", edge_kind: "remote_a2a", execution_semantics: "boundary_crossing", a2a_contract_id: "a2a-001", is_remote_boundary_crossing: true },
        { from: "b", to: "out1", edge_kind: "event_output", execution_semantics: "normal_transition" }
      ],
      a2aContracts: [{
        ...approvedA2AContract(),
        remote_module_id: "mod-x",
        target_agent_name: "X",
        agent_card: { discovery_method: "wk", agent_card_url: "http://localhost:8001/.well-known/agent-card.json", version: "1.0.0", notes: "" }
      }]
    });
    assert.throws(
      () => execFileSync(process.execPath, [generator, artifactRoot, join(artifactRoot, "out")], { stdio: "pipe" }),
      /does not support these edges/
    );
  } finally {
    rmSync(artifactRoot, { recursive: true, force: true });
  }
});

// ---------------------------------------------------------------------------
