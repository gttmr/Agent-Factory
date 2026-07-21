import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { collectFiles, repoRoot } from "./fixtures.mjs";

export function generatedPythonExecutable() {
  return process.env.AF_TEST_PYTHON ?? join(repoRoot, ".agent-factory", "runtime", ".venv", "bin", "python");
}

export function compileGeneratedPython(sourcePath) {
  execFileSync(generatedPythonExecutable(), ["-m", "py_compile", sourcePath], { stdio: "pipe" });
}

export function executeGeneratedWorkflowRuntime({ outputRoot, packageName, message = "hello" }) {
  const script = `
import asyncio
import importlib
import json
from importlib.metadata import version

from google.adk.apps import App
from google.adk.runners import InMemoryRunner
from google.genai import types


def json_safe(value):
    try:
        json.dumps(value)
        return value
    except TypeError:
        return repr(value)


async def main():
    module = importlib.import_module(${JSON.stringify(`${packageName}.agent`)})
    app = App(name="generated_runtime_test", root_agent=module.root_agent)
    runner = InMemoryRunner(app=app)
    session = await runner.session_service.create_session(
        app_name=app.name,
        user_id="test-user",
    )
    events = []
    async for event in runner.run_async(
        user_id="test-user",
        session_id=session.id,
        new_message=types.Content(
            role="user",
            parts=[types.Part.from_text(text=${JSON.stringify(message)})],
        ),
    ):
        content = getattr(event, "content", None)
        texts = [part.text for part in getattr(content, "parts", []) if getattr(part, "text", None)]
        events.append({
            "author": getattr(event, "author", None),
            "output": json_safe(getattr(event, "output", None)),
            "texts": texts,
        })
    refreshed = await runner.session_service.get_session(
        app_name=app.name,
        user_id="test-user",
        session_id=session.id,
    )
    return {
        "google_adk_version": version("google-adk"),
        "events": events,
        "state": json_safe(dict(refreshed.state)),
    }


print(json.dumps(asyncio.run(main()), ensure_ascii=False))
`;
  const stdout = execFileSync(generatedPythonExecutable(), ["-c", script], {
    cwd: outputRoot,
    encoding: "utf8",
    env: { ...process.env, AF_LLM_PROVIDER: "gemini" },
    stdio: ["ignore", "pipe", "pipe"]
  });
  return JSON.parse(stdout);
}

