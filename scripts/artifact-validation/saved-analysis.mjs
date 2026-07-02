import { existsSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { adapterKinds, agentKinds, categories, workflowKinds } from "./constants.mjs";
import { findJsonFiles, readJson } from "./files.mjs";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

export function validateSavedAnalysisFixtures({
  dir,
  root,
  errors,
  validateGraphIR,
  validateRuntimeContractObject,
  isMcpContract
}) {
  for (const path of findJsonFiles(dir)) {
    const record = readJson(path, errors);
    if (!isSavedAnalysisFixture(record)) continue;
    validateSavedAnalysisRecord({
      record,
      label: relative(root, path) || path,
      errors,
      validateGraphIR,
      validateRuntimeContractObject,
      isMcpContract
    });
  }
}

function isSavedAnalysisFixture(value) {
  return (
    value &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    typeof value.id === "string" &&
    typeof value.savedAt === "string" &&
    value.analysis &&
    typeof value.analysis === "object" &&
    Array.isArray(value.catalogEntries) &&
    typeof value.scaffoldReady === "boolean"
  );
}

function validateSavedAnalysisRecord({
  record,
  label,
  errors,
  validateGraphIR,
  validateRuntimeContractObject,
  isMcpContract
}) {
  const requiredStrings = ["id", "title", "savedAt", "analyzerModel", "activeStep"];
  for (const field of requiredStrings) {
    if (typeof record[field] !== "string" || !record[field].trim()) {
      errors.push(`${label}.${field} must be a non-empty string.`);
    }
  }
  if (!["intake", "analysis", "modules", "graph", "runtimeContracts", "a2aContracts", "catalog", "saved", "export"].includes(record.activeStep)) {
    errors.push(`${label}.activeStep is not a known workbench step.`);
  }
  if (!Array.isArray(record.acceptedMissing) || record.acceptedMissing.some((item) => typeof item !== "string")) {
    errors.push(`${label}.acceptedMissing must be an array of strings.`);
  }
  if (!record.input || typeof record.input !== "object" || typeof record.input.rawText !== "string") {
    errors.push(`${label}.input.rawText is required.`);
  }

  const analysis = record.analysis;
  if (!analysis || typeof analysis !== "object" || Array.isArray(analysis)) {
    errors.push(`${label}.analysis must be an object.`);
    return;
  }
  if (!analysis.normalizedRequirement || typeof analysis.normalizedRequirement !== "object") {
    errors.push(`${label}.analysis.normalizedRequirement is required.`);
  }
  if (!analysis.evidence || typeof analysis.evidence !== "object") {
    errors.push(`${label}.analysis.evidence is required.`);
  }
  if (!Array.isArray(analysis.moduleCandidates)) {
    errors.push(`${label}.analysis.moduleCandidates must be an array.`);
    return;
  }
  if (!Array.isArray(record.moduleCandidates)) {
    errors.push(`${label}.moduleCandidates must be an array.`);
    return;
  }

  const embeddedIds = analysis.moduleCandidates.map((candidate) => candidate?.id).filter(Boolean).join("|");
  const recordIds = record.moduleCandidates.map((candidate) => candidate?.id).filter(Boolean).join("|");
  if (embeddedIds !== recordIds) {
    errors.push(`${label}.moduleCandidates must mirror analysis.moduleCandidates by id and order.`);
  }

  const catalogById = new Map();
  record.catalogEntries.forEach((entry, index) => {
    validateCatalogEntryObject(entry, `${label}.catalogEntries[${index}]`, errors);
    if (entry && typeof entry.id === "string") catalogById.set(entry.id, entry);
  });

  const candidatesById = new Map();
  const liveMcpSchemaRefs = collectMcpSchemaRefs(join(repoRoot, "catalog/contracts"), { errors, isMcpContract });
  let needsInfoCount = 0;
  for (const [index, candidate] of analysis.moduleCandidates.entries()) {
    const candidateLabel = `${label}.analysis.moduleCandidates[${index}]`;
    validateModuleCandidateObject(candidate, candidateLabel, errors);
    if (candidate && typeof candidate.id === "string") candidatesById.set(candidate.id, candidate);
    if (candidate?.status === "needs_info") needsInfoCount += 1;
    if (typeof candidate?.missing_information_resolution !== "string") {
      errors.push(`${candidateLabel}.missing_information_resolution must be present as a string in saved-analysis fixtures.`);
    }
    if (!Array.isArray(candidate?.resolved_missing_information)) {
      errors.push(`${candidateLabel}.resolved_missing_information must be present as an array in saved-analysis fixtures.`);
    } else if (candidate.resolved_missing_information.some((item) => typeof item !== "string" || !item.trim())) {
      errors.push(`${candidateLabel}.resolved_missing_information must contain non-empty strings.`);
    }
    if (candidate?.status === "approved" && Array.isArray(candidate.missing_information) && candidate.missing_information.length > 0) {
      errors.push(`${candidateLabel} is approved but still has candidate-level missing_information.`);
    }
    let catalogEntry = null;
    if (typeof candidate?.catalog_entry_id === "string" && candidate.catalog_entry_id) {
      catalogEntry = catalogById.get(candidate.catalog_entry_id) ?? null;
      if (!catalogEntry) {
        errors.push(`${candidateLabel}.catalog_entry_id ${candidate.catalog_entry_id} is not in the saved catalog snapshot.`);
      } else if (catalogEntry.module_category !== candidate.module_category) {
        errors.push(`${candidateLabel}.catalog_entry_id category does not match saved catalog entry.`);
      }
    }
    if (candidate?.access_protocol === "mcp" && candidate.mcp_schema_ref) {
      const snapshotRef = typeof catalogEntry?.mcp_schema_ref === "string" ? catalogEntry.mcp_schema_ref : null;
      if (snapshotRef && snapshotRef !== candidate.mcp_schema_ref) {
        errors.push(`${candidateLabel}.mcp_schema_ref does not match saved catalog entry.`);
      } else if (!snapshotRef && liveMcpSchemaRefs.size > 0 && !liveMcpSchemaRefs.has(candidate.mcp_schema_ref)) {
        errors.push(`${candidateLabel}.mcp_schema_ref ${candidate.mcp_schema_ref} has no catalog/contracts/mcp contract.`);
      }
    }
  }

  if (record.scaffoldReady && needsInfoCount > 0) {
    errors.push(`${label}.scaffoldReady cannot be true while needs_info candidates remain.`);
  }
  if (record.scaffoldReady && record.activeStep !== "export") {
    errors.push(`${label}.scaffoldReady fixtures should land on export.`);
  }

  const contracts = Array.isArray(analysis.a2aContracts) ? analysis.a2aContracts : [];
  const contractsById = new Map();
  for (const contract of contracts) {
    if (contract && typeof contract.contract_id === "string") contractsById.set(contract.contract_id, contract);
  }
  if (analysis.processFlow !== undefined) {
    validateGraphIR(analysis.processFlow, `${label}.analysis.processFlow`, candidatesById, contractsById);
  }
  if (analysis.runtimeContracts !== undefined) {
    if (!Array.isArray(analysis.runtimeContracts)) {
      errors.push(`${label}.analysis.runtimeContracts must be an array when present.`);
    } else {
      analysis.runtimeContracts.forEach((contract, index) =>
        validateRuntimeContractObject(contract, `${label}.analysis.runtimeContracts[${index}]`)
      );
    }
  }
}

function validateCatalogEntryObject(entry, label, errors) {
  if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
    errors.push(`${label} must be an object.`);
    return;
  }
  if (typeof entry.id !== "string" || !entry.id.trim()) errors.push(`${label}.id is required.`);
  if (typeof entry.name !== "string" || !entry.name.trim()) errors.push(`${label}.name is required.`);
  if (!categories.has(entry.module_category)) errors.push(`${label}.module_category is invalid.`);
  if (entry.module_category === "adapter" && !adapterKinds.has(entry.adapter_kind)) {
    errors.push(`${label}.adapter_kind is invalid.`);
  }
  if (entry.module_category === "agent" && !agentKinds.has(entry.agent_kind)) {
    errors.push(`${label}.agent_kind is invalid.`);
  }
  if (entry.module_category === "workflow" && !workflowKinds.has(entry.workflow_kind)) {
    errors.push(`${label}.workflow_kind is invalid.`);
  }
  if (!["seeded", "session_added", "session_edited", "session_deleted"].includes(entry.provenance)) {
    errors.push(`${label}.provenance is invalid.`);
  }
}

