import { REGISTRY_PROJECTION_TEMPLATE } from "./registry-projection-compatibility.mjs";

export function registryProjectionTemplateAgreementIssues({ nodes, modules }) {
  if (!Array.isArray(nodes) || !Array.isArray(modules)) return [];
  const scaffoldByModuleId = new Map(
    modules
      .filter((module) => module && typeof module.id === "string")
      .map((module) => [module.id, module])
  );
  const issues = [];
  for (const node of nodes) {
    if (!node || typeof node.module_id !== "string") continue;
    const graphSelector = node.adk_skeleton_contract?.implementation_template;
    const nodeLabel = typeof node.id === "string" ? node.id : "unknown node";
    const module = scaffoldByModuleId.get(node.module_id);
    if (!module) {
      if (graphSelector === REGISTRY_PROJECTION_TEMPLATE) {
        issues.push(
          `Graph IR selector ${JSON.stringify(graphSelector)} for module ${node.module_id} at ${nodeLabel} has no matching scaffold module.`
        );
      }
      continue;
    }
    const scaffoldSelector = module.adk_skeleton_contract?.implementation_template;
    const graphHasRegistryProjection = graphSelector === REGISTRY_PROJECTION_TEMPLATE;
    const scaffoldHasRegistryProjection = scaffoldSelector === REGISTRY_PROJECTION_TEMPLATE;
    if (graphHasRegistryProjection === scaffoldHasRegistryProjection) continue;
    if (graphHasRegistryProjection) {
      issues.push(
        `Graph IR selector ${JSON.stringify(graphSelector)} for module ${node.module_id} at ${nodeLabel} is not preserved in scaffold module (found ${JSON.stringify(scaffoldSelector ?? null)}).`
      );
    }
    if (scaffoldHasRegistryProjection) {
      issues.push(
        `scaffold selector ${JSON.stringify(scaffoldSelector)} for module ${node.module_id} has no matching Graph IR approval at ${nodeLabel} (found ${JSON.stringify(graphSelector ?? null)}).`
      );
    }
  }
  const graphModuleIds = new Set(
    nodes
      .filter((node) => node && typeof node.module_id === "string")
      .map((node) => node.module_id)
  );
  for (const module of modules) {
    if (!module || typeof module.id !== "string") continue;
    const scaffoldSelector = module.adk_skeleton_contract?.implementation_template;
    if (scaffoldSelector !== REGISTRY_PROJECTION_TEMPLATE || graphModuleIds.has(module.id)) continue;
    issues.push(
      `scaffold selector ${JSON.stringify(scaffoldSelector)} for module ${module.id} has no matching Graph IR node.`
    );
  }
  return issues;
}
