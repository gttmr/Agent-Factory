import { assertDataChannelsSupported, usesArtifactChannels } from "./channels.mjs";
import { hasAgentOwnedToolsets } from "./adapters.mjs";
import { collectGenerationNodes } from "./graph/collector.mjs";
import { assertNoSymbolCollisions } from "./graph/guards.mjs";
import {
  assertDynamicRunnableGraphSupported,
  dynamicRunIdComponent
} from "./graph/dynamic.mjs";
import { toPyStr, toPythonLiteral, truncate } from "./python-literals.mjs";
import { assertRemoteA2aSupported, usesRemoteA2a, usesRemoteA2aAuthInterceptor } from "./remote-a2a.mjs";
import { componentContracts } from "./agent-contracts.mjs";
import { emitRunnableNodeBlocks } from "./emitters/node-registry.mjs";
import { buildRuntimeHelperSection } from "./emitters/runtime-helpers.mjs";

const MAX_DYNAMIC_LOOP_ITERATIONS = 3;

export function buildDynamicRunnableAgentPy(context) {
  const { analysisResult, connectedAdapters, graphContext, modules, normalizedRequirement, packageName } = context;
  const collection = collectGenerationNodes(graphContext, { mode: "dynamic" });
  const dynamicPlan = assertDynamicRunnableGraphSupported(graphContext, { collection });
  assertDataChannelsSupported(graphContext);
  assertRemoteA2aSupported({ analysisResult, modules });

  const {
    collisionTargets,
    humanInputNodes,
    loopControlNodes,
    moduleSpecsInDeclarationOrder: orderedNodeSpecs,
    routerNodes,
    terminalOutputNodes
  } = collection;
  assertNoSymbolCollisions(collisionTargets);
  const { nodeBlocks, funcBlocks, loopControlBlocks } = emitRunnableNodeBlocks(context, {
    mode: "dynamic",
    orderedNodeSpecs,
    humanInputNodes,
    routerNodes,
    terminalOutputNodes,
    loopControlNodes
  });

  const description = `검토된 workbench artifact에서 생성한 ADK 2.3 dynamic workflow wiring입니다: ${truncate(
    normalizedRequirement.title || packageName
  )}.`;
  const usesArtifacts = usesArtifactChannels(graphContext);
  const usesTerminalOutputs = collection.featureFlags.has("terminal_outputs");
  const usesRemoteAuth = usesRemoteA2aAuthInterceptor({ analysisResult, modules });
  const jsonStdlibImport = usesArtifacts || connectedAdapters.length > 0 ? "import json\n" : "";
  const artifactGenaiImport = usesArtifacts || usesTerminalOutputs ? "from google.genai import types\n" : "";
  const remoteImport = usesRemoteA2a(modules)
    ? "from google.adk.agents.remote_a2a_agent import RemoteA2aAgent\n"
    : "";
  const remoteConfigImport = usesRemoteAuth
    ? "from google.adk.a2a.agent.config import A2aRemoteAgentConfig, RequestInterceptor\n"
    : "";
  const mcpToolsetImport = hasAgentOwnedToolsets(graphContext)
    ? "from google.adk.tools import McpToolset\nfrom google.adk.tools.mcp_tool import StreamableHTTPConnectionParams\n"
    : "";
  const eventImport = usesRemoteAuth || usesTerminalOutputs ? "Event, RequestInput" : "RequestInput";
  const dynamicWorkflow = emitDynamicWorkflow(dynamicPlan);

  return `from __future__ import annotations

import os
${jsonStdlibImport}from pathlib import Path
from typing import Any

import yaml

from google.adk import Context
from google.adk.agents import LlmAgent
${remoteConfigImport}
${remoteImport}${mcpToolsetImport}from google.adk.events import ${eventImport}
from google.adk.workflow import FunctionNode, START, Workflow, node
${artifactGenaiImport}

${buildRuntimeHelperSection({ componentContractLiteral: toPythonLiteral(componentContracts(context)), modules })}

${funcBlocks.join("\n\n")}${funcBlocks.length ? "\n\n\n" : ""}${dynamicHelpers()}

${nodeBlocks.join("\n\n")}
${loopControlBlocks.length ? `\n${loopControlBlocks.join("\n\n")}\n` : ""}
${dynamicWorkflow}

root_agent = Workflow(
    name=${toPyStr(packageName)},
    description=${toPyStr(description)},
    edges=[(START, dynamic_workflow)],
)
`;
}

function emitDynamicWorkflow(plan) {
  const seeds = plan.seeds.map((seed) => `    results[${toPyStr(seed.nodeId)}] = node_input`);
  return `@node(name="dynamic_workflow", rerun_on_resume=True)
async def dynamic_workflow(ctx: Context, node_input=None):
    results = {}
    barriers = {}
${seeds.join("\n")}
${renderSteps(plan.steps, "    ")}
    return results[${toPyStr(plan.resultNodeId)}]`;
}

function renderSteps(steps, indent) {
  return steps.map((step) => renderStep(step, indent)).join("\n");
}

