import { readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { load as parseYaml } from "js-yaml";
import { parseCatalogIndexPayload } from "../src/catalog/catalogIndex";
import { catalogIndexToScaffoldCatalog } from "../src/catalog/scaffoldCatalog";
import type { CatalogEntry } from "../src/catalog/types";

export async function loadServerScaffoldCatalog(repoRoot: string): Promise<CatalogEntry[]> {
  const catalogDir = resolve(repoRoot, "catalog");
  const [agents, workflows, tools] = await Promise.all([
    readCanonicalDocument(join(catalogDir, "agents.yaml")),
    readCanonicalDocument(join(catalogDir, "workflows.yaml")),
    readCanonicalDocument(join(catalogDir, "tools.yaml"))
  ]);
  return catalogIndexToScaffoldCatalog(parseCatalogIndexPayload({ agents, workflows, tools }));
}

async function readCanonicalDocument(path: string): Promise<unknown> {
  const text = await readFile(path, "utf8");
  return parseYaml(text);
}
