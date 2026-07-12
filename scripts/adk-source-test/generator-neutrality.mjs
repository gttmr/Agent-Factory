import { readFileSync } from "node:fs";
import { basename, join, relative } from "node:path";
import { collectFiles, repoRoot } from "./fixtures.mjs";

const SNAKE_CASE = /^[a-z][a-z0-9]*(?:_[a-z0-9]+)+$/;
const ASCII_TITLE = /^[A-Za-z][A-Za-z0-9]*(?:[ -][A-Za-z][A-Za-z0-9]*){1,4}$/;
const UPPER_IDENTIFIER = /^(?=.*[A-Z])[A-Z0-9_]{2,20}$/;
const COMPACT_KOREAN = /^(?=.*[가-힣])[가-힣A-Za-z0-9_-]{2,20}$/;

export function extractQuotedAtoms(source) {
  const atoms = [];
  let index = 0;
  while (index < source.length) {
    const char = source[index];
    if (char === "/" && source[index + 1] === "/") {
      index = skipLineComment(source, index + 2);
      continue;
    }
    if (char === "/" && source[index + 1] === "*") {
      index = skipBlockComment(source, index + 2);
      continue;
    }
    if (char === "/" && startsRegex(source, index)) {
      index = skipRegex(source, index + 1);
      continue;
    }
    if (char === '"' || char === "'") {
      const parsed = readQuoted(source, index, char);
      atoms.push({ value: decodeEscapes(parsed.value), line: lineAt(source, index), extractionClass: "quoted" });
      index = parsed.end;
      continue;
    }
    if (char === "`") {
      const parsed = readTemplate(source, index);
      for (const segment of parsed.segments) {
        if (!segment.value) continue;
        atoms.push({ value: decodeEscapes(segment.value), line: lineAt(source, segment.start), extractionClass: "template" });
        for (const nested of extractEmbeddedQuotedAtoms(segment.value)) {
          atoms.push({
            ...nested,
            line: lineAt(source, segment.start) + nested.line - 1,
            extractionClass: "template-quoted"
          });
        }
        for (const nested of extractEmbeddedInlineCode(segment.value)) {
          atoms.push({
            ...nested,
            line: lineAt(source, segment.start) + nested.line - 1,
            extractionClass: "template-inline-code"
          });
        }
      }
      for (const expression of parsed.expressions) {
        for (const nested of extractQuotedAtoms(expression.value)) {
          atoms.push({ ...nested, line: lineAt(source, expression.start) + nested.line - 1 });
        }
      }
      index = parsed.end;
      continue;
    }
    index += 1;
  }
  return atoms;
}

export function collectReviewedFixtureVocabulary(base = repoRoot) {
  const templateRoot = join(base, "templates", "regression-scenarios");
  const fixtureRoot = join(base, "scripts", "adk-source-test");
  const files = [
    ...collectFiles(templateRoot).filter((file) => ["analysis-result.json", "scaffold-plan.json"].includes(basename(file))),
    ...collectFiles(fixtureRoot).filter((file) => basename(file).includes("fixture") && file.endsWith(".mjs"))
  ].sort();
  const vocabulary = new Map();
  for (const file of files) {
    for (const atom of extractQuotedAtoms(readFileSync(file, "utf8"))) {
      if (!isReviewedVocabularyShape(atom.value)) continue;
      const paths = vocabulary.get(atom.value) ?? new Set();
      paths.add(relative(base, file));
      vocabulary.set(atom.value, paths);
    }
  }
  return vocabulary;
}

export function findGeneratorNeutralityViolations({
  sources,
  vocabulary,
  allowlist,
  consultedAllowlistTokens = new Set()
}) {
  const allowed = new Set(allowlist.map((entry) => entry.token));
  const reviewedTokens = [...vocabulary].map(([token, fixturePaths]) => ({
    token,
    fixturePaths,
    containmentPattern: tokenBoundaryPattern(token)
  }));
  const violations = new Map();
  for (const { path, source } of sources) {
    for (const atom of extractQuotedAtoms(source)) {
      if (SNAKE_CASE.test(atom.value)) {
        if (allowed.has(atom.value)) {
          consultedAllowlistTokens.add(atom.value);
        } else {
          addViolation(violations, {
            path,
            line: atom.line,
            token: atom.value,
            extractionClass: "snake-case",
            fixturePaths: vocabulary.get(atom.value) ?? new Set()
          });
        }
      }
      for (const { token, fixturePaths, containmentPattern } of reviewedTokens) {
        if (!containmentPattern.test(atom.value)) continue;
        if (allowed.has(token)) {
          consultedAllowlistTokens.add(token);
        } else {
          addViolation(violations, {
            path,
            line: atom.line,
            token,
            extractionClass: "reviewed-fixture-collision",
            fixturePaths
          });
        }
      }
    }
  }
  return [...violations.values()].sort(
    (left, right) => compareCodeUnits(left.path, right.path) || left.line - right.line || compareCodeUnits(left.token, right.token)
  );
}

function tokenBoundaryPattern(token) {
  const escapedToken = token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(
    `(?<![\\p{ID_Continue}_$\\u200C\\u200D])${escapedToken}(?![\\p{ID_Continue}_$\\u200C\\u200D])`,
    "u"
  );
}

export function formatGeneratorNeutralityViolations(violations) {
  return violations
    .map((violation) => {
      const fixtures = violation.fixturePaths.length ? `; fixtures=${violation.fixturePaths.join(",")}` : "";
      return `${violation.path}:${violation.line} token=${JSON.stringify(violation.token)} class=${violation.extractionClass}${fixtures}`;
    })
    .join("\n");
}

