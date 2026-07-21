import yaml from "js-yaml";
import agentsYaml from "../../../../catalog/agents.yaml?raw";
import toolsYaml from "../../../../catalog/tools.yaml?raw";
import workflowsYaml from "../../../../catalog/workflows.yaml?raw";
import { parseCatalogIndexPayload } from "./catalogIndex";
import { catalogIndexToScaffoldCatalog } from "./scaffoldCatalog";
import type { CatalogEntry } from "./types";

export function loadSeedCatalog(): CatalogEntry[] {
  return catalogIndexToScaffoldCatalog(
    parseCatalogIndexPayload({
      agents: yaml.load(agentsYaml),
      workflows: yaml.load(workflowsYaml),
      tools: yaml.load(toolsYaml)
    })
  );
}
