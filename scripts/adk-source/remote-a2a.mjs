import { nodeSymbol, pyNodeName } from "./naming.mjs";
import { toPyStr, truncate } from "./python-literals.mjs";

const AUTH_ENV_PATTERN = /^AF_A2A_[A-Z0-9_]+$/;

function a2aContractForAsset(analysisResult, asset) {
  const contracts = Array.isArray(analysisResult?.a2aContracts) ? analysisResult.a2aContracts : [];
  return (
    contracts.find((contract) => contract && contract.agent_ref === asset.asset_id && contract.contract_id === asset.binding?.contract_ref) ??
    null
  );
}

function a2aExposureContractForAsset(analysisResult, asset) {
  const contracts = Array.isArray(analysisResult?.a2aContracts) ? analysisResult.a2aContracts : [];
  return (
    contracts.find(
      (contract) =>
        contract &&
        contract.contract_status === "approved" &&
        contract.agent_ref === asset.asset_id &&
        contract.contract_id === asset.exposure?.contract_ref
    ) ?? null
  );
}

function a2aAgentCardUrl(contract) {
  const url = contract?.agent_card?.agent_card_url;
  return typeof url === "string" && url.trim() ? url.trim() : null;
}

export function usesRemoteA2a(assets) {
  return assets.some((asset) => asset.asset_type === "agent" && asset.binding?.kind === "a2a");
}

export function hasApprovedA2aExposure({ analysisResult, assets }) {
  return assets.some(
    (asset) =>
      asset.asset_type === "agent" &&
      asset.exposure?.protocol === "a2a" &&
      a2aExposureContractForAsset(analysisResult, asset) !== null
  );
}

export function usesRemoteA2aAuthInterceptor({ analysisResult, assets }) {
  return remoteA2aRuntimeRows({ analysisResult, assets }).some((entry) => entry.generated_support.request_interceptor_auth);
}

export function remoteA2aEnvVars({ analysisResult, assets }) {
  return [
    ...new Set(
      remoteA2aRuntimeRows({ analysisResult, assets })
        .map((entry) => entry.adk_runtime_policy?.auth?.env_var)
        .filter((envVar) => typeof envVar === "string" && envVar.trim())
    )
  ];
}

