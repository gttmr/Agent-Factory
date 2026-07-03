export interface AnalyzeCatalogEntry {
  id?: string;
  name: string;
  module_category: "agent" | "workflow" | "adapter" | "remote_a2a";
  subtype?: string | null;
  [key: string]: unknown;
}
