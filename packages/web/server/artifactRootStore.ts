import { AsyncLocalStorage } from "node:async_hooks";
import { createHash } from "node:crypto";
import { mkdir, readdir, readFile, stat, writeFile } from "node:fs/promises";
import { join, resolve, sep } from "node:path";
import {
  parseAfRunManifest,
  serializeAfRunManifest,
  type AfRunManifest
} from "../src/analyzer/afRunManifest";

export const REQ_ID_PATTERN = /^[a-z0-9][a-z0-9_-]{0,63}$/;

export interface ArtifactRootStoreOptions {
  repoRoot: string;
}

export interface ArtifactReadResult {
  content: string;
  etag: string;
  bytes: number;
}

export interface ArtifactWriteResult {
  etag: string;
  bytes: number;
}

export interface ArtifactRootSummary {
  requirement_id: string;
  artifact_root: string;
  current_stage: AfRunManifest["current_stage"];
  approvals: AfRunManifest["approvals"];
  updated_at: string;
}

export class ArtifactValidationError extends Error {
  statusCode: number;

  constructor(statusCode: number, message: string) {
    super(message);
    this.name = "ArtifactValidationError";
    this.statusCode = statusCode;
  }
}

export class ArtifactConflictError extends Error {
  expectedEtag: string;
  actualEtag: string;

  constructor(expectedEtag: string, actualEtag: string) {
    super(`ETag 불일치: 다른 곳에서 수정되었습니다.`);
    this.name = "ArtifactConflictError";
    this.expectedEtag = expectedEtag;
    this.actualEtag = actualEtag;
  }
}

const WRITE_WHITELIST: RegExp[] = [
  /^af-run-manifest\.json$/,
  /^analysis-result\.json$/,
  /^normalized-requirement\.json$/,
  /^asset-candidates\.json$/,
  /^graph-ir\.json$/,
  /^scaffold-plan\.json$/,
  /^analysis-summary\.md$/,
  /^boundary-design\.md$/,
  /^implementation-handoff\.md$/,
  /^validation-report\.md$/,
  /^catalog-delta\.yaml$/,
  /^collaboration\/(comments|highlights)\.json$/
];

const READ_WHITELIST: RegExp[] = [
  ...WRITE_WHITELIST,
  /^runtime-stub\/[A-Za-z0-9_.\/-]+$/
];

// Store instances created by different middleware modules still share this queue.
const canonicalWriteLocks = new Map<string, Promise<void>>();
const heldCanonicalWriteLocks = new AsyncLocalStorage<ReadonlyMap<ArtifactRootStore, ReadonlySet<string>>>();

async function runWithCanonicalWriteLock<T>(key: string, operation: () => Promise<T>): Promise<T> {
  const previous = canonicalWriteLocks.get(key) ?? Promise.resolve();
  const ready = previous.catch(() => undefined);
  let release!: () => void;
  const gate = new Promise<void>((resolveGate) => {
    release = resolveGate;
  });
  const tail = ready.then(() => gate);
  canonicalWriteLocks.set(key, tail);
  await ready;
  try {
    return await operation();
  } finally {
    release();
    if (canonicalWriteLocks.get(key) === tail) canonicalWriteLocks.delete(key);
  }
}

export class ArtifactRootStore {
  private readonly artifactsRoot: string;

  constructor(opts: ArtifactRootStoreOptions) {
    this.artifactsRoot = resolve(opts.repoRoot, "artifacts/af");
  }

  /** Validate a req-id and produce the absolute path of its artifact root. */
  resolveRootDir(reqId: string): string {
    this.assertReqId(reqId);
    const abs = resolve(this.artifactsRoot, reqId);
    if (!abs.startsWith(this.artifactsRoot + sep) && abs !== this.artifactsRoot) {
      throw new ArtifactValidationError(403, "허용되지 않은 경로입니다.");
    }
    return abs;
  }

  resolveArtifactPath(reqId: string, relative: string, mode: "read" | "write"): string {
    this.assertReqId(reqId);
    if (typeof relative !== "string" || relative.length === 0) {
      throw new ArtifactValidationError(400, "상대 경로가 필요합니다.");
    }
    if (relative.includes("..") || relative.startsWith("/") || relative.startsWith("\\")) {
      throw new ArtifactValidationError(403, "허용되지 않은 경로입니다.");
    }
    const whitelist = mode === "write" ? WRITE_WHITELIST : READ_WHITELIST;
    if (!whitelist.some((pattern) => pattern.test(relative))) {
      throw new ArtifactValidationError(405, `허용되지 않은 아티팩트 경로입니다: ${relative}`);
    }
    const rootDir = this.resolveRootDir(reqId);
    const abs = resolve(rootDir, relative);
    if (!abs.startsWith(rootDir + sep) && abs !== rootDir) {
      throw new ArtifactValidationError(403, "허용되지 않은 경로입니다.");
    }
    return abs;
  }

  async listRoots(): Promise<ArtifactRootSummary[]> {
    let entries: string[];
    try {
      entries = await readdir(this.artifactsRoot);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
      throw error;
    }
    const summaries: ArtifactRootSummary[] = [];
    for (const name of entries) {
      if (!REQ_ID_PATTERN.test(name)) continue;
      const dir = join(this.artifactsRoot, name);
      const dirStat = await stat(dir).catch(() => null);
      if (!dirStat?.isDirectory()) continue;
      const manifestPath = join(dir, "af-run-manifest.json");
      const fileStat = await stat(manifestPath).catch(() => null);
      if (!fileStat) continue;
      try {
        const text = await readFile(manifestPath, "utf8");
        const manifest = parseAfRunManifest(text, "af-run-manifest.json");
        summaries.push({
          requirement_id: manifest.requirement_id,
          artifact_root: `artifacts/af/${name}`,
          current_stage: manifest.current_stage,
          approvals: manifest.approvals,
          updated_at: fileStat.mtime.toISOString()
        });
      } catch {
        // skip unreadable manifests rather than failing the whole listing
      }
    }
    summaries.sort((a, b) => b.updated_at.localeCompare(a.updated_at));
    return summaries;
  }

