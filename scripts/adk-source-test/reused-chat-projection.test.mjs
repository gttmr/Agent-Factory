import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { baseModules, generator, writeChannelFixture } from "./fixtures.mjs";

test("runnable mode applies chat projection guidance to the actual reused agent node after an adapter", () => {
  const [agent, adapter] = baseModules(true, { agentExecutionMode: "chat" });
  const artifactRoot = mkdtempSync(join(tmpdir(), "af-gen-reused-chat-projection-"));
  try {
    writeChannelFixture(artifactRoot, {
      modules: [agent, adapter],
      nodes: [
        { id: "in1", node_kind: "input" },
        { id: "chat-from-start", node_kind: "agent", module_id: agent.id, agent_execution_mode: "chat" },
        { id: "adapter-before-chat", node_kind: "adapter_call", module_id: adapter.id },
        { id: "chat-after-adapter", node_kind: "agent", module_id: agent.id, agent_execution_mode: "chat" },
        { id: "out1", node_kind: "output" }
      ],
      edges: [
        { from: "in1", to: "chat-from-start" },
        { from: "in1", to: "adapter-before-chat" },
        { from: "adapter-before-chat", to: "chat-after-adapter", edge_kind: "session_state", state_key: "conversation_state" },
        { from: "chat-from-start", to: "out1" },
        { from: "chat-after-adapter", to: "out1" }
      ]
    });

    const outputRoot = join(artifactRoot, "out");
    execFileSync(process.execPath, [generator, artifactRoot, outputRoot], { stdio: "pipe" });
    const source = readFileSync(join(outputRoot, "req_ch_adk", "agent.py"), "utf8");
    const config = readFileSync(join(outputRoot, "agents.config.yaml"), "utf8");
    const directStartBlock = source.match(/agent_mod_gen_agent__chat_from_start = LlmAgent\([\s\S]*?\n\)/)?.[0] ?? "";
    const afterAdapterBlock = source.match(/agent_mod_gen_agent__chat_after_adapter = LlmAgent\([\s\S]*?\n\)/)?.[0] ?? "";
    const directStartConfig = configBlock(config, "chat-from-start");
    const afterAdapterConfig = configBlock(config, "chat-after-adapter");

    assert.match(directStartBlock, /mode="chat"/);
    assert.doesNotMatch(directStartBlock, /ADK workflow projection/);
    assert.match(afterAdapterBlock, /mode="single_turn"/);
    assert.match(afterAdapterBlock, /ADK workflow projection/);
    assert.match(afterAdapterBlock, /conversation context from reviewed session state\/history inputs/);
    assert.match(afterAdapterBlock, /conversation_state/);
    assert.match(directStartConfig, /module_id: mod-gen-agent/);
    assert.doesNotMatch(directStartConfig, /ADK workflow projection/);
    assert.match(afterAdapterConfig, /module_id: mod-gen-agent/);
    assert.match(afterAdapterConfig, /ADK workflow projection/);
    assert.match(afterAdapterConfig, /conversation_state/);
  } finally {
    rmSync(artifactRoot, { recursive: true, force: true });
  }
});

function configBlock(config, id) {
  return config.match(new RegExp(`\\n  - id: ${id}\\n[\\s\\S]*?(?=\\n  - id: |\\nadapters:)`))?.[0] ?? "";
}
