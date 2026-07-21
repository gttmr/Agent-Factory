import { toPythonIdentifier } from "../naming.mjs";

export function usesRoutes(graph) {
  return (Array.isArray(graph.edges) ? graph.edges : []).some((edge) => edge?.control?.kind === "condition");
}

export function routeCasesFor(graph, nodeId) {
  const routes = [];
  const seen = new Set();
  for (const edge of Array.isArray(graph.edges) ? graph.edges : []) {
    if (edge?.control?.kind !== "condition" || edge.from !== nodeId) continue;
    const value = routeValue(edge);
    if (seen.has(value)) continue;
    seen.add(value);
    routes.push({
      value,
      aliases: routeAliases(value, edge),
      isDefault: edge.control.default === true,
      stateKey: edge.channel === "state" ? edge.id : null,
      to: typeof edge.to === "string" ? edge.to : null
    });
  }
  return routes;
}

export function mergedRouteCasesFor(graph, nodeId) {
  return mergeRouteCasesByTarget(routeCasesFor(graph, nodeId), (routeCase) => routeCase.to);
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
  const condition = typeof edge?.control?.condition === "string" ? edge.control.condition.trim() : "";
  const match = /(?:choice|route|decision)\s*==\s*["']?([A-Za-z0-9_-]+)["']?/i.exec(condition);
  if (match) return match[1];
  if (/^[A-Za-z0-9_-]+$/.test(condition)) return condition;
  return toPythonIdentifier(condition || edge?.id || "route").toLowerCase();
}

export function routeAliases(value, edge = null) {
  const normalized = String(value).trim().toLowerCase();
  const aliases = new Set([normalized, normalized.replace(/_/g, " "), normalized.replace(/_/g, "-")]);
  for (const alias of Array.isArray(edge?.control?.accepted_aliases) ? edge.control.accepted_aliases : []) {
    if (typeof alias === "string" && alias.trim()) aliases.add(alias.trim().toLowerCase());
  }
  return [...aliases].filter(Boolean);
}
