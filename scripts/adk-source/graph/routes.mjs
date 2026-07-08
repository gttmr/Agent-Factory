import { toPythonIdentifier } from "../naming.mjs";

export function usesRoutes(processFlow) {
  return (Array.isArray(processFlow.edges) ? processFlow.edges : []).some((edge) => edge?.edge_kind === "route");
}

export function routeCasesFor(processFlow, nodeId) {
  const routes = [];
  const seen = new Set();
  for (const edge of Array.isArray(processFlow.edges) ? processFlow.edges : []) {
    if (edge?.edge_kind !== "route" || edge.from !== nodeId) continue;
    const value = routeValue(edge);
    if (seen.has(value)) continue;
    seen.add(value);
    routes.push({
      value,
      aliases: routeAliases(value, edge),
      isDefault: edge.is_default_route === true,
      stateKey: typeof edge.state_key === "string" && edge.state_key.trim() ? edge.state_key.trim() : null,
      to: typeof edge.to === "string" ? edge.to : null
    });
  }
  return routes;
}

export function routeValue(edge) {
  const condition = typeof edge?.route_condition === "string" ? edge.route_condition.trim() : "";
  const match = /(?:choice|route|decision)\s*==\s*["']?([A-Za-z0-9_-]+)["']?/i.exec(condition);
  if (match) return match[1];
  if (/^[A-Za-z0-9_-]+$/.test(condition)) return condition;
  return toPythonIdentifier(condition || edge?.id || "route").toLowerCase();
}

export function routeAliases(value, edge = null) {
  const normalized = String(value).trim().toLowerCase();
  const aliases = new Set([normalized, normalized.replace(/_/g, " "), normalized.replace(/_/g, "-")]);
  for (const alias of Array.isArray(edge?.route_aliases) ? edge.route_aliases : []) {
    if (typeof alias === "string" && alias.trim()) aliases.add(alias.trim().toLowerCase());
  }
  return [...aliases].filter(Boolean);
}
