import type { FieldSpec, JsonSchema, MockBinding, ModuleCandidate } from "../analyzer/types";

type SchemaDirection = "input" | "output" | "unknown";

interface SchemaRefCardsProps {
  readonly refs: readonly string[];
  readonly contracts: Record<string, unknown>;
  readonly candidate: ModuleCandidate | null;
  readonly mockBinding?: MockBinding | null;
}

interface MappingTableProps {
  readonly mapping: Record<string, string> | null | undefined;
  readonly emptyLabel: string;
}

interface JsonDetailsProps {
  readonly label: string;
  readonly value: unknown;
}

interface ResolvedSchema {
  readonly source: string;
  readonly direction: SchemaDirection;
  readonly schema: unknown;
  readonly contract: unknown;
}

export function SchemaRefCards({ refs, contracts, candidate, mockBinding = null }: SchemaRefCardsProps) {
  if (!refs.length) return <span className="graph-inspector-muted">—</span>;
  const mcpContract = candidate?.mcp_schema_ref ? contracts[candidate.mcp_schema_ref] : null;
  return (
    <div className="graph-schema-card-list">
      {refs.map((ref, index) => {
        const resolved = resolveSchema(ref, contracts, candidate, mcpContract, mockBinding);
        return (
          <details key={ref} className="graph-schema-card" open={Boolean(resolved) && index === 0}>
            <summary>
              <span>{ref}</span>
              <small>{resolved ? `${directionLabel(resolved.direction)} · ${resolved.source}` : "본문 없음"}</small>
            </summary>
            {resolved ? (
              <>
                <SchemaShapePreview schema={resolved.schema} />
                <ContractExamples contract={resolved.contract} />
              </>
            ) : (
              <p className="graph-inspector-note">이 Graph IR에는 schema ref만 있고 표시할 schema 본문은 catalog contract에서 찾지 못했습니다.</p>
            )}
          </details>
        );
      })}
    </div>
  );
}

