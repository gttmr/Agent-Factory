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
import { emitAgentNode, moduleLoweringRole } from "../emitters/agent-node.mjs";
import { emitConnectedAdapterFunc } from "../emitters/connected-adapter.mjs";
import { emitFunctionNodeDecl, emitStubFunc } from "../emitters/function-node.mjs";
import { emitHumanInputFunc, emitHumanInputNodeDecl } from "../emitters/hitl.mjs";
import { emitRouteFunc, emitRouterNodeDecl } from "../emitters/router.mjs";
import { emitTerminalOutputFunc, emitTerminalOutputNodeDecl } from "../emitters/terminal-output.mjs";

const MODULE_EMISSION_HANDLERS = Object.freeze({
  agent: Object.freeze({ emitFunc: () => null, emitDecl: (target, context) => emitAgentNode(target, context) }),
  connected_adapter: Object.freeze({
    emitFunc: (target, context) => emitConnectedAdapterFunc(target, context),
    emitDecl: emitFunctionNodeDecl
  }),
  stub_function: Object.freeze({
    emitFunc: (target, context) => emitStubFunc(target, context),
    emitDecl: emitFunctionNodeDecl
  }),
  remote_a2a: Object.freeze({
    emitFunc: () => null,
    emitDecl: (target, context) => emitRemoteA2aNode({ analysisResult: context.analysisResult, target })
  })
});

const ALL_MODES = Object.freeze({
  smoke: moduleCapability,
  static: staticModuleCapability,
  dynamic: moduleCapability
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
  agent: moduleHandler(),
  function: moduleHandler(),
  tool: moduleHandler(),
  adapter: moduleHandler(),
  adapter_call: moduleHandler(),
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
  callback_wait: syntheticHandler({
    collectionRole: "unsupported",
    modes: {
      smoke: unsupportedMode("smoke mode has no callback_wait runtime endpoint"),
      static: unsupportedMode("static runnable mode has no callback_wait lowerer"),
      dynamic: unsupportedMode("dynamic runnable mode has no callback_wait lowerer")
    }
  }),
  workflow: moduleHandler({ forcesDynamic: ({ module }) => module?.workflow_kind === "dynamic" }),
  workflow_call: moduleHandler(),
  remote_a2a: moduleHandler({ featureFlags: ["remote_a2a"] }),
  remote_agent_call: moduleHandler({ featureFlags: ["remote_a2a"] }),
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
  router: syntheticHandler({
    collectionRole: "router",
    collectionBucket: "routerNodes",
    featureFlags: ["routes"],
    planRole: "router",
    modes: {
      smoke: unsupportedMode("smoke mode has no router runtime endpoint"),
      static: supportedMode,
      dynamic: unsupportedMode("dynamic runnable mode has no conditional router lowerer")
    },
    resolveEndpoint: ({ mode, node }) => (mode === "static" ? syntheticNodeSymbol(node) : null),
    collisionTargets: routerCollisionTargets,
    emission: routerEmission
  }),
  loop_control: syntheticHandler({
    collectionRole: "loop_control",
    collectionBucket: "loopControlNodes",
    featureFlags: ["loops"],
    planRole: "loop_control",
    forcesDynamic: () => true,
    modes: {
      smoke: unsupportedMode("smoke mode has no loop_control runtime endpoint"),
      static: unsupportedMode("static runnable mode has no loop_control lowerer"),
      dynamic: supportedMode
    },
    resolveEndpoint: ({ mode, node, side }) => (mode === "dynamic" && side === "run" ? syntheticNodeSymbol(node) : null),
    collisionTargets: loopControlCollisionTargets,
    emission: loopControlEmission
  })
});

