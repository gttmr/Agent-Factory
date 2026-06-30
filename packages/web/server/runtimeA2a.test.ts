import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ArtifactRootStore } from "./artifactRootStore.ts";
import { RuntimeA2aManager } from "./runtimeA2a.ts";
import { writeFakeA2aRuntime } from "./runtimeA2aTestHelpers.ts";

const repoRoot = await mkdtemp(join(tmpdir(), "af-runtime-a2a-"));
const store = new ArtifactRootStore({ repoRoot });

try {
  await assertMessageSendFailedTaskIsNotChatReady();
  await assertInputRequiredTaskIsInteractiveRequired();
  await assertInputRequiredTaskCarriesResumeMetadata();
  await assertMalformedTaskShapeFailsWithoutCrash();
  await assertRequiredMockLabServerBlocksProviderUntilRunning();
  await assertMalformedMockLabServerStateBlocksWithoutCrash();
  await assertStatusUsesCachedMessageSendProbe();
  await assertExitedSetupFailureKeepsMessage();
} finally {
  await rm(repoRoot, { recursive: true, force: true });
}

async function assertMessageSendFailedTaskIsNotChatReady(): Promise<void> {
  const scenario = await prepareScenario("req-a2a-failed-send", "req_a2a_failed_send_adk");
  await writeFakeA2aRuntime(repoRoot, {
    serveAgentCard: true,
    messageSendResult: {
      status: {
        state: "failed",
        message: { parts: [{ kind: "text", text: "synthetic task failure" }] }
      }
    }
  });

  const manager = new RuntimeA2aManager(scenario.managerOptions);
  const started = await manager.start(scenario.reqId);

  assert.equal(started.ok, true);
  assert.equal(started.status.server.status, "running");
  assert.equal(started.status.server.agent_card_ready, true);
  assert.equal(started.status.server.message_send_ready, false);
  assert.equal(started.status.server.message_send_status, "failed");
  assert.equal(started.status.server.message_send_task_state, "failed");
  assert.match(started.status.server.message ?? "", /synthetic task failure/);
  assert.equal((await manager.stop(scenario.reqId)).ok, true);
}

async function assertInputRequiredTaskIsInteractiveRequired(): Promise<void> {
  const scenario = await prepareScenario("req-a2a-input-required", "req_a2a_input_required_adk");
  await writeFakeA2aRuntime(repoRoot, {
    serveAgentCard: true,
    messageSendResult: {
      status: {
        state: "input-required",
        message: { parts: [{ kind: "text", text: "choose a route" }] }
      }
    }
  });

  const manager = new RuntimeA2aManager(scenario.managerOptions);
  const started = await manager.start(scenario.reqId);

  assert.equal(started.ok, true);
  assert.equal(started.status.server.status, "running");
  assert.equal(started.status.server.agent_card_ready, true);
  assert.equal(started.status.server.message_send_ready, false);
  assert.equal(started.status.server.message_send_status, "interactive_required");
  assert.equal(started.status.server.message_send_task_state, "input-required");
  assert.match(started.status.server.message ?? "", /choose a route/);
  assert.equal((await manager.stop(scenario.reqId)).ok, true);
}

async function assertInputRequiredTaskCarriesResumeMetadata(): Promise<void> {
  const scenario = await prepareScenario("req-a2a-input-required-resume", "req_a2a_input_required_resume_adk");
  await writeFakeA2aRuntime(repoRoot, {
    serveAgentCard: true,
    messageSendResult: {
      id: "task-probe-1",
      contextId: "ctx-probe-1",
      status: {
        state: "input-required",
        message: {
          parts: [
            {
              kind: "data",
              metadata: { adk_type: "function_call", adk_is_long_running: true },
              data: {
                id: "interrupt-probe-1",
                name: "adk_request_input",
                args: {
                  message: "목적/시나리오 분류 확인",
                  payload: "확인이 필요합니다.",
                  response_schema: { type: "string" }
                }
              }
            }
          ]
        }
      }
    }
  });

  const manager = new RuntimeA2aManager(scenario.managerOptions);
  const started = await manager.start(scenario.reqId);

  assert.equal(started.status.server.message_send_status, "interactive_required");
  assert.deepEqual(started.status.server.message_send_resume, {
    task_id: "task-probe-1",
    context_id: "ctx-probe-1",
    interrupt_id: "interrupt-probe-1",
    function_name: "adk_request_input",
    response_schema: { type: "string" }
  });

  const passiveStatus = await manager.status(scenario.reqId);

  assert.deepEqual(passiveStatus.server.message_send_resume, started.status.server.message_send_resume);
  assert.equal((await manager.stop(scenario.reqId)).ok, true);
}

