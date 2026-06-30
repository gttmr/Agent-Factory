import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const ADK_A2A_EXTENSION_URI = "https://google.github.io/adk-docs/a2a/a2a-extension/";

export function assertRunnableAgentCard(outputRoot, packageName, readme) {
  const agentCard = readAgentCard(outputRoot, packageName);
  assertBaseAgentCard(agentCard, packageName);
  assert.deepEqual(agentCard.defaultInputModes, ["text/plain"]);
  assert.deepEqual(agentCard.defaultOutputModes, ["text/plain"]);
  assert.equal(agentCard.capabilities.streaming, false);
  assert.equal(agentCard.skills[0]?.id, `${packageName}_workflow`);
  assert.match(readme, /python af_adk_a2a_server\.py --host 127\.0\.0\.1 --port 8001/);
  assert.match(readme, /ADK's FastAPI\/Web runner and A2A executor/);
  assert.match(readme, /A2A `input-required` task state/);
  assert.match(readme, /`adk_request_input`/);
  assert.match(readme, /does not prove full remote HITL resume support/);
}

export function assertPregeneratedAgentCard(outputRoot, packageName) {
  assertBaseAgentCard(readAgentCard(outputRoot, packageName), packageName);
}

function readAgentCard(outputRoot, packageName) {
  return JSON.parse(readFileSync(join(outputRoot, packageName, "agent.json"), "utf8"));
}

function assertBaseAgentCard(agentCard, packageName) {
  assert.equal(agentCard.name, packageName);
  assert.equal(agentCard.version, "0.1.0");
  assert.equal(agentCard.url, `http://127.0.0.1:8001/a2a/${packageName}`);
  assert.equal(agentCard.preferredTransport, "JSONRPC");
  assert.equal(agentCard.protocolVersion, "0.3.0");
  assertAdkA2aInteractiveContract(agentCard);
}

function assertAdkA2aInteractiveContract(agentCard) {
  const adkExtension = agentCard.capabilities.extensions?.find((extension) => extension.uri === ADK_A2A_EXTENSION_URI);
  assert.ok(adkExtension, "local Agent Card must advertise the ADK A2A extension used by ADK 2.3 RemoteA2aAgent");
  assert.equal(adkExtension.required, false);
  assert.match(adkExtension.description, /input-required/);
  assert.match(adkExtension.description, /adk_request_input/);
  assert.match(adkExtension.description, /does not claim verified remote HITL resume/);
  assert.equal(agentCard.capabilities.resume, undefined, "Agent Card metadata must not claim generic resume support");
  assert.equal(agentCard.capabilities.hitlResume, undefined, "Agent Card metadata must not claim verified HITL resume support");
}
