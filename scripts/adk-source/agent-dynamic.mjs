import { assertDataChannelsSupported, usesArtifactChannels } from "./channels.mjs";
import { hasAgentOwnedTools } from "./tools.mjs";
import { collectGenerationNodes } from "./graph/collector.mjs";
import { assertNoSymbolCollisions } from "./graph/guards.mjs";
import {
  assertDynamicRunnableGraphSupported,
  dynamicRunIdComponent
} from "./graph/dynamic.mjs";
import { toPyStr, toPythonLiteral, truncate } from "./python-literals.mjs";
import { assertRemoteA2aSupported, usesRemoteA2a, usesRemoteA2aAuthInterceptor } from "./remote-a2a.mjs";
import {
  assertAsyncResumeSupported,
  asyncResumeRootClass,
  buildAsyncResumeWorkflowSupport,
  usesAsyncResumeRuntime
} from "./resume-contracts.mjs";
import { componentContracts } from "./agent-contracts.mjs";
import { emitRunnableNodeBlocks } from "./emitters/node-registry.mjs";
import { buildRuntimeHelperSection } from "./emitters/runtime-helpers.mjs";

export function buildDynamicRunnableAgentPy(context) {
  const { analysisResult, assets, connectedTools, graphContext, normalizedRequirement, packageName } = context;
  assertDynamicLoopsHaveApprovedBounds(graphContext);
  const collection = collectGenerationNodes(graphContext, { mode: "dynamic" });
  const dynamicPlan = assertDynamicRunnableGraphSupported(graphContext, { collection });
  assertDataChannelsSupported(graphContext);
  assertRemoteA2aSupported({ analysisResult, assets });
  assertAsyncResumeSupported(context);

  const {
    collisionTargets,
    functionNodes,
    humanInputNodes,
    assetSpecsInDeclarationOrder: orderedNodeSpecs,
    routeNodes,
    terminalOutputNodes
  } = collection;
  assertNoSymbolCollisions(collisionTargets);
  const { nodeBlocks, funcBlocks } = emitRunnableNodeBlocks(context, {
    mode: "dynamic",
    orderedNodeSpecs,
    functionNodes,
    humanInputNodes,
    routeNodes,
    terminalOutputNodes
  });

  const description = `검토된 workbench artifact에서 생성한 ADK 2.3 dynamic workflow wiring입니다: ${truncate(
    normalizedRequirement.title || packageName
  )}.`;
  const usesArtifacts = usesArtifactChannels(graphContext);
  const usesTerminalOutputs = collection.featureFlags.has("terminal_outputs");
  const usesAsyncResume = usesAsyncResumeRuntime(context);
  const usesRemoteAuth = usesRemoteA2aAuthInterceptor({ analysisResult, assets });
  const jsonStdlibImport = usesArtifacts || connectedTools.length > 0 || usesAsyncResume ? "import json\n" : "";
  const timeStdlibImport = usesAsyncResume ? "import time\n" : "";
  const artifactGenaiImport = usesArtifacts || usesTerminalOutputs ? "from google.genai import types\n" : "";
  const remoteImport = usesRemoteA2a(assets)
    ? "from google.adk.agents.remote_a2a_agent import RemoteA2aAgent\n"
    : "";
  const remoteConfigImport = usesRemoteAuth
    ? "from google.adk.a2a.agent.config import A2aRemoteAgentConfig, RequestInterceptor\n"
    : "";
  const mcpToolsetImport = hasAgentOwnedTools(graphContext)
    ? "from google.adk.tools import McpToolset\nfrom google.adk.tools.mcp_tool import StreamableHTTPConnectionParams\n"
    : "";
  const eventImport = usesRemoteAuth || usesTerminalOutputs ? "Event, RequestInput" : "RequestInput";
  const dynamicWorkflow = emitDynamicWorkflow(dynamicPlan);

  return `from __future__ import annotations

import os
${jsonStdlibImport}${timeStdlibImport}from pathlib import Path
from typing import Any

import yaml

from google.adk import Context
from google.adk.agents import LlmAgent
${remoteConfigImport}
${remoteImport}${mcpToolsetImport}from google.adk.events import ${eventImport}
from google.adk.workflow import FunctionNode, START, Workflow, node
${artifactGenaiImport}

${buildRuntimeHelperSection({ componentContractLiteral: toPythonLiteral(componentContracts(context)), assets })}
${buildAsyncResumeWorkflowSupport(context)}

${funcBlocks.join("\n\n")}${funcBlocks.length ? "\n\n\n" : ""}

${nodeBlocks.join("\n\n")}
${dynamicWorkflow}

root_agent = ${asyncResumeRootClass(context)}(
    name=${toPyStr(packageName)},
    description=${toPyStr(description)},
    edges=[(START, dynamic_workflow)],
)
`;
}

function assertDynamicLoopsHaveApprovedBounds({ graph }) {
  const loopEdges = (graph.edges ?? []).filter(
    (edge) => edge?.control?.kind === "loop_back" || edge?.control?.kind === "loop_exit"
  );
  const loopRegions = (graph.regions ?? []).filter((region) => region?.kind === "loop");
  if (!loopEdges.length && !loopRegions.length) return;
  throw new Error(
    "dynamic runnable mode cannot lower loops: Target Graph IR has no approved loop bound or exhaustion contract fields."
  );
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
  throw new Error(`dynamic runnable emitter cannot render unsupported step kind ${step.kind}.`);
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
