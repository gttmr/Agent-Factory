import type { ModuleType } from "./types";

export const moduleTypeLabels: Record<ModuleType, string> = {
  tool_adapter: "tool_adapter",
  knowledge_retrieval: "knowledge_retrieval",
  internal_workflow: "internal_workflow",
  specialist_agent: "specialist_agent",
  shared_agent: "shared_agent",
  metadata_registry: "metadata_registry",
  remote_a2a_contract: "remote_a2a_contract"
};

export const classificationRules: Record<ModuleType, string> = {
  tool_adapter:
    "Use for deterministic integration, lookup, calculation, validation, parsing, transformation, or storage.",
  knowledge_retrieval:
    "Use for search or summarization over documents, policies, FAQs, manuals, procedures, contracts, regulations, or other knowledge sources.",
  internal_workflow:
    "Use for ordered steps, checklists, handoffs, or fan-out/fan-in inside one boundary.",
  specialist_agent:
    "Use for a narrow domain responsibility that combines tools, maintains context, and produces judgment or recommendations.",
  shared_agent:
    "Use when multiple specialists need the same higher-level capability with its own lifecycle, policy, or owner.",
  metadata_registry:
    "Use for structured architecture or operating metadata such as routing tables, ownership maps, schema catalogs, capability catalogs, registries, risk rules, or thresholds.",
  remote_a2a_contract:
    "Use only for interaction with an independently owned, independently deployed, or independently governed remote agent boundary."
};
