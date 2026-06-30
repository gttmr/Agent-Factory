import { readdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { isFile, isRecord, readJson } from "./runtimeProcessControl";

const ADK_A2A_EXTENSION_URI = "https://google.github.io/adk-docs/a2a/a2a-extension/";

export interface LocalAgentCardExtension {
  uri: string;
  required: boolean;
  description: string;
}

export interface LocalAgentCard {
  name: string;
  description: string;
  url: string;
  version: string;
  preferredTransport: string;
  protocolVersion: string;
  capabilities: {
    extensions: LocalAgentCardExtension[];
    streaming: boolean;
    pushNotifications: boolean;
    stateTransitionHistory: boolean;
  };
  defaultInputModes: string[];
  defaultOutputModes: string[];
  skills: Array<{
    id: string;
    name: string;
    description: string;
    tags: string[];
  }>;
}

export interface A2aCardContext {
  stubDir: string;
  appName: string;
  rpcUrl: string;
}

export async function discoverAppName(stubDir: string): Promise<string> {
  const entries = await readdir(stubDir, { withFileTypes: true }).catch(() => []);
  for (const entry of entries) {
    if (!entry.isDirectory() || entry.name.startsWith(".")) continue;
    const manifest = await readJson(join(stubDir, entry.name, "workflow_manifest.json")).catch(() => null);
    if (isRecord(manifest) && typeof manifest.package === "string" && manifest.package.trim()) return manifest.package;
    if (await isFile(join(stubDir, entry.name, "agent.py"))) return entry.name;
  }
  throw new Error("runtime-stub agent package was not found.");
}

export async function refreshAgentCard(ctx: A2aCardContext): Promise<LocalAgentCard> {
  const manifest = await readJson(join(ctx.stubDir, ctx.appName, "workflow_manifest.json")).catch(() => null);
  const title = manifestTitle(manifest) ?? ctx.appName;
  const card = buildLocalAgentCard({ appName: ctx.appName, title, rpcUrl: ctx.rpcUrl });
  await writeFile(join(ctx.stubDir, ctx.appName, "agent.json"), `${JSON.stringify(card, null, 2)}\n`, "utf8");
  return card;
}

export async function readExistingAgentCard(ctx: Pick<A2aCardContext, "stubDir" | "appName">): Promise<LocalAgentCard> {
  const value = await readJson(join(ctx.stubDir, ctx.appName, "agent.json"));
  if (!isLocalAgentCard(value)) {
    throw new Error("runtime-stub Agent Card file is not a valid local A2A Agent Card.");
  }
  if (value.name !== ctx.appName) {
    throw new Error("runtime-stub Agent Card name does not match the provider app.");
  }
  return value;
}

function buildLocalAgentCard(input: { appName: string; title: string; rpcUrl: string }): LocalAgentCard {
  return {
    name: input.appName,
    description: `ADK Workflow generated from the approved Agent Factory artifact: ${input.title}.`,
    url: input.rpcUrl,
    version: "0.1.0",
    preferredTransport: "JSONRPC",
    protocolVersion: "0.3.0",
    capabilities: {
      extensions: [
        {
          uri: ADK_A2A_EXTENSION_URI,
          required: false,
          description:
            "ADK 2.3 A2A executor metadata; RequestInput is surfaced as the A2A input-required state with adk_request_input, but this does not claim verified remote HITL resume support."
        }
      ],
      streaming: false,
      pushNotifications: false,
      stateTransitionHistory: true
    },
    defaultInputModes: ["text/plain"],
    defaultOutputModes: ["text/plain"],
    skills: [
      {
        id: `${input.appName}_workflow`,
        name: input.title,
        description: "Runs the reviewed Agent Factory ADK Workflow over synthetic local runtime inputs.",
        tags: ["agent-factory", "adk-workflow"]
      }
    ]
  };
}

function manifestTitle(value: unknown): string | null {
  if (!isRecord(value) || !isRecord(value.requirement)) return null;
  const title = value.requirement.title;
  return typeof title === "string" && title.trim() ? title : null;
}

function isLocalAgentCard(value: unknown): value is LocalAgentCard {
  if (!isRecord(value) || !isRecord(value.capabilities)) return false;
  return (
    isNonEmptyString(value.name) &&
    isNonEmptyString(value.description) &&
    isNonEmptyString(value.url) &&
    isNonEmptyString(value.version) &&
    isNonEmptyString(value.preferredTransport) &&
    isNonEmptyString(value.protocolVersion) &&
    typeof value.capabilities.streaming === "boolean" &&
    typeof value.capabilities.pushNotifications === "boolean" &&
    typeof value.capabilities.stateTransitionHistory === "boolean" &&
    Array.isArray(value.capabilities.extensions) &&
    Array.isArray(value.defaultInputModes) &&
    Array.isArray(value.defaultOutputModes) &&
    Array.isArray(value.skills)
  );
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && Boolean(value.trim());
}
