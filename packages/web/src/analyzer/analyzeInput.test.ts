import assert from "node:assert/strict";
import { resolveAnalyzeRawText } from "./analyzeInput.ts";

assert.equal(resolveAnalyzeRawText("  새 요구사항  ", "기존 raw_text"), "새 요구사항");
assert.equal(resolveAnalyzeRawText("", "  기존 raw_text  "), "기존 raw_text");
assert.equal(resolveAnalyzeRawText("   ", ""), "");
