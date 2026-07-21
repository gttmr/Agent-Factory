#!/usr/bin/env node

import { constants } from "node:fs";
import { access, readdir } from "node:fs/promises";
import { delimiter, join, resolve } from "node:path";
import { spawnSync } from "node:child_process";

const artifactRoot = process.argv[2] ? resolve(process.argv[2]) : null;
if (!artifactRoot) {
  console.error("Usage: node scripts/validate-generated-runtime.mjs <artifact-root>");
  process.exit(2);
}

const runtimeStub = join(artifactRoot, "runtime-stub");
const python = await resolvePython();
const packageTests = await findGeneratedPackageTests(runtimeStub);
if (packageTests.length === 0) {
  console.error(`Generated runtime tests were not found under ${runtimeStub}.`);
  process.exit(1);
}

const compileProgram = [
  "from pathlib import Path",
  "import sys",
  "root = Path(sys.argv[1])",
  "ignored = {'.venv', '.pytest_cache', '__pycache__'}",
  "files = sorted(path for path in root.rglob('*.py') if not any(part in ignored for part in path.parts))",
  "assert files, f'No generated Python files found under {root}'",
  "[compile(path.read_text(encoding='utf-8'), str(path), 'exec') for path in files]",
  "print(f'compiled {len(files)} generated Python files')"
].join("; ");

run(python, ["-c", compileProgram, runtimeStub]);
run(python, ["-m", "pytest", "-q", "-p", "no:cacheprovider", ...packageTests], {
  PYTHONDONTWRITEBYTECODE: "1",
  PYTHONPATH: [runtimeStub, process.env.PYTHONPATH].filter(Boolean).join(delimiter)
});

console.log(
  JSON.stringify(
    {
      ok: true,
      artifact_root: artifactRoot,
      runtime_stub: runtimeStub,
      python,
      test_roots: packageTests
    },
    null,
    2
  )
);

async function findGeneratedPackageTests(root) {
  const entries = await readdir(root, { withFileTypes: true }).catch((error) => {
    if (error?.code === "ENOENT") return [];
    throw error;
  });
  const tests = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const packageRoot = join(root, entry.name);
    if (!(await exists(join(packageRoot, "workflow_manifest.json")))) continue;
    const testsRoot = join(packageRoot, "tests");
    if (await exists(testsRoot)) tests.push(testsRoot);
  }
  return tests.sort();
}

async function resolvePython() {
  const candidates = [
    process.env.AF_PYTHON,
    join(process.cwd(), ".agent-factory/runtime/.venv/bin/python"),
    "python3",
    "python"
  ].filter(Boolean);
  for (const candidate of candidates) {
    if (candidate.includes("/")) {
      if (await exists(candidate, constants.X_OK)) return candidate;
      continue;
    }
    const probe = spawnSync(candidate, ["--version"], { encoding: "utf8" });
    if (probe.status === 0) return candidate;
  }
  console.error("Python runtime is unavailable; generated runtime remains unverified.");
  process.exit(2);
}

async function exists(path, mode = constants.F_OK) {
  return await access(path, mode).then(
    () => true,
    () => false
  );
}

function run(command, args, extraEnv = {}) {
  const result = spawnSync(command, args, {
    cwd: process.cwd(),
    encoding: "utf8",
    env: { ...process.env, ...extraEnv },
    maxBuffer: 20 * 1024 * 1024
  });
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  if (result.error) {
    console.error(result.error.message);
    process.exit(2);
  }
  if (result.status !== 0) process.exit(result.status ?? 1);
}
