import assert from "node:assert/strict";
import type { IncomingMessage } from "node:http";
import { Readable } from "node:stream";
import { readJsonBody } from "./httpApi.ts";

const oversizedRequest = Readable.from([JSON.stringify({ value: "abcdef" })]) as IncomingMessage;

await assert.rejects(
  readJsonBody(oversizedRequest, { maxBytes: 10, sizeLimitMessage: "요청 본문이 너무 큽니다." }),
  /요청 본문이 너무 큽니다\./
);

const whitespaceRequest = Readable.from(["   "]) as IncomingMessage;

await assert.rejects(readJsonBody(whitespaceRequest, { treatWhitespaceAsEmpty: false }), SyntaxError);
