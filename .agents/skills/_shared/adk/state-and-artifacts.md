# State and Artifacts

## Problem this pattern solves

Move small serializable state and versioned binary outputs across approved runtime boundaries with explicit scope, persistence, producer, consumer, and commit semantics.

## Evidence for use

- A value must survive steps, turns, sessions, users, or app-wide execution.
- Invocation-local scratch data is needed.
- A named binary or large output needs versioned save/load behavior.
- Graph correctness depends on state/artifact producer and consumer channels.

## When not to use

- Do not store large binaries or complex objects in session state.
- Do not use `temp:` state for persistence.
- Do not use artifacts for secrets or uncontrolled production payload capture.
- Do not add ad hoc plumbing when no downstream consumer exists.
- Do not mutate a Session object's state outside the recommended context/event path.

## Required questions

- What is the producer, consumer, Graph edge identity, channel kind, schema/MIME type, and scope?
- Is persistence required beyond process, invocation, session, or user?
- Which service implementation owns persistence and retention?
- When is the state/artifact action committed?
- What happens on duplicate write, version conflict, missing artifact, cancellation, or failed invocation?

## Agent Factory representation

Represent state and artifacts as runtime data channels on Graph edges and contracts, not assets. Keep session, user, app, and invocation scopes explicit. Open `_shared/adk/event-loop.md` separately when commit timing matters.

## Compose Artifact

Record producer, consumer, Graph edge identity, channel kind, scope, schema/MIME type, persistence service, retention, access control, version behavior, overwrite/idempotency policy, commit point, missing-value behavior, and synthetic fixture.

In strict v2 Graphs, an edge records only `channel` for state or artifact movement. The current generator derives the runtime storage key deterministically from the edge `id`; do not add a separate state or artifact key field.

## Scaffold Output

Installed session imports include `BaseSessionService`, `InMemorySessionService`, `Session`, and `State`. Verified state syntax:

- unprefixed key: session scope;
- `user:`: user scope within an app;
- `app:`: app scope;
- `temp:`: invocation-only and omitted from persistence.

`State.SESSION_PREFIX` is not present in installed 2.3.0; session scope is unprefixed. `BaseSessionService` exposes async create/get/list/delete session and `append_event(session, event)` operations.

Installed artifact services include `BaseArtifactService`, `FileArtifactService`, `GcsArtifactService`, and `InMemoryArtifactService`. Verified core signatures:

```text
save_artifact(*, app_name, user_id, filename, artifact,
              session_id=None, custom_metadata=None) -> int
load_artifact(*, app_name, user_id, filename,
              session_id=None, version=None) -> Part | None
```

The returned revision starts at 0 and increases. `session_id=None` selects user-scoped service storage; a supplied session ID selects session scope. Installed `Context` wrappers are `load_artifact(filename, version=None)` and `save_artifact(filename, artifact, custom_metadata=None)`; save records the revision in the event's artifact delta.

Official docs also describe agent output-key, context-state, and event-action update paths. Inspect the exact installed constructor before emitting fields not captured in the package check.

Preserve valid current-generator guardrails during review: stop on multiple distinct outgoing state channels from one Agent, Agent artifact output, unsupported non-connected state/artifact consumers, or derived runtime storage-key collisions. Reverify current emitter source before changing these limits.

## Verification Scenarios

- each state scope and persistence boundary;
- state action before yield, commit, and resume;
- invocation failure drops uncommitted/temp state;
- artifact save, latest load, specific-version load, list, and delete;
- missing artifact and duplicate write behavior;
- multiple-producer conflict and unsupported consumer rejection;
- access control, redaction, retention, and event artifact delta.

## Failure / Retry / Timeout

Define missing-key and service-unavailable behavior. Make repeated artifact writes intentional and version-aware. Do not retry state/artifact side effects without idempotency and commit-status evidence.

## Security / Audit

Use the narrowest scope, avoid secrets, validate MIME/schema, restrict filenames, sanitize metadata, and record producer, consumer, scope, revision, retention, and access outcome. Use synthetic content in tests.

## Official sources

- [ADK state](https://adk.dev/sessions/state/index.md)
- [ADK artifacts](https://adk.dev/artifacts/index.md)
- [ADK event loop](https://adk.dev/runtime/event-loop/index.md)
- Installed signature evidence: [r1-adk-package-check.md](../../../../tests/skills/evidence/research/r1-adk-package-check.md), section G

## Checked date and Package Version

- Checked date: 2026-07-18
- Official sources: ADK state, artifacts, and event-loop documentation
- Installed package version: `google-adk 2.3.0`
- Known compatibility note: Session scope is unprefixed and `State.SESSION_PREFIX` is not present; persistence depends on the configured service, not on the state key alone.
