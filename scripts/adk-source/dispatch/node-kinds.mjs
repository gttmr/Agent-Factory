import { emitRemoteA2aNode } from "../remote-a2a.mjs";
import {
  funcName,
  hitlFuncName,
  nodeFunctionName,
  nodeSymbol,
  pyGraphNodeName,
  pyNodeName,
  routeFuncName,
  stateKey,
  syntheticNodeSymbol,
  terminalFuncName
} from "../naming.mjs";
import { toPyStr } from "../python-literals.mjs";
import { assetLoweringRole, emitAgentNode } from "../emitters/agent-node.mjs";
import { emitConnectedToolFunc } from "../emitters/connected-tool.mjs";
import { emitFunctionNodeDecl, emitStubFunc } from "../emitters/function-node.mjs";
import { emitHumanInputFunc, emitHumanInputNodeDecl } from "../emitters/hitl.mjs";
import { emitRouteFunc, emitRouteNodeDecl } from "../emitters/route-function.mjs";
import { emitTerminalOutputFunc, emitTerminalOutputNodeDecl } from "../emitters/terminal-output.mjs";

const ASSET_EMISSION_HANDLERS = Object.freeze({
  agent: Object.freeze({ emitFunc: () => null, emitDecl: (target, context) => emitAgentNode(target, context) }),
  connected_tool: Object.freeze({
    emitFunc: (target, context) => emitConnectedToolFunc(target, context),
    emitDecl: emitFunctionNodeDecl
  }),
  stub_function: Object.freeze({
    emitFunc: (target, context) => emitStubFunc(target, context),
    emitDecl: emitFunctionNodeDecl
  }),
  a2a_agent: Object.freeze({
    emitFunc: () => null,
    emitDecl: (target, context) => emitRemoteA2aNode({ analysisResult: context.analysisResult, target })
  })
});

const ALL_MODES = Object.freeze({
  smoke: assetCapability,
  static: staticAssetCapability,
  dynamic: assetCapability
});

export const NODE_KIND_HANDLERS = Object.freeze({
  input: syntheticHandler({
    collectionRole: "input",
    planRole: "seed",
    modes: {
      smoke: supportedMode,
      static: supportedMode,
      dynamic: supportedMode
    },
    resolveEndpoint: ({ mode, side }) => (side === "from" && mode !== "dynamic" ? "START" : null)
  }),
  output: syntheticHandler({
    collectionRole: "terminal",
    collectionBucket: "terminalOutputNodes",
    featureFlags: ["terminal_outputs"],
    planRole: "terminal",
    modes: {
      smoke: supportedMode,
      static: supportedMode,
      dynamic: supportedMode
    },
    resolveEndpoint: ({ mode, node, side }) => {
      if (mode === "smoke") return side === "to" ? "emit_workflow_result" : null;
      if (mode === "static") return side === "to" ? syntheticNodeSymbol(node) : null;
      return side === "run" ? syntheticNodeSymbol(node) : null;
    },
    collisionTargets: terminalCollisionTargets,
    emission: terminalEmission
  }),
  agent: assetHandler(),
  function: syntheticHandler({
    collectionRole: "function",
    collectionBucket: "functionNodes",
    featureFlags: ["functions"],
    planRole: "run",
    modes: { smoke: supportedMode, static: supportedMode, dynamic: supportedMode },
    resolveEndpoint: syntheticRunnableEndpoint,
    collisionTargets: functionCollisionTargets,
    emission: functionEmission
  }),
  tool: assetHandler(),
  human_input: syntheticHandler({
    collectionRole: "human_input",
    collectionBucket: "humanInputNodes",
    featureFlags: ["human_inputs"],
    planRole: "run",
    modes: {
      smoke: unsupportedMode("smoke mode has no human_input runtime endpoint"),
      static: humanInputCapability,
      dynamic: humanInputCapability
    },
    resolveEndpoint: syntheticRunnableEndpoint,
    collisionTargets: humanInputCollisionTargets,
    emission: humanInputEmission
  }),
  subworkflow: assetHandler({ forcesDynamic: ({ asset }) => asset?.workflow_profile?.representation === "dynamic" }),
  join: syntheticHandler({
    collectionRole: "join",
    collectionBucket: "explicitJoinNodes",
    planRole: "join",
    modes: {
      smoke: unsupportedMode("smoke mode has no join barrier endpoint"),
      static: supportedMode,
      dynamic: supportedMode
    },
    resolveEndpoint: ({ mode, node }) => (mode === "static" ? syntheticNodeSymbol(node) : null),
    collisionTargets: joinCollisionTargets
  }),
});

function assetHandler({ featureFlags = [], forcesDynamic = () => false } = {}) {
  return Object.freeze({
    assetBinding: "required",
    collectionRole: "asset",
    collectionBucket: "assetSpecsInDeclarationOrder",
    featureFlags: Object.freeze(featureFlags),
    planRole: "run",
    modes: ALL_MODES,
    forcesDynamic,
    resolveEndpoint: assetEndpoint,
    runtimeName: ({ target }) => pyNodeName(target),
    collisionTargets: assetCollisionTargets,
    emission: assetEmission
  });
}

function syntheticHandler({
  collectionRole,
  collectionBucket = null,
  featureFlags = [],
  planRole = null,
  modes,
  forcesDynamic = () => false,
  resolveEndpoint = () => null,
  collisionTargets = () => [],
  emission = null
}) {
  return Object.freeze({
    assetBinding: "forbidden",
    collectionRole,
    collectionBucket,
    featureFlags: Object.freeze(featureFlags),
    planRole,
    modes: Object.freeze(modes),
    forcesDynamic,
    resolveEndpoint,
    runtimeName: ({ node }) => pyGraphNodeName(node),
    collisionTargets,
    emission
  });
}

