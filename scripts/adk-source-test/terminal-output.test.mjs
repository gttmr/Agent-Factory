import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { generate } from "./fixtures.mjs";
import { emitTerminalOutputFunc } from "../adk-source/emitters/terminal-output.mjs";
import { compileGeneratedPython } from "./generated-python-runtime.mjs";

test("runnable terminal output node emits chat-visible completion and JSON-safe structured output", () => {
  const { outputRoot, artifactRoot } = generate({ runnable: true });
  try {
    const source = readFileSync(join(outputRoot, "req_gen_test_adk", "agent.py"), "utf8");
    const readme = readFileSync(join(outputRoot, "README.md"), "utf8");
    assert.match(source, /from google\.genai import types/);
    assert.match(source, /from google\.adk\.events import Event, RequestInput/);
    assert.match(source, /def _terminal_out1\(ctx: Context, node_input=None\):/);
    assert.match(source, /yield Event\(\s*author="agent_factory_terminal",\s*content=types\.Content\(/s);
    assert.match(source, /_node_id = "out1"/);
    assert.match(source, /Terminal output node \{_node_id\} completed\. Final state keys:/);
    assert.match(
      source,
      /yield \{\s*"node_kind": "output",\s*"terminal_output_node_id": "out1",\s*"status": "completed",\s*"final_state_keys": _state_keys,\s*\}/s
    );
    assert.match(source, /node_out1 = FunctionNode\(func=_terminal_out1, name="out1"\)/);
    assert.match(source, /\(node_mod_gen_adapter,\s*node_out1\)/);
    assert.doesNotMatch(source, /content=types\.Content[\s\S]*return/s, "terminal content must not be returned as node output");
    assert.match(readme, /Terminal output node out1 completed\. Final state keys:/);
  } finally {
    rmSync(artifactRoot, { recursive: true, force: true });
  }
});

test("terminal output emitter binds the node id as a python literal, not raw f-string text", () => {
  const hostileId = 'out"1{evil}\\';
  const emitted = emitTerminalOutputFunc({ id: hostileId });
  assert.match(emitted, /_node_id = /);
  assert.ok(!emitted.includes(`node ${hostileId} completed`), "raw node id must not be interpolated into the f-string literal");
  const scratch = mkdtempSync(join(tmpdir(), "af-terminal-escape-"));
  try {
    const file = join(scratch, "terminal_escape_case.py");
    writeFileSync(file, `${emitted}\n`, "utf8");
    compileGeneratedPython(file);
  } finally {
    rmSync(scratch, { recursive: true, force: true });
  }
});
