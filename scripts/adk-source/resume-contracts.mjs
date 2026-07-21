import { routeValue } from "./graph/routes.mjs";
import { toPythonLiteral } from "./python-literals.mjs";

export function approvedAsyncResumeContracts(context) {
  const contracts = context?.scaffoldPlan?.runtime_contracts ?? context?.analysisResult?.runtimeContracts ?? [];
  return contracts.filter(
    (contract) => contract?.contract_kind === "async_resume" && contract?.contract_status === "approved"
  );
}

export function usesAsyncResumeRuntime(context) {
  return approvedAsyncResumeContracts(context).length > 0;
}

export function asyncResumeContractForHumanNode(context, node) {
  return uniqueMatch(
    approvedAsyncResumeContracts(context).filter(
      (contract) => contract.graph_ir_annotations?.human_input_node_id === node?.id
    ),
    `Human Input Node ${node?.id ?? "missing"}`
  );
}

export function asyncResumeContractForToolTarget(context, target) {
  const node = target?.node ?? null;
  const asset = target?.asset ?? target;
  if (!node || asset?.asset_type !== "tool") return null;
  return uniqueMatch(
    approvedAsyncResumeContracts(context).filter(
      (contract) =>
        contract.side_effect_guard?.tool_ref === asset.asset_id &&
        contract.graph_ir_annotations?.side_effect_tool_node_id === node.id
    ),
    `side-effect Tool Node ${node.id}`
  );
}

export function assertAsyncResumeSupported(context) {
  const contracts = approvedAsyncResumeContracts(context);
  if (!contracts.length) return;
  const nodes = new Map((context.graph?.nodes ?? []).map((node) => [node.id, node]));
  const assets = new Map((context.assets ?? []).map((asset) => [asset.asset_id, asset]));
  const interruptOwners = new Map();
  const humanOwners = new Map();
  const toolNodeOwners = new Map();

  for (const contract of contracts) {
    const label = `approved async_resume contract ${contract.contract_id}`;
    const policy = contract.resume_policy;
    if (!policy || typeof policy.interrupt_id !== "string" || !policy.interrupt_id.trim()) {
      throw new Error(`${label} requires a typed resume_policy with a stable interrupt_id.`);
    }
    if (interruptOwners.has(policy.interrupt_id)) {
      throw new Error(
        `${label} duplicates interrupt_id ${policy.interrupt_id} from ${interruptOwners.get(policy.interrupt_id)}.`
      );
    }
    interruptOwners.set(policy.interrupt_id, contract.contract_id);

    if (contract.runtime_support?.human_approval_required === true) {
      const humanNodeId = contract.graph_ir_annotations?.human_input_node_id;
      const humanNode = nodes.get(humanNodeId);
      if (humanNode?.node_kind !== "human_input") {
        throw new Error(`${label} human_input_node_id must reference a Human Input Node.`);
      }
      if (humanOwners.has(humanNodeId)) {
        throw new Error(`${label} duplicates Human Input ownership from ${humanOwners.get(humanNodeId)}.`);
      }
      humanOwners.set(humanNodeId, contract.contract_id);
    }

    const guard = contract.side_effect_guard;
    if (contract.runtime_support?.idempotency_required === true && !guard) {
      throw new Error(`${label} requires side_effect_guard when idempotency_required is true.`);
    }
    if (!guard) continue;

    const toolNodeId = contract.graph_ir_annotations?.side_effect_tool_node_id;
    const toolNode = nodes.get(toolNodeId);
    const tool = assets.get(guard.tool_ref);
    if (toolNode?.node_kind !== "tool" || toolNode.tool_ref !== guard.tool_ref) {
      throw new Error(`${label} side_effect_tool_node_id must reference the guarded Tool Node.`);
    }
    if (toolNodeOwners.has(toolNodeId)) {
      throw new Error(`${label} duplicates side-effect Tool ownership from ${toolNodeOwners.get(toolNodeId)}.`);
    }
    toolNodeOwners.set(toolNodeId, contract.contract_id);
    if (tool?.asset_type !== "tool" || tool.binding?.kind !== "function" || tool.connection?.transport !== "in_process") {
      throw new Error(`${label} can lower at-most-once behavior only for a reviewed function/in_process Tool.`);
    }
    if (!(tool.inputs ?? []).some((input) => input?.name === guard.idempotency_key_input)) {
      throw new Error(`${label} idempotency_key_input must reference a reviewed Tool input.`);
    }
    assertFailClosedSideEffectRoute({ contract, nodes, graph: context.graph, toolNodeId, label });
  }
}

