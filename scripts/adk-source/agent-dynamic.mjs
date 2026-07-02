import { assertDataChannelsSupported, usesArtifactChannels } from "./channels.mjs";
import { agentOwnedToolsetAdapterIds, hasAgentOwnedToolsets } from "./adapters.mjs";
import { assertNoSymbolCollisions } from "./graph/guards.mjs";
import { graphIndexes, orderedGraphModules } from "./graph/indexes.mjs";
import {
  assertDynamicRunnableGraphSupported,
  buildDynamicRunnablePlan
} from "./graph/dynamic.mjs";
import { pyGraphNodeName, syntheticNodeSymbol } from "./naming.mjs";
import { toPyStr, toPythonLiteral, truncate } from "./python-literals.mjs";
import { assertRemoteA2aSupported, usesRemoteA2a, usesRemoteA2aAuthInterceptor } from "./remote-a2a.mjs";
import { componentContracts } from "./agent-contracts.mjs";
import { emitRunnableNodeBlocks } from "./emitters/node-registry.mjs";
import { buildRuntimeHelperSection } from "./emitters/runtime-helpers.mjs";

const MAX_DYNAMIC_LOOP_ITERATIONS = 3;

export function buildDynamicRunnableAgentPy(context) {
  const { analysisResult, connectedAdapters, graphContext, modules, normalizedRequirement, packageName } = context;
  assertDynamicRunnableGraphSupported(graphContext);
  assertDataChannelsSupported(graphContext);
  assertRemoteA2aSupported({ analysisResult, modules });

  const graph = graphIndexes(graphContext);
  const toolsetAdapterIds = agentOwnedToolsetAdapterIds(graphContext);
  const orderedModules = orderedGraphModules(graphContext, { excludeModuleIds: toolsetAdapterIds });
  const humanInputNodes = graph.nodes.filter((node) => node.node_kind === "human_input");
  const loopPlan = buildDynamicRunnablePlan(graphContext);
  assertNoSymbolCollisions(orderedModules, [...humanInputNodes, ...loopPlan.loopControls]);
  const { nodeBlocks, funcBlocks } = emitRunnableNodeBlocks(context, { orderedModules, humanInputNodes, routerNodes: [] });
  const loopControlBlocks = loopPlan.loopControls.map(emitLoopControlNode);

  const description = `검토된 Agent Factory artifact에서 생성한 ADK 2.1 dynamic workflow wiring입니다: ${truncate(
    normalizedRequirement.title || packageName
  )}.`;
  const usesArtifacts = usesArtifactChannels(graphContext);
  const usesRemoteAuth = usesRemoteA2aAuthInterceptor({ analysisResult, modules });
  const jsonStdlibImport = usesArtifacts || connectedAdapters.length > 0 ? "import json\n" : "";
  const artifactGenaiImport = usesArtifacts ? "from google.genai import types\n" : "";
  const remoteImport = usesRemoteA2a(modules)
    ? "from google.adk.agents.remote_a2a_agent import RemoteA2aAgent\n"
    : "";
  const remoteConfigImport = usesRemoteAuth
    ? "from google.adk.a2a.agent.config import A2aRemoteAgentConfig, RequestInterceptor\n"
    : "";
  const mcpToolsetImport = hasAgentOwnedToolsets(graphContext)
    ? "from google.adk.tools import McpToolset\nfrom google.adk.tools.mcp_tool import StreamableHTTPConnectionParams\n"
    : "";
  const eventImport = usesRemoteAuth ? "Event, RequestInput" : "RequestInput";
  const dynamicWorkflow = emitDynamicWorkflow(loopPlan.steps);

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

${buildRuntimeHelperSection({ componentContractLiteral: toPythonLiteral(componentContracts(context)) })}

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

function emitLoopControlNode(node) {
  return `@node(name=${toPyStr(pyGraphNodeName(node))})
def ${syntheticNodeSymbol(node)}(node_input=None):
    return node_input`;
}

function emitDynamicWorkflow(steps) {
  return `@node(name="dynamic_workflow", rerun_on_resume=True)
async def dynamic_workflow(ctx: Context, node_input=None):
    payload = node_input
${renderSteps(steps, "    ")}
    return payload`;
}

function renderSteps(steps, indent) {
  return steps.map((step) => renderStep(step, indent)).join("\n");
}

function renderStep(step, indent) {
  if (step.kind === "run") {
    return `${indent}payload = await ctx.run_node(${step.symbol}, payload)`;
  }
  const body = step.body.map((entry) => `${indent}    payload = await ctx.run_node(${entry.symbol}, payload)`);
  return [
    `${indent}_loop_iteration = 0`,
    `${indent}while True:`,
    ...body,
    `${indent}    _loop_decision = await ctx.run_node(${step.controlSymbol}, payload)`,
    `${indent}    ctx.state[${toPyStr(`af_dynamic_loop:${step.controlNodeId}`)}] = {`,
    `${indent}        "iteration": _loop_iteration,`,
    `${indent}        "decision": _loop_decision,`,
    `${indent}    }`,
    `${indent}    if not _dynamic_should_continue(_loop_decision, ${inlineList(step.backAliases)}, ${inlineList(step.exitAliases)}, ${toPyStr(step.defaultAction)}):`,
    `${indent}        payload = _loop_decision`,
    `${indent}        break`,
    `${indent}    _loop_iteration += 1`,
    `${indent}    if _loop_iteration >= _MAX_DYNAMIC_LOOP_ITERATIONS:`,
    `${indent}        ctx.state[${toPyStr(`af_dynamic_loop:${step.controlNodeId}:max_iterations_reached`)}] = True`,
    `${indent}        payload = _loop_decision`,
    `${indent}        break`,
    `${indent}    payload = _loop_decision`
  ].join("\n");
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
