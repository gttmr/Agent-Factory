# Ambient Agents

## Problem this pattern solves

Start an approved Agent or Workflow from an external event instead of an interactive chat turn, with explicit normalization, session, retry, deduplication, and output-sink contracts.

## Evidence for use

- A webhook, cron, Pub/Sub message, or Eventarc CloudEvent initiates work.
- No user is waiting in an interactive chat for the response.
- Event identity, delivery semantics, concurrency, and output routing materially affect correctness.

## When not to use

- Do not create an Ambient Agent asset type.
- Do not use ambient entry for a normal request/response chat flow.
- Do not choose trigger endpoints for unsupported event sources or work that exceeds synchronous acknowledgement limits.
- Do not assume built-in deduplication or an ambient-specific Python package.

## Required questions

- Is generic run entry or a Pub/Sub/Eventarc trigger endpoint appropriate?
- What is the source event schema, identity, and normalization?
- How are user and session identities assigned?
- What are idempotency, duplicate delivery, concurrency, retry/backoff, DLQ, timeout, and replay policies?
- Where does output go: structured log, Pub/Sub, notification/integration, downstream Tool, or artifact store?

## Agent Factory representation

Represent an Agent or Workflow plus a Runtime Trigger Contract. Keep trigger source, endpoint mode, transport, and output sink outside asset classification.

## Compose Artifact

Record trigger source, endpoint mode, event identity/schema, normalization, auth, user/session mapping, idempotency, deduplication, concurrency, retry/backoff, DLQ, timeout, output sink, observability, replay, data policy, and local event fixture.

## Scaffold Output

No `google.adk.ambient` module or named ambient-agent API is present in installed 2.3.0. Installed ambient behavior uses generic API-server routes and opt-in trigger routes.

Installed surfaces include:

- `POST /run`, `POST /run_sse`, and websocket `/run_live` in the checked package;
- `--auto_create_session` and `--trigger_sources` CLI options;
- `POST /apps/{app_name}/trigger/pubsub` and `/apps/{app_name}/trigger/eventarc` when trigger sources are enabled;
- standard Pub/Sub push envelopes and structured/binary CloudEvents.

Official checked docs describe generic run entry as `/apps/{app_name}/run`; this differs from the installed route probe. Inspect the deployed API route before generating a client.

Official defaults recorded on 2026-07-18 are process-local concurrency 10, transient retry count 3 with exponential backoff/jitter, and a 10-minute synchronous acknowledgement ceiling. Trigger processing creates one new session per event; retries are stateless and may create another session. Treat duplicate handling as application responsibility. Status 200 acknowledges, 400 rejects malformed input without retry, and 500 requests source retry.

## Verification Scenarios

- normal and malformed event;
- Pub/Sub Base64 decode and Eventarc structured/binary normalization;
- duplicate delivery, replay, and idempotent output;
- transient failure, retry exhaustion, and DLQ handoff;
- concurrency burst and session isolation;
- timeout and output-sink failure;
- auth failure and sanitized observability.

## Failure / Retry / Timeout

Classify malformed, transient, and terminal failures. Keep work under the source acknowledgement deadline or move long work to a pull subscription, job, or worker architecture. Configure DLQ externally and make replay safe.

## Security / Audit

Authenticate event sources, validate schemas before Agent execution, sanitize attributes, prevent event data from becoming untrusted instructions, and audit event ID, source, session, retries, output sink, and redaction. Never embed subscriptions, endpoints, or credentials from a private environment.

## Official sources

- [ADK ambient agents](https://adk.dev/runtime/ambient-agents/index.md)
- Installed API/trigger evidence: [r1-adk-package-check.md](../../../../tests/skills/evidence/research/r1-adk-package-check.md), section F

## Checked date and Package Version

- Checked date: 2026-07-18
- Official sources: ADK ambient-agents documentation
- Installed package version: `google-adk 2.3.0`
- Known compatibility note: Installed generic run routes differ from the checked official path, and no ambient-specific module exists; verify the deployed route before scaffolding clients.
