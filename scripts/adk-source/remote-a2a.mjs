import { nodeSymbol, pyNodeName } from "./naming.mjs";
import { toPyStr, truncate } from "./python-literals.mjs";

const AUTH_ENV_PATTERN = /^AF_A2A_[A-Z0-9_]+$/;

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

export function usesRemoteA2aAuthInterceptor({ analysisResult, modules }) {
  return remoteA2aRuntimeRows({ analysisResult, modules }).some((entry) => entry.generated_support.request_interceptor_auth);
}

export function remoteA2aEnvVars({ analysisResult, modules }) {
  return [
    ...new Set(
      remoteA2aRuntimeRows({ analysisResult, modules })
        .map((entry) => entry.adk_runtime_policy?.auth?.env_var)
        .filter((envVar) => typeof envVar === "string" && envVar.trim())
    )
  ];
}

export function remoteA2aRuntimeRows({ analysisResult, modules }) {
  return modules
    .filter((module) => module.module_category === "remote_a2a")
    .map((module) => {
      const contract = a2aContractForModule(analysisResult, module);
      const policy = contract?.adk_runtime_policy ?? null;
      return {
        module_id: module.id,
        module_name: module.name,
        contract_id: contract?.contract_id ?? null,
        target_agent_name: contract?.target_agent_name ?? null,
        agent_card_url: a2aAgentCardUrl(contract),
        adk_runtime_policy: policy,
        generated_support: {
          timeout: hasTimeoutPolicy(policy),
          request_interceptor_auth: Boolean(authInterceptorSpec(policy)),
          retry_runtime_wrapper: false,
          fallback_runtime_wrapper: false
        }
      };
    });
}

export function emitRemoteA2aNode({ analysisResult, target }) {
  const module = target.module ?? target;
  const contract = a2aContractForModule(analysisResult, module);
  const url = a2aAgentCardUrl(contract);
  const policy = contract?.adk_runtime_policy ?? null;
  const description = (contract && contract.target_agent_name) || module.name;
  const authSpec = authInterceptorSpec(policy);
  const beforeRequest = authSpec ? `${emitAuthInterceptor({ target, spec: authSpec })}\n\n` : "";
  const timeoutLine = hasTimeoutPolicy(policy) ? `    timeout=${formatPythonNumber(policy.timeout_seconds)},\n` : "";
  const configLine = authSpec
    ? `    config=A2aRemoteAgentConfig(
        request_interceptors=[RequestInterceptor(before_request=${a2aBeforeRequestName(target)})]
    ),
`
    : "";
  return `${beforeRequest}${nodeSymbol(target)} = RemoteA2aAgent(
    name=${toPyStr(pyNodeName(target))},
    description=${toPyStr(truncate(description))},
    agent_card=${toPyStr(url)},
${timeoutLine}${configLine}    use_legacy=False,
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
    } else {
      const policyIssues = a2aRuntimePolicyIssues(contract.adk_runtime_policy);
      if (policyIssues.length > 0) {
        bad.push(`${module.id} (contract ${contract.contract_id} adk_runtime_policy: ${policyIssues.join(", ")})`);
      }
    }
  }
  if (bad.length > 0) {
    throw new Error(
      `runnable mode cannot lower these Remote A2A nodes: ${bad.join("; ")}. Each needs an approved A2A contract with agent_card.agent_card_url.`
    );
  }
}

function emitAuthInterceptor({ target, spec }) {
  const assignment =
    spec.mode === "bearer_env"
      ? `    metadata["authorization"] = f"Bearer {auth_value}"`
      : `    metadata[${toPyStr(spec.metadataKey)}] = auth_value`;
  return `async def ${a2aBeforeRequestName(target)}(ctx, a2a_request, params):
    auth_value = os.environ.get(${toPyStr(spec.envVar)})
    if not auth_value:
        return Event(
            author="agent_factory_runtime_policy",
            error_message=${toPyStr(`Missing required Remote A2A auth env var ${spec.envVar}`)},
        ), params
    metadata = dict(getattr(params, "request_metadata", None) or {})
${assignment}
    params.request_metadata = metadata
    return a2a_request, params`;
}

function a2aBeforeRequestName(target) {
  return `_a2a_before_${nodeSymbol(target)}`;
}

function authInterceptorSpec(policy) {
  if (!policy || typeof policy !== "object") return null;
  const auth = policy.auth;
  if (!auth || typeof auth !== "object") return null;
  if (auth.mode === "none") return null;
  if (auth.mode !== "bearer_env" && auth.mode !== "metadata_env") return null;
  if (typeof auth.env_var !== "string" || !AUTH_ENV_PATTERN.test(auth.env_var)) return null;
  if (auth.mode === "metadata_env" && (typeof auth.metadata_key !== "string" || !auth.metadata_key.trim())) return null;
  return {
    mode: auth.mode,
    envVar: auth.env_var,
    metadataKey: auth.mode === "metadata_env" ? auth.metadata_key : null
  };
}

function hasTimeoutPolicy(policy) {
  return Boolean(policy && typeof policy.timeout_seconds === "number" && Number.isFinite(policy.timeout_seconds) && policy.timeout_seconds > 0);
}

function formatPythonNumber(value) {
  return Number.isInteger(value) ? String(value) : String(Number(value));
}

function a2aRuntimePolicyIssues(policy) {
  const issues = [];
  if (!policy || typeof policy !== "object" || Array.isArray(policy)) return ["missing"];
  if (policy.timeout_seconds !== null && !hasTimeoutPolicy(policy)) issues.push("timeout_seconds must be a positive number or null");
  const auth = policy.auth;
  if (!auth || typeof auth !== "object" || Array.isArray(auth)) {
    issues.push("auth missing");
  } else if (auth.mode === "bearer_env" || auth.mode === "metadata_env") {
    if (typeof auth.env_var !== "string" || !AUTH_ENV_PATTERN.test(auth.env_var)) issues.push("auth.env_var must be AF_A2A_*");
    if (auth.mode === "metadata_env" && (typeof auth.metadata_key !== "string" || !auth.metadata_key.trim())) {
      issues.push("auth.metadata_key missing");
    }
  } else if (auth.mode !== "none") {
    issues.push("auth.mode invalid");
  }
  return issues;
}
