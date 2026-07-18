# Human Input and Resume

## Problem this pattern solves

Pause an approved Workflow for human input or approval and resume the same logical execution with explicit response mapping and replay/idempotency semantics.

## Evidence for use

- A person must approve, choose, or supply missing information before flow continues.
- Work must pause rather than poll or fabricate an answer.
- Resume must preserve invocation/task progress and completed results.
- Side-effecting Tools may be re-entered after interruption and need duplicate protection.

## When not to use

- Do not use Human Input as a third Tool Invocation Control value.
- Do not add pause/resume for ordinary conversational clarification that does not preserve a Workflow checkpoint.
- Do not assume every UI or CLI can resume.
- Do not resume a materially changed Workflow definition.

## Required questions

- What message, payload, allowed response, schema, aliases, and default are presented?
- What stable interrupt/invocation/session identifiers correlate the response?
- Which node reruns, and which completed work is reinstated?
- Which Tools are at-least-once and how are side effects deduplicated?
- What timeout, cancellation, rejection, auth, audit, and abandoned-request policy applies?

## Agent Factory representation

Use a Human Input Node plus pause/resume execution semantics and subsequent Workflow control. The human response influences the Workflow; Invocation Control remains Workflow or Agent for any later Tool call.

## Compose Artifact

Record Human Input message, payload/schema references, response mapping, choice options/aliases/default, checkpoint, interrupt correlation, resume entry, rerun behavior, state/artifact dependencies, timeout/cancel/reject paths, idempotency, audit, and required approvals.

## Scaffold Output

Installed public import and shape:

```python
from google.adk.events import RequestInput
```

`RequestInput` has `interrupt_id: str`, optional `payload`, optional `message`, and optional `response_schema`. When yielded by a Workflow node, installed runtime converts it to a function call named `adk_request_input`, uses `interrupt_id` as the call ID, and marks it long-running.

Resume sends a `google.genai.types.FunctionResponse` with the same ID and name inside `new_message`. Runner forbids mixing that function response with text and matches it to the prior call. The helper `create_request_input_response(interrupt_id, response)` exists only in an internal workflow utility; it is not exported from `google.adk.events` in installed 2.3.0. Build the `types.Part(function_response=...)` directly or consciously isolate internal usage.

Verified Function Node surface:

```text
FunctionNode(*, func, name=None, rerun_on_resume=False, retry_config=None,
             timeout=None, auth_config=None, parameter_binding='state',
             state_schema=None)
```

Set `rerun_on_resume=True` for generator-style logic that must re-enter after the response.

Preserve valid current-generator lowering during review: it reads the first resume input, yields `RequestInput` when no response exists, returns the mapped human response after resume, and wraps the function with rerun enabled. Current runnable output accepts `response_schema_ref` only when absent/null or `"str"`; numeric choice aliases may intentionally omit the string schema. Reverify the emitter before changing this limit.

Official resume docs describe `App(..., resumability_config=ResumabilityConfig(is_resumable=True))` and resuming with `invocation_id`; that symbol/signature was not included in the installed package probe, so inspect installed source before scaffolding it. Official docs state ADK Web UI and CLI resume are currently unsupported and Tool execution is at-least-once.

## Verification Scenarios

- initial pause emits the expected request and stable ID;
- valid response maps and resumes the correct node;
- invalid/missing response, wrong ID, and text-plus-response rejection;
- timeout, cancel, reject, and abandoned request;
- completed work reinstatement and incomplete work rerun;
- duplicate response and at-least-once side-effect protection;
- state/artifact continuity and audit trail;
- supported API-based resume rather than unsupported UI/CLI assumptions.

## Failure / Retry / Timeout

Define expiry, cancellation, duplicate response, and stale invocation behavior. Protect side-effecting Tools with idempotency keys or durable duplicate checks. Do not modify the Workflow between interruption and resume.

## Security / Audit

Authenticate the responder, authorize the decision, minimize payload data, prevent response tampering/replay, and audit prompt, allowed choices, actor, timestamps, correlation IDs, response summary, resume outcome, and redaction.

## Official sources

- [ADK human input](https://adk.dev/graphs/human-input/index.md)
- [ADK resume](https://adk.dev/runtime/resume/index.md)
- Installed RequestInput/resume evidence: [r1-adk-package-check.md](../../../../tests/skills/evidence/research/r1-adk-package-check.md), section B

## Checked date and Package Version

- Checked date: 2026-07-18
- Official sources: ADK human-input and resume documentation
- Installed package version: `google-adk 2.3.0`
- Known compatibility note: The response helper is internal, UI/CLI resume is unsupported, and the official `ResumabilityConfig` surface must be rechecked in the installed package before code emission.
