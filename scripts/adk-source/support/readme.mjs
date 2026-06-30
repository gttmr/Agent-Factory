import { join, relative } from "node:path";
import { RUNTIME_MCP_LABEL } from "../context.mjs";
import { remoteA2aEnvVars, remoteA2aRuntimeRows } from "../remote-a2a.mjs";
import { sampleConversationTranscript } from "./samples.mjs";

export function buildReadme(context) {
  const { normalizedRequirement, outputMode, packageName } = context;
  const runtimeEnvPath = runtimeEnvRelativePath(context);
  const runtimeEnvDir = posixDirname(runtimeEnvPath);
  const runtimeRequirementsPath = runtimeRequirementsRelativePath(context);
  if (outputMode === "runnable") {
    return `# ${packageName}

${normalizedRequirement.title}의 승인된 scaffold-plan.json에서 생성한 runnable ADK 2.1 Workflow입니다.

\`\`\`bash
# repository root
python3 -m venv .agent-factory/runtime/.venv
.agent-factory/runtime/.venv/bin/python -m pip install -r requirements/adk-runtime.txt

# generated runtime-stub
mkdir -p ${runtimeEnvDir}
cp .env.example ${runtimeEnvPath}
python -m compileall ${packageName}
python -m pytest -q
\`\`\`

Windows에서는 \`py -3 -m venv .agent-factory\\runtime\\.venv\` 후 \`.agent-factory\\runtime\\.venv\\Scripts\\python.exe -m pip install -r requirements\\adk-runtime.txt\` 를 사용하세요.
이 bundle은 artifact-local \`requirements.txt\` 를 만들지 않습니다. 공유 dependency 기준은 repository root의 \`${runtimeRequirementsPath}\` 입니다.

## 이 번들의 역할

- \`root_agent\`는 \`google.adk.workflow.Workflow\` graph입니다. Agent node는 runtime env에 따라
  vLLM(OpenAI-compatible, \`LiteLlm\`) 또는 Gemini fallback을 쓰는 \`LlmAgent\`이고, adapter node는 deterministic
  \`FunctionNode\`입니다.
- graph는 **synthetic input만** 사용합니다. private endpoint, credential, 실제 고객 데이터는 포함하지 않습니다.
- reviewed Agent Factory artifact에서만 생성되었습니다(\`raw_requirement_to_code=false\`).

## 설정 변경

\`agents.config.yaml\`에서 각 node의 \`model\`, \`instruction\`, adapter의 \`mcp_url\`을 검토/수정하세요.
\`agent.py\`가 import 시점에 이 파일을 읽으므로 다음 실행부터 변경이 적용됩니다.

\`.env.example\`을 repository root의 \`.agent-factory/runtime.env\`로 복사하고 공유 runtime secret은 그 파일에 둡니다.
\`AF_RUNTIME_ENV_FILE\`로 다른 파일을 지정할 수도 있습니다. \`AF_LLM_PROVIDER=auto\`에서는 \`AF_VLLM_API_BASE\` 또는
\`AF_VLLM_MODEL\`이 있으면 vLLM을 쓰고, 없으면 \`GOOGLE_API_KEY\` 기반 Gemini fallback을 사용합니다.
Windows + LiteLLM 실행 환경에서는 \`PYTHONUTF8=1\`을 함께 둡니다.

${buildMockLabRunMarkdown(context)}

${buildRemoteA2aRuntimePolicyMarkdown(context)}

${buildSampleDialogueMarkdown(context)}

## Adapter와 Mock Lab

연결된 adapter는 streamable-HTTP로 실행 중인 Mock Lab MCP tool을 호출합니다
(\`AF_MOCK_LAB_MCP_URL\` base, 기본값 \`http://127.0.0.1:5173/api/mock-lab/mcp\`).
이 결과는 \`${RUNTIME_MCP_LABEL}\` 라벨과 함께 payload와 \`workflow_manifest.json\`에 기록됩니다.
Mock Lab server가 binding/running 상태가 아닌 adapter는 reviewed synthetic mock output을 반환하는 TODO stub으로 남고,
\`workflow_manifest.json\`의 \`runtime.unconnected_adapters\`에 표시됩니다.

## ADK Web

\`\`\`bash
AF_RUNTIME_ENV_FILE=${runtimeEnvPath} \\
AF_MOCK_LAB_MCP_URL=http://127.0.0.1:5176/api/mock-lab/mcp \\
adk web --host 127.0.0.1 --port 8765 --no-reload .
curl -X POST http://127.0.0.1:8765/apps/${packageName}/users/af-reviewer/sessions/af-smoke -H "Content-Type: application/json" -d '{}'
curl -X POST http://127.0.0.1:8765/run -H "Content-Type: application/json" -d @runtime-chat-smoke.json
\`\`\`

## ADK A2A provider

\`\`\`bash
AF_RUNTIME_ENV_FILE=${runtimeEnvPath} \\
AF_MOCK_LAB_MCP_URL=http://127.0.0.1:5176/api/mock-lab/mcp \\
python af_adk_a2a_server.py --host 127.0.0.1 --port 8001 --session_service_uri memory:// --artifact_service_uri memory:// --no-reload --with_ui .
curl http://127.0.0.1:8001/a2a/${packageName}/.well-known/agent-card.json
\`\`\`

\`af_adk_a2a_server.py\` uses ADK's FastAPI/Web runner and A2A executor, but applies a local in-memory compatibility patch for ADK CLI versions whose \`api_server --a2a\` path fails before registering \`agent.json\`.

When generated \`RequestInput\` nodes pause the workflow, the local provider keeps that pause as an A2A \`input-required\` task state and exposes the ADK long-running function call as \`adk_request_input\`. Agent Card metadata advertises the ADK A2A extension used by ADK 2.3 for this local executor path, but it does not prove full remote HITL resume support; verify same-task function-response continuation before treating plain chat follow-up as resume.
`;
  }
  return `# ${packageName}

${normalizedRequirement.title}의 승인된 scaffold-plan.json에서 생성한 ADK smoke handoff입니다.

\`\`\`bash
# repository root
python3 -m venv .agent-factory/runtime/.venv
.agent-factory/runtime/.venv/bin/python -m pip install -r requirements/adk-runtime.txt

# generated runtime-stub
python -m compileall ${packageName}
python -m pytest -q
\`\`\`

Windows에서는 \`py -3 -m venv .agent-factory\\runtime\\.venv\` 후 \`.agent-factory\\runtime\\.venv\\Scripts\\python.exe -m pip install -r requirements\\adk-runtime.txt\` 를 사용하세요.
이 bundle은 artifact-local \`requirements.txt\` 를 만들지 않습니다. 공유 dependency 기준은 repository root의 \`${runtimeRequirementsPath}\` 입니다.

## ADK runtime chat smoke

이 bundle은 검토된 합성 테스트 더블만 사용해 로컬 ADK API/Web UI smoke test를 수행합니다.
비공개 endpoint, credential, 배포 script, 실제 업무 로직은 포함하지 않습니다.

\`\`\`bash
adk api_server --host 127.0.0.1 --port 8765 --session_service_uri memory:// --artifact_service_uri memory:// --no-reload --with_ui .
curl -X POST http://127.0.0.1:8765/apps/${packageName}/users/af-reviewer/sessions/af-smoke -H "Content-Type: application/json" -d '{}'
curl -X POST http://127.0.0.1:8765/run -H "Content-Type: application/json" -d @runtime-chat-smoke.json
\`\`\`
`;
}