export function remoteA2aRuntimeRows({ analysisResult, assets }) {
  return assets
    .filter((asset) => asset.asset_type === "agent" && asset.binding?.kind === "a2a")
    .map((asset) => {
      const contract = a2aContractForAsset(analysisResult, asset);
      const policy = contract?.adk_runtime_policy ?? null;
      return {
        agent_ref: asset.asset_id,
        agent_name: asset.name,
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

export function remoteA2aRegistrySnapshotRows({ analysisResult, assets }) {
  return assets
    .filter((asset) => asset.asset_type === "agent" && asset.binding?.kind === "a2a")
    .map((asset) => {
      const contract = a2aContractForAsset(analysisResult, asset);
      if (contract?.contract_status !== "approved") return null;
      const agentCardUrl = a2aAgentCardUrl(contract);
      const rpcUrl = firstInterfaceUrl(contract);
      if (!agentCardUrl && !rpcUrl) return null;
      return {
        agent_ref: asset.asset_id,
        contract_id: contract.contract_id ?? null,
        target_agent_name: firstString([contract.target_agent_name, asset.name]),
        agent_card_url: agentCardUrl,
        rpc_url: rpcUrl,
        skills: stringArray(contract.skills),
        operations: stringArray(contract.operations),
        task_states: stringArray(contract.task_lifecycle?.states),
        connection_status: "configured"
      };
    })
    .filter(Boolean);
}

export function emitRemoteA2aNode({ analysisResult, target }) {
  const asset = target.asset ?? target;
  const contract = a2aContractForAsset(analysisResult, asset);
  const url = a2aAgentCardUrl(contract);
  const policy = contract?.adk_runtime_policy ?? null;
  const description = (contract && contract.target_agent_name) || asset.name;
  const authSpec = authInterceptorSpec(policy);
  const beforeRequest = authSpec ? `${emitAuthInterceptor({ target, spec: authSpec })}\n\n` : "";
  const timeoutLine = hasTimeoutPolicy(policy) ? `    timeout=${formatPythonNumber(policy.timeout_seconds)},\n` : "";
  const configLine = authSpec
    ? `    config=A2aRemoteAgentConfig(
        request_interceptors=[RequestInterceptor(before_request=${a2aBeforeRequestName(target)})]
    ),
`
    : "";
  const guardClass = `_FailClosed_${nodeSymbol(target)}`;
  const failureClass = `_RemoteA2aFailure_${nodeSymbol(target)}`;
  const fallback = policy?.fallback_handoff ?? { mode: "none", message: null };
  const failureContext = [
    `contract_id=${contract?.contract_id ?? "unknown"}`,
    `fallback_handoff=${fallback.mode ?? "none"}`,
    ...(typeof fallback.message === "string" && fallback.message.trim()
      ? [`handoff_message=${fallback.message.trim()}`]
      : []),
    ...(typeof contract?.task_lifecycle?.input_required_followup === "string" && contract.task_lifecycle.input_required_followup.trim()
      ? [`input_required_followup=${contract.task_lifecycle.input_required_followup.trim()}`]
      : []),
    ...(typeof contract?.task_lifecycle?.auth_required_followup === "string" && contract.task_lifecycle.auth_required_followup.trim()
      ? [`auth_required_followup=${contract.task_lifecycle.auth_required_followup.trim()}`]
      : [])
  ].join("; ");
  return `${beforeRequest}class ${failureClass}(RuntimeError):
    pass


class ${guardClass}(RemoteA2aAgent):
    @staticmethod
    def _task_state(event):
        metadata = getattr(event, "custom_metadata", None) or {}
        response = metadata.get("a2a:response")
        if not isinstance(response, dict):
            return None
        status = response.get("status")
        state = status.get("state") if isinstance(status, dict) else None
        if state is None:
            return None
        normalized = str(state).strip().lower()
        if normalized.startswith("task_state_"):
            normalized = normalized[len("task_state_"):]
        return normalized

    @staticmethod
    def _has_usable_result(event):
        if getattr(event, "long_running_tool_ids", None):
            return False
        content = getattr(event, "content", None)
        parts = getattr(content, "parts", None) or []
        return bool(getattr(event, "output", None) is not None or parts)

    async def _run_async_impl(self, ctx):
        usable_result_seen = False
        async for event in super()._run_async_impl(ctx):
            task_state = self._task_state(event)
            error_detail = getattr(event, "error_message", None) or getattr(event, "error_code", None)
            if error_detail or task_state in {"failed", "canceled", "cancelled", "rejected"}:
                cause = str(error_detail) if error_detail else f"remote task non-success state={task_state}"
                raise ${failureClass}(${toPyStr(`Remote A2A failed closed; ${failureContext}; cause=`)} + cause)
            if task_state in {"input-required", "input_required", "auth-required", "auth_required"}:
                # Keep the reviewed interactive event observable to the Workbench.
                # If execution consumes past it instead of pausing/resuming the same
                # remote task, fail before the Graph can reach a success terminal.
                yield event
                raise ${failureClass}(
                    ${toPyStr(`Remote A2A interactive handoff required; ${failureContext}; cause=`)}
                    + f"remote task non-success state={task_state}"
                )
            if task_state not in {"submitted", "working"} and self._has_usable_result(event):
                usable_result_seen = True
            yield event
        if not usable_result_seen:
            raise ${failureClass}(${toPyStr(`Remote A2A failed closed; ${failureContext}; cause=remote stream ended without a usable result`)})


${nodeSymbol(target)} = ${guardClass}(
    name=${toPyStr(pyNodeName(target))},
    description=${toPyStr(truncate(description))},
    agent_card=${toPyStr(url)},
${timeoutLine}${configLine}    use_legacy=False,
)`;
}

export function assertRemoteA2aSupported({ analysisResult, assets }) {
  const bad = [];
  for (const asset of assets) {
    if (asset.asset_type !== "agent" || asset.binding?.kind !== "a2a") continue;
    const contract = a2aContractForAsset(analysisResult, asset);
    if (!contract) bad.push(`${asset.asset_id} (no A2A contract)`);
    else if (!a2aAgentCardUrl(contract)) {
      bad.push(`${asset.asset_id} (contract ${contract.contract_id} has no agent_card.agent_card_url)`);
    } else {
      const policyIssues = a2aRuntimePolicyIssues(contract.adk_runtime_policy);
      if (policyIssues.length > 0) {
        bad.push(`${asset.asset_id} (contract ${contract.contract_id} adk_runtime_policy: ${policyIssues.join(", ")})`);
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

function firstInterfaceUrl(contract) {
  const interfaces = Array.isArray(contract?.supported_interfaces) ? contract.supported_interfaces : [];
  for (const entry of interfaces) {
    if (typeof entry?.url === "string" && entry.url.trim()) return entry.url.trim();
  }
  return null;
}

function firstString(values) {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
}

function stringArray(value) {
  return Array.isArray(value) ? value.filter((entry) => typeof entry === "string" && entry.trim()).map((entry) => entry.trim()) : [];
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
