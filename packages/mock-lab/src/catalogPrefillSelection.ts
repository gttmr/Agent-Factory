import type { CatalogPrefillPayload, MockSpec } from "./types/mockSpec";

export function resolveCatalogPrefillSpec(catalog: CatalogPrefillPayload, adapterName: string | null | undefined): MockSpec | null {
  const name = adapterName?.trim();
  if (!name) return null;
  const entry = catalog.entries.find((candidate) => candidate.name === name);
  return entry ? cloneMockSpec(entry.prefill) : null;
}

function cloneMockSpec(spec: MockSpec): MockSpec {
  return JSON.parse(JSON.stringify(spec)) as MockSpec;
}
