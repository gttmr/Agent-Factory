import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { join } from "node:path";
import { repoRoot } from "./fixtures.mjs";

export function generatedDecisionRouteBlock(source) {
  const routeMatches = [...source.matchAll(/\ndef (_route_[A-Za-z0-9_]+)\(ctx: Context, node_input=None\):/g)];
  const decisionRoute = routeMatches.find((match) => {
    const routeStart = match.index ?? -1;
    const nextRoute = source.indexOf("\ndef ", routeStart + 1);
    const block = source.slice(routeStart, nextRoute === -1 ? undefined : nextRoute);
    return block.includes('route="remote_a2a"') && block.includes('route="super_agent_response"');
  });
  assert.ok(decisionRoute, "generated source should contain remote/local decision route function");
  return generatedRouteBlock(source, decisionRoute[1], "def _route_decision_text(node_input):");
}

export function generatedRouteBlock(source, routeFuncName, helperMarker) {
  const routeStart = source.indexOf(`def ${routeFuncName}(ctx: Context, node_input=None):`);
  assert.notEqual(routeStart, -1, `generated source should contain ${routeFuncName}`);
  const helperStart = source.lastIndexOf(helperMarker, routeStart);
  assert.notEqual(helperStart, -1, `generated source should contain helper marker ${helperMarker}`);
  const routeTail = source.slice(routeStart);
  const routeEndMatch = /\n(?=def |node_|agent_|root_agent)/.exec(routeTail.slice(1));
  assert.ok(routeEndMatch, "generated route function should end before node declarations");
  return {
    source: source.slice(helperStart, routeStart + 1 + routeEndMatch.index),
    routeFuncName
  };
}

export function evaluateGeneratedRoute(routeBlock, payload, { userText = "", state = {} } = {}) {
  const python = process.env.AF_TEST_PYTHON ?? join(repoRoot, ".agent-factory", "runtime", ".venv", "bin", "python");
  const script = `
import json
from typing import Any

generated_source = json.loads(${JSON.stringify(JSON.stringify(routeBlock.source))})
route_func_name = json.loads(${JSON.stringify(JSON.stringify(routeBlock.routeFuncName))})
payload = json.loads(${JSON.stringify(JSON.stringify(payload))})
state = json.loads(${JSON.stringify(JSON.stringify(state))})
user_text = json.loads(${JSON.stringify(JSON.stringify(userText))})

class Event:
    def __init__(self, route=None, output=None):
        self.route = route
        self.output = output

class Context:
    pass

class State(dict):
    def to_dict(self):
        return dict(self)

def _payload_value(value, key):
    if isinstance(value, dict):
        return value.get(key)
    return None

def _json_payload(value):
    if not isinstance(value, str):
        return None
    try:
        return json.loads(value)
    except json.JSONDecodeError:
        return None

def _json_safe_node_value(value):
    return value

def _user_text_from_context(ctx):
    return user_text

USER_TEXT_INPUT_NAMES = {
    "query",
    "user_query",
    "user_request",
    "request",
    "message",
    "prompt",
    "objective",
    "objective_text",
    "goal",
    "goal_text",
    "input_text",
    "user_message",
}

def _payload_user_text(payload, depth=0):
    if payload is None or depth > 6:
        return ""
    if isinstance(payload, str):
        parsed = _json_payload(payload)
        return _payload_user_text(parsed, depth + 1) if parsed is not None else payload.strip()
    if isinstance(payload, dict):
        for key in ("user_message", "message", "request", "prompt"):
            value = payload.get(key)
            if isinstance(value, str) and value.strip():
                return value.strip()
    return ""

def _route_context_payload(ctx, node_input, input_names):
    output = {}
    for name in input_names:
        if name in ctx.state:
            output[name] = ctx.state[name]
    return output or node_input

ctx = Context()
ctx.state = State(state)
exec(generated_source, globals())
result = globals()[route_func_name](ctx, payload)
print(json.dumps({"route": result.route, "output": result.output}, ensure_ascii=False))
`;
  return JSON.parse(execFileSync(python, ["-c", script], { encoding: "utf8" }));
}
