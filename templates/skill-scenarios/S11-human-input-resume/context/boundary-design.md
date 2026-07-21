# S11 Synthetic Human Input and Resume Boundary

- Decision status: approved for an isolated runnable prototype.
- Scaffold Readiness: `ready`.
- Source requirement: `req-s11-human-input-resume`.
- Root Workflow: `workflow-s11-human-input-resume`.
- Side-effect Tool: `tool-s11-apply-synthetic-change`, invoked only by the Workflow.
- Runtime contract: `rtc-s11-async-resume`, status `approved`.
- Stable synthetic correlation: interrupt `synthetic-approval-001`, invocation `synthetic-invocation-001`, session `synthetic-session-001`, idempotency key `synthetic-change-001`.
- Reviewed Graph: `graph-s11-human-input-resume`; the Human Input Node maps `approve` to `apply` and `reject` to `cancel` before the Tool boundary.
- Resume boundary: use the supported API response path for the same invocation. Web UI and CLI resume are not approved or claimed usable.
- Replay boundary: completed preparation is restored, the Human Input function may re-enter, and the synthetic write returns its prior result for duplicate responses instead of executing twice.
- Timeout, reject, cancel, wrong-ID, duplicate, and abandoned-request paths are explicit negative tests.
- Output mode: `runnable`.
- Exact standalone output: `${SCENARIO_OUTPUT_ROOT}/runtime`.
- Data boundary: fixed synthetic IDs and payloads only. No actor data, customer data, private endpoint, credential, deployment, or Catalog write is approved.
- Raw requirement to code: `false`; generation consumes this reviewed artifact set.
