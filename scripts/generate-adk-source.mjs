#!/usr/bin/env node

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

const artifactRoot = resolve(process.argv[2] ?? "templates");
const outputRoot = resolve(process.argv[3] ?? "generated/adk-source");

const normalizedRequirement = readJson("normalized-requirement.json");
const processFlow = readJson("process-flow.json");
const scaffoldPlan = readJson("scaffold-plan.json", "scaffold-plan.template.json");

if (scaffoldPlan?.source !== "approved_workbench_artifact" || scaffoldPlan?.raw_requirement_to_code !== false) {
  throw new Error("scaffold-plan.json must be an approved_workbench_artifact with raw_requirement_to_code=false.");
}
if (!Array.isArray(scaffoldPlan.modules) || scaffoldPlan.modules.length === 0) {
  throw new Error("scaffold-plan.json must contain at least one approved module.");
}
if (scaffoldPlan.validation?.can_generate_source === false) {
  throw new Error(`scaffold-plan.json has blockers: ${(scaffoldPlan.validation.blockers ?? []).join("; ")}`);
}

const packageName = `${toPythonIdentifier(normalizedRequirement.id || scaffoldPlan.requirement_id || "agent_factory_workflow")}_adk`;
const files = buildFiles();

Object.entries(files).forEach(([relativePath, content]) => {
  const target = join(outputRoot, relativePath);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, content, "utf8");
});

console.log(`ADK source generated from scaffold-plan.json: ${join(outputRoot, packageName)}`);
console.log(`Run from ${outputRoot}:`);
console.log("  python3 -m venv .venv");
console.log("  source .venv/bin/activate");
console.log("  pip install -r requirements.txt");
console.log(`  python -m compileall ${packageName} tests`);
console.log("  python -m pytest -q");

function readJson(name, fallbackName) {
  const path = join(artifactRoot, name);
  const selectedPath = existsSync(path) ? path : fallbackName ? join(artifactRoot, fallbackName) : path;
  if (!existsSync(selectedPath)) {
    throw new Error(`Missing required artifact: ${path}`);
  }
  return JSON.parse(readFileSync(selectedPath, "utf8"));
}

function buildFiles() {
  return {
    [`${packageName}/__init__.py`]: "from .agent import root_agent\n",
    [`${packageName}/agent.py`]: buildAgentPy(),
    [`${packageName}/workflow_manifest.json`]: `${JSON.stringify(buildManifest(), null, 2)}\n`,
    "requirements.txt": buildRequirements(),
    "tests/test_workflow_contract.py": buildContractTest(),
    "README.md": buildReadme()
  };
}

function buildAgentPy() {
  const modules = scaffoldPlan.modules;
  const functions = modules.map(buildNodeFunction).join("\n\n");
  const edgeRows = modules
    .map((module, index) => {
      const from = index === 0 ? '"START"' : nodeFunctionName(modules[index - 1]);
      return `        (${from}, ${nodeFunctionName(module)}),`;
    })
    .join("\n");

  return `from __future__ import annotations

from typing import Any

from google.adk import Event, Workflow


COMPONENT_CONTRACTS = ${toPythonLiteral(componentContracts())}


def _event_output(module_id: str, module_name: str, node_input: Any = None):
    return {
        "module_id": module_id,
        "module_name": module_name,
        "input": node_input,
        "status": "stubbed_runtime_contract",
    }


${functions}


def emit_workflow_result(node_input: Any = None):
    return Event(output={
        "node_id": "workflow_result",
        "terminal_outputs": ${toPythonLiteral(processFlow.outputs ?? [])},
        "input": node_input,
        "status": "stubbed_runtime_contract",
    })


root_agent = Workflow(
    name="${packageName}",
    edges=[
${edgeRows}
        (${nodeFunctionName(modules[modules.length - 1])}, emit_workflow_result),
    ],
)
`;
}

function buildNodeFunction(module) {
  return `def ${todoFunctionName(module)}(node_input: Any = None):
    """TODO_IMPLEMENT_HERE: implement this approved module after filling the reviewed handoff."""
    raise NotImplementedError("${escapePythonString(module.name)} requires developer implementation")


def ${nodeFunctionName(module)}(node_input: Any = None):
    contract = COMPONENT_CONTRACTS["${module.id}"]
    output = _event_output("${module.id}", "${escapePythonString(module.name)}", node_input)
    output["status"] = "todo_implementation_required"
    output["developer_todos"] = contract["developer_todos"]
    output["todo_function"] = "${todoFunctionName(module)}"
    return Event(output=output)`;
}

function buildManifest() {
  return {
    package: packageName,
    requirement: {
      id: normalizedRequirement.id,
      title: normalizedRequirement.title,
      status: normalizedRequirement.status
    },
    guardrails: {
      raw_requirement_to_code: false,
      generated_business_logic: false,
      private_data_or_endpoints: false
    },
    catalog_bound_modules: scaffoldPlan.manifest?.catalog_bound_modules ?? [],
    new_code_required: scaffoldPlan.manifest?.new_code_required ?? [],
    excluded_modules: scaffoldPlan.excluded_modules ?? [],
    modules: scaffoldPlan.modules
  };
}

function buildRequirements() {
  return `${["--pre", "google-adk", "pytest"].join("\n")}\n`;
}

function buildContractTest() {
  return `from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


def test_agent_source_declares_adk_workflow():
    source = (ROOT / "${packageName}" / "agent.py").read_text(encoding="utf-8")
    assert "from google.adk import Event, Workflow" in source
    assert "root_agent = Workflow(" in source
    assert "TODO_IMPLEMENT_HERE" in source


def test_manifest_uses_scaffold_plan_contract():
    manifest = (ROOT / "${packageName}" / "workflow_manifest.json").read_text(encoding="utf-8")
    assert '"raw_requirement_to_code": false' in manifest
    assert '"catalog_bound_modules"' in manifest
    assert '"new_code_required"' in manifest
`;
}

function buildReadme() {
  return `# ${packageName}

Generated from approved scaffold-plan.json for ${normalizedRequirement.title}.

\`\`\`bash
pip install -r requirements.txt
python -m compileall ${packageName} tests
python -m pytest -q
\`\`\`
`;
}

function componentContracts() {
  return Object.fromEntries(
    scaffoldPlan.modules.map((module) => [
      module.id,
      {
        catalog_binding: module.catalog_binding ?? null,
        developer_todos: module.developer_todos,
        inputs: module.inputs,
        outputs: module.outputs,
        risk_signals: module.risk_signals
      }
    ])
  );
}

function nodeFunctionName(module) {
  return `node_${toPythonIdentifier(module.id)}`;
}

function todoFunctionName(module) {
  return `TODO_IMPLEMENT_HERE_${toPythonIdentifier(module.id)}`;
}

function toPythonIdentifier(value) {
  const identifier = String(value).toLowerCase().replace(/[^a-z0-9_]+/g, "_").replace(/^_+|_+$/g, "");
  return /^[a-z_]/.test(identifier) ? identifier || "workflow" : `node_${identifier}`;
}

function toPythonLiteral(value) {
  return JSON.stringify(value, null, 4)
    .replace(/\btrue\b/g, "True")
    .replace(/\bfalse\b/g, "False")
    .replace(/\bnull\b/g, "None");
}

function escapePythonString(value) {
  return String(value).replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}
