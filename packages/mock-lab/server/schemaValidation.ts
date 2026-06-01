import type { JsonSchema, MockSpec, ValidationIssue, ValidationResult } from "../src/types/mockSpec";

const MOCK_ID_PATTERN = /^[a-zA-Z0-9_-]{3,80}$/;
const TOOL_NAME_PATTERN = /^[a-zA-Z_][a-zA-Z0-9_]{2,80}$/;

export function validateMockSpec(value: unknown): ValidationResult {
  const errors: ValidationIssue[] = [];
  const warnings: ValidationIssue[] = [];

  if (!isRecord(value)) {
    return {
      ok: false,
      errors: [{ path: "$", message: "spec must be an object" }],
      warnings
    };
  }

  if (typeof value.mock_id !== "string" || !MOCK_ID_PATTERN.test(value.mock_id)) {
    errors.push({ path: "$.mock_id", message: "mock_id must match ^[a-zA-Z0-9_-]{3,80}$" });
  }
  if (typeof value.server_name !== "string" || value.server_name.trim().length === 0) {
    errors.push({ path: "$.server_name", message: "server_name is required" });
  }
  if (value.protocol !== "mcp_stdio") {
    errors.push({ path: "$.protocol", message: "protocol must be mcp_stdio" });
  }
  if (!Array.isArray(value.tools) || value.tools.length === 0) {
    errors.push({ path: "$.tools", message: "at least one tool is required" });
  } else {
    value.tools.forEach((tool, index) => {
      const path = `$.tools[${index}]`;
      if (!isRecord(tool)) {
        errors.push({ path, message: "tool must be an object" });
        return;
      }
      if (typeof tool.name !== "string" || !TOOL_NAME_PATTERN.test(tool.name)) {
        errors.push({ path: `${path}.name`, message: "tool name must match ^[a-zA-Z_][a-zA-Z0-9_]{2,80}$" });
      }
      if (typeof tool.description !== "string" || tool.description.trim().length === 0) {
        errors.push({ path: `${path}.description`, message: "tool description is required" });
      }
      const inputErrors = validateJsonSchemaObject(tool.inputSchema, `${path}.inputSchema`);
      const outputErrors = validateJsonSchemaObject(tool.outputSchema, `${path}.outputSchema`);
      errors.push(...inputErrors, ...outputErrors);
      if (!isRecord(tool.successResponse)) {
        errors.push({ path: `${path}.successResponse`, message: "successResponse must be an object" });
      } else if (outputErrors.length === 0) {
        const outputValidation = validateValueAgainstSchema(tool.successResponse, tool.outputSchema as JsonSchema);
        if (!outputValidation.ok) {
          warnings.push(
            ...outputValidation.errors.map((issue) => ({
              path: `${path}.successResponse${issue.path === "$" ? "" : issue.path.slice(1)}`,
              message: issue.message
            }))
          );
        }
      }
      if (tool.errorScenarios !== undefined && !Array.isArray(tool.errorScenarios)) {
        errors.push({ path: `${path}.errorScenarios`, message: "errorScenarios must be an array" });
      }
      const latencyMs = tool.latencyMs;
      if (
        latencyMs !== undefined &&
        (typeof latencyMs !== "number" || !Number.isInteger(latencyMs) || latencyMs < 0 || latencyMs > 10000)
      ) {
        errors.push({ path: `${path}.latencyMs`, message: "latencyMs must be an integer between 0 and 10000" });
      }
    });
  }

  const guardrails = value.guardrails;
  for (const key of [
    "synthetic_only",
    "no_private_data",
    "no_private_endpoint",
    "no_credentials",
    "no_production_business_logic"
  ]) {
    if (!isRecord(guardrails) || guardrails[key] !== true) {
      errors.push({ path: `$.guardrails.${key}`, message: `${key} must be true` });
    }
  }

  return { ok: errors.length === 0, errors, warnings };
}

export function assertValidMockSpec(value: unknown): asserts value is MockSpec {
  const result = validateMockSpec(value);
  if (!result.ok) {
    throw new Error(result.errors.map((issue) => `${issue.path}: ${issue.message}`).join("; "));
  }
}

export function validateJsonSchemaObject(value: unknown, path = "$"): ValidationIssue[] {
  if (!isRecord(value)) {
    return [{ path, message: "schema must be an object" }];
  }
  if (value.type !== undefined && !schemaTypeIncludes(value.type, "object")) {
    return [{ path: `${path}.type`, message: "top-level schema type must be object" }];
  }
  if (value.properties !== undefined && !isRecord(value.properties)) {
    return [{ path: `${path}.properties`, message: "properties must be an object" }];
  }
  if (value.required !== undefined && !isStringArray(value.required)) {
    return [{ path: `${path}.required`, message: "required must be a string array" }];
  }
  return [];
}

