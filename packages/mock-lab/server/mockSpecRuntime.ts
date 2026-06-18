import { appendFile } from "node:fs/promises";
import { createInterface } from "node:readline";
import type { JsonRpcEnvelope, MockSpec, MockToolErrorScenario, MockToolSpec } from "../src/types/mockSpec";
import { readJson } from "./mockSpecStore";
import { assertValidMockSpec, validateValueAgainstSchema } from "./schemaValidation";

const specPath = process.env.AFML_MOCK_SPEC;
const auditLogPath = process.env.AFML_AUDIT_LOG;

if (!specPath) {
  console.error("AFML_MOCK_SPEC is required");
  process.exit(1);
}

const spec = await readJson(specPath);
assertValidMockSpec(spec);
const mockSpec = spec as MockSpec;

const keepAlive = setInterval(() => undefined, 2_147_483_647);
const rl = createInterface({ input: process.stdin });
process.stdin.resume();

process.on("SIGTERM", () => {
  clearInterval(keepAlive);
  process.exit(0);
});
rl.on("close", () => {
  clearInterval(keepAlive);
});
rl.on("line", (line) => {
  void handleLine(line);
});

async function handleLine(line: string): Promise<void> {
  let request: Record<string, any>;
  try {
    request = JSON.parse(line) as Record<string, any>;
  } catch {
    writeResponse({
      jsonrpc: "2.0",
      id: null,
      error: { code: -32700, message: "parse error" }
    } as JsonRpcEnvelope);
    return;
  }

  if (request.method === "tools/list") {
    writeResponse({
      jsonrpc: "2.0",
      id: request.id,
      result: {
        tools: mockSpec.tools.map((tool) => ({
          name: tool.name,
          title: tool.title,
          description: tool.description,
          inputSchema: tool.inputSchema,
          outputSchema: tool.outputSchema
        }))
      }
    });
    return;
  }

  if (request.method === "tools/call") {
    writeResponse(await callTool(request));
    return;
  }

  writeResponse({
    jsonrpc: "2.0",
    id: request.id,
    error: { code: -32601, message: `method not found: ${String(request.method ?? "")}` }
  });
}

async function callTool(request: Record<string, any>): Promise<JsonRpcEnvelope> {
  const name = typeof request.params?.name === "string" ? request.params.name : "";
  const tool = mockSpec.tools.find((candidate) => candidate.name === name);
  if (!tool) {
    return {
      jsonrpc: "2.0",
      id: request.id,
      error: { code: -32602, message: `unknown tool: ${name}` }
    };
  }

  const args = isRecord(request.params?.arguments) ? request.params.arguments : {};
  const inputValidation = validateValueAgainstSchema(args, tool.inputSchema);
  if (!inputValidation.ok) {
    await appendAudit(tool, args, "input_validation_failed", inputValidation.errors);
    return {
      jsonrpc: "2.0",
      id: request.id,
      error: {
        code: -32602,
        message: "input schema validation failed",
        data: { validation: inputValidation }
      }
    };
  }

  const scenario = (tool.errorScenarios ?? []).find((candidate) => scenarioMatches(candidate, args));
  if (scenario) {
    await appendAudit(tool, args, "error_scenario", [{ path: "$", message: scenario.name }]);
    const structuredContent = {
      synthetic: true,
      source: "agent-factory-mock-lab",
      errorCode: scenario.errorCode,
      message: scenario.message
    };
    return {
      jsonrpc: "2.0",
      id: request.id,
      result: {
        content: [{ type: "text", text: `[SYNTHETIC agent-factory-mock-lab] ${scenario.message}` }],
        structuredContent,
        isError: true
      }
    };
  }

  if (tool.latencyMs && tool.latencyMs > 0) {
    await wait(tool.latencyMs);
  }
  await appendAudit(tool, args, "success", []);
  const structuredContent = cloneRecord(tool.successResponse);
  return {
    jsonrpc: "2.0",
    id: request.id,
    result: {
      content: [
        {
          type: "text",
          text: `[SYNTHETIC agent-factory-mock-lab] ${JSON.stringify(structuredContent)}`
        }
      ],
      structuredContent,
      isError: false
    }
  };
}

async function appendAudit(
  tool: MockToolSpec,
  args: Record<string, unknown>,
  outcome: string,
  validationErrors: Array<{ path: string; message: string }>
): Promise<void> {
  if (!auditLogPath) return;
  await appendFile(
    auditLogPath,
    `${JSON.stringify({
      at: new Date().toISOString(),
      event: "tools/call",
      method: "tools/call",
      mock_id: mockSpec.mock_id,
      tool_name: tool.name,
      arguments: args,
      outcome,
      validation_errors: validationErrors,
      synthetic: true
    })}\n`,
    "utf8"
  );
}

function scenarioMatches(scenario: MockToolErrorScenario, args: Record<string, unknown>): boolean {
  if (!scenario.when) return false;
  return Object.entries(scenario.when).every(([key, expected]) => JSON.stringify(args[key]) === JSON.stringify(expected));
}

function writeResponse(response: JsonRpcEnvelope): void {
  process.stdout.write(`${JSON.stringify(response)}\n`);
}

function cloneRecord(value: Record<string, unknown>): Record<string, unknown> {
  return JSON.parse(JSON.stringify(value)) as Record<string, unknown>;
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
