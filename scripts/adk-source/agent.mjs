import { buildRunnableAgentPy } from "./agent-runnable.mjs";
import { buildSmokeAgentPy } from "./agent-smoke.mjs";

export function buildAgentPy(context) {
  // agent.py builders keyed by output mode. A future runtime form (e.g. an ADK
  // dynamic-workflow bundle) plugs in as one entry here plus its builder, rather
  // than another branch. Declared inside the function so the top-level
  // buildFiles() driver does not hit a temporal-dead-zone on these consts.
  const AGENT_PY_BUILDERS = {
    smoke: buildSmokeAgentPy,
    runnable: buildRunnableAgentPy
  };
  return (AGENT_PY_BUILDERS[context.outputMode] ?? buildSmokeAgentPy)(context);
}