export function executeGeneratedAsyncResumeRuntime({
  outputRoot,
  packageName,
  interruptId,
  contractId,
  changeId
}) {
  const script = `
import asyncio
import importlib
import json
from importlib.metadata import version

from google.adk.apps import App
from google.adk.runners import InMemoryRunner, Runner
from google.genai import types


def json_safe(value):
    try:
        json.dumps(value)
        return value
    except TypeError:
        return repr(value)


async def collect(runner, **kwargs):
    rows = []
    error = None
    try:
        async for event in runner.run_async(**kwargs):
            rows.append({
                "invocation_id": event.invocation_id,
                "output": json_safe(event.output),
                "error_message": event.error_message,
                "function_calls": [
                    {"id": call.id, "name": call.name, "args": json_safe(call.args)}
                    for call in event.get_function_calls()
                ],
            })
    except Exception as exc:
        error = {"type": type(exc).__name__, "message": str(exc)}
    return {"events": rows, "error": error}


async def main():
    module = importlib.import_module(${JSON.stringify(`${packageName}.agent`)})
    app = App(name="generated_async_resume_test", root_agent=module.root_agent)
    base = InMemoryRunner(app=app)

    def restarted_runner():
        return Runner(
            app=app,
            session_service=base.session_service,
            artifact_service=base.artifact_service,
            memory_service=base.memory_service,
            credential_service=base.credential_service,
        )

    async def create_session():
        return await base.session_service.create_session(app_name=app.name, user_id="test-user")

    async def read_state(session_id):
        session = await base.session_service.get_session(
            app_name=app.name, user_id="test-user", session_id=session_id
        )
        return dict(session.state)

    async def start(session_id):
        result = await collect(
            restarted_runner(),
            user_id="test-user",
            session_id=session_id,
            new_message=types.Content(
                role="user",
                parts=[types.Part.from_text(text=json.dumps({"change_id": ${JSON.stringify(changeId)}}))],
            ),
        )
        calls = [call for row in result["events"] for call in row["function_calls"]]
        invocation_ids = [row["invocation_id"] for row in result["events"] if row["invocation_id"]]
        result["call"] = calls[-1] if calls else None
        result["invocation_id"] = invocation_ids[-1] if invocation_ids else None
        result["state"] = await read_state(session_id)
        return result

    async def respond(session_id, invocation_id, call, value, *, state_delta=None, response_id=None):
        result = await collect(
            restarted_runner(),
            user_id="test-user",
            session_id=session_id,
            invocation_id=invocation_id,
            state_delta=state_delta,
            new_message=types.Content(
                role="user",
                parts=[types.Part(function_response=types.FunctionResponse(
                    id=response_id or call["id"],
                    name=call["name"],
                    response={"result": value},
                ))],
            ),
        )
        result["state"] = await read_state(session_id)
        return result

    approve_session = await create_session()
    approve_start = await start(approve_session.id)
    approve_resume = await respond(
        approve_session.id, approve_start["invocation_id"], approve_start["call"], "approve"
    )
    approve_duplicate = await respond(
        approve_session.id, approve_start["invocation_id"], approve_start["call"], "approve"
    )
    second_start = await start(approve_session.id)
    second_resume = await respond(
        approve_session.id, second_start["invocation_id"], second_start["call"], "approve"
    )

    conflict_session = await create_session()
    conflict_start = await start(conflict_session.id)
    await respond(conflict_session.id, conflict_start["invocation_id"], conflict_start["call"], "approve")
    conflict_resume = await respond(
        conflict_session.id, conflict_start["invocation_id"], conflict_start["call"], "reject"
    )

    reject_session = await create_session()
    reject_start = await start(reject_session.id)
    reject_resume = await respond(
        reject_session.id, reject_start["invocation_id"], reject_start["call"], "reject"
    )

    expiry_session = await create_session()
    expiry_start = await start(expiry_session.id)
    expiry_state_key = f"af_resume_record:${contractId}:{expiry_start['invocation_id']}"
    expired_record = dict(expiry_start["state"][expiry_state_key])
    expired_record["expires_at"] = 0
    expiry_resume = await respond(
        expiry_session.id,
        expiry_start["invocation_id"],
        expiry_start["call"],
        "approve",
        state_delta={expiry_state_key: expired_record},
    )

    wrong_session = await create_session()
    wrong_start = await start(wrong_session.id)
    wrong_resume = await respond(
        wrong_session.id,
        wrong_start["invocation_id"],
        wrong_start["call"],
        "approve",
        response_id="wrong-interrupt-id",
    )

    return {
        "google_adk_version": version("google-adk"),
        "expected_interrupt_id": ${JSON.stringify(interruptId)},
        "ledger_key": ${JSON.stringify(`af_resume_ledger:${contractId}`)},
        "approve_start": approve_start,
        "approve_resume": approve_resume,
        "approve_duplicate": approve_duplicate,
        "second_start": second_start,
        "second_resume": second_resume,
        "conflict_resume": conflict_resume,
        "reject_resume": reject_resume,
        "expiry_resume": expiry_resume,
        "wrong_resume": wrong_resume,
    }


print(json.dumps(asyncio.run(main()), ensure_ascii=False))
`;
  const stdout = execFileSync(generatedPythonExecutable(), ["-c", script], {
    cwd: outputRoot,
    encoding: "utf8",
    env: { ...process.env, AF_LLM_PROVIDER: "gemini" },
    stdio: ["ignore", "pipe", "pipe"]
  });
  return JSON.parse(stdout);
}

export function executeGeneratedFunction({ outputRoot, packageName, functionName, nodeInput, state = {} }) {
  const script = `
import importlib
import json


class FakeContext:
    def __init__(self):
        self.state = json.loads(${JSON.stringify(JSON.stringify(state))})


module = importlib.import_module(${JSON.stringify(`${packageName}.agent`)})
returned = getattr(module, ${JSON.stringify(functionName)})(
    FakeContext(),
    json.loads(${JSON.stringify(JSON.stringify(nodeInput))}),
)
print(json.dumps({
    "route": getattr(returned, "route", None) or getattr(getattr(returned, "actions", None), "route", None),
    "output": getattr(returned, "output", None),
}, ensure_ascii=False))
`;
  const stdout = execFileSync(generatedPythonExecutable(), ["-c", script], {
    cwd: outputRoot,
    encoding: "utf8",
    env: { ...process.env, AF_LLM_PROVIDER: "gemini" },
    stdio: ["ignore", "pipe", "pipe"]
  });
  return JSON.parse(stdout);
}

