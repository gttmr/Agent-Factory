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

export function mergedRouteCasesFor(processFlow, nodeId) {
  return mergeRouteCasesByTarget(routeCasesFor(processFlow, nodeId), (routeCase) => routeCase.to);
}

export function mergeRouteCasesByTarget(routeCases, targetFor = (routeCase) => routeCase.target) {
  const groups = [];
  const groupsByTarget = new Map();
  for (const routeCase of Array.isArray(routeCases) ? routeCases : []) {
    const target = targetFor(routeCase);
    let group = groupsByTarget.get(target);
    if (!group) {
      group = { target, cases: [] };
      groupsByTarget.set(target, group);
      groups.push(group);
    }
    group.cases.push(routeCase);
  }
  return groups.map(({ target, cases }) => {
    const first = cases[0];
    const values = [...new Set(cases.map((routeCase) => routeCase.value))].sort();
    return {
      ...first,
      value: canonicalMergedRouteKey(values),
      aliases: [...new Set(cases.flatMap((routeCase) => routeCase.aliases ?? []))],
      isDefault: cases.some((routeCase) => routeCase.isDefault === true),
      target,
      cases
    };
  });
}

function canonicalMergedRouteKey(values) {
  // routeValue excludes "|", so sorted joining is deterministic and cannot
  // collide with a single reviewed route value.
  return values.join("|");
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
