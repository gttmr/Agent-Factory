import { mkdir, readdir, readFile, rm, stat, writeFile, cp } from "node:fs/promises";
import { join, relative, resolve, sep } from "node:path";
import type { GeneratedFileInfo, MockSpec } from "../src/types/mockSpec";
import { assertValidMockSpec } from "./schemaValidation";

export const MOCK_ID_PATTERN = /^[a-zA-Z0-9_-]{3,80}$/;
export const RUN_ID_PATTERN = /^\d{8}T\d{6}Z-generate-[a-f0-9]{6}$/;

export class MockLabError extends Error {
  readonly statusCode: number;

  constructor(statusCode: number, message: string) {
    super(message);
    this.statusCode = statusCode;
  }
}

export class MockSpecStore {
  readonly repoRoot: string;
  readonly artifactRoot: string;

  constructor({ repoRoot }: { repoRoot: string }) {
    this.repoRoot = resolve(repoRoot);
    this.artifactRoot = resolve(this.repoRoot, "artifacts", "mock-lab");
  }

  async listMocks(): Promise<Array<{ mock_id: string; server_name: string; updated_at: string | null }>> {
    const entries = await readdir(this.artifactRoot, { withFileTypes: true }).catch((error) => {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
      throw error;
    });
    const result: Array<{ mock_id: string; server_name: string; updated_at: string | null }> = [];
    for (const entry of entries) {
      if (!entry.isDirectory() || !MOCK_ID_PATTERN.test(entry.name)) continue;
      const spec = await this.readSpec(entry.name).catch(() => null);
      if (!spec) continue;
      const specPath = join(this.resolveMockDir(entry.name), "mock-spec.json");
      const specStat = await stat(specPath).catch(() => null);
      result.push({
        mock_id: spec.mock_id,
        server_name: spec.server_name,
        updated_at: specStat ? specStat.mtime.toISOString() : null
      });
    }
    result.sort((a, b) => a.mock_id.localeCompare(b.mock_id));
    return result;
  }

  async readSpec(mockId: string): Promise<MockSpec> {
    const content = await readFile(join(this.resolveMockDir(mockId), "mock-spec.json"), "utf8").catch((error) => {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        throw new MockLabError(404, `Mock spec is not saved: ${mockId}. Save the spec before generating or running smoke tests.`);
      }
      throw error;
    });
    const parsed = JSON.parse(content) as unknown;
    assertValidMockSpec(parsed);
    return parsed;
  }

  async writeSpec(mockId: string, spec: unknown): Promise<{ ok: true; bytes: number }> {
    assertMockId(mockId);
    assertValidMockSpec(spec);
    if (spec.mock_id !== mockId) {
      throw new MockLabError(400, "mock_id path and spec.mock_id must match");
    }
    const dir = this.resolveMockDir(mockId);
    await mkdir(dir, { recursive: true });
    const content = `${JSON.stringify(spec, null, 2)}\n`;
    await writeFile(join(dir, "mock-spec.json"), content, "utf8");
    await appendJsonl(join(dir, "audit-log.jsonl"), {
      at: new Date().toISOString(),
      event: "mock_spec_saved",
      mock_id: mockId,
      synthetic: true
    });
    return { ok: true, bytes: Buffer.byteLength(content, "utf8") };
  }

  async deleteMock(mockId: string): Promise<{ ok: true; mock_id: string }> {
    const dir = this.resolveMockDir(mockId);
    await rm(dir, { recursive: true, force: true });
    return { ok: true, mock_id: mockId };
  }

  resolveMockDir(mockId: string): string {
    assertMockId(mockId);
    const abs = resolve(this.artifactRoot, mockId);
    assertInside(this.artifactRoot, abs);
    return abs;
  }

  resolveRunDir(mockId: string, runId: string): string {
    assertRunId(runId);
    const runsRoot = resolve(this.resolveMockDir(mockId), "runs");
    const abs = resolve(runsRoot, runId);
    assertInside(runsRoot, abs);
    return abs;
  }

  resolveRunProposedDir(mockId: string, runId: string): string {
    return join(this.resolveRunDir(mockId, runId), "proposed-files");
  }

  resolveGeneratedDir(mockId: string): string {
    return join(this.resolveMockDir(mockId), "generated");
  }

  resolveAuditLog(mockId: string): string {
    return join(this.resolveMockDir(mockId), "audit-log.jsonl");
  }

  resolveServerState(mockId: string): string {
    return join(this.resolveMockDir(mockId), "server-state.json");
  }

  async applyGeneratedFiles(mockId: string, runId: string): Promise<{ ok: true; files: GeneratedFileInfo[] }> {
    const proposedDir = this.resolveRunProposedDir(mockId, runId);
    const files = await this.validateProposedFiles(mockId, runId);
    const generatedDir = this.resolveGeneratedDir(mockId);
    await rm(generatedDir, { recursive: true, force: true });
    await mkdir(generatedDir, { recursive: true });
    await cp(proposedDir, generatedDir, {
      recursive: true,
      filter: (source) => {
        const rel = relative(proposedDir, source).split(sep).join("/");
        return rel === "" || (!rel.includes("node_modules") && !rel.includes(".git"));
      }
    });
    await appendJsonl(this.resolveAuditLog(mockId), {
      at: new Date().toISOString(),
      event: "generated_files_applied",
      mock_id: mockId,
      run_id: runId,
      files: files.map((file) => file.path),
      synthetic: true
    });
    return { ok: true, files };
  }

  async validateProposedFiles(mockId: string, runId: string): Promise<GeneratedFileInfo[]> {
    const proposedDir = this.resolveRunProposedDir(mockId, runId);
    const files = await collectFiles(proposedDir, proposedDir);
    validateGeneratedFiles(files, proposedDir);
    return files;
  }

  async listRuns(mockId: string): Promise<unknown[]> {
    const runsRoot = join(this.resolveMockDir(mockId), "runs");
    const entries = await readdir(runsRoot, { withFileTypes: true }).catch((error) => {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
      throw error;
    });
    const runs: unknown[] = [];
    for (const entry of entries) {
      if (!entry.isDirectory() || !RUN_ID_PATTERN.test(entry.name)) continue;
      const runDir = join(runsRoot, entry.name);
      const summary = await readJson(join(runDir, "result-summary.json")).catch(() => null);
      if (summary) {
        runs.push(summary);
        continue;
      }
      const request = await readJson<Record<string, any>>(join(runDir, "request.json")).catch(() => null);
      if (request) {
        runs.push({
          run_id: entry.name,
          mock_id: mockId,
          status: "failed",
          model: typeof request.model === "string" ? request.model : "gpt-5.5",
          started_at: inferRunStartedAt(entry.name) ?? new Date(0).toISOString(),
          finished_at: null,
          elapsed_ms: 0,
          pid: null,
          command: null,
          proposed_files: [],
          validation: {
            ok: false,
            errors: ["result-summary.json is missing; generation may have been interrupted before status was recorded."]
          },
          last_error: "result-summary.json is missing; generation may have been interrupted before status was recorded."
        });
      }
    }
    runs.sort((a, b) => {
      const left = isRecord(a) && typeof a.started_at === "string" ? a.started_at : "";
      const right = isRecord(b) && typeof b.started_at === "string" ? b.started_at : "";
      return right.localeCompare(left);
    });
    return runs;
  }
}

