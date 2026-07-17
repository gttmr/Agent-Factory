import { emissionForNode } from "../dispatch/index.mjs";

export function emitRunnableNodeBlocks(
  context,
  {
    mode,
    orderedNodeSpecs,
    humanInputNodes,
    routerNodes,
    terminalOutputNodes = [],
    loopControlNodes = []
  }
) {
  const nodeBlocks = [];
  const funcBlocks = [];
  const loopControlBlocks = [];
  const sections = { nodeBlocks, loopControlBlocks };
  const emitNode = (target) => {
    const emission = emissionForNode(target, { mode, context });
    if (emission.func) funcBlocks.push(emission.func);
    sections[emission.section].push(emission.decl);
  };

  for (const spec of orderedNodeSpecs) emitNode(spec);
  for (const node of humanInputNodes) emitNode(node);
  for (const node of routerNodes) emitNode(node);
  for (const node of terminalOutputNodes) emitNode(node);
  for (const node of loopControlNodes) emitNode(node);

  return { nodeBlocks, funcBlocks, loopControlBlocks };
}
