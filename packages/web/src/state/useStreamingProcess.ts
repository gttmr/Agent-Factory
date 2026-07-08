export interface ProcessStreamEvent<TData = Record<string, unknown>> {
  event: string;
  data: TData;
}

export interface StreamLogEntry {
  readonly id: number;
  readonly text: string;
}

export function formatProcessStreamLogLine(event: ProcessStreamEvent): string {
  const data = event.data;
  if (event.event === "stdout" || event.event === "stderr") {
    return `[${event.event}] ${withTrailingNewline(valueToString(data.chunk))}`;
  }
  if (event.event === "start") {
    return `[start] ${valueToString(data.command ?? data.command_key ?? "process")}\n`;
  }
  if (event.event === "done") {
    return `[done] exit ${valueToString(data.exit_code ?? 0)}\n`;
  }
  if (event.event === "error") {
    return `[error] ${valueToString(data.error ?? data.message ?? "실패")}\n`;
  }
  return `[${event.event}] ${JSON.stringify(data)}\n`;
}

export class StreamProcessError extends Error {
  status: number;
  details?: unknown;

  constructor(status: number, message: string, details?: unknown) {
    super(message);
    this.name = "StreamProcessError";
    this.status = status;
    this.details = details;
  }
}

export async function streamServerEvents<TDone>(
  input: RequestInfo | URL,
  init: RequestInit,
  onEvent?: (event: ProcessStreamEvent) => void
): Promise<TDone> {
  const headers = new Headers(init.headers);
  headers.set("accept", "text/event-stream");
  const response = await fetch(input, { ...init, headers });
  if (!response.ok || !response.body) {
    throw await readStreamResponseError(response, "stream 실행 실패");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let finalData: TDone | null = null;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let separator = buffer.indexOf("\n\n");
    while (separator !== -1) {
      const block = buffer.slice(0, separator);
      buffer = buffer.slice(separator + 2);
      const event = parseServerEvent(block);
      if (event) {
        onEvent?.(event);
        if (event.event === "done" || event.event === "error") {
          finalData = event.data as TDone;
        }
      }
      separator = buffer.indexOf("\n\n");
    }
  }

  if (finalData === null) {
    throw new StreamProcessError(500, "stream 종료 이벤트를 받지 못했습니다.");
  }
  return finalData;
}

async function readStreamResponseError(response: Response, fallback: string): Promise<StreamProcessError> {
  const contentType = response.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    try {
      const body = (await response.json()) as { error?: string; details?: unknown };
      return new StreamProcessError(response.status, body.error ?? fallback, body.details);
    } catch {
      // fall through
    }
  }
  return new StreamProcessError(response.status, fallback);
}

function parseServerEvent(block: string): ProcessStreamEvent | null {
  let event = "message";
  const dataLines: string[] = [];
  for (const line of block.split("\n")) {
    if (line.startsWith("event:")) event = line.slice("event:".length).trim();
    if (line.startsWith("data:")) dataLines.push(line.slice("data:".length).trimStart());
  }
  if (dataLines.length === 0) return null;
  try {
    return {
      event,
      data: JSON.parse(dataLines.join("\n")) as Record<string, unknown>
    };
  } catch {
    return null;
  }
}

function valueToString(value: unknown): string {
  return typeof value === "string" ? value : String(value);
}

function withTrailingNewline(value: string): string {
  return value.endsWith("\n") ? value : `${value}\n`;
}
