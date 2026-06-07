import { useQuery } from "@tanstack/react-query";
import { AfApiError } from "./apiClient";

export interface MockLabDiscoveryServer {
  mock_id: string;
  server_name: string;
  catalog_entry_name: string | null;
  running: boolean;
  tools: string[];
  mcp_url: string;
}

export interface MockLabDiscoveryPayload {
  servers: MockLabDiscoveryServer[];
}

export function useMockLabDiscovery(enabled: boolean) {
  return useQuery<MockLabDiscoveryPayload>({
    queryKey: ["mock-lab", "mcp-discovery"] as const,
    queryFn: fetchMockLabDiscovery,
    enabled
  });
}

async function fetchMockLabDiscovery(): Promise<MockLabDiscoveryPayload> {
  const response = await fetch("/api/mock-lab/mcp-discovery");
  const body = (await response.json()) as unknown;
  if (!response.ok) {
    const message =
      body && typeof body === "object" && "error" in body && typeof body.error === "string"
        ? body.error
        : "Mock Lab MCP discovery 조회 실패";
    throw new AfApiError(response.status, message, body);
  }
  return body as MockLabDiscoveryPayload;
}
