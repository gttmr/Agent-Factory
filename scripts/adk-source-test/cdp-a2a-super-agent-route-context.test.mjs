import assert from "node:assert/strict";
import test from "node:test";
import { evaluateGeneratedRoute, generatedRouteBlock, generateSuperAgentRouteBundle } from "./cdp-a2a-fixtures.mjs";

function routeEdge(edges, from, to) {
  const edge = edges.find((candidate) => candidate.from === from && candidate.to === to);
  assert.ok(edge, `expected route edge ${from} -> ${to}`);
  return edge;
}

test("Given reviewed Super Agent route contract When runtime is generated Then route context and decision rules stay structured", () => {
  const { agentSource, modules, edges } = generateSuperAgentRouteBundle();
  const superAgent = modules.find((module) => module.id === "mod-super-agent");
  assert.ok(superAgent, "fixture should include the reviewed Super Agent module");

  assert.equal(superAgent.agent_execution_mode, "chat");
  assert.deepEqual(superAgent.inputs.map((input) => input.name), ["user_message", "agent_registry_snapshot", "conversation_state"]);
  assert.deepEqual(superAgent.outputs.map((output) => output.name), ["route_decision", "super_agent_message"]);

  const superAgentRoute = routeEdge(edges, "owner-route", "super-agent");
  assert.deepEqual(superAgentRoute, {
    from: "owner-route",
    to: "super-agent",
    edge_kind: "route",
    execution_semantics: "conditional",
    route_condition: "super_agent_turn",
    route_aliases: ["no_active_task"],
    state_key: "active_a2a_task",
    is_default_route: true
  });

  const remoteRoute = routeEdge(edges, "decision-route", "remote-sink");
  assert.equal(remoteRoute.route_condition, "route_decision == remote_a2a");
  assert.deepEqual(remoteRoute.route_aliases, [
    "delegate_remote",
    "remote_a2a_agent",
    "delegate_a2a",
    "delegate_to_a2a",
    "delegate_to_a2a_agent",
    "delegate_to_remote_a2a"
  ]);

  const localRoute = routeEdge(edges, "decision-route", "local-sink");
  assert.equal(localRoute.route_condition, "route_decision == super_agent_response");
  assert.equal(localRoute.is_default_route, true);

  const ownerRoute = generatedRouteBlock(agentSource, "_route_owner_route", "def _route_decision_text(node_input):");
  const result = evaluateGeneratedRoute(ownerRoute, { user_message: "fallback" }, {
    state: {
      user_message: "reviewed turn",
      agent_registry_snapshot: { providers: [{ module_id: "mod-reviewed-remote-agent" }] },
      conversation_state: { turn: 7 },
      unrelated_state: "ignored"
    }
  });

  assert.equal(result.route, "super_agent_turn");
  assert.deepEqual(result.output, {
    user_message: "fallback",
    agent_registry_snapshot: { providers: [{ module_id: "mod-reviewed-remote-agent" }] },
    conversation_state: { turn: 7 },
    previous: { user_message: "fallback" }
  });
});
