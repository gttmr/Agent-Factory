import type { IncomingMessage, ServerResponse } from "node:http";

export interface ReadBodyOptions {
  readonly maxBytes?: number;
  readonly sizeLimitMessage?: string;
}

export interface ReadJsonBodyOptions extends ReadBodyOptions {
  readonly treatWhitespaceAsEmpty?: boolean;
}

export async function readJsonBody(req: IncomingMessage, options: ReadJsonBodyOptions = {}): Promise<unknown> {
  const raw = await readRawBody(req, options);
  const emptyBody = options.treatWhitespaceAsEmpty === false ? raw.length === 0 : !raw.trim();
  if (emptyBody) return {};
  return JSON.parse(raw);
}

export async function readRawBody(req: IncomingMessage, options: ReadBodyOptions = {}): Promise<string> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    const buffer = bodyChunkToBuffer(chunk);
    size += buffer.length;
    if (typeof options.maxBytes === "number" && size > options.maxBytes) {
      req.destroy();
      throw new Error(options.sizeLimitMessage ?? "요청 본문이 너무 큽니다.");
    }
    chunks.push(buffer);
  }
  return Buffer.concat(chunks).toString("utf8");
}

function bodyChunkToBuffer(chunk: unknown): Buffer {
  if (Buffer.isBuffer(chunk)) return chunk;
  if (typeof chunk === "string") return Buffer.from(chunk);
  if (chunk instanceof Uint8Array) return Buffer.from(chunk);
  throw new Error("지원하지 않는 요청 본문 청크입니다.");
}

export function sendJson(res: ServerResponse, statusCode: number, body: unknown): void {
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(`${JSON.stringify(body)}\n`);
}

export function ifMatchHeader(value: string | string[] | undefined): string | null {
  if (Array.isArray(value)) return value[0] ?? null;
  if (typeof value === "string" && value.length > 0) return value;
  return null;
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
