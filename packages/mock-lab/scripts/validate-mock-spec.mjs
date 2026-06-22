import { readFile } from "node:fs/promises";

const target = process.argv[2];
if (!target) {
  console.error("Usage: node scripts/validate-mock-spec.mjs <mock-spec.json>");
  process.exit(2);
}

const spec = JSON.parse(await readFile(target, "utf8"));
const errors = [];

function validateJsonSchemaShape(schema, path) {
  if (!schema || typeof schema !== "object" || Array.isArray(schema)) return;
  const properties = schema.properties;
  const required = Array.isArray(schema.required) ? schema.required : [];
  if (required.length && (!properties || typeof properties !== "object" || Array.isArray(properties))) {
    errors.push(`${path}.required is set but ${path}.properties is missing`);
  }
  for (const name of required) {
    if (!properties || !Object.hasOwn(properties, name)) {
      errors.push(`${path}.required includes undeclared property ${name}`);
    }
  }
  if (properties && typeof properties === "object" && !Array.isArray(properties)) {
    for (const [name, child] of Object.entries(properties)) {
      validateJsonSchemaShape(child, `${path}.properties.${name}`);
    }
  }
  if (schema.items) {
    validateJsonSchemaShape(schema.items, `${path}.items`);
  }
}

if (!/^[a-zA-Z0-9_-]{3,80}$/.test(spec.mock_id ?? "")) errors.push("mock_id is invalid");
if (!spec.server_name) errors.push("server_name is required");
if (spec.protocol !== "mcp_stdio") errors.push("protocol must be mcp_stdio");
if (!Array.isArray(spec.tools) || spec.tools.length === 0) {
  errors.push("tools must contain at least one tool");
} else {
  spec.tools.forEach((tool, index) => {
    if (!/^[a-zA-Z_][a-zA-Z0-9_]{2,80}$/.test(tool.name ?? "")) errors.push(`tools[${index}].name is invalid`);
    if (!tool.description) errors.push(`tools[${index}].description is required`);
    if (!tool.inputSchema || typeof tool.inputSchema !== "object" || Array.isArray(tool.inputSchema)) {
      errors.push(`tools[${index}].inputSchema must be an object`);
    } else {
      validateJsonSchemaShape(tool.inputSchema, `tools[${index}].inputSchema`);
    }
    if (!tool.outputSchema || typeof tool.outputSchema !== "object" || Array.isArray(tool.outputSchema)) {
      errors.push(`tools[${index}].outputSchema must be an object`);
    } else {
      validateJsonSchemaShape(tool.outputSchema, `tools[${index}].outputSchema`);
    }
    if (!tool.successResponse || typeof tool.successResponse !== "object" || Array.isArray(tool.successResponse)) {
      errors.push(`tools[${index}].successResponse must be an object`);
    }
  });
}

for (const key of [
  "synthetic_only",
  "no_private_data",
  "no_private_endpoint",
  "no_credentials",
  "no_production_business_logic"
]) {
  if (spec.guardrails?.[key] !== true) errors.push(`guardrails.${key} must be true`);
}

if (errors.length) {
  console.error(JSON.stringify({ ok: false, errors }, null, 2));
  process.exit(1);
}

console.log(JSON.stringify({ ok: true, mock_id: spec.mock_id, tools: spec.tools.map((tool) => tool.name) }, null, 2));