  async createRoot(reqId: string): Promise<{ requirement_id: string; artifact_root: string }> {
    return await this.withCanonicalWriteLock(reqId, async () => {
      const rootDir = this.resolveRootDir(reqId);
      const manifestPath = join(rootDir, "af-run-manifest.json");
      const existing = await stat(manifestPath).catch(() => null);
      if (existing) {
        throw new ArtifactValidationError(409, `이미 존재하는 requirement_id 입니다: ${reqId}`);
      }
      await mkdir(rootDir, { recursive: true });
      const manifest: AfRunManifest = {
        requirement_id: reqId,
        artifact_root: `artifacts/af/${reqId}`,
        current_stage: "analyze",
        stages: {
          analyze: { status: "pending", outputs: [] },
          design: { status: "pending", outputs: [] },
          build: { status: "pending", outputs: [] },
          verify: { status: "pending", outputs: [] }
        },
        approvals: {
          analysis_reviewed: false,
          boundaries_approved: false,
          runtime_contracts_approved: false,
          stub_ready_for_followup: false
        },
        validation: { commands: [], last_result: "not_run" }
      };
      await writeFile(manifestPath, serializeAfRunManifest(manifest), "utf8");
      return { requirement_id: reqId, artifact_root: manifest.artifact_root };
    });
  }

  async readArtifact(reqId: string, relative: string): Promise<ArtifactReadResult> {
    const abs = this.resolveArtifactPath(reqId, relative, "read");
    const content = await readFile(abs, "utf8").catch((error) => {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        throw new ArtifactValidationError(404, `아티팩트를 찾을 수 없습니다: ${relative}`);
      }
      throw error;
    });
    return { content, etag: computeEtag(content), bytes: Buffer.byteLength(content, "utf8") };
  }

  async writeArtifact(
    reqId: string,
    relative: string,
    content: string,
    ifMatch?: string | null
  ): Promise<ArtifactWriteResult> {
    return await this.withCanonicalWriteLock(reqId, async () => {
      const abs = this.resolveArtifactPath(reqId, relative, "write");
      if (ifMatch) {
        const current = await readFile(abs, "utf8").catch((error) => {
          if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
          throw error;
        });
        if (current !== null) {
          const currentEtag = computeEtag(current);
          if (currentEtag !== ifMatch) {
            throw new ArtifactConflictError(ifMatch, currentEtag);
          }
        } else if (ifMatch !== "0") {
          throw new ArtifactConflictError(ifMatch, "0");
        }
      }
      await mkdir(abs.substring(0, abs.lastIndexOf(sep)), { recursive: true });
      await writeFile(abs, content, "utf8");
      return { etag: computeEtag(content), bytes: Buffer.byteLength(content, "utf8") };
    });
  }

  async withCanonicalWriteLock<T>(reqId: string, operation: () => Promise<T>): Promise<T> {
    const key = this.resolveRootDir(reqId);
    const heldLocks = heldCanonicalWriteLocks.getStore();
    // Preserve overridden writeArtifact methods without re-acquiring the batch owner's lock.
    if (heldLocks?.get(this)?.has(key)) return await operation();

    return await runWithCanonicalWriteLock(key, async () => {
      const nextHeldLocks = new Map(heldLocks);
      nextHeldLocks.set(this, new Set([...(heldLocks?.get(this) ?? []), key]));
      return await heldCanonicalWriteLocks.run(nextHeldLocks, operation);
    });
  }

  async readManifest(reqId: string): Promise<{ manifest: AfRunManifest; etag: string }> {
    const result = await this.readArtifact(reqId, "af-run-manifest.json");
    let manifest: AfRunManifest;
    try {
      manifest = parseAfRunManifest(result.content);
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      throw new ArtifactValidationError(422, `af-run-manifest.json 검증 실패: ${detail}`);
    }
    if (manifest.requirement_id !== reqId) {
      throw new ArtifactValidationError(
        422,
        `af-run-manifest.json requirement_id가 artifact root와 일치하지 않습니다: ${manifest.requirement_id} != ${reqId}`
      );
    }
    const expectedRoot = `artifacts/af/${reqId}`;
    if (manifest.artifact_root !== expectedRoot) {
      throw new ArtifactValidationError(
        422,
        `af-run-manifest.json artifact_root가 canonical 경로와 일치하지 않습니다: ${manifest.artifact_root} != ${expectedRoot}`
      );
    }
    return { manifest, etag: result.etag };
  }

  async writeManifest(
    reqId: string,
    manifest: AfRunManifest,
    ifMatch?: string | null
  ): Promise<ArtifactWriteResult> {
    return this.writeArtifact(reqId, "af-run-manifest.json", serializeAfRunManifest(manifest), ifMatch);
  }

  private assertReqId(reqId: string): void {
    if (typeof reqId !== "string" || !REQ_ID_PATTERN.test(reqId)) {
      throw new ArtifactValidationError(
        400,
        "requirement_id 형식이 올바르지 않습니다. 소문자/숫자/하이픈/언더스코어만 허용됩니다."
      );
    }
  }
}

export function computeEtag(content: string): string {
  return createHash("sha256").update(content, "utf8").digest("hex");
}
