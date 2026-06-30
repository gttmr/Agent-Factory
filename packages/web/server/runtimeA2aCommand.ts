import { join } from "node:path";

const A2A_LAUNCHER = "af_adk_a2a_server.py";

export interface RuntimeA2aCommandInput {
  readonly pythonPath: string;
  readonly stubDir: string;
  readonly host: string;
  readonly port: number;
}

export function buildAdkA2aServerCommand(input: RuntimeA2aCommandInput) {
  const args = [
    a2aLauncherPath(input),
    "--host",
    input.host,
    "--port",
    String(input.port),
    "--session_service_uri",
    "memory://",
    "--artifact_service_uri",
    "memory://",
    "--no-reload",
    "--with_ui",
    "."
  ];
  return { command: input.pythonPath, args, display: `${input.pythonPath} ${args.join(" ")}` };
}

export function a2aLauncherPath(ctx: Pick<RuntimeA2aCommandInput, "stubDir">): string {
  return join(ctx.stubDir, A2A_LAUNCHER);
}