export async function writeJsonFile(path: string, value: unknown): Promise<void> {
  await mkdir(path.slice(0, path.lastIndexOf(sep)), { recursive: true });
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

export async function readJson<T = unknown>(path: string): Promise<T> {
  return JSON.parse(await readFile(path, "utf8")) as T;
}

export async function appendJsonl(path: string, value: unknown): Promise<void> {
  await mkdir(path.slice(0, path.lastIndexOf(sep)), { recursive: true });
  const existing = await readFile(path, "utf8").catch(() => "");
  await writeFile(path, `${existing}${JSON.stringify(value)}\n`, "utf8");
}

export async function collectFiles(root: string, current: string): Promise<GeneratedFileInfo[]> {
  const entries = await readdir(current, { withFileTypes: true });
  const files: GeneratedFileInfo[] = [];
  for (const entry of entries) {
    if (entry.name === "node_modules" || entry.name === ".git") continue;
    const abs = join(current, entry.name);
    if (entry.isSymbolicLink()) {
      throw new MockLabError(422, `symlink is not allowed in generated files: ${entry.name}`);
    }
    if (entry.isDirectory()) {
      files.push(...(await collectFiles(root, abs)));
    } else if (entry.isFile()) {
      const info = await stat(abs);
      const rel = relative(root, abs).split(sep).join("/");
      if (rel.startsWith("../") || rel.includes("/../") || rel.startsWith("/")) {
        throw new MockLabError(403, `unsafe generated file path: ${rel}`);
      }
      files.push({ path: rel, bytes: info.size });
    }
  }
  files.sort((a, b) => a.path.localeCompare(b.path));
  return files;
}

function validateGeneratedFiles(files: GeneratedFileInfo[], proposedDir: string): void {
  const paths = new Set(files.map((file) => file.path));
  if (!paths.has("package.json")) {
    throw new MockLabError(422, "generated package.json is required");
  }
  if (!paths.has("src/server.ts") && !paths.has("server.mjs") && !paths.has("server.js")) {
    throw new MockLabError(422, "generated server entry is required");
  }
  for (const file of files) {
    if (file.bytes > 1_000_000) throw new MockLabError(422, `${file.path} exceeds 1MB`);
    const abs = resolve(proposedDir, file.path);
    assertInside(proposedDir, abs);
  }
}

export function assertMockId(value: string): void {
  if (!MOCK_ID_PATTERN.test(value)) throw new MockLabError(400, "mock_id 형식이 올바르지 않습니다.");
}

function assertRunId(value: string): void {
  if (!RUN_ID_PATTERN.test(value)) throw new MockLabError(400, "run_id 형식이 올바르지 않습니다.");
}

function assertInside(root: string, target: string): void {
  if (target !== root && !target.startsWith(root + sep)) {
    throw new MockLabError(403, "허용되지 않은 경로입니다.");
  }
}

function inferRunStartedAt(runId: string): string | null {
  const match = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z-generate-[a-f0-9]{6}$/.exec(runId);
  if (!match) return null;
  return `${match[1]}-${match[2]}-${match[3]}T${match[4]}:${match[5]}:${match[6]}Z`;
}

function isRecord(value: unknown): value is Record<string, any> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
