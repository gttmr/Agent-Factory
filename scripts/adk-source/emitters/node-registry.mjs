import { emitRemoteA2aNode } from "../remote-a2a.mjs";
import { emitAgentNode, moduleLoweringRole } from "./agent-node.mjs";
import { emitConnectedAdapterFunc } from "./connected-adapter.mjs";
import { emitFunctionNodeDecl, emitStubFunc } from "./function-node.mjs";
import { emitHumanInputFunc, emitHumanInputNodeDecl } from "./hitl.mjs";
import { emitRouteFunc, emitRouterNodeDecl } from "./router.mjs";

export function emitRunnableNodeBlocks(context, { orderedModules, humanInputNodes, routerNodes }) {
  const nodeBlocks = [];
  const funcBlocks = [];

  // Node lowering registry: maps a node's lowering role to its function/
  // declaration emitters, replacing the per-role if/elif chain. Adding a node
  // kind (e.g. a future remote_a2a or dynamic node) adds a registry entry here —
  // though it may also need import, guard (assertRunnableGraphSupported), and
  // graph-resolution support, so this is the emission seam, not the whole story.
  // emitFunc returns null when the node needs no standalone function (LlmAgent
  // agents are declared inline). Emission order — module nodes in graph order,
  // then human-input nodes — is preserved.
  const NODE_LOWERING = {
    agent: { emitFunc: () => null, emitDecl: (module) => emitAgentNode(module, context) },
    connected_adapter: {
      emitFunc: (module) => emitConnectedAdapterFunc(module, context),
      emitDecl: emitFunctionNodeDecl
    },
    stub_function: { emitFunc: (module) => emitStubFunc(module, context), emitDecl: emitFunctionNodeDecl },
    human_input: { emitFunc: (node) => emitHumanInputFunc(node, context), emitDecl: emitHumanInputNodeDecl },
    router: { emitFunc: (node) => emitRouteFunc(node, context), emitDecl: emitRouterNodeDecl },
    remote_a2a: {
      emitFunc: () => null,
      emitDecl: (module) => emitRemoteA2aNode({ analysisResult: context.analysisResult, module })
    }
  };
  const emitNode = (role, target) => {
    const handler = NODE_LOWERING[role];
    if (!handler) throw new Error(`runnable codegen: no node-lowering handler for role "${role}".`);
    const func = handler.emitFunc(target);
    if (func) funcBlocks.push(func);
    nodeBlocks.push(handler.emitDecl(target));
  };

  for (const module of orderedModules) emitNode(moduleLoweringRole(module), module);
  for (const node of humanInputNodes) emitNode("human_input", node);
  for (const node of routerNodes) emitNode("router", node);

  return { nodeBlocks, funcBlocks };
}
