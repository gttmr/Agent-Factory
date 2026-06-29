import { buildAgentPy } from "./agent.mjs";
import { adapterConnection } from "./adapters.mjs";
import { defaultAgentInstruction } from "./emitters/agent-node.mjs";
import {
  graphEdgeSemantics,
  graphNodeSemantics,
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
  buildWorkflowCallsPy,
  buildWorkflowPy,
  mockBindingFromModule as supportMockBindingFromModule
} from "./support/config.mjs";
import { buildManifest as buildSupportManifest } from "./support/manifest.mjs";
import { buildImplementationHandoff, buildReadme } from "./support/readme.mjs";
import { buildRuntimeChatSmoke, buildSampleInputsYaml } from "./support/samples.mjs";
import { buildContractTest } from "./support/tests.mjs";

export function buildFiles({
  artifactRoot,
  outputRoot,
  analysisResult,
  normalizedRequirement,
  processFlow,
  mockLabSpec,
  scaffoldPlan,
  modules,
  outputMode,
  packageName
}) {
  const graphContext = { modules, processFlow };
  validateGraphCoverage(graphContext);
  const connectedAdapters = modules.filter((module) => adapterConnection(module) === "mcp_connected");
  const unconnectedAdapters = modules.filter((module) => adapterConnection(module) === "unconnected");
  const supportContext = {
    artifactRoot,
    outputRoot,
    analysisResult,
    normalizedRequirement,
    processFlow,
    mockLabSpec,
    scaffoldPlan,
    modules,
    outputMode,
    packageName,
    unconnectedAdapters,
    terminalOutputIds: () => terminalOutputIds(graphContext)
  };
  const mockBindingFromModule = (module) => supportMockBindingFromModule(module, { adapterConnection });
  const files = {
    [`${packageName}/__init__.py`]: "from .agent import root_agent\n",
    [`${packageName}/agent.py`]: buildAgentPy({
      analysisResult,
      normalizedRequirement,
      processFlow,
      scaffoldPlan,
      modules,
      outputMode,
      packageName,
      graphContext,
      connectedAdapters,
      mockBindingFromModule
    }),
    [`${packageName}/workflow.py`]: buildWorkflowPy(),
    [`${packageName}/schemas.py`]: buildSchemasPy({ modules, adapterConnection }),
    [`${packageName}/mock_config.yaml`]: buildMockConfigYaml({ modules, adapterConnection }),
    [`${packageName}/sample_inputs.yaml`]: buildSampleInputsYaml(supportContext),
    [`${packageName}/README.md`]: buildReadme(supportContext),
    [`${packageName}/nodes/__init__.py`]: "",
    [`${packageName}/nodes/agents.py`]: buildNodeHelperPy("agents"),
    [`${packageName}/nodes/adapters.py`]: buildNodeHelperPy("adapters"),
    [`${packageName}/nodes/gates.py`]: buildNodeHelperPy("gates"),
    [`${packageName}/nodes/human_inputs.py`]: buildNodeHelperPy("human_inputs"),
    [`${packageName}/nodes/routers.py`]: buildNodeHelperPy("routers"),
    [`${packageName}/nodes/workflow_calls.py`]: buildWorkflowCallsPy({ modules }),
    [`${packageName}/workflow_manifest.json`]: `${JSON.stringify(
      buildManifest({
        outputMode,
        packageName,
        normalizedRequirement,
        analysisResult,
        connectedAdapters,
        unconnectedAdapters,
        scaffoldPlan,
        modules,
        processFlow,
        graphContext,
        mockBindingFromModule
      }),
      null,
      2
    )}\n`,
    "scaffold-plan.json": `${JSON.stringify(scaffoldPlan, null, 2)}\n`,
    "implementation-handoff.md": buildImplementationHandoff(supportContext),
    "runtime-chat-smoke.json": `${JSON.stringify(buildRuntimeChatSmoke(supportContext), null, 2)}\n`,
    [`${packageName}/tests/__init__.py`]: "",
    [`${packageName}/tests/test_workflow_contract.py`]: buildContractTest({ outputMode, packageName }),
    "README.md": buildReadme(supportContext)
  };
  if (outputMode === "runnable") {
    files["agents.config.yaml"] = buildAgentsConfig({ modules, defaultAgentInstruction, adapterConnection });
    files[".env.example"] = buildEnvExample({ analysisResult, modules });
    files[".gitignore"] = buildGitignore();
  }
  return files;
}

function buildManifest({
  outputMode,
  packageName,
  normalizedRequirement,
  analysisResult,
  connectedAdapters,
  unconnectedAdapters,
  scaffoldPlan,
  modules,
  processFlow,
  graphContext,
  mockBindingFromModule
}) {
  return buildSupportManifest({
    outputMode,
    packageName,
    normalizedRequirement,
    analysisResult,
    connectedAdapters,
    unconnectedAdapters,
    scaffoldPlan,
    modules,
    processFlow,
    startNodeIds: () => startNodeIds(graphContext),
    terminalOutputIds: () => terminalOutputIds(graphContext),
    graphNodeSemantics: () => graphNodeSemantics(graphContext),
    graphEdgeSemantics: () => graphEdgeSemantics(graphContext),
    mockBindingFromModule
  });
}
