import { assertDataChannelsSupported, usesArtifactChannels } from "./channels.mjs";
import { hasAgentOwnedToolsets } from "./adapters.mjs";
import { collisionTargetForSyntheticJoin } from "./dispatch/index.mjs";
import { collectGenerationNodes } from "./graph/collector.mjs";
import { assertNoSymbolCollisions, assertRunnableGraphSupported } from "./graph/guards.mjs";
import { hasDynamicRunnableShape } from "./graph/dynamic.mjs";
import { buildRunnableGraph, workflowEdgeLiteral } from "./graph/lowering.mjs";
import { toPyStr, toPythonLiteral, truncate } from "./python-literals.mjs";
import { assertRemoteA2aSupported, usesRemoteA2a, usesRemoteA2aAuthInterceptor } from "./remote-a2a.mjs";
import { componentContracts } from "./agent-contracts.mjs";
import { emitRunnableNodeBlocks } from "./emitters/node-registry.mjs";
import { buildRuntimeHelperSection } from "./emitters/runtime-helpers.mjs";
import { buildDynamicRunnableAgentPy } from "./agent-dynamic.mjs";

export function buildRunnableAgentPy(context) {
  const { analysisResult, connectedAdapters, graphContext, modules, normalizedRequirement, packageName, processFlow } =
    context;
  if (hasDynamicRunnableShape(graphContext)) {
    return buildDynamicRunnableAgentPy(context);
  }
  const collection = collectGenerationNodes(graphContext, { mode: "static" });
  assertRunnableGraphSupported(graphContext, { collection });
  assertDataChannelsSupported(graphContext);
  assertRemoteA2aSupported({ analysisResult, modules });
  const { edges, joins } = buildRunnableGraph(graphContext, { collection });
  const {
    collisionTargets,
    humanInputNodes,
    moduleSpecsInDeclarationOrder: orderedNodeSpecs,
    routerNodes,
    terminalOutputNodes
  } = collection;
  const autoJoins = joins.filter((join) => join.explicit === false);
  assertNoSymbolCollisions([...collisionTargets, ...autoJoins.map(collisionTargetForSyntheticJoin)]);
  const { nodeBlocks, funcBlocks } = emitRunnableNodeBlocks(context, {
    mode: "static",
    orderedNodeSpecs,
    humanInputNodes,
    routerNodes,
    terminalOutputNodes
  });

  const projectionNotes = runtimeProjectionNotes(processFlow);
  const joinDecls = joins.map((join) => `${join.sym} = JoinNode(name=${toPyStr(join.name)})`);
  const edgeLiteral = workflowEdgeLiteral(edges);
  const description = `검토된 workbench artifact에서 생성한 실행 가능한 ADK 2.3 워크플로우입니다: ${truncate(
    normalizedRequirement.title || packageName
  )}.`;

  // Artifact channels need json (serialize the payload) + google.genai.types
  // (wrap as a Part); Remote A2A nodes need RemoteA2aAgent. Gated so bundles
  // without those features keep an unchanged import block.
  const usesArtifacts = usesArtifactChannels(graphContext);
  const usesRouteNodes = collection.featureFlags.has("routes");
  const usesRemoteAuth = usesRemoteA2aAuthInterceptor({ analysisResult, modules });
  const jsonStdlibImport = usesArtifacts || connectedAdapters.length > 0 || usesRouteNodes ? "import json\n" : "";
  const usesTerminalOutputs = terminalOutputNodes.length > 0;
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
  const eventImport = usesRouteNodes || usesRemoteAuth || usesTerminalOutputs ? "Event, RequestInput" : "RequestInput";

  return `from __future__ import annotations

import os
${jsonStdlibImport}from pathlib import Path
from typing import Any

import yaml

from google.adk import Context
from google.adk.agents import LlmAgent
${remoteConfigImport}
${remoteImport}${mcpToolsetImport}from google.adk.events import ${eventImport}
from google.adk.workflow import FunctionNode, JoinNode, START, Workflow
${artifactGenaiImport}

${buildRuntimeHelperSection({ componentContractLiteral: toPythonLiteral(componentContracts(context)), modules })}

${funcBlocks.join("\n\n")}${funcBlocks.length ? "\n\n\n" : ""}# ---------------------------------------------------------------------------
# Graph nodes
# ---------------------------------------------------------------------------

${projectionNotes}${nodeBlocks.join("\n\n")}
${joinDecls.length ? `\n${joinDecls.join("\n")}\n` : ""}

root_agent = Workflow(
    name=${toPyStr(packageName)},
    description=${toPyStr(description)},
    edges=${edgeLiteral},
)
`;
}

function runtimeProjectionNotes(processFlow) {
  const warnings = processFlow?.validation?.warnings;
  if (!Array.isArray(warnings) || warnings.length === 0) return "";
  const lines = warnings
    .filter((warning) => typeof warning === "string" && warning.trim())
    .map((warning) => `# Runtime projection note: ${warning.replaceAll("\n", " ")}`);
  return lines.length ? `${lines.join("\n")}\n\n` : "";
}