function supportedMode({ node, asset }) {
  if (asset) return unsupported("synthetic node must not bind to an asset", "asset_binding");
  if (!node) return unsupported("node record is missing", "node_shape");
  return supported();
}

function assetCapability({ node, asset }) {
  if (!node) return unsupported("node record is missing", "node_shape");
  if (!asset) return unsupported(`${node.node_kind} requires a reviewed Target asset ref`, "asset_binding");
  return supported();
}

function staticAssetCapability(context) {
  const capability = assetCapability(context);
  if (!capability.supported) return capability;
  if (context.asset.asset_type === "workflow" && context.asset.workflow_profile?.representation === "dynamic") {
    return unsupported("dynamic Workflow assets require dynamic runnable mode", "dynamic_workflow");
  }
  return capability;
}

function humanInputCapability(context) {
  const capability = supportedMode(context);
  if (!capability.supported) return capability;
  const responseSchemaRef = context.node.human_input_contract?.response_schema_ref;
  if (responseSchemaRef !== undefined && responseSchemaRef !== null && responseSchemaRef !== "str") {
    return unsupported(
      `structured human_input response schema ${responseSchemaRef} is not lowerable; use response_schema_ref "str"`,
      "structured_human_input"
    );
  }
  return capability;
}

function unsupportedMode(reason) {
  return () => unsupported(reason, "unsupported_mode");
}

function supported() {
  return Object.freeze({ supported: true, reason: null, code: null });
}

function unsupported(reason, code) {
  return Object.freeze({ supported: false, reason, code });
}

function assetEndpoint({ mode, side, target, exclusions }) {
  const assetId = target.asset.asset_id;
  const nodeId = target.node.id;
  if (exclusions?.has(assetId) || exclusions?.has(nodeId)) return null;
  if (mode === "smoke") return nodeFunctionName(target);
  if (mode === "static" || (mode === "dynamic" && side === "run")) return nodeSymbol(target);
  return null;
}

function syntheticRunnableEndpoint({ mode, node, side }) {
  if (mode === "static") return syntheticNodeSymbol(node);
  if (mode === "dynamic" && side === "run") return syntheticNodeSymbol(node);
  return null;
}

function assetCollisionTargets(target, { seenAssetIds }) {
  const owner = target.node?.id ?? target.asset.asset_id;
  const rows = [
    collisionTarget(owner, [
      ["node symbol", nodeSymbol(target)],
      ["function name", funcName(target)],
      ["node name", pyNodeName(target)]
    ])
  ];
  if (!seenAssetIds.has(target.asset.asset_id)) {
    seenAssetIds.add(target.asset.asset_id);
    rows.push(collisionTarget(target.asset.asset_id, [["state key", stateKey(target.asset)]]));
  }
  return rows;
}

function humanInputCollisionTargets(node) {
  return [
    collisionTarget(node.id, [
      ["node symbol", syntheticNodeSymbol(node)],
      ["function name", hitlFuncName(node)],
      ["node name", pyGraphNodeName(node)]
    ])
  ];
}

function functionCollisionTargets(node) {
  if (node.role === "route") return routeCollisionTargets(node);
  return [
    collisionTarget(node.id, [
      ["node symbol", syntheticNodeSymbol(node)],
      ["function name", `_function_${node.id}`],
      ["node name", pyGraphNodeName(node)]
    ])
  ];
}

function routeCollisionTargets(node) {
  return [
    collisionTarget(node.id, [
      ["node symbol", syntheticNodeSymbol(node)],
      ["function name", routeFuncName(node)],
      ["node name", pyGraphNodeName(node)]
    ])
  ];
}

function terminalCollisionTargets(node) {
  return [
    collisionTarget(node.id, [
      ["node symbol", syntheticNodeSymbol(node)],
      ["function name", terminalFuncName(node)],
      ["node name", pyGraphNodeName(node)]
    ])
  ];
}

function joinCollisionTargets(node) {
  return [collisionTarget(node.id, [["node symbol", syntheticNodeSymbol(node)], ["node name", pyGraphNodeName(node)]])];
}

export function syntheticJoinCollisionTarget(join) {
  return collisionTarget(join.sym, [["node symbol", join.sym], ["node name", join.name]]);
}

function collisionTarget(owner, symbols) {
  return Object.freeze({ owner, symbols: Object.freeze(symbols.map((row) => Object.freeze(row))) });
}

function assetEmission(target, context) {
  const role = assetLoweringRole(target);
  const handler = ASSET_EMISSION_HANDLERS[role];
  if (!handler) throw new Error(`runnable codegen: no asset-lowering handler for role "${role}".`);
  return emissionResult(handler.emitFunc(target, context), handler.emitDecl(target, context));
}

function functionEmission(node, context) {
  if (node.role === "route") return routeEmission(node, context);
  const functionName = `_function_${node.id.replaceAll(/[^A-Za-z0-9_]/g, "_")}`;
  return emissionResult(
    `async def ${functionName}(ctx: Context, node_input=None):\n    return _json_safe_node_value(node_input)`,
    `${syntheticNodeSymbol(node)} = FunctionNode(func=${functionName}, name=${toPyStr(pyGraphNodeName(node))})`
  );
}

function humanInputEmission(node, context) {
  return emissionResult(emitHumanInputFunc(node, context), emitHumanInputNodeDecl(node));
}

function routeEmission(node, context) {
  return emissionResult(emitRouteFunc(node, context), emitRouteNodeDecl(node));
}

function terminalEmission(node) {
  return emissionResult(emitTerminalOutputFunc(node), emitTerminalOutputNodeDecl(node));
}

function emissionResult(func, decl) {
  return Object.freeze({ func, decl });
}