export function executeGeneratedPythonSymbols({ sourcePath, names, prelude = "", body }) {
  const request = JSON.stringify({ sourcePath, names, prelude, body });
  const runner = `
import ast
import json
import sys

request = json.loads(sys.stdin.read())
with open(request["sourcePath"], encoding="utf-8") as source_file:
    source = source_file.read()
syntax_tree = ast.parse(source, filename=request["sourcePath"])
wanted = set(request["names"])
selected = []
for node in syntax_tree.body:
    if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef, ast.ClassDef)) and node.name in wanted:
        selected.append(node)
        continue
    if isinstance(node, (ast.Assign, ast.AnnAssign)):
        targets = node.targets if isinstance(node, ast.Assign) else [node.target]
        if any(isinstance(target, ast.Name) and target.id in wanted for target in targets):
            selected.append(node)
namespace = {}
exec(request["prelude"], namespace)
exec(compile(type(syntax_tree)(body=selected, type_ignores=[]), "<generated-symbols>", "exec"), namespace)
namespace["__selected_nodes"] = selected
namespace["namespace"] = namespace
exec(request["body"], namespace)
print(json.dumps(namespace["result"], ensure_ascii=False))
`;
  const stdout = execFileSync(generatedPythonExecutable(), ["-c", runner], {
    encoding: "utf8",
    input: request,
    stdio: ["pipe", "pipe", "pipe"]
  });
  return JSON.parse(stdout);
}

export function executeGeneratedDynamicTrace({ sourcePath, initialInput, nodeOutputs, passthroughSymbols = [] }) {
  return executeGeneratedPythonSymbols({
    sourcePath,
    names: [
      "_MAX_DYNAMIC_LOOP_ITERATIONS",
      "_dynamic_decision_text",
      "_dynamic_matches",
      "_dynamic_should_continue",
      "dynamic_workflow"
    ],
    prelude: [
      "import asyncio",
      "import ast",
      "import json",
      "from typing import Any",
      "Context = object",
      "def node(*args, **kwargs):",
      "    return lambda target: target"
    ].join("\n"),
    body: `
class FakeContext:
    def __init__(self):
        self.state = {}
        self.trace = []
        self.outputs = json.loads(${JSON.stringify(JSON.stringify(nodeOutputs))})
        self.passthrough_symbols = set(json.loads(${JSON.stringify(JSON.stringify(passthroughSymbols))}))

    async def run_node(self, symbol, node_input=None, *, run_id=None):
        self.trace.append({"symbol": symbol, "input": node_input, "run_id": run_id})
        if symbol in self.passthrough_symbols:
            return node_input
        configured = self.outputs.get(symbol, [])
        if isinstance(configured, list):
            index = sum(1 for row in self.trace if row["symbol"] == symbol) - 1
            return configured[min(index, len(configured) - 1)]
        return configured

symbols = {
    child.args[0].id
    for child in ast.walk(next(item for item in __selected_nodes if getattr(item, "name", None) == "dynamic_workflow"))
    if isinstance(child, ast.Call)
    and isinstance(child.func, ast.Attribute)
    and child.func.attr == "run_node"
    and child.args
    and isinstance(child.args[0], ast.Name)
}
for symbol in symbols:
    namespace[symbol] = symbol
context = FakeContext()
returned = asyncio.run(namespace["dynamic_workflow"](context, json.loads(${JSON.stringify(JSON.stringify(initialInput))})))
result = {"trace": context.trace, "state": context.state, "returned": returned}
`
  });
}

export function bundleSha256Manifest(root) {
  return collectFiles(root).map((path) => ({
    path: relative(root, path).split(sep).join("/"),
    sha256: createHash("sha256").update(readFileSync(path)).digest("hex")
  }));
}

// README files embed the environment-dependent relative path back to the
// checkout's .agent-factory/runtime.env, so their bytes vary by checkout/tmp
// location and cannot be hash-pinned; README stability is covered by the
// behavioral README tests instead.
const SHA256_MANIFEST_ENV_DEPENDENT = new Set(["README.md", "req_gen_test_adk/README.md"]);

export function assertBundleSha256Manifest(root, expectedRows) {
  const actualRows = bundleSha256Manifest(root).filter((row) => !SHA256_MANIFEST_ENV_DEPENDENT.has(row.path));
  const expected = new Map(expectedRows.map((row) => [row.path, row.sha256]));
  const actual = new Map(actualRows.map((row) => [row.path, row.sha256]));
  const paths = [...new Set([...expected.keys(), ...actual.keys()])].sort();
  const differences = paths.filter((path) => expected.get(path) !== actual.get(path));
  if (differences.length > 0) {
    throw new Error(`generated bundle SHA-256 manifest changed at: ${differences.join(", ")}`);
  }
}
