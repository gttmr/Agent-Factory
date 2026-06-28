import { mkdir, readdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { join, resolve, sep } from "node:path";
import type { MockDraftSummary, MockSpec } from "../src/types/mockSpec";
import { assertValidMockSpec } from "./schemaValidation";

export const MOCK_ID_PATTERN = /^[a-zA-Z0-9_-]{3,80}$/;
export const DRAFT_ID_PATTERN = /^\d{8}T\d{6}Z-draft-[a-f0-9]{6}$/;

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
        throw new MockLabError(404, `Mock spec is not saved: ${mockId}. Save the spec before running the mock server or smoke tests.`);
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

  resolveDraftDir(mockId: string, draftId: string): string {
    assertDraftId(draftId);
    const draftsRoot = resolve(this.resolveMockDir(mockId), "drafts");
    const abs = resolve(draftsRoot, draftId);
    assertInside(draftsRoot, abs);
    return abs;
  }

  resolveDraftSpec(mockId: string, draftId: string): string {
    return join(this.resolveDraftDir(mockId, draftId), "draft-spec.json");
  }

  resolveAuditLog(mockId: string): string {
    return join(this.resolveMockDir(mockId), "audit-log.jsonl");
  }

  resolveServerState(mockId: string): string {
    return join(this.resolveMockDir(mockId), "server-state.json");
  }

  async writeDraftSpec(mockId: string, draftId: string, spec: unknown): Promise<{ ok: true; bytes: number }> {
    assertMockId(mockId);
    assertDraftId(draftId);
    assertValidMockSpec(spec);
    if (spec.mock_id !== mockId) {
      throw new MockLabError(422, "draft spec mock_id must match the selected mock");
    }
    const path = this.resolveDraftSpec(mockId, draftId);
    const content = `${JSON.stringify(spec, null, 2)}\n`;
    await mkdir(path.slice(0, path.lastIndexOf(sep)), { recursive: true });
    await writeFile(path, content, "utf8");
    return { ok: true, bytes: Buffer.byteLength(content, "utf8") };
  }

  async readDraftSpec(mockId: string, draftId: string): Promise<MockSpec> {
    const parsed = JSON.parse(await readFile(this.resolveDraftSpec(mockId, draftId), "utf8")) as unknown;
    assertValidMockSpec(parsed);
    if (parsed.mock_id !== mockId) {
      throw new MockLabError(422, "draft spec mock_id must match the selected mock");
    }
    return parsed;
  }

  async listDrafts(mockId: string): Promise<MockDraftSummary[]> {
    const draftsRoot = join(this.resolveMockDir(mockId), "drafts");
    const entries = await readdir(draftsRoot, { withFileTypes: true }).catch((error) => {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
      throw error;
    });
    const drafts: MockDraftSummary[] = [];
    for (const entry of entries) {
      if (!entry.isDirectory() || !DRAFT_ID_PATTERN.test(entry.name)) continue;
      const draftDir = join(draftsRoot, entry.name);
      const summary = await readJson<MockDraftSummary>(join(draftDir, "result-summary.json")).catch(() => null);
      if (summary) {
        drafts.push(summary);
        continue;
      }
      const request = await readJson<Record<string, unknown>>(join(draftDir, "request.json")).catch(() => null);
      if (request) {
        drafts.push({
          draft_id: entry.name,
          mock_id: mockId,
          status: "failed",
          model: typeof request.model === "string" ? request.model : "gpt-5.5",
          started_at: inferDraftStartedAt(entry.name) ?? new Date(0).toISOString(),
          finished_at: null,
          elapsed_ms: 0,
          pid: null,
          command: null,
          validation: {
            ok: false,
            errors: ["result-summary.json is missing; draft may have been interrupted before status was recorded."],
            warnings: []
          },
          last_error: "result-summary.json is missing; draft may have been interrupted before status was recorded."
        });
      }
    }
    drafts.sort((a, b) => {
      const left = isRecord(a) && typeof a.started_at === "string" ? a.started_at : "";
      const right = isRecord(b) && typeof b.started_at === "string" ? b.started_at : "";
      return right.localeCompare(left);
    });
    return drafts;
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

export function assertMockId(value: string): void {
  if (!MOCK_ID_PATTERN.test(value)) throw new MockLabError(400, "mock_id 형식이 올바르지 않습니다.");
}

function assertDraftId(value: string): void {
  if (!DRAFT_ID_PATTERN.test(value)) throw new MockLabError(400, "draft_id 형식이 올바르지 않습니다.");
}

function assertInside(root: string, target: string): void {
  if (target !== root && !target.startsWith(root + sep)) {
    throw new MockLabError(403, "허용되지 않은 경로입니다.");
  }
}

function inferDraftStartedAt(draftId: string): string | null {
  const match = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z-draft-[a-f0-9]{6}$/.exec(draftId);
  if (!match) return null;
  return `${match[1]}-${match[2]}-${match[3]}T${match[4]}:${match[5]}:${match[6]}Z`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