function validateModuleCandidateObject(candidate, label, errors) {
  if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) {
    errors.push(`${label} must be an object.`);
    return;
  }
  if (typeof candidate.id !== "string" || !candidate.id.trim()) errors.push(`${label}.id is required.`);
  if (!categories.has(candidate.module_category)) errors.push(`${label}.module_category is invalid.`);
  if (!["needs_info", "approved", "deferred", "rejected"].includes(candidate.status)) {
    errors.push(`${label}.status is invalid.`);
  }
  if (!Array.isArray(candidate.inputs)) errors.push(`${label}.inputs must be an array.`);
  if (!Array.isArray(candidate.outputs)) errors.push(`${label}.outputs must be an array.`);
  if (!Array.isArray(candidate.missing_information)) errors.push(`${label}.missing_information must be an array.`);
  if (
    candidate.missing_information_resolution !== undefined &&
    typeof candidate.missing_information_resolution !== "string"
  ) {
    errors.push(`${label}.missing_information_resolution must be a string when present.`);
  }
  if (
    candidate.resolved_missing_information !== undefined &&
    (!Array.isArray(candidate.resolved_missing_information) ||
      candidate.resolved_missing_information.some((item) => typeof item !== "string" || !item.trim()))
  ) {
    errors.push(`${label}.resolved_missing_information must be an array of non-empty strings when present.`);
  }
  if (candidate.module_category === "adapter" && !adapterKinds.has(candidate.adapter_kind)) {
    errors.push(`${label}.adapter_kind is invalid.`);
  }
  if (candidate.module_category === "agent" && !agentKinds.has(candidate.agent_kind)) {
    errors.push(`${label}.agent_kind is invalid.`);
  }
  if (candidate.module_category === "workflow" && !workflowKinds.has(candidate.workflow_kind)) {
    errors.push(`${label}.workflow_kind is invalid.`);
  }
  if (candidate.access_protocol === "mcp" && (!candidate.mcp_server || !candidate.mcp_tool_name || !candidate.mcp_schema_ref)) {
    errors.push(`${label} access_protocol=mcp requires mcp_server, mcp_tool_name, and mcp_schema_ref.`);
  }
}

function collectMcpSchemaRefs(dir, { errors, isMcpContract }) {
  const refs = new Set();
  if (!existsSync(dir)) return refs;
  for (const path of findJsonFiles(dir)) {
    const contract = readJson(path, errors);
    if (isMcpContract(contract)) refs.add(contract.schema_ref);
  }
  return refs;
}
