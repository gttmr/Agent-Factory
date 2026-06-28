import { nodeSymbol, pyNodeName } from "./naming.mjs";
import { toPyStr, truncate } from "./python-literals.mjs";

export function a2aContractForModule(analysisResult, module) {
  const contracts = Array.isArray(analysisResult?.a2aContracts) ? analysisResult.a2aContracts : [];
  return (
    contracts.find((contract) => contract && contract.remote_module_id === module.id) ??
    (module.a2a_contract_id
      ? contracts.find((contract) => contract && contract.contract_id === module.a2a_contract_id)
      : null) ??
    null
  );
}

export function a2aAgentCardUrl(contract) {
  const url = contract?.agent_card?.agent_card_url;
  return typeof url === "string" && url.trim() ? url.trim() : null;
}

export function usesRemoteA2a(modules) {
  return modules.some((module) => module.module_category === "remote_a2a");
}

export function emitRemoteA2aNode({ analysisResult, module }) {
  const contract = a2aContractForModule(analysisResult, module);
  const url = a2aAgentCardUrl(contract);
  const description = (contract && contract.target_agent_name) || module.name;
  return `${nodeSymbol(module)} = RemoteA2aAgent(
    name=${toPyStr(pyNodeName(module))},
    description=${toPyStr(truncate(description))},
    agent_card=${toPyStr(url)},
    use_legacy=False,
)`;
}

export function assertRemoteA2aSupported({ analysisResult, modules }) {
  const bad = [];
  for (const module of modules) {
    if (module.module_category !== "remote_a2a") continue;
    const contract = a2aContractForModule(analysisResult, module);
    if (!contract) bad.push(`${module.id} (no A2A contract)`);
    else if (!a2aAgentCardUrl(contract)) {
      bad.push(`${module.id} (contract ${contract.contract_id} has no agent_card.agent_card_url)`);
    }
  }
  if (bad.length > 0) {
    throw new Error(
      `runnable mode cannot lower these Remote A2A nodes: ${bad.join("; ")}. Each needs an approved A2A contract with agent_card.agent_card_url.`
    );
  }
}
