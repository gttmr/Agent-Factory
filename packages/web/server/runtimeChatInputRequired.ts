import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { RuntimeChatStatus } from "./runtimeChat";
import { extractRemoteInputRequiredFromAdkEvents, type RemoteInputRequiredDisplayState } from "./runtimeChatEvents";

export interface RuntimeChatInputRequiredResult {
  readonly input_required: RemoteInputRequiredDisplayState | null;
  readonly session: RuntimeChatSessionRef | null;
  readonly error: string | null;
}

export interface RuntimeChatSessionRef {
  readonly app_name: string;
  readonly user_id: string;
  readonly session_id: string;
}

interface RuntimeChatSmokeConfig {
  readonly appName: string;
  readonly userId: string;
  readonly sessionId: string;
}

export async function runtimeChatInputRequiredFromStatus(status: RuntimeChatStatus): Promise<RuntimeChatInputRequiredResult> {
  const smokeConfig = await readRuntimeChatSmokeConfig(status.paths.runtime_stub_dir);
  const session = smokeConfig
    ? {
        app_name: smokeConfig.appName,
        user_id: smokeConfig.userId,
        session_id: smokeConfig.sessionId
      }
    : {
        app_name: status.app_name,
        user_id: "af-reviewer",
        session_id: "af-smoke"
      };
  const eventsResult = await fetchSessionEvents(status.api_base_url, session);
  if (!eventsResult.ok) {
    return { input_required: null, session, error: eventsResult.error };
  }
  return {
    input_required: extractRemoteInputRequiredFromAdkEvents(eventsResult.events),
    session,
    error: null
  };
}

async function readRuntimeChatSmokeConfig(stubDir: string): Promise<RuntimeChatSmokeConfig | null> {
  const path = join(stubDir, "runtime-chat-smoke.json");
  try {
    const parsed: unknown = JSON.parse(await readFile(path, "utf8"));
    return parseRuntimeChatSmokeConfig(parsed);
  } catch (error) {
    if (error instanceof Error) return null;
    throw error;
  }
}

function parseRuntimeChatSmokeConfig(value: unknown): RuntimeChatSmokeConfig | null {
  if (!isRecord(value)) return null;
  const appName = stringValue(value.appName);
  const userId = stringValue(value.userId);
  const sessionId = stringValue(value.sessionId);
  if (!appName || !userId || !sessionId) return null;
  return { appName, userId, sessionId };
}

async function fetchSessionEvents(
  apiBaseUrl: string,
  session: RuntimeChatSessionRef
): Promise<{ readonly ok: true; readonly events: readonly unknown[] } | { readonly ok: false; readonly error: string }> {
  const url = `${apiBaseUrl}/apps/${encodeURIComponent(session.app_name)}/users/${encodeURIComponent(session.user_id)}/sessions/${encodeURIComponent(
    session.session_id
  )}`;
  try {
    const response = await fetch(url);
    if (!response.ok) return { ok: false, error: `ADK session route returned HTTP ${response.status}.` };
    const body: unknown = await response.json();
    return { ok: true, events: sessionEvents(body) };
  } catch (error) {
    if (error instanceof Error) return { ok: false, error: `ADK session route is not reachable: ${error.message}` };
    throw error;
  }
}

function sessionEvents(value: unknown): readonly unknown[] {
  if (!isRecord(value) || !Array.isArray(value.events)) return [];
  return value.events;
}

function stringValue(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