function moduleHandler({ featureFlags = [], forcesDynamic = () => false } = {}) {
  return Object.freeze({
    moduleBinding: "required",
    collectionRole: "module",
    collectionBucket: "moduleSpecsInDeclarationOrder",
    featureFlags: Object.freeze(featureFlags),
    planRole: "run",
    modes: ALL_MODES,
    forcesDynamic,
    resolveEndpoint: moduleEndpoint,
    runtimeName: ({ target }) => pyNodeName(target),
    collisionTargets: moduleCollisionTargets,
    emission: moduleEmission
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
    moduleBinding: "forbidden",
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

function supportedMode({ node, module }) {
  if (module) return unsupported("synthetic node must not bind to a module", "module_binding");
  if (!node) return unsupported("node record is missing", "node_shape");
  return supported();
}

function moduleCapability({ node, module }) {
  if (!node) return unsupported("node record is missing", "node_shape");
  if (!module) return unsupported(`${node.node_kind} requires a reviewed module_id`, "module_binding");
  return supported();
}

function staticModuleCapability(context) {
  const capability = moduleCapability(context);
  if (!capability.supported) return capability;
  if (context.module.module_category === "workflow" && context.module.workflow_kind === "dynamic") {
    return unsupported("dynamic workflow modules require dynamic runnable mode", "dynamic_workflow");
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

function moduleEndpoint({ mode, side, target, exclusions }) {
  const moduleId = target.module.id;
  const nodeId = target.node.id;
  if (exclusions?.has(moduleId) || exclusions?.has(nodeId)) return null;
  if (mode === "smoke") return nodeFunctionName(target);
  if (mode === "static" || (mode === "dynamic" && side === "run")) return nodeSymbol(target);
  return null;
}

function syntheticRunnableEndpoint({ mode, node, side }) {
  if (mode === "static") return syntheticNodeSymbol(node);
  if (mode === "dynamic" && side === "run") return syntheticNodeSymbol(node);
  return null;
}

function moduleCollisionTargets(target, { seenModuleIds }) {
  const owner = target.node?.id ?? target.module.id;
  const rows = [
    collisionTarget(owner, [
      ["node symbol", nodeSymbol(target)],
      ["function name", funcName(target)],
      ["node name", pyNodeName(target)]
    ])
  ];
  if (!seenModuleIds.has(target.module.id)) {
    seenModuleIds.add(target.module.id);
    rows.push(collisionTarget(target.module.id, [["state key", stateKey(target.module)]]));
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

function routerCollisionTargets(node) {
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

function loopControlCollisionTargets(node) {
  return [collisionTarget(node.id, [["node symbol", syntheticNodeSymbol(node)], ["node name", pyGraphNodeName(node)]])];
}

export function syntheticJoinCollisionTarget(join) {
  return collisionTarget(join.sym, [["node symbol", join.sym], ["node name", join.name]]);
}

function collisionTarget(owner, symbols) {
  return Object.freeze({ owner, symbols: Object.freeze(symbols.map((row) => Object.freeze(row))) });
}

function moduleEmission(target, context) {
  const role = moduleLoweringRole(target);
  const handler = MODULE_EMISSION_HANDLERS[role];
  if (!handler) throw new Error(`runnable codegen: no module-lowering handler for role "${role}".`);
  return emissionResult(handler.emitFunc(target, context), handler.emitDecl(target, context));
}

function humanInputEmission(node, context) {
  return emissionResult(emitHumanInputFunc(node, context), emitHumanInputNodeDecl(node));
}

function routerEmission(node, context) {
  return emissionResult(emitRouteFunc(node, context), emitRouterNodeDecl(node));
}

function terminalEmission(node) {
  return emissionResult(emitTerminalOutputFunc(node), emitTerminalOutputNodeDecl(node));
}

function loopControlEmission(node) {
  return emissionResult(
    null,
    `@node(name=${toPyStr(pyGraphNodeName(node))})\ndef ${syntheticNodeSymbol(node)}(node_input=None):\n    return node_input`,
    "loopControlBlocks"
  );
}

function emissionResult(func, decl, section = "nodeBlocks") {
  return Object.freeze({ func, decl, section });
}
