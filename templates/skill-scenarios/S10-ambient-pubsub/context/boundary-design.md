# S10 Synthetic External Event Boundary

- Decision status: reviewed design only; no runtime source generation is authorized.
- Scaffold Readiness: `Not Ready`.
- Source requirement: `req-s10-event-processing`.
- Root Workflow: `workflow-s10-event-processing`.
- Asset boundary: Ambient and Pub/Sub are not top-level Assets. Pub/Sub remains an external dependency described by runtime contract `rtc-s10-event-delivery-boundary`.
- Graph boundary: the reviewed Graph contains only Input, Function, and Output Nodes. It does not create an Ambient, Pub/Sub, event-source, retry-service, or DLQ Node.
- Input boundary: `pubsub-event.json` is an opaque synthetic test input. Its project-like subscription string is not connection configuration or approval to contact a cloud resource.
- Delivery identity: the reviewed target policy uses `message.messageId`, one logical session per delivery identity, and idempotent outcome handling.
- Failure boundary: the reviewed target policy allows at most three attempts and hands exhausted failures to an externally managed dead-letter boundary.
- Current Implementation: the generic ADK source generator has no Pub/Sub event-source adapter, no runnable `retry` or `error` Edge lowerer, and no DLQ delivery emitter.
- `STOP`: keep `scaffold-plan.json.validation.can_generate_source` false and do not create runtime source, a runtime stub, or an implementation handoff.
- Unblock condition: add framework-neutral event-source, delivery identity, retry/error, and DLQ handoff support with tests, then re-review Scaffold Readiness in a separate change.
- Output mode: `smoke` is only the strict schema value carried by the blocked plan; it is not generation approval or a runnable claim.
- Data boundary: fixed synthetic fixture content only. No customer data, private endpoint, credential, deployment, cloud resource creation, or Catalog write is approved.
- Raw requirement to code: `false`; any future generation must consume a re-approved artifact set.
