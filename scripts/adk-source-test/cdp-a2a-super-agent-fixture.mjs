import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { baseModules, discoverGeneratedPackage, generateBundle, writeChannelFixture } from "./fixtures.mjs";

function channelModulesForSuperAgent() {
  const [agentBase, unconnectedAdapter] = baseModules(true, { agentExecutionMode: "chat" });
  return { agentBase, unconnectedAdapter };
}

function superAgentModule(agentBase) {
  return {
    ...agentBase,
    id: "mod-super-agent",
    name: "Super Agent",
    agent_execution_mode: "chat",
    inputs: [
      { name: "user_message", type: "text", required: true },
      { name: "agent_registry_snapshot", type: "object", required: true },
      { name: "conversation_state", type: "object", required: false }
    ],
    outputs: [
      { name: "route_decision", type: "object", required: true },
      { name: "super_agent_message", type: "text", required: false }
    ]
  };
}

function adapterModule(adapter, id, name) {
  return { ...adapter, id, name };
}

function superAgentRouteNodes(superAgent, registry, activeTask, remoteSink, localSink) {
  return [
    { id: "turn-input", node_kind: "input" },
    { id: "registry", node_kind: "adapter_call", module_id: registry.id },
    { id: "owner-route", node_kind: "router", input_ports: ["chat_turn", "active_a2a_task"] },
    { id: "active-task", node_kind: "adapter_call", module_id: activeTask.id },
    { id: "super-agent", node_kind: "agent", module_id: superAgent.id, agent_execution_mode: "chat" },
    { id: "decision-route", node_kind: "router", input_ports: ["route_decision"] },
    { id: "remote-sink", node_kind: "adapter_call", module_id: remoteSink.id },
    { id: "local-sink", node_kind: "adapter_call", module_id: localSink.id },
    { id: "active-out", node_kind: "output" },
    { id: "remote-out", node_kind: "output" },
    { id: "local-out", node_kind: "output" }
  ];
}

function superAgentRouteEdges() {
  return [
    { from: "turn-input", to: "registry", edge_kind: "event_output", execution_semantics: "normal_transition" },
    { from: "registry", to: "owner-route", edge_kind: "session_state", execution_semantics: "normal_transition", state_key: "agent_registry_snapshot" },
    { from: "owner-route", to: "active-task", edge_kind: "route", execution_semantics: "conditional", route_condition: "session_state.active_a2a_task is active", route_aliases: ["submitted", "working", "input-required", "auth-required"], state_key: "active_a2a_task", is_default_route: false },
    { from: "owner-route", to: "super-agent", edge_kind: "route", execution_semantics: "conditional", route_condition: "super_agent_turn", route_aliases: ["no_active_task"], state_key: "active_a2a_task", is_default_route: true },
    { from: "active-task", to: "active-out", edge_kind: "event_output", execution_semantics: "normal_transition" },
    { from: "super-agent", to: "decision-route", edge_kind: "event_output", execution_semantics: "normal_transition", schema_ref: "route_decision.v1" },
    { from: "decision-route", to: "remote-sink", edge_kind: "route", execution_semantics: "conditional", route_condition: "route_decision == remote_a2a", route_aliases: ["delegate_remote", "remote_a2a_agent", "delegate_a2a", "delegate_to_a2a", "delegate_to_a2a_agent", "delegate_to_remote_a2a"] },
    { from: "decision-route", to: "local-sink", edge_kind: "route", execution_semantics: "conditional", route_condition: "route_decision == super_agent_response", is_default_route: true },
    { from: "remote-sink", to: "remote-out", edge_kind: "event_output", execution_semantics: "normal_transition" },
    { from: "local-sink", to: "local-out", edge_kind: "event_output", execution_semantics: "normal_transition" }
  ];
}

export function superAgentRouteFixtureContract() {
  const { agentBase, unconnectedAdapter } = channelModulesForSuperAgent();
  const superAgent = superAgentModule(agentBase);
  const registry = adapterModule(unconnectedAdapter, "mod-registry", "Registry Discovery Adapter");
  const activeTask = adapterModule(unconnectedAdapter, "mod-active-task", "Active A2A Task Adapter");
  const remoteSink = adapterModule(unconnectedAdapter, "mod-remote-sink", "Remote Delegation Adapter");
  const localSink = adapterModule(unconnectedAdapter, "mod-local-sink", "Local Response Adapter");
  return {
    modules: [superAgent, registry, activeTask, remoteSink, localSink],
    nodes: superAgentRouteNodes(superAgent, registry, activeTask, remoteSink, localSink),
    edges: superAgentRouteEdges()
  };
}

export function generateSuperAgentRouteBundle() {
  const artifactRoot = mkdtempSync(join(tmpdir(), "af-gen-super-agent-route-"));
  try {
    const fixture = superAgentRouteFixtureContract();
    writeChannelFixture(artifactRoot, fixture);
    const outputRoot = join(artifactRoot, "out");
    generateBundle(artifactRoot, outputRoot);
    const packageName = discoverGeneratedPackage(outputRoot);
    return {
      ...fixture,
      agentSource: readFileSync(join(outputRoot, packageName, "agent.py"), "utf8"),
      agentsConfig: readFileSync(join(outputRoot, "agents.config.yaml"), "utf8")
    };
  } finally {
    rmSync(artifactRoot, { recursive: true, force: true });
  }
}
