export function yamlScalar(value) {
  if (value === null || value === undefined || value === "") return "null";
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return JSON.stringify(String(value));
}

export function toPythonLiteral(value, indent = 0) {
  // Recursive emitter: strings stay opaque (via toPyStr) so values like "true"
  // or "null" are never rewritten; only real booleans/null become True/False/None.
  // Matches JSON.stringify(value, null, 4) spacing for ASCII data so smoke output
  // stays byte-identical.
  const pad = "    ".repeat(indent);
  const padInner = "    ".repeat(indent + 1);
  if (value === null || value === undefined) return "None";
  if (typeof value === "boolean") return value ? "True" : "False";
  if (typeof value === "number") return Number.isFinite(value) ? String(value) : "None";
  if (typeof value === "string") return toPyStr(value);
  if (Array.isArray(value)) {
    if (value.length === 0) return "[]";
    const items = value.map((item) => `${padInner}${toPythonLiteral(item, indent + 1)}`).join(",\n");
    return `[\n${items}\n${pad}]`;
  }
  if (typeof value === "object") {
    const entries = Object.entries(value);
    if (entries.length === 0) return "{}";
    const items = entries
      .map(([key, val]) => `${padInner}${toPyStr(key)}: ${toPythonLiteral(val, indent + 1)}`)
      .join(",\n");
    return `{\n${items}\n${pad}}`;
  }
  return "None";
}

export function toPythonEdgeTupleLiteral(rows) {
  if (!Array.isArray(rows) || rows.length === 0) return "[]";
  return `[\n${rows.map(([from, to]) => `    (${JSON.stringify(from)}, ${JSON.stringify(to)})`).join(",\n")}\n]`;
}

export function toPyStr(value) {
  // JSON string escapes (\n, \", \\, \uXXXX) are all valid Python string escapes.
  return JSON.stringify(String(value ?? ""));
}

export function truncate(value, max = 200) {
  const text = String(value ?? "");
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

export function escapePythonString(value) {
  return String(value).replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}
