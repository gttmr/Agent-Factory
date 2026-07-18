#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const CANONICAL_SKILLS = [
  "af-workflow",
  "af-discover-assets",
  "af-compose-solution",
  "af-scaffold-runtime",
  "af-verify-runtime",
];

const LEGACY_SHIMS = new Map([
  ["af-analyze-requirement", "af-discover-assets"],
  ["af-design-boundaries", "af-compose-solution"],
  ["af-build-runtime-stub", "af-scaffold-runtime"],
  ["af-verify-feedback", "af-verify-runtime"],
]);

const FORBIDDEN_LEGACY_TERMS = [
  ["module_category: adapter", /module_category\s*:\s*["'`]?adapter\b/i],
  ["adapter_kind", /\badapter_kind\b/i],
  ["agent_kind", /\bagent_kind\b/i],
  ["selected_by_llm", /\bselected_by_llm\b/i],
  ["decision_owner: llm", /decision_owner\s*:\s*["'`]?llm\b/i],
  ["specialist agent", /\bspecialist\s+agent\b/i],
  ["shared agent", /\bshared\s+agent\b/i],
  ["domain agent", /\bdomain\s+agent\b/i],
  ["common agent", /\bcommon\s+agent\b/i],
];

const rootArgument = process.argv[2] ?? ".agents/skills";
const root = path.resolve(process.cwd(), rootArgument);
const issues = [];

function toPosix(value) {
  return value.split(path.sep).join("/");
}

function displayPath(file) {
  const relative = path.relative(process.cwd(), file);
  return toPosix(relative || ".");
}

function addIssue(severity, file, rule, message, line = null) {
  issues.push({ severity, file: path.resolve(file), line, rule, message });
}

function addError(file, rule, message, line = null) {
  addIssue("error", file, rule, message, line);
}

function addWarning(file, rule, message, line = null) {
  addIssue("warning", file, rule, message, line);
}

function walkFiles(directory) {
  const result = [];
  if (!fs.existsSync(directory) || !fs.statSync(directory).isDirectory()) {
    return result;
  }

  for (const entry of fs.readdirSync(directory, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      result.push(...walkFiles(entryPath));
    } else if (entry.isFile()) {
      result.push(entryPath);
    }
  }
  return result;
}

function countLines(text) {
  if (text.length === 0) return 0;
  const lines = text.split(/\r\n|\n|\r/);
  return /(?:\r\n|\n|\r)$/.test(text) ? lines.length - 1 : lines.length;
}

function lineNumberAt(text, index) {
  let line = 1;
  for (let cursor = 0; cursor < index; cursor += 1) {
    if (text.charCodeAt(cursor) === 10) line += 1;
  }
  return line;
}

function parseScalar(raw, file, line) {
  const value = raw.trim();
  if (value.startsWith('"')) {
    try {
      return JSON.parse(value);
    } catch {
      addError(file, "frontmatter-yaml", "invalid double-quoted YAML scalar", line);
      return value;
    }
  }
  if (value.startsWith("'")) {
    if (!value.endsWith("'")) {
      addError(file, "frontmatter-yaml", "unterminated single-quoted YAML scalar", line);
      return value;
    }
    return value.slice(1, -1).replace(/''/g, "'");
  }
  return value.replace(/\s+#.*$/, "").trim();
}

function parseFrontmatter(text, file) {
  const lines = text.split(/\r\n|\n|\r/);
  if (lines[0] !== "---") {
    addError(file, "frontmatter", "SKILL.md must begin with YAML frontmatter", 1);
    return { values: new Map(), keyLines: new Map() };
  }

  const closingIndex = lines.findIndex((line, index) => index > 0 && line === "---");
  if (closingIndex === -1) {
    addError(file, "frontmatter", "YAML frontmatter is missing its closing delimiter", 1);
    return { values: new Map(), keyLines: new Map() };
  }

  const values = new Map();
  const keyLines = new Map();
  let index = 1;

  while (index < closingIndex) {
    const rawLine = lines[index];
    if (rawLine.trim() === "" || rawLine.trimStart().startsWith("#")) {
      index += 1;
      continue;
    }
    if (/^\s/.test(rawLine)) {
      addError(file, "frontmatter-yaml", "unexpected indented content outside a block scalar", index + 1);
      index += 1;
      continue;
    }

    const match = rawLine.match(/^([A-Za-z0-9_-]+):(?:\s*(.*))?$/);
    if (!match) {
      addError(file, "frontmatter-yaml", "unsupported or malformed top-level YAML entry", index + 1);
      index += 1;
      continue;
    }

    const [, key, rawValue = ""] = match;
    if (values.has(key)) {
      addError(file, "frontmatter-yaml", `duplicate frontmatter key '${key}'`, index + 1);
    }
    keyLines.set(key, index + 1);

    if (/^[>|][+-]?$/.test(rawValue.trim())) {
      const style = rawValue.trim()[0];
      const block = [];
      index += 1;
      while (index < closingIndex && (lines[index].trim() === "" || /^\s/.test(lines[index]))) {
        block.push(lines[index].replace(/^\s+/, ""));
        index += 1;
      }
      const value = style === ">"
        ? block.map((line) => line.trim()).filter(Boolean).join(" ")
        : block.join("\n").trimEnd();
      values.set(key, value);
      continue;
    }

    if (rawValue.trim() === "" && index + 1 < closingIndex && /^\s/.test(lines[index + 1])) {
      index += 1;
      while (index < closingIndex && (lines[index].trim() === "" || /^\s/.test(lines[index]))) {
        index += 1;
      }
      values.set(key, { nested: true });
      continue;
    }

    values.set(key, parseScalar(rawValue, file, index + 1));
    index += 1;
  }

  for (const key of values.keys()) {
    if (key !== "name" && key !== "description") {
      addWarning(file, "frontmatter-extra-key", `frontmatter key '${key}' is outside the name/description core`, keyLines.get(key));
    }
  }

  return { values, keyLines };
}

function normalizeLinkTarget(rawTarget) {
  let target = rawTarget.trim();
  if (target.startsWith("<")) {
    const end = target.indexOf(">");
    target = end === -1 ? target.slice(1) : target.slice(1, end);
  } else {
    target = target.split(/\s+["']/)[0];
  }
  return target;
}

function resolveMarkdownTarget(sourceFile, rawTarget) {
  const normalized = normalizeLinkTarget(rawTarget);
  if (!normalized || normalized.startsWith("#") || normalized.startsWith("//") || /^[a-z][a-z0-9+.-]*:/i.test(normalized)) {
    return null;
  }

  const withoutFragment = normalized.split(/[?#]/, 1)[0];
  if (!withoutFragment) return null;

  try {
    return path.resolve(path.dirname(sourceFile), decodeURIComponent(withoutFragment));
  } catch {
    return { invalid: true, raw: normalized };
  }
}

function extractMarkdownLinks(text, file) {
  const links = [];
  const pattern = /!?\[[^\]]*\]\(([^)]+)\)/g;
  for (const match of text.matchAll(pattern)) {
    links.push({
      raw: match[1],
      resolved: resolveMarkdownTarget(file, match[1]),
      line: lineNumberAt(text, match.index ?? 0),
    });
  }
  return links;
}

function isWithin(parent, child) {
  const relative = path.relative(parent, child);
  return relative === "" || (!relative.startsWith(`..${path.sep}`) && relative !== "..");
}

if (!fs.existsSync(root) || !fs.statSync(root).isDirectory()) {
  addError(root, "skill-root", `skill root does not exist or is not a directory: ${rootArgument}`);
} else {
  for (const skillName of CANONICAL_SKILLS) {
    const skillDirectory = path.join(root, skillName);
    if (!fs.existsSync(skillDirectory) || !fs.statSync(skillDirectory).isDirectory()) {
      addError(skillDirectory, "canonical-directory", `missing canonical skill directory '${skillName}'`);
      continue;
    }
    const skillFile = path.join(skillDirectory, "SKILL.md");
    if (!fs.existsSync(skillFile) || !fs.statSync(skillFile).isFile()) {
      addError(skillFile, "canonical-skill-file", `missing ${skillName}/SKILL.md`);
    }
  }
}

const allFiles = walkFiles(root);
const markdownFiles = allFiles.filter((file) => file.endsWith(".md"));
const markdownSet = new Set(markdownFiles.map((file) => path.resolve(file)));
const skillFiles = allFiles.filter((file) => path.basename(file) === "SKILL.md");
const fileText = new Map();
const fileLinks = new Map();

for (const file of allFiles) {
  const buffer = fs.readFileSync(file);
  if (buffer.length >= 3 && buffer[0] === 0xef && buffer[1] === 0xbb && buffer[2] === 0xbf) {
    addError(file, "utf8-bom", "UTF-8 BOM is not allowed", 1);
  }
  if (file.endsWith(".md")) {
    fileText.set(file, buffer.toString("utf8").replace(/^\uFEFF/, ""));
  }
}

const names = new Map();
const skillMetadata = new Map();

for (const skillFile of skillFiles) {
  const text = fileText.get(skillFile) ?? "";
  const { values, keyLines } = parseFrontmatter(text, skillFile);
  const name = values.get("name");
  const description = values.get("description");
  skillMetadata.set(skillFile, { name, description });

  if (typeof name !== "string" || name.trim() === "") {
    addError(skillFile, "frontmatter-name", "frontmatter name is required", keyLines.get("name") ?? 2);
  } else {
    const folderName = path.basename(path.dirname(skillFile));
    if (name !== folderName) {
      addError(skillFile, "name-folder-match", `frontmatter name '${name}' does not match folder '${folderName}'`, keyLines.get("name"));
    }
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(name)) {
      addError(skillFile, "name-format", "name must contain only lowercase letters, numbers, and single hyphens", keyLines.get("name"));
    }
    if (name.length > 64) {
      addError(skillFile, "name-length", `name length ${name.length} exceeds 64 characters`, keyLines.get("name"));
    }
    const duplicates = names.get(name) ?? [];
    duplicates.push(skillFile);
    names.set(name, duplicates);
  }

  if (typeof description !== "string" || description.trim() === "") {
    addError(skillFile, "frontmatter-description", "frontmatter description is required", keyLines.get("description") ?? 3);
  } else {
    if (description.length > 1024) {
      addError(skillFile, "description-length", `description length ${description.length} exceeds 1024 characters`, keyLines.get("description"));
    }
    if (!/(?:\buse(?:d)?\s+when\b|\bappl(?:y|ies)\s+when\b|\btrigger(?:s|ed|ing)?\b|\binvocation(?:s)?\b|요청|사용|호출|경우)/i.test(description)) {
      addWarning(skillFile, "description-trigger", "description has no clear use/trigger clue", keyLines.get("description"));
    }
  }

  const lineCount = countLines(text);
  if (lineCount > 500) {
    addError(skillFile, "skill-line-budget", `SKILL.md has ${lineCount} lines; maximum is 500`);
  } else if (lineCount > 300) {
    addWarning(skillFile, "skill-line-budget", `SKILL.md has ${lineCount} lines; recommended maximum is 300`);
  }
}

for (const [name, files] of names.entries()) {
  if (files.length < 2) continue;
  const locations = files.map(displayPath).join(", ");
  for (const file of files) {
    addError(file, "duplicate-skill-name", `duplicate frontmatter name '${name}' in: ${locations}`);
  }
}

for (const markdownFile of markdownFiles) {
  const text = fileText.get(markdownFile) ?? "";
  const links = extractMarkdownLinks(text, markdownFile);
  fileLinks.set(markdownFile, links);

  for (const link of links) {
    if (link.resolved?.invalid) {
      addError(markdownFile, "relative-link", `link target cannot be decoded: ${link.resolved.raw}`, link.line);
    } else if (typeof link.resolved === "string" && !fs.existsSync(link.resolved)) {
      addError(markdownFile, "relative-link", `broken relative link: ${normalizeLinkTarget(link.raw)}`, link.line);
    }
  }
}

for (const skillFile of skillFiles) {
  const skillDirectory = path.dirname(skillFile);
  const referenceDirectory = path.join(skillDirectory, "references");
  if (!fs.existsSync(referenceDirectory) || !fs.statSync(referenceDirectory).isDirectory()) continue;

  const linkedReferences = new Set(
    (fileLinks.get(skillFile) ?? [])
      .map((link) => link.resolved)
      .filter((target) => typeof target === "string" && isWithin(referenceDirectory, target))
      .map((target) => path.resolve(target)),
  );

  for (const referenceFile of walkFiles(referenceDirectory).filter((file) => file.endsWith(".md"))) {
    if (!linkedReferences.has(path.resolve(referenceFile))) {
      addError(referenceFile, "orphan-reference", `reference is not linked directly from ${displayPath(skillFile)}`);
    }
  }
}

const stagingMode = fs.existsSync(path.join(root, "legacy-shims")) || /staging/i.test(path.basename(root));
const shimRoot = stagingMode ? path.join(root, "legacy-shims") : root;
const shimFiles = new Set();

for (const [legacyName, canonicalName] of LEGACY_SHIMS.entries()) {
  const shimDirectory = path.join(shimRoot, legacyName);
  const shimFile = path.join(shimDirectory, "SKILL.md");
  shimFiles.add(path.resolve(shimFile));

  if (!fs.existsSync(shimFile) || !fs.statSync(shimFile).isFile()) {
    addError(shimFile, "legacy-shim", `missing legacy shim '${legacyName}'${stagingMode ? " under legacy-shims/" : ""}`);
    continue;
  }

  const text = fileText.get(shimFile) ?? fs.readFileSync(shimFile, "utf8").replace(/^\uFEFF/, "");
  const lineCount = countLines(text);
  if (lineCount > 15) {
    addError(shimFile, "legacy-shim-lines", `legacy shim has ${lineCount} lines; maximum is 15`);
  }

  const referencesDirectory = path.join(shimDirectory, "references");
  if (fs.existsSync(referencesDirectory)) {
    addError(referencesDirectory, "legacy-shim-references", "legacy shim must not contain a references/ directory");
  }

  const canonicalPathPattern = new RegExp(`(?:^|[/.])${canonicalName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}/SKILL\\.md`);
  if (!canonicalPathPattern.test(text)) {
    addError(shimFile, "legacy-shim-handoff", `legacy shim must point to ${canonicalName}/SKILL.md`);
  }
}

const sharedRoot = path.join(root, "_shared");
for (const sharedFile of markdownFiles.filter((file) => isWithin(sharedRoot, file))) {
  const text = fileText.get(sharedFile) ?? "";
  if (text.split(/\r\n|\n|\r/, 1)[0] === "---") {
    addError(sharedFile, "shared-frontmatter", "_shared Markdown must not contain YAML frontmatter", 1);
  }
}

for (const markdownFile of markdownFiles) {
  const normalized = toPosix(path.relative(root, markdownFile));
  const isSharedReference = normalized.startsWith("_shared/");
  const isSkillReference = normalized.includes("/references/");
  if (!isSharedReference && !isSkillReference) continue;

  const text = fileText.get(markdownFile) ?? "";
  if (!/Checked date:/.test(text)) {
    addError(markdownFile, "checked-date", "reference must contain 'Checked date:'");
  }
  if (normalized.startsWith("_shared/adk/") && !/https:\/\/[^\s)]+/.test(text)) {
    addError(markdownFile, "source-url", "ADK pattern card must contain an official source URL");
  }
}

const compatibilityFile = path.resolve(root, "_shared/compatibility-current-schema.md");
for (const markdownFile of markdownFiles) {
  if (shimFiles.has(path.resolve(markdownFile)) || path.resolve(markdownFile) === compatibilityFile) continue;
  const lines = (fileText.get(markdownFile) ?? "").split(/\r\n|\n|\r/);
  lines.forEach((line, index) => {
    if (/\blegacy\b/i.test(line)) return;
    const matches = FORBIDDEN_LEGACY_TERMS.filter(([, pattern]) => pattern.test(line)).map(([label]) => label);
    if (matches.length > 0) {
      addError(markdownFile, "forbidden-legacy-vocabulary", `forbidden active vocabulary: ${matches.join(", ")}`, index + 1);
    }
  });
}

const graph = new Map(markdownFiles.map((file) => [path.resolve(file), []]));
for (const markdownFile of markdownFiles) {
  const edges = [];
  for (const link of fileLinks.get(markdownFile) ?? []) {
    if (typeof link.resolved === "string" && markdownSet.has(path.resolve(link.resolved))) {
      edges.push(path.resolve(link.resolved));
    }
  }
  graph.set(path.resolve(markdownFile), [...new Set(edges)].sort());
}

const visitState = new Map();
const visitStack = [];
const reportedCycles = new Set();

function visitForCycles(file) {
  visitState.set(file, "visiting");
  visitStack.push(file);
  for (const target of graph.get(file) ?? []) {
    if (visitState.get(target) === "visiting") {
      const start = visitStack.indexOf(target);
      const cycle = [...visitStack.slice(start), target];
      const members = cycle.slice(0, -1).map(displayPath);
      const key = [...new Set(members)].sort().join("|");
      if (!reportedCycles.has(key)) {
        reportedCycles.add(key);
        const owner = cycle.slice(0, -1).every((member) => isWithin(sharedRoot, member)) ? "shared" : "skill";
        const message = `circular Markdown reference: ${cycle.map(displayPath).join(" -> ")}`;
        if (owner === "shared") {
          addWarning(cycle[0], "circular-reference", message);
        } else {
          addError(cycle[0], "circular-reference", message);
        }
      }
    } else if (!visitState.has(target)) {
      visitForCycles(target);
    }
  }
  visitStack.pop();
  visitState.set(file, "visited");
}

for (const markdownFile of [...graph.keys()].sort()) {
  if (!visitState.has(markdownFile)) visitForCycles(markdownFile);
}

for (const skillFile of skillFiles.sort()) {
  const queue = [{ file: path.resolve(skillFile), path: [path.resolve(skillFile)] }];
  let warningPath = null;
  while (queue.length > 0 && warningPath === null) {
    const current = queue.shift();
    for (const target of graph.get(current.file) ?? []) {
      if (current.path.includes(target)) continue;
      const nextPath = [...current.path, target];
      if (nextPath.length - 1 > 2) {
        warningPath = nextPath;
        break;
      }
      queue.push({ file: target, path: nextPath });
    }
  }
  if (warningPath) {
    addWarning(skillFile, "deep-reference-chain", `reference chain exceeds two hops: ${warningPath.map(displayPath).join(" -> ")}`);
  }
}

const severityOrder = { error: 0, warning: 1 };
issues.sort((left, right) => {
  return displayPath(left.file).localeCompare(displayPath(right.file))
    || (left.line ?? Number.MAX_SAFE_INTEGER) - (right.line ?? Number.MAX_SAFE_INTEGER)
    || severityOrder[left.severity] - severityOrder[right.severity]
    || left.rule.localeCompare(right.rule)
    || left.message.localeCompare(right.message);
});

console.log(`Skill root: ${displayPath(root)}${stagingMode ? " (staging mode)" : ""}`);
let lastFile = null;
for (const issue of issues) {
  const currentFile = displayPath(issue.file);
  if (currentFile !== lastFile) {
    console.log(currentFile);
    lastFile = currentFile;
  }
  const location = issue.line === null ? "" : `:${issue.line}`;
  console.log(`  ${issue.severity.toUpperCase()}${location} [${issue.rule}] ${issue.message}`);
}

const errorCount = issues.filter((issue) => issue.severity === "error").length;
const warningCount = issues.filter((issue) => issue.severity === "warning").length;
console.log(`Summary: files=${allFiles.length} markdown=${markdownFiles.length} skills=${skillFiles.length} errors=${errorCount} warnings=${warningCount}`);
console.log(`Result: ${errorCount === 0 ? "PASS" : "FAIL"}`);

process.exitCode = errorCount === 0 ? 0 : 1;
