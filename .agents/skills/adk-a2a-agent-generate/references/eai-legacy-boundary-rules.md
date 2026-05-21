# EAI Legacy Boundary Rules

EAI is an internal legacy routing and integration boundary. Legacy System means an actual core banking, loan, card, customer, risk, or similar system. An ADK Agent or Workflow should not call a legacy endpoint directly.

Use an MCP Adapter or ADK Tool Adapter to call an EAI capability. Classify EAI/Legacy access as:

```text
module_category: adapter
adapter_kind: legacy_api
```

Do not add EAI or Legacy System as a new top-level `module_category`.

## Decision Rules

- Simple readonly lookup with short response -> `adapter_kind: legacy_api`, sync tool call can be enough.
- Shared legacy capability reused by multiple agents -> recommend MCP Legacy Adapter.
- EAI returns `job_id` and result arrives later -> Async Job + Callback Broker + Context Manager.
- Customer-impacting write or financial data change -> require human approval, idempotency, audit, timeout/retry/fallback, callback or timeout policy, and compensation review.
- Another department exposes independent Agent Runtime for legacy access -> evaluate `remote_a2a`, but only if owner, Agent Card, task lifecycle, auth, timeout, retry, fallback, audit, and data policy are known.

## Read/Write Separation

Readonly access still needs masking, access control, and audit when customer or financial data is involved.

Write, approval, batch, customer notification, and financial-write operations require:

- operation type classification
- reviewer or approval token policy
- idempotency key
- correlation id
- audit fields
- timeout and retry policy
- fallback behavior
- manual review or compensation path

## Handoff Notes

Record the selected access mode as one of:

```text
sync_read
sync_write
async_job
approval
batch
notification
unknown
```

Never include real banking endpoints, credentials, private network paths, or real customer data. Use synthetic ids and placeholder contract names only.