function renderStep(step, indent) {
  if (step.kind === "run" || step.kind === "terminal") {
    return renderRunStep(step, indent, null);
  }
  if (step.kind === "join") return renderJoinStep(step, indent, null);
  const body = step.bodySteps.map((bodyStep) => {
    if (bodyStep.kind === "join") return renderJoinStep(bodyStep, `${indent}    `, "iterationResults");
    return renderRunStep(bodyStep, `${indent}    `, step);
  });
  const controlInput = renderInputExpression(step.controlInputRefs, "iterationResults");
  const controlRunId = loopRunId(step, step.controlNodeId);
  return [
    `${indent}_loop_iteration = 0`,
    `${indent}_loop_feedback = None`,
    `${indent}while True:`,
    `${indent}    iterationResults = {}`,
    `${indent}    iterationBarriers = {}`,
    ...body,
    `${indent}    iterationResults[${toPyStr(step.controlNodeId)}] = await ctx.run_node(`,
    `${indent}        ${step.controlSymbol},`,
    `${indent}        ${controlInput},`,
    `${indent}        run_id=${controlRunId},`,
    `${indent}    )`,
    `${indent}    _loop_decision = iterationResults[${toPyStr(step.controlNodeId)}]`,
    `${indent}    ctx.state[${toPyStr(`af_dynamic_loop:${step.controlNodeId}`)}] = {`,
    `${indent}        "iteration": _loop_iteration,`,
    `${indent}        "decision": _loop_decision,`,
    `${indent}    }`,
    `${indent}    if not _dynamic_should_continue(_loop_decision, ${inlineList(step.backAliases)}, ${inlineList(step.exitAliases)}, ${toPyStr(step.defaultAction)}):`,
    `${indent}        results[${toPyStr(step.controlNodeId)}] = _loop_decision`,
    `${indent}        break`,
    `${indent}    _loop_iteration += 1`,
    `${indent}    if _loop_iteration >= _MAX_DYNAMIC_LOOP_ITERATIONS:`,
    `${indent}        ctx.state[${toPyStr(`af_dynamic_loop:${step.controlNodeId}:max_iterations_reached`)}] = True`,
    `${indent}        results[${toPyStr(step.controlNodeId)}] = _loop_decision`,
    `${indent}        break`,
    `${indent}    _loop_feedback = _loop_decision`
  ].join("\n");
}

function renderRunStep(step, indent, loopStep) {
  let input = renderInputExpression(step.inputRefs, loopStep ? "iterationResults" : null);
  if (loopStep && step.usesLoopFeedback) input = `(_loop_feedback if _loop_iteration > 0 else ${input})`;
  const target = loopStep ? "iterationResults" : "results";
  const runId = loopStep ? loopRunId(loopStep, step.nodeId) : toPyStr(step.runId);
  return [
    `${indent}${target}[${toPyStr(step.nodeId)}] = await ctx.run_node(`,
    `${indent}    ${step.symbol},`,
    `${indent}    ${input},`,
    `${indent}    run_id=${runId},`,
    `${indent})`
  ].join("\n");
}

function renderJoinStep(step, indent, loopResultsName) {
  const target = step.explicit
    ? loopResultsName ?? "results"
    : loopResultsName
      ? "iterationBarriers"
      : "barriers";
  const rows = step.predecessors.map(
    (predecessor) =>
      `${indent}    ${toPyStr(predecessor.runtimeName)}: ${renderResultRef(predecessor, loopResultsName)},`
  );
  return [
    `${indent}${target}[${toPyStr(step.nodeId)}] = {`,
    ...rows,
    `${indent}}`
  ].join("\n");
}

function renderInputExpression(refs, loopResultsName) {
  if (!refs.length) return "node_input";
  if (refs.length !== 1) throw new Error(`dynamic runnable emitter expected one input reference, found ${refs.length}.`);
  return renderResultRef(refs[0], loopResultsName);
}

function renderResultRef(ref, loopResultsName) {
  if (ref.storage === "barrier") {
    return `${ref.scope === "iteration" ? "iterationBarriers" : "barriers"}[${toPyStr(ref.nodeId)}]`;
  }
  if (ref.scope === "iteration") {
    if (!loopResultsName) throw new Error(`dynamic runnable emitter cannot read iteration result ${ref.nodeId} outside a loop.`);
    return `${loopResultsName}[${toPyStr(ref.nodeId)}]`;
  }
  return `results[${toPyStr(ref.nodeId)}]`;
}

function loopRunId(loopStep, nodeId) {
  return `f${toPyStr(`run-loop-${dynamicRunIdComponent(loopStep.regionId)}-iteration-{_loop_iteration}-${dynamicRunIdComponent(nodeId)}`)}`;
}

function dynamicHelpers() {
  return `_MAX_DYNAMIC_LOOP_ITERATIONS = ${MAX_DYNAMIC_LOOP_ITERATIONS}


def _dynamic_decision_text(value: Any) -> str:
    if isinstance(value, dict):
        for key in ("decision", "response", "choice", "value", "status"):
            item = value.get(key)
            if item is not None:
                return str(item).strip().lower()
    return str(value or "").strip().lower()


def _dynamic_matches(value: Any, aliases: list[str]) -> bool:
    text = _dynamic_decision_text(value)
    return any(alias and alias == text for alias in aliases)


def _dynamic_should_continue(value: Any, back_aliases: list[str], exit_aliases: list[str], default_action: str) -> bool:
    if _dynamic_matches(value, exit_aliases):
        return False
    if _dynamic_matches(value, back_aliases):
        return True
    return default_action == "loop_back"
`;
}

function inlineList(values) {
  return `[${values.map((value) => toPyStr(value)).join(", ")}]`;
}