export function buildImplementationHandoff(context) {
  const { scaffoldPlan, normalizedRequirement, outputMode, unconnectedAdapters } = context;
  const todoLines = scaffoldPlan.modules.flatMap((module) =>
    (module.developer_todos ?? []).map((todo) => `- ${module.name}: ${todo}`)
  );
  if (outputMode === "runnable") {
    const unconnected = unconnectedAdapters.map((module) => `- ${module.name}: Mock Lab MCP 서버를 binding하거나 합성 stub으로 유지하세요.`);
    return `# 구현 Handoff (runnable mode)

${normalizedRequirement.title}의 reviewed scaffold-plan.json에서 생성되었습니다.

## 현재 실행되는 것

- Agent node는 runtime env에 따라 vLLM(OpenAI-compatible) 또는 Gemini fallback을 호출하고, 연결된 Adapter node는 실제 실행 시점에 Mock Lab MCP tool을 호출합니다.
- 연결된 MCP 결과는 \`${RUNTIME_MCP_LABEL}\` 라벨과 함께 payload에 기록됩니다.
- 모든 실행은 합성 input만 사용합니다.

## 반드시 유지할 경계

- 비공개 endpoint, credential, 고객 데이터, 배포 script를 추가하지 마세요.
- Adapter 호출은 실제 운영 system이 아니라 합성 Mock Lab 서버를 향해야 합니다.
- 동작은 \`agents.config.yaml\`에서 조정하고 공유 secret은 \`.agent-factory/runtime.env\`에 둡니다. secret을 코드에 hard-code하지 마세요.

## 미연결 adapter

${unconnected.length ? unconnected.join("\n") : "- none"}

${buildRemoteA2aHandoffMarkdown(context)}

## 검토된 TODO

${todoLines.length ? todoLines.join("\n") : "- 운영 wiring 전에 generated node를 검토하세요."}
`;
  }
  return `# 구현 Handoff

${normalizedRequirement.title}의 reviewed scaffold-plan.json에서 생성되었습니다.

## 하지 않는 일

- 이 generated bundle 안에 실행 가능한 업무 로직을 추가하지 않습니다.
- 비공개 endpoint, credential, 고객 데이터, 배포 script를 추가하지 않습니다.
- 런타임 wiring이 승인된 뒤 별도 구현 작업에서만 TODO boundary를 대체합니다.

## TODO Boundaries

${todoLines.length ? todoLines.join("\n") : "- 구현 전에 generated TODO_IMPLEMENT_HERE function을 검토하세요."}
`;
}