async function assertMalformedTaskShapeFailsWithoutCrash(): Promise<void> {
  const scenario = await prepareScenario("req-a2a-malformed-send", "req_a2a_malformed_send_adk");
  await writeFakeA2aRuntime(repoRoot, { serveAgentCard: true, messageSendResult: { unexpected: true } });

  const manager = new RuntimeA2aManager(scenario.managerOptions);
  const started = await manager.start(scenario.reqId);

  assert.equal(started.ok, true);
  assert.equal(started.status.server.status, "running");
  assert.equal(started.status.server.agent_card_ready, true);
  assert.equal(started.status.server.message_send_ready, false);
  assert.equal(started.status.server.message_send_status, "failed");
  assert.match(started.status.server.message ?? "", /message\/send/);
  assert.equal((await manager.stop(scenario.reqId)).ok, true);
}

async function assertRequiredMockLabServerBlocksProviderUntilRunning(): Promise<void> {
  const scenario = await prepareScenario("req-a2a-required-mock", "req_a2a_required_mock_adk");
  await writeRequiredMockScaffoldPlan(scenario.stubDir, "wf-page-recommendation-mock");
  await writeMockLabServerState("wf-page-recommendation-mock", "stopped");
  await writeFakeA2aRuntime(repoRoot, {
    serveAgentCard: true,
    messageSendResult: {
      status: {
        state: "completed",
        message: { parts: [{ kind: "text", text: "ready" }] }
      }
    }
  });

  const manager = new RuntimeA2aManager(scenario.managerOptions);
  const blocked = await manager.start(scenario.reqId);

  assert.equal(blocked.ok, false);
  assert.equal(blocked.status.server.status, "failed");
  assert.equal(blocked.status.server.message_send_ready, false);
  assert.equal(blocked.status.server.message_send_status, "not_checked");
  assert.deepEqual(
    blocked.status.server.mock_lab_prerequisites.map((prerequisite) => ({
      mock_server_id: prerequisite.mock_server_id,
      status: prerequisite.status,
      running: prerequisite.running,
      start_url: prerequisite.start_action.url
    })),
    [
      {
        mock_server_id: "wf-page-recommendation-mock",
        status: "stopped",
        running: false,
        start_url: "/api/mock-lab/wf-page-recommendation-mock/server/start"
      }
    ]
  );
  assert.match(blocked.status.server.message ?? "", /wf-page-recommendation-mock/);
  assert.match(blocked.status.server.message ?? "", /\/api\/mock-lab\/wf-page-recommendation-mock\/server\/start/);

  await writeMockLabServerState("wf-page-recommendation-mock", "running");
  const started = await manager.start(scenario.reqId);

  assert.equal(started.ok, true);
  assert.equal(started.status.server.status, "running");
  assert.equal(started.status.server.message_send_ready, true);
  assert.equal(started.status.server.message_send_status, "ready");
  assert.deepEqual(
    started.status.server.mock_lab_prerequisites.map((prerequisite) => ({
      mock_server_id: prerequisite.mock_server_id,
      status: prerequisite.status,
      running: prerequisite.running
    })),
    [{ mock_server_id: "wf-page-recommendation-mock", status: "running", running: true }]
  );
  assert.equal(started.status.server.message, null);
  assert.equal((await manager.stop(scenario.reqId)).ok, true);
}

async function assertMalformedMockLabServerStateBlocksWithoutCrash(): Promise<void> {
  const scenario = await prepareScenario("req-a2a-malformed-mock-state", "req_a2a_malformed_mock_state_adk");
  await writeRequiredMockScaffoldPlan(scenario.stubDir, "wf-page-recommendation-mock");
  await writeMockLabSpec("wf-page-recommendation-mock");
  await writeFile(join(repoRoot, "artifacts/mock-lab/wf-page-recommendation-mock/server-state.json"), "{not-json\n", "utf8");
  await writeFakeA2aRuntime(repoRoot, { serveAgentCard: true });

  const manager = new RuntimeA2aManager(scenario.managerOptions);
  const blocked = await manager.start(scenario.reqId);

  assert.equal(blocked.ok, false);
  assert.equal(blocked.status.server.status, "failed");
  assert.equal(blocked.status.server.mock_lab_prerequisites[0]?.status, "stopped");
  assert.match(blocked.status.server.message ?? "", /wf-page-recommendation-mock/);
}

