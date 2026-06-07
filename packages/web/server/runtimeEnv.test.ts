import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildRuntimeProcessEnv, parseRuntimeEnv, resolveRuntimeEnvPath } from "./runtimeEnv.ts";

const repoRoot = await mkdtemp(join(tmpdir(), "af-runtime-env-"));

try {
  assert.deepEqual(parseRuntimeEnv("GOOGLE_API_KEY=central-key\n# comment\nEMPTY=\n"), {
    GOOGLE_API_KEY: "central-key",
    EMPTY: ""
  });
  assert.deepEqual(parseRuntimeEnv("export MCP_TOKEN='quoted token'\nAF_MOCK_LAB_MCP_URL=\"http://127.0.0.1:5173/api/mock-lab/mcp\"\n"), {
    MCP_TOKEN: "quoted token",
    AF_MOCK_LAB_MCP_URL: "http://127.0.0.1:5173/api/mock-lab/mcp"
  });

  await mkdir(join(repoRoot, ".agent-factory"), { recursive: true });
  await writeFile(
    join(repoRoot, ".agent-factory/runtime.env"),
    [
      "GOOGLE_API_KEY=central-gemini-key",
      "AF_MOCK_LAB_MCP_URL=http://127.0.0.1:5173/api/mock-lab/mcp",
      "MCP_TOKEN=central-mcp-token"
    ].join("\n"),
    "utf8"
  );

  assert.equal(resolveRuntimeEnvPath(repoRoot, {}), join(repoRoot, ".agent-factory/runtime.env"));
  assert.equal(resolveRuntimeEnvPath(repoRoot, { AF_RUNTIME_ENV_FILE: "secrets/runtime.env" }), join(repoRoot, "secrets/runtime.env"));

  const env = await buildRuntimeProcessEnv({
    repoRoot,
    stubDir: join(repoRoot, "artifacts/af/req-demo/runtime-stub"),
    baseEnv: {
      PATH: "/bin",
      GOOGLE_API_KEY: "shell-gemini-key",
      AF_RUNTIME_ENV_FILE: join(repoRoot, ".agent-factory/runtime.env")
    }
  });
  assert.equal(env.GOOGLE_API_KEY, "central-gemini-key");
  assert.equal(env.AF_MOCK_LAB_MCP_URL, "http://127.0.0.1:5173/api/mock-lab/mcp");
  assert.equal(env.MCP_TOKEN, "central-mcp-token");
  assert.equal(env.PYTHONUNBUFFERED, "1");
  assert.equal(env.PYTHONPATH, join(repoRoot, "artifacts/af/req-demo/runtime-stub"));
  assert.equal(env.PATH, "/bin");
} finally {
  await rm(repoRoot, { recursive: true, force: true });
}
