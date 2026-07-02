import { relative } from "node:path";
import { findJsonFiles, readJson } from "./files.mjs";

export function validateContractRegistry({ dir, root, errors, validateA2AContract }) {
  for (const path of findJsonFiles(dir)) {
    const normalizedPath = path.replace(/\\/g, "/");
    if (!normalizedPath.includes("/catalog/contracts/")) continue;
    const contract = readJson(path, errors);
    if (isMcpContract(contract)) {
      validateMcpContract(contract, relative(root, path) || path, errors);
    } else if (isA2ARegistryContract(contract)) {
      validateA2ARegistryContract(contract, relative(root, path) || path, { errors, validateA2AContract });
    }
  }
}

export function isMcpContract(value) {
  return (
    value &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    typeof value.schema_ref === "string" &&
    typeof value.server === "string" &&
    typeof value.tool === "string" &&
    value.inputSchema &&
    value.outputSchema
  );
}

function validateMcpContract(contract, label, errors) {
  for (const field of ["schema_ref", "server", "tool", "title", "description"]) {
    if (typeof contract[field] !== "string" || !contract[field].trim()) {
      errors.push(`${label}.${field} must be a non-empty string.`);
    }
  }
  validateJsonSchemaObject(contract.inputSchema, `${label}.inputSchema`, errors);
  validateJsonSchemaObject(contract.outputSchema, `${label}.outputSchema`, errors);
  if (!Array.isArray(contract.success_examples) || contract.success_examples.length === 0) {
    errors.push(`${label}.success_examples must be a non-empty array.`);
  } else {
    contract.success_examples.forEach((example, index) => {
      if (!example || typeof example !== "object" || Array.isArray(example)) {
        errors.push(`${label}.success_examples[${index}] must be an object.`);
        return;
      }
      validateSchemaInstance(example.arguments, contract.inputSchema, `${label}.success_examples[${index}].arguments`, errors);
      validateSchemaInstance(example.structuredContent, contract.outputSchema, `${label}.success_examples[${index}].structuredContent`, errors);
    });
  }
  if (!Array.isArray(contract.error_examples) || contract.error_examples.length === 0) {
    errors.push(`${label}.error_examples must be a non-empty array.`);
  } else {
    contract.error_examples.forEach((example, index) => {
      if (example?.isError !== true) {
        errors.push(`${label}.error_examples[${index}].isError must be true.`);
      }
      if (typeof example?.message !== "string" || !example.message.trim()) {
        errors.push(`${label}.error_examples[${index}].message is required.`);
      }
    });
  }
  if (!contract.mock_response || typeof contract.mock_response !== "object" || Array.isArray(contract.mock_response)) {
    errors.push(`${label}.mock_response must be an object.`);
    return;
  }
  if (contract.mock_response.isError !== false) {
    errors.push(`${label}.mock_response.isError must be false for the default deterministic response.`);
  }
  if (!Array.isArray(contract.mock_response.content) || contract.mock_response.content.length === 0) {
    errors.push(`${label}.mock_response.content must be a non-empty array.`);
  }
  validateSchemaInstance(contract.mock_response.structuredContent, contract.outputSchema, `${label}.mock_response.structuredContent`, errors);
}

function isA2ARegistryContract(value) {
  return (
    value &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    typeof value.contract_id === "string" &&
    value.agent_card &&
    value.task_lifecycle &&
    value.artifact_contract
  );
}

function validateA2ARegistryContract(contract, label, { errors, validateA2AContract }) {
  validateA2AContract(contract, label, new Map(), new Set(), new Map());
  for (const field of ["success_task_example", "auth_required_example", "failed_task_example"]) {
    if (!contract[field] || typeof contract[field] !== "object" || Array.isArray(contract[field])) {
      errors.push(`${label}.${field} must be an object.`);
    }
  }
}

function validateJsonSchemaObject(schema, label, errors) {
  if (!schema || typeof schema !== "object" || Array.isArray(schema)) {
    errors.push(`${label} must be an object.`);
    return;
  }
  if (schema.type !== "object") {
    errors.push(`${label}.type must be object.`);
  }
  if (!schema.properties || typeof schema.properties !== "object" || Array.isArray(schema.properties)) {
    errors.push(`${label}.properties must be an object.`);
  }
  if (schema.required !== undefined && !Array.isArray(schema.required)) {
    errors.push(`${label}.required must be an array when present.`);
  }
}

function validateSchemaInstance(value, schema, label, errors) {
  if (!schema || typeof schema !== "object") return;
  const type = schema.type;
  if (type === "object") {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      errors.push(`${label} must be an object.`);
      return;
    }
    const required = Array.isArray(schema.required) ? schema.required : [];
    for (const key of required) {
      if (!(key in value)) errors.push(`${label}.${key} is required by schema.`);
    }
    const properties = schema.properties && typeof schema.properties === "object" ? schema.properties : {};
    for (const [key, childSchema] of Object.entries(properties)) {
      if (value[key] !== undefined) validateSchemaInstance(value[key], childSchema, `${label}.${key}`, errors);
    }
    return;
  }
  if (type === "array") {
    if (!Array.isArray(value)) {
      errors.push(`${label} must be an array.`);
      return;
    }
    if (schema.items) {
      value.forEach((item, index) => validateSchemaInstance(item, schema.items, `${label}[${index}]`, errors));
    }
    return;
  }
  if (type === "string" && typeof value !== "string") errors.push(`${label} must be a string.`);
  if (type === "number" && typeof value !== "number") errors.push(`${label} must be a number.`);
  if (type === "boolean" && typeof value !== "boolean") errors.push(`${label} must be a boolean.`);
}
