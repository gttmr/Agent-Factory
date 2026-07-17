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

export function executeGeneratedPythonSymbols({ sourcePath, names, prelude = "", body }) {
  const request = JSON.stringify({ sourcePath, names, prelude, body });
  const runner = `
import ast
import json
import sys

request = json.loads(sys.stdin.read())
with open(request["sourcePath"], encoding="utf-8") as source_file:
    source = source_file.read()
module = ast.parse(source, filename=request["sourcePath"])
wanted = set(request["names"])
selected = []
for node in module.body:
    if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef, ast.ClassDef)) and node.name in wanted:
        selected.append(node)
        continue
    if isinstance(node, (ast.Assign, ast.AnnAssign)):
        targets = node.targets if isinstance(node, ast.Assign) else [node.target]
        if any(isinstance(target, ast.Name) and target.id in wanted for target in targets):
            selected.append(node)
namespace = {}
exec(request["prelude"], namespace)
exec(compile(ast.Module(body=selected, type_ignores=[]), "<generated-symbols>", "exec"), namespace)
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
