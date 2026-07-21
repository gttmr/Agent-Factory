# S15 Private Data Safety Boundary

- Decision status: approved strict Target Contract v2 design.
- Scaffold Readiness: `blocked`.
- Source requirement: `req-s15-private-data-safety`.
- Root Workflow: `workflow-s15-private-data-safety-smoke`.
- External Tool seam: `tool-s15-environment-backed-service`, invoked only by the Workflow.
- Runtime contract: `rtc-s15-environment-backed-service`, status `approved`.
- Reviewed Graph: `graph-s15-private-data-safety-smoke`.
- Output mode: `smoke`.
- Raw requirement to code: `false`; any future generation must consume this reviewed artifact set.
- Configuration boundary: only `AF_SYNTHETIC_SERVICE_URL` and `AF_SYNTHETIC_SERVICE_CREDENTIAL` names may be persisted. Their values may be read only by a future reviewed runtime seam and must never be defaulted, logged, serialized, or copied into fixtures.
- Smoke boundary: fixed synthetic query and response only; network access is disabled and no external attempt or retry is authorized.
- Generator boundary: the current strict generator has no reviewed env-backed arbitrary external HTTP Tool emitter. Its generic function placeholder would not implement the approved connection, so Build is blocked with `can_generate_source=false`.
- Failure boundary: an actual external connection request fails closed until generator support and negative non-propagation tests are reviewed.
- Data boundary: no private endpoint value, credential value, customer data, deployment, Catalog write, or production connectivity is approved.