export function MappingTable({ mapping, emptyLabel }: MappingTableProps) {
  const entries = mapping ? Object.entries(mapping) : [];
  if (!entries.length) return <p className="graph-inspector-note">{emptyLabel}</p>;
  return (
    <table className="graph-mapping-table">
      <thead>
        <tr>
          <th scope="col">대상 필드</th>
          <th scope="col">소스</th>
        </tr>
      </thead>
      <tbody>
        {entries.map(([target, source]) => (
          <tr key={target}>
            <td>
              <code>{target}</code>
            </td>
            <td>
              <code>{source}</code>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function JsonDetails({ label, value }: JsonDetailsProps) {
  return (
    <details className="graph-json-details">
      <summary>{label}</summary>
      <pre>{JSON.stringify(value, null, 2)}</pre>
    </details>
  );
}

export function FieldSpecList({ title, fields }: { readonly title: string; readonly fields: readonly { readonly name: string; readonly type: string; readonly required?: boolean }[] }) {
  if (!fields.length) return null;
  return (
    <div className="graph-field-spec-list">
      <strong>{title}</strong>
      <div className="graph-field-spec-items">
        {fields.map((field) => (
          <span key={field.name} className="graph-field-spec">
            <code>{field.name}</code>
            <span>{field.type}</span>
            {field.required ? <small>required</small> : null}
          </span>
        ))}
      </div>
    </div>
  );
}

function resolveSchema(
  ref: string,
  contracts: Record<string, unknown>,
  candidate: ModuleCandidate | null,
  mcpContract: unknown,
  mockBinding: MockBinding | null
): ResolvedSchema | null {
  const direction = schemaDirection(ref, mockBinding);
  const direct = contracts[ref];
  if (direct) {
    return { source: "catalog contract", direction, schema: direct, contract: direct };
  }
  if (!mcpContract) return fallbackSchemaFromCandidate(direction, candidate);
  const schema = direction === "output" ? fieldValue(mcpContract, "outputSchema") : fieldValue(mcpContract, "inputSchema");
  if (!schema) return fallbackSchemaFromCandidate(direction, candidate);
  return { source: "MCP tool contract", direction, schema, contract: mcpContract };
}

function fallbackSchemaFromCandidate(direction: SchemaDirection, candidate: ModuleCandidate | null): ResolvedSchema | null {
  const fields = direction === "output" ? candidate?.outputs : candidate?.inputs;
  if (!fields?.length) return null;
  const schema = fieldSpecsToSchema(fields, direction === "output" ? "Module output fields" : "Module input fields");
  return { source: "module field spec", direction, schema, contract: schema };
}

function fieldSpecsToSchema(fields: readonly FieldSpec[], title: string): JsonSchema {
  const properties: Record<string, JsonSchema> = {};
  const required: string[] = [];
  for (const field of fields) {
    properties[field.name] = field.schema ?? { type: normalizeSchemaType(field.type) };
    if (field.required) required.push(field.name);
  }
  return { type: "object", description: title, properties, required };
}

function normalizeSchemaType(type: string): JsonSchema["type"] {
  const lowered = type.toLowerCase();
  if (lowered.includes("array") || lowered.endsWith("[]")) return "array";
  if (lowered.includes("boolean")) return "boolean";
  if (lowered.includes("number") || lowered.includes("integer")) return "number";
  if (lowered.includes("object") || lowered.includes("record")) return "object";
  return "string";
}

function schemaDirection(ref: string, mockBinding: MockBinding | null): SchemaDirection {
  if (mockBinding?.input_schema === ref) return "input";
  if (mockBinding?.output_schema === ref) return "output";
  const lowered = ref.toLowerCase();
  if (lowered.includes("request") || lowered.includes("input")) return "input";
  if (lowered.includes("response") || lowered.includes("output")) return "output";
  return "unknown";
}

function SchemaShapePreview({ schema }: { readonly schema: unknown }) {
  const type = stringField(schema, "type");
  const required = stringArrayField(schema, "required");
  const properties = recordField(schema, "properties");
  const entries = properties ? Object.entries(properties) : [];
  if (!type && !entries.length) return <JsonDetails label="schema JSON 보기" value={schema} />;
  return (
    <div className="graph-schema-shape">
      {type ? (
        <p>
          type <code>{type}</code>
        </p>
      ) : null}
      {required.length ? (
        <div className="graph-schema-required">
          <span>required</span>
          {required.map((item) => (
            <code key={item}>{item}</code>
          ))}
        </div>
      ) : null}
      {entries.length ? (
        <div className="graph-schema-properties">
          {entries.map(([name, value]) => (
            <div key={name} className="graph-schema-property">
              <code>{name}</code>
              <span>{stringField(value, "type") ?? "object"}</span>
              {required.includes(name) ? <small>required</small> : null}
            </div>
          ))}
        </div>
      ) : null}
      <JsonDetails label="schema JSON 보기" value={schema} />
    </div>
  );
}

function ContractExamples({ contract }: { readonly contract: unknown }) {
  const successExamples = fieldValue(contract, "success_examples");
  const mockResponse = fieldValue(fieldValue(contract, "mock_response"), "structuredContent");
  if (!successExamples && !mockResponse) return null;
  return (
    <div className="graph-contract-examples">
      {successExamples ? <JsonDetails label="success examples" value={successExamples} /> : null}
      {mockResponse ? <JsonDetails label="mock structuredContent" value={mockResponse} /> : null}
    </div>
  );
}

function fieldValue(value: unknown, key: string): unknown {
  if (!isRecord(value)) return null;
  return value[key] ?? null;
}

function stringField(value: unknown, key: string): string | null {
  const field = fieldValue(value, key);
  return typeof field === "string" && field.trim() ? field : null;
}

function stringArrayField(value: unknown, key: string): readonly string[] {
  const field = fieldValue(value, key);
  if (!Array.isArray(field)) return [];
  return field.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
}

function recordField(value: unknown, key: string): Record<string, unknown> | null {
  const field = fieldValue(value, key);
  return isRecord(field) ? field : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function directionLabel(direction: SchemaDirection): string {
  if (direction === "input") return "입력";
  if (direction === "output") return "출력";
  return "schema";
}