function runtimeEnvRelativePath({ outputRoot }) {
  return relative(outputRoot, join(process.cwd(), ".agent-factory", "runtime.env")).replace(/\\/g, "/");
}

function runtimeRequirementsRelativePath({ outputRoot }) {
  return relative(outputRoot, join(process.cwd(), "requirements", "adk-runtime.txt")).replace(/\\/g, "/");
}

function posixDirname(path) {
  const segments = String(path).split("/");
  segments.pop();
  return segments.length ? segments.join("/") : ".";
}

function mockSpecRelativePath({ outputRoot, artifactRoot }) {
  return relative(outputRoot, join(artifactRoot, "mock-lab", "mock-spec.json")).replace(/\\/g, "/");
}

function buildSampleDialogueMarkdown(context) {
  return ["## Sample ADK Web messages", "", "```text", sampleConversationTranscript(context), "```"].join("\n");
}

function buildRemoteA2aRuntimePolicyMarkdown(context) {
  const rows = remoteA2aRuntimeRows(context);
  if (!rows.length) return "";
  const lines = rows.map((row) => {
    const auth = row.adk_runtime_policy?.auth;
    const timeout = row.adk_runtime_policy?.timeout_seconds ?? "null";
    const authText = auth?.mode === "none" ? "none" : `${auth?.mode ?? "missing"} via ${auth?.env_var ?? "missing env"}`;
    return `- ${row.module_name} (${row.contract_id}): timeout_seconds=${timeout}, auth=${authText}`;
  });
  return `## Remote A2A runtime policy

${lines.join("\n")}

retry_handoff and fallback_handoff are reviewed handoff policy; this generator does not emit retry/fallback wrappers.
`;
}

function buildRemoteA2aHandoffMarkdown(context) {
  const rows = remoteA2aRuntimeRows(context);
  if (!rows.length) return "";
  const envVars = remoteA2aEnvVars(context);
  return `## Remote A2A runtime policy

${rows
  .map((row) => `- ${row.module_name} (${row.contract_id}): set reviewed env-backed auth before smoke runs.`)
  .join("\n")}
${envVars.length ? `- Required env vars: ${envVars.join(", ")}` : "- Required env vars: none"}
- Remote A2A retry/fallback policy is not generated as an ADK retry wrapper; keep it in operator handoff until an ADK-supported runtime policy is reviewed.
`;
}

function buildMockLabRunMarkdown(context) {
  const mockId = context.mockLabSpec?.mock_id || "<mock-id>";
  return `## Mock Lab MCP server

From the repo root, start the existing Mock Lab package on its fixed standalone port and run the saved spec:

\`\`\`bash
npm run dev --prefix packages/mock-lab -- --host 0.0.0.0 --port 5176 --strictPort
curl -X POST http://127.0.0.1:5176/api/mock-lab/${mockId}/server/start
curl 'http://127.0.0.1:5176/api/mock-lab/mcp-discovery?server=${mockId}'
\`\`\`

Then run ADK Web from this generated output root with the standalone Mock Lab URL explicit, so it wins over any central runtime default:

\`\`\`bash
AF_RUNTIME_ENV_FILE=${runtimeEnvRelativePath(context)} \\
AF_MOCK_LAB_MCP_URL=http://127.0.0.1:5176/api/mock-lab/mcp \\
adk web --host 127.0.0.1 --port 8765 --no-reload .
\`\`\`

Direct stdio smoke for the same saved spec:

\`\`\`bash
AFML_MOCK_SPEC=$PWD/${mockSpecRelativePath(context)} \\
npm run mcp:stdio --prefix ../../packages/mock-lab
\`\`\``;
}
