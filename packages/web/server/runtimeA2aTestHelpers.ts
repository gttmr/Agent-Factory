import { chmod, mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

export interface FakeA2aRuntimeOptions {
  readonly serveAgentCard: boolean;
  readonly messageSendResult?: unknown;
  readonly messageSendCounterPath?: string;
  readonly exitWithSetupFailure?: boolean;
}

export async function writeFakeA2aRuntime(root: string, options: FakeA2aRuntimeOptions): Promise<void> {
  const binDir = join(root, ".agent-factory/runtime/.venv/bin");
  const messageSendResult = JSON.stringify(
    options.messageSendResult ?? {
      status: {
        state: "completed",
        message: { parts: [{ kind: "text", text: "ready" }] }
      }
    }
  );
  await mkdir(binDir, { recursive: true });
  await writeFile(
    join(binDir, "python"),
    [
      "#!/usr/bin/env node",
      "const http = require('node:http');",
      "const fs = require('node:fs');",
      "const args = process.argv.slice(2);",
      "const port = Number(args[args.indexOf('--port') + 1]);",
      "const host = args[args.indexOf('--host') + 1] || '127.0.0.1';",
      `const serveAgentCard = ${options.serveAgentCard ? "true" : "false"};`,
      `const messageSendResult = ${messageSendResult};`,
      `const messageSendCounterPath = ${JSON.stringify(options.messageSendCounterPath ?? null)};`,
      `const exitWithSetupFailure = ${options.exitWithSetupFailure ? "true" : "false"};`,
      "if (exitWithSetupFailure) {",
      "  console.error('Failed to setup A2A agent: synthetic setup failure');",
      "  process.exit(1);",
      "}",
      "const server = http.createServer((req, res) => {",
      "  const cardMatch = req.url && req.url.match(/^\\/a2a\\/([^/]+)\\/\\.well-known\\/agent-card\\.json$/);",
      "  if (serveAgentCard && cardMatch) {",
      "    res.setHeader('content-type', 'application/json');",
      "    res.end(JSON.stringify({ name: cardMatch[1], skills: [{ id: `${cardMatch[1]}_workflow` }] }));",
      "    return;",
      "  }",
      "  if (req.method === 'POST' && req.url && req.url.startsWith('/a2a/')) {",
      "    let raw = '';",
      "    req.on('data', (chunk) => { raw += chunk; });",
      "    req.on('end', () => {",
      "      if (messageSendCounterPath) {",
      "        let count = 0;",
      "        try { count = Number(fs.readFileSync(messageSendCounterPath, 'utf8')) || 0; } catch {}",
      "        fs.writeFileSync(messageSendCounterPath, String(count + 1));",
      "      }",
      "      const body = JSON.parse(raw);",
      "      res.setHeader('content-type', 'application/json');",
      "      res.end(JSON.stringify({ id: body.id, jsonrpc: '2.0', result: messageSendResult }));",
      "    });",
      "    return;",
      "  }",
      "  res.statusCode = 404;",
      "  res.setHeader('content-type', 'application/json');",
      "  res.end(JSON.stringify({ detail: 'Not Found' }));",
      "});",
      "server.listen(port, host);",
      "process.on('SIGTERM', () => server.close(() => process.exit(0)));",
      "setInterval(() => undefined, 1000);",
      ""
    ].join("\n"),
    "utf8"
  );
  await writeFile(join(binDir, "adk"), "#!/bin/sh\nexit 0\n", "utf8");
  await chmod(join(binDir, "python"), 0o755);
  await chmod(join(binDir, "adk"), 0o755);
}
