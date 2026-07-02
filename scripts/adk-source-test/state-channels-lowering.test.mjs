import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { channelModules, generator, writeChannelFixture } from "./fixtures.mjs";

test("runnable lowers per-edge state channels (agent output_key, function mirror, consumer read)", () => {
  const { agentBase, unconnectedAdapter, connectedAdapter } = channelModules();
  const modules = [
    { ...agentBase, id: "mod-a", name: "요약_Agent" },
    { ...unconnectedAdapter, id: "mod-b", name: "전처리_Adapter" },
    { ...connectedAdapter, id: "mod-c", name: "조회_Adapter" }
  ];
  const artifactRoot = mkdtempSync(join(tmpdir(), "af-gen-channel-"));
  try {
    writeChannelFixture(artifactRoot, {
      modules,
      nodes: [
        { id: "in1", node_kind: "input" },
        { id: "a", node_kind: "agent", module_id: "mod-a" },
        { id: "b", node_kind: "adapter", module_id: "mod-b" },
        { id: "c", node_kind: "adapter", module_id: "mod-c" },
        { id: "out1", node_kind: "output" }
      ],
      edges: [
        { from: "in1", to: "a" },
        { from: "in1", to: "b" },
        { from: "a", to: "c", edge_kind: "session_state", state_key: "agent_summary" },
        { from: "b", to: "c", edge_kind: "temp_state", state_key: "lookup_payload" },
        { from: "c", to: "out1" }
      ]
    });
    const outputRoot = join(artifactRoot, "out");
    execFileSync(process.execPath, [generator, artifactRoot, outputRoot], { stdio: "pipe" });
    const source = readFileSync(join(outputRoot, "req_ch_adk", "agent.py"), "utf8");
    assert.match(source, /output_key="agent_summary"/, "agent's sole outgoing state channel becomes output_key");
    assert.match(source, /ctx\.state\["temp:lookup_payload"\] = payload/, "function producer mirrors payload to the scoped temp channel");
    assert.match(source, /"temp:lookup_payload"/, "connected consumer receives the incoming channel key");
    assert.doesNotMatch(source, /output_key="mod_a_output"/, "named channel replaces the canonical agent output key");
  } finally {
    rmSync(artifactRoot, { recursive: true, force: true });
  }
});

test("runnable describes reviewed state channels consumed by agent nodes", () => {
  const { agentBase, unconnectedAdapter } = channelModules();
  const modules = [
    { ...unconnectedAdapter, id: "mod-pre", name: "고객_컨텍스트_Adapter" },
    { ...agentBase, id: "mod-agent", name: "컨텍스트_판단_Agent" }
  ];
  const artifactRoot = mkdtempSync(join(tmpdir(), "af-gen-agent-state-consumer-"));
  try {
    writeChannelFixture(artifactRoot, {
      modules,
      nodes: [
        { id: "in1", node_kind: "input" },
        { id: "pre", node_kind: "adapter", module_id: "mod-pre" },
        { id: "agent", node_kind: "agent", module_id: "mod-agent" },
        { id: "out1", node_kind: "output" }
      ],
      edges: [
        { from: "in1", to: "pre" },
        { from: "pre", to: "agent", edge_kind: "session_state", state_key: "customer_context" },
        { from: "agent", to: "out1" }
      ]
    });
    const outputRoot = join(artifactRoot, "out");
    execFileSync(process.execPath, [generator, artifactRoot, outputRoot], { stdio: "pipe" });
    const source = readFileSync(join(outputRoot, "req_ch_adk", "agent.py"), "utf8");
    assert.match(source, /검토된 session state 입력: customer_context/);
    assert.match(source, /ctx\.state\["customer_context"\] = payload/);
  } finally {
    rmSync(artifactRoot, { recursive: true, force: true });
  }
});

