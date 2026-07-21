import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const schemaRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../schemas");
const schemaCache = new Map();

export function validateAgainstSchema(value, schemaName, label) {
  const file = join(schemaRoot, schemaName);
  const errors = [];
  validate(value, loadSchema(file), file, label, errors);
  return errors;
}

function loadSchema(file) {
  const absolute = resolve(file);
  if (!schemaCache.has(absolute)) {
    const schema = JSON.parse(readFileSync(absolute, "utf8"));
    schemaCache.set(absolute, schema);
  }
  return schemaCache.get(absolute);
}

function validate(value, schema, schemaFile, path, errors) {
  if (!schema || typeof schema !== "object") return;
  if (schema.$ref) {
    const { target, file } = resolveReference(schema.$ref, schemaFile);
    validate(value, target, file, path, errors);
    return;
  }

  if (Array.isArray(schema.allOf)) {
    for (const branch of schema.allOf) validate(value, branch, schemaFile, path, errors);
  }
  if (schema.if) {
    const matches = [];
    validate(value, schema.if, schemaFile, path, matches);
    if (matches.length === 0 && schema.then) validate(value, schema.then, schemaFile, path, errors);
    if (matches.length > 0 && schema.else) validate(value, schema.else, schemaFile, path, errors);
  }
  if (Array.isArray(schema.oneOf)) {
    const outcomes = schema.oneOf.map((branch) => {
      const branchErrors = [];
      validate(value, branch, schemaFile, path, branchErrors);
      return branchErrors;
    });
    const matches = outcomes.filter((branchErrors) => branchErrors.length === 0);
    if (matches.length !== 1) errors.push(`${path} must match exactly one allowed schema shape.`);
    if (matches.length === 0) {
      const closest = outcomes.reduce((best, candidate) => candidate.length < best.length ? candidate : best);
      errors.push(...closest);
    }
    return;
  }
  if (Array.isArray(schema.anyOf)) {
    const matched = schema.anyOf.some((branch) => {
      const branchErrors = [];
      validate(value, branch, schemaFile, path, branchErrors);
      return branchErrors.length === 0;
    });
    if (!matched) errors.push(`${path} must match an allowed schema shape.`);
    return;
  }

  if (Object.hasOwn(schema, "const") && value !== schema.const) {
    errors.push(`${path} must equal ${JSON.stringify(schema.const)}.`);
    return;
  }
  if (Array.isArray(schema.enum) && !schema.enum.some((entry) => Object.is(entry, value))) {
    errors.push(`${path} has invalid enum value ${JSON.stringify(value)}.`);
    return;
  }
  if (schema.type && !matchesType(value, schema.type)) {
    errors.push(`${path} must be ${schema.type}.`);
    return;
  }

  if (schema.type === "object" || (!schema.type && isRecord(value))) validateObject(value, schema, schemaFile, path, errors);
  if (schema.type === "array" && Array.isArray(value)) validateArray(value, schema, schemaFile, path, errors);
  if (schema.type === "string" && typeof value === "string") validateString(value, schema, path, errors);
  if ((schema.type === "number" || schema.type === "integer") && typeof value === "number") validateNumber(value, schema, path, errors);
}

function validateObject(value, schema, schemaFile, path, errors) {
  if (!isRecord(value)) return;
  const properties = schema.properties ?? {};
  for (const key of schema.required ?? []) {
    if (!Object.hasOwn(value, key)) errors.push(`${path}.${key} is required.`);
  }
  for (const [key, entry] of Object.entries(value)) {
    if (Object.hasOwn(properties, key)) {
      validate(entry, properties[key], schemaFile, `${path}.${key}`, errors);
    } else if (schema.additionalProperties === false) {
      errors.push(`${path}.${key} is not allowed.`);
    } else if (isRecord(schema.additionalProperties)) {
      validate(entry, schema.additionalProperties, schemaFile, `${path}.${key}`, errors);
    }
  }
}

function validateArray(value, schema, schemaFile, path, errors) {
  if (typeof schema.minItems === "number" && value.length < schema.minItems) errors.push(`${path} must contain at least ${schema.minItems} items.`);
  if (schema.items) value.forEach((entry, index) => validate(entry, schema.items, schemaFile, `${path}[${index}]`, errors));
}

function validateString(value, schema, path, errors) {
  if (typeof schema.minLength === "number" && value.length < schema.minLength) errors.push(`${path} must not be empty.`);
  if (typeof schema.pattern === "string" && !new RegExp(schema.pattern).test(value)) errors.push(`${path} does not match ${schema.pattern}.`);
}

function validateNumber(value, schema, path, errors) {
  if (schema.type === "integer" && !Number.isInteger(value)) errors.push(`${path} must be integer.`);
  if (typeof schema.minimum === "number" && value < schema.minimum) errors.push(`${path} must be >= ${schema.minimum}.`);
  if (typeof schema.maximum === "number" && value > schema.maximum) errors.push(`${path} must be <= ${schema.maximum}.`);
  if (typeof schema.exclusiveMinimum === "number" && value <= schema.exclusiveMinimum) errors.push(`${path} must be > ${schema.exclusiveMinimum}.`);
}

function resolveReference(reference, schemaFile) {
  const [filePart, fragment = ""] = reference.split("#", 2);
  const file = filePart ? resolve(dirname(schemaFile), filePart) : schemaFile;
  let target = loadSchema(file);
  if (fragment) {
    for (const raw of fragment.replace(/^\//, "").split("/")) {
      const key = raw.replace(/~1/g, "/").replace(/~0/g, "~");
      target = target?.[key];
    }
  }
  if (!target) throw new Error(`Unresolved schema reference ${reference} from ${schemaFile}`);
  return { target, file };
}

function matchesType(value, type) {
  if (type === "null") return value === null;
  if (type === "array") return Array.isArray(value);
  if (type === "object") return isRecord(value);
  if (type === "integer") return typeof value === "number" && Number.isInteger(value);
  return typeof value === type;
}

function isRecord(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