async function assertStatusUsesCachedMessageSendProbe(): Promise<void> {
  const scenario = await prepareScenario("req-a2a-passive-status", "req_a2a_passive_status_adk");
  const counterPath = join(repoRoot, "message-send-count.txt");
  await writeFakeA2aRuntime(repoRoot, {
    serveAgentCard: true,
    messageSendCounterPath: counterPath,
    messageSendResult: {
      status: {
        state: "input-required",
        message: { parts: [{ kind: "text", text: "choose a route" }] }
      }
    }
  });

  const manager = new RuntimeA2aManager(scenario.managerOptions);
  const started = await manager.start(scenario.reqId);

  assert.equal(started.ok, true);
  assert.equal(started.status.server.message_send_status, "interactive_required");
  assert.equal(await readCounter(counterPath), 1);

  const passiveStatus = await manager.status(scenario.reqId);

  assert.equal(passiveStatus.server.message_send_status, "interactive_required");
  assert.equal(passiveStatus.server.message_send_task_state, "input-required");
  assert.equal(await readCounter(counterPath), 1);
  assert.equal((await manager.stop(scenario.reqId)).ok, true);
}

async function assertExitedSetupFailureKeepsMessage(): Promise<void> {
  const scenario = await prepareScenario("req-a2a-setup-failure", "req_a2a_setup_failure_adk");
  await writeFakeA2aRuntime(repoRoot, { serveAgentCard: false, exitWithSetupFailure: true });

  const manager = new RuntimeA2aManager(scenario.managerOptions);
  const started = await manager.start(scenario.reqId);

  assert.equal(started.ok, false);
  assert.equal(started.status.server.status, "failed");
  assert.match(started.status.server.message ?? "", /synthetic setup failure/);
}

async function readCounter(path: string): Promise<number> {
  const text = await readFile(path, "utf8").catch(() => "0");
  return Number(text) || 0;
}

interface PreparedScenario {
  readonly reqId: string;
  readonly stubDir: string;
  readonly managerOptions: ConstructorParameters<typeof RuntimeA2aManager>[0];
}

async function prepareScenario(reqId: string, appName: string): Promise<PreparedScenario> {
  await store.createRoot(reqId);
  const port = await getAvailablePort();
  const stubDir = join(repoRoot, "artifacts/af", reqId, "runtime-stub");
  await mkdir(join(stubDir, appName), { recursive: true });
  await writeFile(
    join(stubDir, appName, "workflow_manifest.json"),
    `${JSON.stringify({ package: appName, requirement: { title: appName } }, null, 2)}\n`,
    "utf8"
  );
  await writeFile(join(stubDir, appName, "agent.py"), "root_agent = object()\n", "utf8");
  await writeFile(join(stubDir, "af_adk_a2a_server.py"), "# fake launcher\n", "utf8");
  return { reqId, stubDir, managerOptions: { repoRoot, store, port, startupProbeTimeoutMs: 250, statusProbeTimeoutMs: 100 } };
}

async function writeRequiredMockScaffoldPlan(stubDir: string, mockServerId: string): Promise<void> {
  await writeFile(
    join(stubDir, "scaffold-plan.json"),
    `${JSON.stringify(
      {
        modules: [
          {
            id: "mod-required-mock",
            module_category: "adapter",
            access_protocol: "mcp",
            mcp_server: mockServerId,
            mcp_tool_name: "get_scenario_taxonomy",
            mock_binding: {
              provider: "mock_lab",
              mock_server_id: mockServerId,
              tool_name: "get_scenario_taxonomy",
              status: "linked"
            }
          }
        ]
      },
      null,
      2
    )}\n`,
    "utf8"
  );
}

async function writeMockLabServerState(mockServerId: string, status: "running" | "stopped"): Promise<void> {
  const mockDir = await writeMockLabSpec(mockServerId);
  await writeFile(
    join(mockDir, "server-state.json"),
    `${JSON.stringify(
      {
        mock_id: mockServerId,
        status,
        pid: status === "running" ? process.pid : null,
        started_at: status === "running" ? new Date(0).toISOString() : null,
        command: status === "running" ? "test mock process" : null,
        cwd: null,
        stdout_tail: [],
        stderr_tail: []
      },
      null,
      2
    )}\n`,
    "utf8"
  );
}

async function writeMockLabSpec(mockServerId: string): Promise<string> {
  const mockDir = join(repoRoot, "artifacts/mock-lab", mockServerId);
  await mkdir(mockDir, { recursive: true });
  await writeFile(
    join(mockDir, "mock-spec.json"),
    `${JSON.stringify(
      {
        mock_id: mockServerId,
        server_name: mockServerId,
        protocol: "mcp_stdio",
        tools: [
          {
            name: "get_scenario_taxonomy",
            description: "test tool",
            inputSchema: { type: "object", properties: {}, additionalProperties: false },
            outputSchema: { type: "object", properties: {}, additionalProperties: false },
            scenarios: []
          }
        ]
      },
      null,
      2
    )}\n`,
    "utf8"
  );
  return mockDir;
}

function getAvailablePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.on("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      server.close(() => {
        if (address && typeof address === "object") resolve(address.port);
        else reject(new Error("Could not allocate a local test port."));
      });
    });
  });
}