test("runnable connected MCP adapters resolve inputs from agent-authored JSON state channels", () => {
  const { agentBase, connectedAdapter } = channelModules();
  const modules = [
    {
      ...agentBase,
      id: "mod-arg-agent",
      name: "Adapter_Arguments_Agent",
      outputs: [{ name: "adapter_arguments", type: "object", required: true }]
    },
    {
      ...connectedAdapter,
      id: "mod-lookup",
      name: "조회_Adapter",
      inputs: [
        { name: "objective_text", type: "string", required: true },
        { name: "product_hint", type: "string", required: false }
      ],
      smoke_spec: {
        sample_user_message: "fallback should lose",
        synthetic_inputs: { objective_text: "synthetic fallback objective" },
        expected_output_shape: { type: "object" },
        expected_event_markers: [],
        mock_sources: [],
        ready: true
      }
    }
  ];
  const artifactRoot = mkdtempSync(join(tmpdir(), "af-gen-agent-json-channel-"));
  try {
    writeChannelFixture(artifactRoot, {
      modules,
      nodes: [
        { id: "in1", node_kind: "input" },
        { id: "arg-agent", node_kind: "agent", module_id: "mod-arg-agent" },
        { id: "lookup", node_kind: "adapter", module_id: "mod-lookup" },
        { id: "out1", node_kind: "output" }
      ],
      edges: [
        { from: "in1", to: "arg-agent" },
        { from: "arg-agent", to: "lookup", edge_kind: "session_state", state_key: "adapter_arguments" },
        { from: "lookup", to: "out1" }
      ]
    });
    const outputRoot = join(artifactRoot, "out");
    execFileSync(process.execPath, [generator, artifactRoot, outputRoot], { stdio: "pipe" });
    const source = readFileSync(join(outputRoot, "req_ch_adk", "agent.py"), "utf8");
    assert.match(source, /output_key="adapter_arguments"/, "planner agent writes the named arguments channel");
    assert.match(source, /^import json$/m, "JSON state channel parsing needs json import");
    assert.match(source, /def _json_payload\(value: Any\) -> Any:/, "runtime can parse agent-authored JSON strings");
    assert.match(source, /_value = _json_payload\(payload\)/, "payload resolver tries JSON string payloads");
    assert.match(source, /"adapter_arguments"/, "connected adapter receives the named channel");
    assert.match(source, /async def _fn_mod_lookup\(ctx: Context, node_input=None\) -> dict:/);
    assert.match(source, /node_input=node_input/);
    assert.match(source, /"arguments": arguments/, "audit payload records actual MCP arguments");
    assert.doesNotMatch(source, /for key, value in structured_content\.items\(\):/);
  } finally {
    rmSync(artifactRoot, { recursive: true, force: true });
  }
});

test("runnable connected MCP adapters prefer reviewed node input_mapping before fallback inputs", () => {
  const { agentBase, connectedAdapter } = channelModules();
  const modules = [
    {
      ...agentBase,
      id: "mod-arg-agent",
      name: "Adapter_Arguments_Agent",
      outputs: [{ name: "adapter_arguments", type: "object", required: true }]
    },
    {
      ...connectedAdapter,
      id: "mod-lookup",
      name: "조회_Adapter",
      inputs: [
        { name: "objective_text", type: "string", required: true },
        { name: "product_hint", type: "string", required: false }
      ],
      input_mapping: {
        objective_text: "confirmed_objective_text",
        product_hint: "confirmed_product_hint"
      },
      smoke_spec: {
        sample_user_message: "fallback should lose",
        synthetic_inputs: { objective_text: "synthetic fallback objective" },
        expected_output_shape: { type: "object" },
        expected_event_markers: [],
        mock_sources: [],
        ready: true
      }
    }
  ];
  const artifactRoot = mkdtempSync(join(tmpdir(), "af-gen-reviewed-input-map-"));
  try {
    writeChannelFixture(artifactRoot, {
      modules,
      nodes: [
        { id: "in1", node_kind: "input" },
        { id: "arg-agent", node_kind: "agent", module_id: "mod-arg-agent" },
        {
          id: "lookup",
          node_kind: "adapter",
          module_id: "mod-lookup",
          input_mapping: {
            objective_text: "confirmed_objective_text",
            product_hint: "confirmed_product_hint"
          }
        },
        { id: "out1", node_kind: "output" }
      ],
      edges: [
        { from: "in1", to: "arg-agent" },
        { from: "arg-agent", to: "lookup", edge_kind: "session_state", state_key: "adapter_arguments" },
        { from: "lookup", to: "out1" }
      ]
    });
    const outputRoot = join(artifactRoot, "out");
    execFileSync(process.execPath, [generator, artifactRoot, outputRoot], { stdio: "pipe" });
    const source = readFileSync(join(outputRoot, "req_ch_adk", "agent.py"), "utf8");
    assert.match(source, /reviewed_mapping = contract\.get\("input_mapping"\)/);
    assert.match(source, /source_key = reviewed_mapping\.get\(name\) or overrides\.get\(name, name\)/);
    assert.match(source, /"confirmed_objective_text"/);
    assert.match(source, /"confirmed_product_hint"/);
  } finally {
    rmSync(artifactRoot, { recursive: true, force: true });
  }
});
