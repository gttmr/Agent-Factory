export const DEFAULT_A2A_PROVIDER_URL = "http://127.0.0.1:8001";
export const ADK_A2A_EXTENSION_URI = "https://google.github.io/adk-docs/a2a/a2a-extension/";

export function buildAgentCard({ packageName, normalizedRequirement, baseUrl = DEFAULT_A2A_PROVIDER_URL }) {
  const rpcUrl = `${baseUrl}/a2a/${packageName}`;
  const title = normalizedRequirement?.title || packageName;
  return {
    name: packageName,
    description: `ADK Workflow generated from the approved Agent Factory artifact: ${title}.`,
    url: rpcUrl,
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
        id: `${packageName}_workflow`,
        name: title,
        description: "Runs the reviewed Agent Factory ADK Workflow over synthetic local runtime inputs.",
        tags: ["agent-factory", "adk-workflow"]
      }
    ]
  };
}