function addViolation(violations, violation) {
  const fixturePaths = [...violation.fixturePaths].sort();
  const key = `${violation.path}:${violation.line}:${violation.token}:${violation.extractionClass}`;
  violations.set(key, { ...violation, fixturePaths });
}

function isReviewedVocabularyShape(value) {
  return SNAKE_CASE.test(value) || ASCII_TITLE.test(value) || UPPER_IDENTIFIER.test(value) || COMPACT_KOREAN.test(value);
}

function readQuoted(source, start, quote) {
  let value = "";
  let index = start + 1;
  while (index < source.length) {
    if (source[index] === "\\") {
      value += source.slice(index, index + 2);
      index += 2;
      continue;
    }
    if (source[index] === quote) return { value, end: index + 1 };
    value += source[index];
    index += 1;
  }
  return { value, end: index };
}

function extractEmbeddedQuotedAtoms(source) {
  const atoms = [];
  let index = 0;
  while (index < source.length) {
    const quote = source[index];
    if (quote !== '"' && quote !== "'") {
      index += 1;
      continue;
    }
    if (quote === "'" && isProseApostrophe(source, index)) {
      index += 1;
      continue;
    }
    const tripleQuoted = source[index + 1] === quote && source[index + 2] === quote;
    const parsed = tripleQuoted ? readTripleQuoted(source, index, quote) : readQuoted(source, index, quote);
    atoms.push({ value: decodeEscapes(parsed.value), line: lineAt(source, index), extractionClass: "quoted" });
    index = parsed.end;
  }
  return atoms;
}

function isProseApostrophe(source, index) {
  return /\p{ID_Continue}/u.test(source[index - 1] ?? "") && /\p{ID_Continue}/u.test(source[index + 1] ?? "");
}

function readTripleQuoted(source, start, quote) {
  const delimiter = quote.repeat(3);
  const contentStart = start + delimiter.length;
  const end = source.indexOf(delimiter, contentStart);
  if (end === -1) return { value: source.slice(contentStart), end: source.length };
  return { value: source.slice(contentStart, end), end: end + delimiter.length };
}

function extractEmbeddedInlineCode(source) {
  const atoms = [];
  for (const match of source.matchAll(/\\?`([^`\n]+)\\?`/g)) {
    const value = match[1].endsWith("\\") ? match[1].slice(0, -1) : match[1];
    atoms.push({ value: decodeEscapes(value), line: lineAt(source, match.index ?? 0), extractionClass: "inline-code" });
  }
  return atoms;
}

function readTemplate(source, start) {
  const segments = [];
  const expressions = [];
  let segmentStart = start + 1;
  let value = "";
  let index = start + 1;
  while (index < source.length) {
    if (source[index] === "\\") {
      value += source.slice(index, index + 2);
      index += 2;
      continue;
    }
    if (source[index] === "`") {
      segments.push({ value, start: segmentStart });
      return { segments, expressions, end: index + 1 };
    }
    if (source[index] === "$" && source[index + 1] === "{") {
      segments.push({ value, start: segmentStart });
      const expression = readTemplateExpression(source, index + 2);
      expressions.push({ value: expression.value, start: index + 2 });
      index = expression.end;
      segmentStart = index;
      value = "";
      continue;
    }
    value += source[index];
    index += 1;
  }
  segments.push({ value, start: segmentStart });
  return { segments, expressions, end: index };
}

function readTemplateExpression(source, start) {
  let depth = 1;
  let index = start;
  while (index < source.length && depth > 0) {
    const char = source[index];
    if (char === '"' || char === "'") {
      index = readQuoted(source, index, char).end;
      continue;
    }
    if (char === "`") {
      index = readTemplate(source, index).end;
      continue;
    }
    if (char === "{") depth += 1;
    if (char === "}") depth -= 1;
    index += 1;
  }
  return { value: source.slice(start, Math.max(start, index - 1)), end: index };
}

function skipLineComment(source, start) {
  const end = source.indexOf("\n", start);
  return end === -1 ? source.length : end + 1;
}

function skipBlockComment(source, start) {
  const end = source.indexOf("*/", start);
  return end === -1 ? source.length : end + 2;
}

function startsRegex(source, index) {
  const prefix = source.slice(0, index).trimEnd();
  if (!prefix) return true;
  const previous = prefix.at(-1);
  if ("([{=,:;!?&|+-*%^~<>".includes(previous)) return true;
  return /(?:return|case|throw|else|do|typeof|instanceof|in|of)$/.test(prefix);
}

function skipRegex(source, start) {
  let inClass = false;
  let index = start;
  while (index < source.length) {
    if (source[index] === "\\") {
      index += 2;
      continue;
    }
    if (source[index] === "[") inClass = true;
    if (source[index] === "]") inClass = false;
    if (source[index] === "/" && !inClass) {
      index += 1;
      while (/[A-Za-z]/.test(source[index] ?? "")) index += 1;
      return index;
    }
    index += 1;
  }
  return index;
}

function decodeEscapes(value) {
  return value
    .replace(/\\u([0-9a-fA-F]{4})/g, (_, hex) => String.fromCharCode(Number.parseInt(hex, 16)))
    .replace(/\\([\\'"`])/g, "$1")
    .replace(/\\n/g, "\n")
    .replace(/\\r/g, "\r")
    .replace(/\\t/g, "\t");
}

function lineAt(source, index) {
  return source.slice(0, index).split("\n").length;
}

function compareCodeUnits(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}
