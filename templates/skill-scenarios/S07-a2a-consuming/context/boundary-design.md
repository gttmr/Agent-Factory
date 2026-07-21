# S07 Synthetic A2A Consuming Boundary

- Decision status: approved for an isolated runnable prototype.
- Scaffold Readiness: `ready`.
- Source requirement: `req-s07-a2a-consuming`.
- Root Workflow: `workflow-s07-a2a-consuming`.
- Local Agent: `agent-s07-local-coordinator`.
- Consumed remote Agent: `agent-s07-remote-policy-qa` through approved contract `a2a-207`.
- Runtime contract: `rtc-s07-a2a-connection`, status `approved`.
- Reviewed Graph: `graph-s07-a2a-consuming`; no unresolved nodes, edges, regions, or candidate information.
- Output mode: `runnable`.
- Exact standalone output: `${SCENARIO_OUTPUT_ROOT}/runtime`.
- Authentication boundary: read only the environment-variable name `AF_A2A_SYNTHETIC_TOKEN`; no value is provided or persisted.
- Failure boundary: timeout and remote failure produce an observable manual-review handoff. A local Agent alternative may be compared in the handoff but must never replace the remote Agent silently.
- Data boundary: localhost and fixed synthetic text only. No customer data, private endpoint, credential, deployment, or Catalog write is approved.
- Raw requirement to code: `false`; generation consumes this reviewed artifact set.
