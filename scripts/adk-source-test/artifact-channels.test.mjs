import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { channelModules, generator, writeChannelFixture } from "./fixtures.mjs";

test("runnable lowers an artifact channel (function save_artifact, consumer load_artifact)", () => {
  const { agentBase, unconnectedAdapter, connectedAdapter } = channelModules();
  const modules = [
    { ...agentBase, id: "mod-a", name: "분류_Agent" },
    { ...unconnectedAdapter, id: "mod-b", name: "증거_Adapter" },
    { ...connectedAdapter, id: "mod-c", name: "조회_Adapter" }
  ];
  const artifactRoot = mkdtempSync(join(tmpdir(), "af-gen-artifact-"));
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
        { from: "a", to: "b" },
        { from: "b", to: "c", edge_kind: "artifact", artifact_key: "evidence_blob.json" },
        { from: "c", to: "out1" }
      ]
    });
    const outputRoot = join(artifactRoot, "out");
    execFileSync(process.execPath, [generator, artifactRoot, outputRoot], { stdio: "pipe" });
    const source = readFileSync(join(outputRoot, "req_ch_adk", "agent.py"), "utf8");
    assert.match(source, /^import json$/m, "artifact bundle imports json");
    assert.match(source, /from google\.genai import types/, "artifact bundle imports genai types");
    assert.match(
      source,
      /await ctx\.save_artifact\("evidence_blob\.json", types\.Part\(text=json\.dumps\(payload/,
      "function producer saves the artifact"
    );
    assert.match(source, /await ctx\.load_artifact\(_artifact_key\)/, "consumer loads incoming artifacts");
    assert.match(source, /extra_payloads=_artifact_payloads/, "consumer passes loaded artifacts to input resolution");
  } finally {
    rmSync(artifactRoot, { recursive: true, force: true });
  }
});

test("runnable rejects artifact channels consumed by agent nodes", () => {
  const { agentBase, unconnectedAdapter } = channelModules();
  const modules = [
    { ...unconnectedAdapter, id: "mod-b", name: "증거_Adapter" },
    { ...agentBase, id: "mod-a", name: "검토_Agent" }
  ];
  const artifactRoot = mkdtempSync(join(tmpdir(), "af-gen-artifact-agent-consumer-"));
  try {
    writeChannelFixture(artifactRoot, {
      modules,
      nodes: [
        { id: "in1", node_kind: "input" },
        { id: "b", node_kind: "adapter", module_id: "mod-b" },
        { id: "a", node_kind: "agent", module_id: "mod-a" },
        { id: "out1", node_kind: "output" }
      ],
      edges: [
        { from: "in1", to: "b" },
        { from: "b", to: "a", edge_kind: "artifact", artifact_key: "evidence_blob.json" },
        { from: "a", to: "out1" }
      ]
    });
    assert.throws(
      () => execFileSync(process.execPath, [generator, artifactRoot, join(artifactRoot, "out")], { stdio: "pipe" }),
      /artifact channel consumed by non-connected node/
    );
  } finally {
    rmSync(artifactRoot, { recursive: true, force: true });
  }
});

test("runnable rejects an artifact channel produced by an agent node", () => {
  const { agentBase, connectedAdapter } = channelModules();
  const modules = [
    { ...agentBase, id: "mod-a", name: "초안_Agent" },
    { ...connectedAdapter, id: "mod-c", name: "조회_Adapter" }
  ];
  const artifactRoot = mkdtempSync(join(tmpdir(), "af-gen-artifact-agent-"));
  try {
    writeChannelFixture(artifactRoot, {
      modules,
      nodes: [
        { id: "in1", node_kind: "input" },
        { id: "a", node_kind: "agent", module_id: "mod-a" },
        { id: "c", node_kind: "adapter", module_id: "mod-c" },
        { id: "out1", node_kind: "output" }
      ],
      edges: [
        { from: "in1", to: "a" },
        { from: "a", to: "c", edge_kind: "artifact", artifact_key: "blob.json" },
        { from: "c", to: "out1" }
      ]
    });
    assert.throws(
      () => execFileSync(process.execPath, [generator, artifactRoot, join(artifactRoot, "out")], { stdio: "pipe" }),
      /artifact channel produced by an agent node/
    );
  } finally {
    rmSync(artifactRoot, { recursive: true, force: true });
  }
});

test("runnable rejects a state channel written by multiple producers (same state_key)", () => {
  const { unconnectedAdapter, connectedAdapter } = channelModules();
  const modules = [
    { ...unconnectedAdapter, id: "mod-b", name: "B_Adapter" },
    { ...unconnectedAdapter, id: "mod-c", name: "C_Adapter" },
    { ...connectedAdapter, id: "mod-d", name: "D_Adapter" }
  ];
  const artifactRoot = mkdtempSync(join(tmpdir(), "af-gen-state-collide-"));
  try {
    writeChannelFixture(artifactRoot, {
      modules,
      nodes: [
        { id: "in1", node_kind: "input" },
        { id: "b", node_kind: "adapter", module_id: "mod-b" },
        { id: "c", node_kind: "adapter", module_id: "mod-c" },
        { id: "d", node_kind: "adapter", module_id: "mod-d" },
        { id: "out1", node_kind: "output" }
      ],
      edges: [
        { from: "in1", to: "b" },
        { from: "in1", to: "c" },
        { from: "b", to: "d", edge_kind: "session_state", state_key: "shared" },
        { from: "c", to: "d", edge_kind: "session_state", state_key: "shared" },
        { from: "d", to: "out1" }
      ]
    });
    assert.throws(
      () => execFileSync(process.execPath, [generator, artifactRoot, join(artifactRoot, "out")], { stdio: "pipe" }),
      /state channel written by multiple producers/
    );
  } finally {
    rmSync(artifactRoot, { recursive: true, force: true });
  }
});

// ---------------------------------------------------------------------------
// remote_a2a (A2A) lowering.
// ---------------------------------------------------------------------------
