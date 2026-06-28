import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join } from "node:path";

export function collectTargets(start, errors) {
  if (!existsSync(start)) {
    errors.push(`Path does not exist: ${start}.`);
    return [];
  }
  let stat;
  try {
    stat = statSync(start);
  } catch (error) {
    errors.push(`Cannot stat ${start}: ${error.message}`);
    return [];
  }
  if (stat.isFile()) {
    const parent = dirname(start);
    if (looksLikeArtifactDir(parent)) {
      return [parent];
    }
    errors.push(`Path is not a recognized artifact file: ${start}.`);
    return [];
  }
  if (!stat.isDirectory()) {
    errors.push(`Path is not a directory or artifact file: ${start}.`);
    return [];
  }

  // If this directory itself looks like a leaf artifact directory, validate
  // it directly. We treat the presence of analysis-result.json,
  // module-candidates.json, process-flow.json, scaffold-plan(.template).json,
  // or af-run-manifest.json as the leaf signal so the existing templates/
  // smoke check still works.
  if (looksLikeArtifactDir(start)) {
    return [start];
  }

  // Otherwise walk one level deep and pick up every subdirectory that looks
  // like an artifact leaf.
  const found = [];
  let entries;
  try {
    entries = readdirSync(start, { withFileTypes: true });
  } catch (error) {
    errors.push(`Cannot read directory ${start}: ${error.message}`);
    return [];
  }
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const child = join(start, entry.name);
    if (looksLikeArtifactDir(child)) {
      found.push(child);
    }
  }
  if (found.length === 0) {
    // Nothing to walk: fall back to validating the directory itself, so
    // pre-existing callers that pass a leaf-shaped directory without
    // canonical files still get the legacy "no-op success" behaviour.
    return [start];
  }
  return found;
}

export function findJsonFiles(dir) {
  if (!existsSync(dir)) return [];
  let stat;
  try {
    stat = statSync(dir);
  } catch {
    return [];
  }
  if (!stat.isDirectory()) {
    return dir.endsWith(".json") ? [dir] : [];
  }
  const files = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...findJsonFiles(path));
    } else if (entry.isFile() && entry.name.endsWith(".json")) {
      files.push(path);
    }
  }
  return files;
}

export function readJson(path, errors) {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch (error) {
    errors.push(`${path} is not valid JSON: ${error.message}`);
    return {};
  }
}

function looksLikeArtifactDir(dir) {
  return (
    existsSync(join(dir, "analysis-result.json")) ||
    existsSync(join(dir, "module-candidates.json")) ||
    existsSync(join(dir, "process-flow.json")) ||
    existsSync(join(dir, "scaffold-plan.json")) ||
    existsSync(join(dir, "scaffold-plan.template.json")) ||
    existsSync(join(dir, "af-run-manifest.json"))
  );
}
