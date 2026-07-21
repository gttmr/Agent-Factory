import { emissionForNode } from "../dispatch/index.mjs";

export function emitRunnableNodeBlocks(
  context,
  {
    mode,
    orderedNodeSpecs,
    functionNodes = [],
    humanInputNodes,
    routeNodes,
    terminalOutputNodes = []
  }
) {
  const nodeBlocks = [];
  const funcBlocks = [];
  const emitNode = (target) => {
    const emission = emissionForNode(target, { mode, context });
    if (emission.func) funcBlocks.push(emission.func);
    nodeBlocks.push(emission.decl);
  };

  for (const spec of orderedNodeSpecs) emitNode(spec);
  for (const node of functionNodes) emitNode(node);
  for (const node of humanInputNodes) emitNode(node);
  for (const node of routeNodes) emitNode(node);
  for (const node of terminalOutputNodes) emitNode(node);

  return { nodeBlocks, funcBlocks };
}
