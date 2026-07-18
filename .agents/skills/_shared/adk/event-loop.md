# Event Loop

## Problem this pattern solves

Reason correctly about when Events pause execution, when Runner services commit state/artifact actions, and when resumed code may rely on persisted results.

## Evidence for use

- Correctness depends on state or artifact commit timing.
- Streaming emits partial and final events.
- A callback or Tool reads state changed earlier in the same invocation.
- Pause/resume, cancellation, failure, or event history affects behavior.

## When not to use

- Do not model the Event Loop as an asset or Graph Node.
- Do not add custom event plumbing when ordinary Agent/Workflow execution is sufficient.
- Do not assume state is persisted merely because context state was mutated.
- Do not treat a partial streaming event as a final committed result.

## Required questions

- Which component yields each Event?
- Which action changes state or artifacts?
- Is the event partial or final?
- When does execution pause and resume?
- Which scope is session versus invocation?
- What happens on failure before commit, cancellation, duplicate processing, or callback/Tool error?

## Agent Factory representation

Represent Event Loop behavior as runtime execution semantics between Runner, Agent/Workflow/Tool/callback execution, SessionService, and ArtifactService. Attach state/artifact channels and commit expectations to Graph and runtime contracts; create no new asset type.

## Compose Artifact

Record event producer, content/output, `event.actions`, state/artifact delta, partial/final semantics, pause point, commit owner, resume point, invocation/session scope, event-history requirement, and failure/cancellation behavior.

## Scaffold Output

Installed event facts:

- `Event.output` is top-level.
- `Event.partial` is inherited from `LlmResponse`.
- `state_delta` and `route` live in `Event.actions` as `EventActions.state_delta` and `.route`.
- Convenience `Event(state={...}, route=...)` input is normalized into actions; a declared top-level `Event.state_delta` field is not present in installed 2.3.0.

Follow the official loop: execution yields an Event and pauses; Runner appends/processes it through services; state/artifact actions become committed; execution then resumes. Official docs state that `partial=True` events are forwarded but their actions are not committed, while the final non-partial event receives full action processing.

Do not hand-roll a second commit loop around Runner. Use context/service APIs from the state/artifact card and test the actual yielded events.

## Verification Scenarios

- state value before yield;
- yielded event and action delta;
- Runner append/commit then resumed state;
- dirty read followed by invocation failure;
- partial events followed by one final commit;
- callback state action and Tool result event;
- artifact delta/version;
- cancellation, exception, and event-history inspection.

## Failure / Retry / Timeout

Treat changes before a committed event as loss-prone. Do not retry a whole invocation without side-effect and duplicate-event analysis. Preserve cancellation/error events and define whether an interrupted invocation is resumed or restarted.

## Security / Audit

Do not store secrets or raw sensitive payloads in events, state deltas, artifact metadata, or histories. Record invocation/session IDs, event author/type, committed action summary, redaction, and failure without copying private content.

## Official sources

- [ADK event loop](https://adk.dev/runtime/event-loop/index.md)
- [ADK state](https://adk.dev/sessions/state/index.md)
- Installed event/source evidence: [r1-adk-package-check.md](../../../../tests/skills/evidence/research/r1-adk-package-check.md), sections E and G

## Checked date and Package Version

- Checked date: 2026-07-18
- Official sources: ADK event loop and state documentation
- Installed package version: `google-adk 2.3.0`
- Known compatibility note: Installed `Event` has no declared top-level `state_delta`; use `Event.actions.state_delta` semantics, and never rely on partial-event actions being committed.