export function buildAsyncResumeWorkflowSupport(context) {
  const contracts = approvedAsyncResumeContracts(context);
  if (!contracts.length) return "";
  const registry = Object.fromEntries(
    contracts.map((contract) => [
      contract.resume_policy.interrupt_id,
      {
        contract_id: contract.contract_id,
        conflicting_response: contract.resume_policy.conflicting_response,
        duplicate_response: contract.resume_policy.duplicate_response
      }
    ])
  );
  return `

# Approved async-resume replay policies. Session state is the reviewed ledger
# boundary; no external side effect is inferred or executed here.
ASYNC_RESUME_POLICIES = ${toPythonLiteral(registry)}


def _resume_response_fingerprint(value: Any) -> str:
    return json.dumps(_json_safe_node_value(value), ensure_ascii=False, sort_keys=True, separators=(",", ":"))


def _validate_async_resume_replay(ctx: Context) -> None:
    active_interrupt_ids = set()
    for registered_interrupt_id, registered_policy in ASYNC_RESUME_POLICIES.items():
        registered_key = f"af_resume_record:{registered_policy['contract_id']}:{ctx.invocation_id}"
        if isinstance(ctx.state.get(registered_key), dict):
            active_interrupt_ids.add(registered_interrupt_id)
    unknown_interrupt_ids = set((ctx.resume_inputs or {}).keys()) - set(ASYNC_RESUME_POLICIES.keys())
    if active_interrupt_ids and unknown_interrupt_ids:
        raise RuntimeError(
            f"Unexpected resume interrupt IDs {sorted(unknown_interrupt_ids)}; expected one of {sorted(active_interrupt_ids)}."
        )
    for interrupt_id, raw_response in (ctx.resume_inputs or {}).items():
        policy = ASYNC_RESUME_POLICIES.get(interrupt_id)
        if not policy:
            continue
        state_key = f"af_resume_record:{policy['contract_id']}:{ctx.invocation_id}"
        record = ctx.state.get(state_key)
        if not isinstance(record, dict) or record.get("status") == "pending":
            continue
        incoming = _resume_input_value(raw_response)
        incoming_fingerprint = _resume_response_fingerprint(incoming)
        if incoming_fingerprint != record.get("response_fingerprint"):
            raise RuntimeError(
                f"{policy['contract_id']}: conflicting response rejected for interrupt_id={interrupt_id}."
            )


class _AsyncResumeWorkflow(Workflow):
    async def _run_impl(self, *, ctx: Context, node_input):
        _validate_async_resume_replay(ctx)
        async for event in super()._run_impl(ctx=ctx, node_input=node_input):
            yield event
`;
}

export function asyncResumeRootClass(context) {
  return usesAsyncResumeRuntime(context) ? "_AsyncResumeWorkflow" : "Workflow";
}

function assertFailClosedSideEffectRoute({ contract, nodes, graph, toolNodeId, label }) {
  const routeNodeId = contract.graph_ir_annotations?.resume_entry_node_id;
  const routeNode = nodes.get(routeNodeId);
  if (routeNode?.node_kind !== "function" || routeNode.role !== "route") {
    throw new Error(`${label} resume_entry_node_id must reference the reviewed route Function Node.`);
  }
  const routeEdges = (graph?.edges ?? []).filter(
    (edge) => edge?.from === routeNodeId && edge?.control?.kind === "condition"
  );
  const guardedEdge = routeEdges.find((edge) => edge.to === toolNodeId);
  if (!guardedEdge || guardedEdge.control?.default === true) {
    throw new Error(`${label} guarded Tool route must be explicit and must not be the default branch.`);
  }
  const defaultEdge = routeEdges.find((edge) => edge.control?.default === true && edge.to !== toolNodeId);
  if (!defaultEdge) {
    throw new Error(`${label} requires a non-side-effect default route for reject, invalid, and timeout outcomes.`);
  }
  const humanNode = nodes.get(contract.graph_ir_annotations?.human_input_node_id);
  const defaultChoice = humanNode?.human_input_contract?.default_choice;
  const mappedDefault = humanNode?.human_input_contract?.response_mapping?.[defaultChoice] ?? defaultChoice;
  if (mappedDefault && routeValue(guardedEdge) === mappedDefault) {
    throw new Error(`${label} Human Input default_choice must not select the guarded Tool route.`);
  }
}

function uniqueMatch(matches, label) {
  if (matches.length > 1) throw new Error(`${label} is covered by multiple approved async_resume contracts.`);
  return matches[0] ?? null;
}
