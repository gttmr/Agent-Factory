import { buildAgentPy } from "./agent.mjs";
import { toolConnection } from "./tools.mjs";
import { agentInstruction } from "./emitters/agent-node.mjs";
import {
  graphEdgeSemantics,
  graphNodeSemantics,
  orderedGraphNodeSpecs,
  startNodeIds,
  terminalOutputIds,
  validateGraphCoverage
} from "./graph/indexes.mjs";
import {
  buildAgentsConfig,
  buildEnvExample,
  buildGitignore,
  buildMockConfigYaml,
  buildNodeHelperPy,
  buildSchemasPy,
  buildSubworkflowsPy,
  buildWorkflowPy,
  toolConfigFromAsset as supportToolConfigFromAsset
} from "./support/config.mjs";
import { buildManifest as buildSupportManifest } from "./support/manifest.mjs";
import { buildImplementationHandoff, buildReadme } from "./support/readme.mjs";
import { buildRuntimeChatSmoke, buildSampleInputsYaml } from "./support/samples.mjs";
import { buildContractTest } from "./support/tests.mjs";
import { buildAgentCard } from "./support/agent-card.mjs";
import { buildA2aLauncherPy } from "./support/a2a-launcher.mjs";
import { hasApprovedA2aExposure } from "./remote-a2a.mjs";

export function buildFiles({
  artifactRoot,
  outputRoot,
  analysisResult,
  normalizedRequirement,
  graph,
  mockLabSpec,
  scaffoldPlan,
  assets,
  outputMode,
  packageName
}) {
  const graphContext = { assets, graph };
  validateGraphCoverage(graphContext);
  const connectedTools = assets.filter((asset) => toolConnection(asset) === "mcp_connected");
  const unconnectedTools = assets.filter((asset) => asset.asset_type === "tool" && toolConnection(asset) === "unconnected");
  const a2aProviderEnabled = hasApprovedA2aExposure({ analysisResult, assets });
  const supportContext = {
    artifactRoot,
    outputRoot,
    analysisResult,
    normalizedRequirement,
    graph,
    mockLabSpec,
    scaffoldPlan,
    assets,
    outputMode,
    packageName,
    graphContext,
    a2aProviderEnabled,
    unconnectedTools,
    terminalOutputIds: () => terminalOutputIds(graphContext)
  };
  const toolConfigForAsset = (asset) => supportToolConfigFromAsset(asset, { toolConnection });
  const defaultAgentInstructionForConfig = (target) => {
    const asset = target.asset ?? target;
    return agentInstruction(
      {
        asset,
        node:
          target.node ??
          graph.nodes.find(
            (node) => node?.agent_ref === asset.asset_id || node?.tool_ref === asset.asset_id || node?.workflow_ref === asset.asset_id
          ) ??
          null,
        assetNodeCount: target.assetNodeCount
      },
      { graphContext }
    );
  };
  const files = {
    [`${packageName}/__init__.py`]: "from .agent import root_agent\n",
    [`${packageName}/agent.py`]: buildAgentPy({
      analysisResult,
      normalizedRequirement,
      graph,
      scaffoldPlan,
      assets,
      outputMode,
      packageName,
      graphContext,
      connectedTools,
      toolConfigForAsset
    }),
    [`${packageName}/workflow.py`]: buildWorkflowPy(),
    [`${packageName}/schemas.py`]: buildSchemasPy({ assets, toolConnection }),
    [`${packageName}/mock_config.yaml`]: buildMockConfigYaml({ assets, toolConnection }),
    [`${packageName}/sample_inputs.yaml`]: buildSampleInputsYaml(supportContext),
    [`${packageName}/README.md`]: buildReadme(supportContext),
    [`${packageName}/nodes/__init__.py`]: "",
    [`${packageName}/nodes/agents.py`]: buildNodeHelperPy("agents"),
    [`${packageName}/nodes/tools.py`]: buildNodeHelperPy("tools"),
    [`${packageName}/nodes/gates.py`]: buildNodeHelperPy("gates"),
    [`${packageName}/nodes/human_inputs.py`]: buildNodeHelperPy("human_inputs"),
    [`${packageName}/nodes/functions.py`]: buildNodeHelperPy("functions"),
    [`${packageName}/nodes/subworkflows.py`]: buildSubworkflowsPy({ assets }),
    [`${packageName}/workflow_manifest.json`]: `${JSON.stringify(
      buildManifest({
        outputMode,
        packageName,
        normalizedRequirement,
        analysisResult,
        connectedTools,
        unconnectedTools,
        scaffoldPlan,
        assets,
        graph,
        graphContext,
        toolConfigForAsset
      }),
      null,
      2
    )}\n`,
    "scaffold-plan.json": `${JSON.stringify(scaffoldPlan, null, 2)}\n`,
    "implementation-handoff.md": buildImplementationHandoff(supportContext),
    "runtime-chat-smoke.json": `${JSON.stringify(buildRuntimeChatSmoke(supportContext), null, 2)}\n`,
    [`${packageName}/tests/__init__.py`]: "",
    [`${packageName}/tests/test_workflow_contract.py`]: buildContractTest({ outputMode, packageName, a2aProviderEnabled }),
    "README.md": buildReadme(supportContext)
  };
  if (a2aProviderEnabled) {
    files[`${packageName}/agent.json`] = `${JSON.stringify(buildAgentCard({ packageName, normalizedRequirement }), null, 2)}\n`;
    files["af_adk_a2a_server.py"] = buildA2aLauncherPy();
  }
  if (outputMode === "runnable") {
    files["agents.config.yaml"] = buildAgentsConfig({
      assets,
      agentNodeTargets: orderedGraphNodeSpecs(graphContext),
      defaultAgentInstruction: defaultAgentInstructionForConfig,
      toolConnection
    });
    files[".env.example"] = buildEnvExample({ analysisResult, assets });
    files[".gitignore"] = buildGitignore();
  }
  return files;
}

function buildManifest({
  outputMode,
  packageName,
  normalizedRequirement,
  analysisResult,
  connectedTools,
  unconnectedTools,
  scaffoldPlan,
  assets,
  graph,
  graphContext,
  toolConfigForAsset
}) {
  return buildSupportManifest({
    outputMode,
    packageName,
    normalizedRequirement,
    analysisResult,
    connectedTools,
    unconnectedTools,
    scaffoldPlan,
    assets,
    graph,
    startNodeIds: () => startNodeIds(graphContext),
    terminalOutputIds: () => terminalOutputIds(graphContext),
    graphNodeSemantics: () => graphNodeSemantics(graphContext),
    graphEdgeSemantics: () => graphEdgeSemantics(graphContext),
    toolConfigForAsset
  });
}
