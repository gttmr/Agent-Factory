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
    routes.push({ value, aliases: routeAliases(value) });
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

export function routeAliases(value) {
  const normalized = String(value).trim().toLowerCase();
  const aliases = new Set([normalized, normalized.replace(/_/g, " ")]);
  // LEGACY_ROUTE_ALIAS_COMPAT: existing route labels kept until Graph IR carries reviewed aliases.
  if (normalized === "run_analysis") {
    aliases.add("분석 실행");
    aliases.add("1");
  }
  if (normalized === "skip_analysis") {
    aliases.add("분석 없이 진행");
    aliases.add("2");
  }
  return [...aliases].filter(Boolean);
}
