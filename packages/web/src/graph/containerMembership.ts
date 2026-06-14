import type { GraphIR } from "../analyzer/types";

export function rootWorkflowContainerId(graphIR: GraphIR): string | null {
  const root = (graphIR.containers ?? []).find(
    (container) =>
      (container.container_kind === "graph_workflow" || container.container_kind === "dynamic_workflow") &&
      container.parent_container_id === null
  );
  return root?.id ?? null;
}

export function appendNodeToContainer(
  containers: GraphIR["containers"],
  containerId: string,
  nodeId: string
): GraphIR["containers"] {
  return containers.map((container) =>
    container.id === containerId
      ? {
          ...container,
          contains_node_ids: appendUnique(container.contains_node_ids, nodeId)
        }
      : container
  );
}

export function moveNodeToContainer(
  containers: GraphIR["containers"],
  nodeId: string,
  nextContainerId: string | null
): GraphIR["containers"] {
  return containers.map((container) => {
    const stripped = {
      ...container,
      contains_node_ids: container.contains_node_ids.filter((id) => id !== nodeId),
      entry_node_ids: container.entry_node_ids.filter((id) => id !== nodeId),
      exit_node_ids: container.exit_node_ids.filter((id) => id !== nodeId)
    };
    if (nextContainerId && container.id === nextContainerId) {
      return {
        ...stripped,
        contains_node_ids: appendUnique(stripped.contains_node_ids, nodeId)
      };
    }
    return stripped;
  });
}

function appendUnique(values: string[], value: string): string[] {
  return values.includes(value) ? values : [...values, value];
}
