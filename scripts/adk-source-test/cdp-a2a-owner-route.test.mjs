import assert from "node:assert/strict";
import test from "node:test";
import { evaluateGeneratedRoute, generatedRouteBlock, generateSuperAgentRouteBundle } from "./cdp-a2a-fixtures.mjs";

test("Given active Remote A2A task ownership When owner route runs Then active states bypass Super Agent", () => {
  const { agentSource } = generateSuperAgentRouteBundle();
  const ownerRoute = generatedRouteBlock(agentSource, "_route_owner_route", "def _route_decision_text(node_input):");
  const result = evaluateGeneratedRoute(ownerRoute, { user_message: "resume" }, {
    state: {
      active_a2a_task: {
        task_state: "TASK_STATE_INPUT_REQUIRED",
        task_id: "task-1"
      }
    }
  });

  assert.equal(result.route, "session_state_active_a2a_task_is_active");
  assert.deepEqual(result.output, { task_state: "TASK_STATE_INPUT_REQUIRED", task_id: "task-1" });
});

test("Given no active Remote A2A task When owner route runs Then Super Agent receives reviewed turn context", () => {
  const { agentSource } = generateSuperAgentRouteBundle();
  const ownerRoute = generatedRouteBlock(agentSource, "_route_owner_route", "def _route_decision_text(node_input):");
  const result = evaluateGeneratedRoute(ownerRoute, { user_message: "new turn" }, {
    state: {
      user_message: "new turn",
      agent_registry_snapshot: { providers: [{ connection_status: "configured" }] },
      conversation_state: { turn: 3 }
    }
  });

  assert.equal(result.route, "super_agent_turn");
  assert.deepEqual(result.output, {
    user_message: "new turn",
    agent_registry_snapshot: { providers: [{ connection_status: "configured" }] },
    conversation_state: { turn: 3 },
    previous: { user_message: "new turn" }
  });
});
