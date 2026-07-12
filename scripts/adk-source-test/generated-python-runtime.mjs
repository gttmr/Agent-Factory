import { execFileSync } from "node:child_process";
import { join } from "node:path";
import { repoRoot } from "./fixtures.mjs";

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