export function validateValueAgainstSchema(value: unknown, schema: JsonSchema, path = "$"): { ok: boolean; errors: ValidationIssue[] } {
  const errors: ValidationIssue[] = [];
  validateValue(value, schema, path, errors);
  return { ok: errors.length === 0, errors };
}

export function sampleValueFromSchema(schema: JsonSchema): unknown {
  if (schema.const !== undefined) return schema.const;
  if (Array.isArray(schema.enum) && schema.enum.length > 0) return schema.enum[0];
  const type = firstSchemaType(schema.type);
  if (type === "object" || schema.properties) {
    const result: Record<string, unknown> = {};
    for (const [key, child] of Object.entries(schema.properties ?? {})) {
      if (!schema.required || schema.required.includes(key)) {
        result[key] = sampleValueFromSchema(child);
      }
    }
    return result;
  }
  if (type === "array") return [sampleValueFromSchema(schema.items ?? { type: "string" })];
  if (type === "number") return 1;
  if (type === "integer") return 1;
  if (type === "boolean") return true;
  if (type === "null") return null;
  return "synthetic_value";
}

function validateValue(value: unknown, schema: JsonSchema, path: string, errors: ValidationIssue[]): void {
  if (schema.const !== undefined && !deepEqual(value, schema.const)) {
    errors.push({ path, message: `must equal ${JSON.stringify(schema.const)}` });
    return;
  }
  if (schema.enum && !schema.enum.some((entry) => deepEqual(value, entry))) {
    errors.push({ path, message: "must match one of the enum values" });
    return;
  }

  const allowedTypes = normalizeTypes(schema.type);
  if (allowedTypes.length > 0 && !allowedTypes.some((type) => matchesType(value, type))) {
    errors.push({ path, message: `must be ${allowedTypes.join(" or ")}` });
    return;
  }

  if ((schema.properties || schema.required || schema.additionalProperties !== undefined) && isRecord(value)) {
    for (const key of schema.required ?? []) {
      if (!(key in value)) errors.push({ path: `${path}.${key}`, message: "is required" });
    }
    for (const [key, child] of Object.entries(schema.properties ?? {})) {
      if (key in value) validateValue(value[key], child, `${path}.${key}`, errors);
    }
    if (schema.additionalProperties === false && schema.properties) {
      for (const key of Object.keys(value)) {
        if (!(key in schema.properties)) errors.push({ path: `${path}.${key}`, message: "is not allowed" });
      }
    }
  }

  if (Array.isArray(value) && schema.items) {
    value.forEach((item, index) => validateValue(item, schema.items!, `${path}[${index}]`, errors));
  }

  if (typeof value === "string") {
    if (typeof schema.minLength === "number" && value.length < schema.minLength) {
      errors.push({ path, message: `length must be at least ${schema.minLength}` });
    }
    if (typeof schema.maxLength === "number" && value.length > schema.maxLength) {
      errors.push({ path, message: `length must be at most ${schema.maxLength}` });
    }
    if (schema.pattern && !new RegExp(schema.pattern).test(value)) {
      errors.push({ path, message: `must match pattern ${schema.pattern}` });
    }
  }

  if (typeof value === "number") {
    if (typeof schema.minimum === "number" && value < schema.minimum) {
      errors.push({ path, message: `must be >= ${schema.minimum}` });
    }
    if (typeof schema.maximum === "number" && value > schema.maximum) {
      errors.push({ path, message: `must be <= ${schema.maximum}` });
    }
  }
}

function schemaTypeIncludes(value: unknown, expected: string): boolean {
  return normalizeTypes(value).includes(expected);
}

function normalizeTypes(value: unknown): string[] {
  if (typeof value === "string") return [value];
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function firstSchemaType(value: unknown): string {
  return normalizeTypes(value)[0] ?? "string";
}

function matchesType(value: unknown, type: string): boolean {
  if (type === "array") return Array.isArray(value);
  if (type === "object") return isRecord(value);
  if (type === "integer") return Number.isInteger(value);
  if (type === "number") return typeof value === "number" && Number.isFinite(value);
  if (type === "string") return typeof value === "string";
  if (type === "boolean") return typeof value === "boolean";
  if (type === "null") return value === null;
  return true;
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function deepEqual(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}
