import type { IncomingMessage, ServerResponse } from "node:http";
import type { RuntimeA2aManager } from "./runtimeA2a";
import { sendJson } from "./httpApi";

export async function handleRuntimeA2a(
  runtimeA2a: RuntimeA2aManager,
  reqId: string,
  rest: string[],
  req: IncomingMessage,
  res: ServerResponse
): Promise<void> {
  const [action] = rest;
  if (action === "status") {
    if (req.method !== "GET") {
      sendJson(res, 405, { error: "지원하지 않는 메서드입니다." });
      return;
    }
    sendJson(res, 200, await runtimeA2a.status(reqId));
    return;
  }
  if (action === "agent-card") {
    if (req.method !== "GET") {
      sendJson(res, 405, { error: "지원하지 않는 메서드입니다." });
      return;
    }
    sendJson(res, 200, await runtimeA2a.agentCard(reqId));
    return;
  }
  if (action === "install") {
    sendJson(res, 405, {
      error: "웹에서 ADK dependency 설치는 지원하지 않습니다. 공유 venv를 수동으로 준비하세요.",
      status: await runtimeA2a.status(reqId)
    });
    return;
  }
  if (action === "start") {
    if (req.method !== "POST") {
      sendJson(res, 405, { error: "지원하지 않는 메서드입니다." });
      return;
    }
    sendJson(res, 200, await runtimeA2a.start(reqId));
    return;
  }
  if (action === "stop") {
    if (req.method !== "POST") {
      sendJson(res, 405, { error: "지원하지 않는 메서드입니다." });
      return;
    }
    sendJson(res, 200, await runtimeA2a.stop(reqId));
    return;
  }
  sendJson(res, 404, { error: "알 수 없는 runtime-a2a 경로입니다." });
}
