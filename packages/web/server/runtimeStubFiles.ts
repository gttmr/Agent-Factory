import { readdir, stat } from "node:fs/promises";
import { join, relative, sep } from "node:path";

export interface RuntimeStubFile {
  readonly path: string;
  readonly bytes: number;
}

const RUNTIME_STUB_IGNORED_DIRS = new Set([".adk", ".pytest_cache", ".venv", "__pycache__"]);
const RUNTIME_STUB_IGNORED_FILE_SUFFIXES = [".pyc", ".pyo"];

export async function collectRuntimeStubFiles(root: string, current: string): Promise<RuntimeStubFile[]> {
  const entries = await readdir(current, { withFileTypes: true });
  const result: RuntimeStubFile[] = [];
  for (const entry of entries) {
    const abs = join(current, entry.name);
    if (entry.isDirectory()) {
      if (RUNTIME_STUB_IGNORED_DIRS.has(entry.name)) continue;
      result.push(...(await collectRuntimeStubFiles(root, abs)));
    } else if (entry.isFile()) {
      const fileStat = await stat(abs);
      const path = relative(root, abs).split(sep).join("/");
      if (isIgnoredRuntimeStubPath(path)) continue;
      result.push({ path, bytes: fileStat.size });
    }
  }
  result.sort((a, b) => a.path.localeCompare(b.path));
  return result;
}

export function isIgnoredRuntimeStubPath(relativeFile: string): boolean {
  const normalized = relativeFile.split(sep).join("/");
  const parts = normalized.split("/");
  return (
    parts.some((part) => RUNTIME_STUB_IGNORED_DIRS.has(part)) ||
    RUNTIME_STUB_IGNORED_FILE_SUFFIXES.some((suffix) => normalized.endsWith(suffix))
  );
}
