import { readFile } from "node:fs/promises";
import { isAbsolute, join, resolve } from "node:path";

export const DEFAULT_RUNTIME_ENV_RELATIVE_PATH = ".agent-factory/runtime.env";

type EnvMap = Record<string, string | undefined>;

export function resolveRuntimeEnvPath(repoRoot: string, env: EnvMap = process.env): string {
  const configured = env.AF_RUNTIME_ENV_FILE?.trim();
  if (configured) return isAbsolute(configured) ? configured : resolve(repoRoot, configured);
  return join(repoRoot, DEFAULT_RUNTIME_ENV_RELATIVE_PATH);
}

export function parseRuntimeEnv(source: string): Record<string, string> {
  const values: Record<string, string> = {};
  for (const rawLine of source.replace(/^\uFEFF/, "").split(/\r?\n/)) {
    let line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    if (line.startsWith("export ")) line = line.slice("export ".length).trimStart();
    const separator = line.indexOf("=");
    if (separator <= 0) continue;
    const key = line.slice(0, separator).trim();
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) continue;
    values[key] = parseRuntimeEnvValue(line.slice(separator + 1).trim());
  }
  return values;
}

export async function loadRuntimeEnv(repoRoot: string, baseEnv: EnvMap = process.env): Promise<Record<string, string>> {
  const path = resolveRuntimeEnvPath(repoRoot, baseEnv);
  const source = await readFile(path, "utf8").catch((error: NodeJS.ErrnoException) => {
    if (error.code === "ENOENT") return "";
    throw error;
  });
  return parseRuntimeEnv(source);
}

export async function buildRuntimeProcessEnv(input: {
  repoRoot: string;
  stubDir: string;
  baseEnv?: EnvMap;
}): Promise<NodeJS.ProcessEnv> {
  const baseEnv = input.baseEnv ?? process.env;
  const runtimeEnv = await loadRuntimeEnv(input.repoRoot, baseEnv);
  return {
    ...baseEnv,
    ...runtimeEnv,
    PYTHONUNBUFFERED: "1",
    PYTHONUTF8: "1",
    PYTHONPATH: input.stubDir
  };
}

function parseRuntimeEnvValue(rawValue: string): string {
  if (rawValue.length >= 2 && rawValue.startsWith('"') && rawValue.endsWith('"')) {
    return rawValue
      .slice(1, -1)
      .replace(/\\n/g, "\n")
      .replace(/\\r/g, "\r")
      .replace(/\\t/g, "\t")
      .replace(/\\"/g, '"')
      .replace(/\\\\/g, "\\");
  }
  if (rawValue.length >= 2 && rawValue.startsWith("'") && rawValue.endsWith("'")) {
    return rawValue.slice(1, -1);
  }
  return rawValue.replace(/\s+#.*$/, "").trim();
}
