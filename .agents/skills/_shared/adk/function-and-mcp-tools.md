# Function and MCP Tools

## Problem this pattern solves

Connect an approved Tool contract through an in-process function or an MCP server while keeping Function Node, Function-bound Tool, Tool Node, Binding, Transport, and Invocation Control distinct.

## Evidence for use

- Use Function Binding when the reviewed Tool executes in-process with a stable callable schema.
- Use MCP Binding when an external Tool server owns discovery/execution or a protocol boundary is required.
- Use Workflow Invocation Control when a Tool Node is a fixed Graph step.
- Use Agent Invocation Control when the Agent may choose among approved available Tools.

## When not to use

- Do not create a Tool for a Workflow-private helper that lacks an independent contract.
- Do not use MCP merely because a Tool is local or reusable.
- Do not expose every discovered MCP Tool to every Agent.
- Do not guess an endpoint, auth scheme, Tool name, schema, or installed API.

## Required questions

- Is this a Function Node or an independent Tool?
- What are the input, output, error, and side-effect schemas?
- Which owner controls the server lifecycle and Tool discovery?
- Which allow-list or filter applies?
- Is Transport in-process, stdio, SSE, or streamable HTTP?
- What auth, timeout, cancellation, cleanup, retry, idempotency, and audit policy applies?

## Agent Factory representation

Represent the asset as Tool. Use Binding `function` or `mcp`, Transport separately, and Invocation Control Workflow or Agent. MCP is not an asset type. A Workflow-private deterministic function remains a Function Node.

## Compose Artifact

Record Tool contract, Binding, Transport, server reference, Tool name, schema, auth reference, lifecycle owner, allow-list, side effect, timeout, cancellation, retry, idempotency, error mapping, cleanup, mock, audit, and Invocation Control.

## Scaffold Output

Official docs describe native functions as ADK Function Tools, but the installed package evidence did not record an exact Function Tool constructor. Inspect installed source before emitting one.

Installed MCP imports are:

```python
from google.adk.tools.mcp_tool import (
    McpToolset, SseConnectionParams, StdioConnectionParams,
    StreamableHTTPConnectionParams,
)
from mcp import StdioServerParameters
```

Verified connection surfaces:

- `StdioConnectionParams(*, server_params, timeout=5.0)`
- `SseConnectionParams(*, url, headers=None, timeout=5.0, sse_read_timeout=300.0, httpx_client_factory=...)`
- `StreamableHTTPConnectionParams(*, url, headers=None, timeout=5.0, sse_read_timeout=300.0, terminate_on_close=True, httpx_client_factory=...)`
- `McpToolset(*, connection_params, tool_filter=None, tool_name_prefix=None, ..., require_confirmation=False, ...)`

`tool_filter` accepts a list of names or a predicate over `BaseTool` and optional read-only context. Generic `HttpConnectionParams` is not present in installed `google-adk 2.3.0`; use `StreamableHTTPConnectionParams`. Uppercase `MCPToolset` exists only as a deprecated subclass; use `McpToolset`.

## Verification Scenarios

- discovery and allow-list filtering;
- Tool schema and successful call;
- invalid argument and error mapping;
- timeout, cancellation, server unavailable, and auth missing;
- duplicate side effect and cleanup;
- Agent-selected Tool trajectory;
- Workflow-fixed Tool call;
- local deterministic mock.

## Failure / Retry / Timeout

Define connect, discovery, call, and read timeouts separately where the transport supports them. Close sessions/processes on success, error, and cancellation. Retry only classified transient failures and require idempotency for side effects.

## Security / Audit

Use approved Tool allow-lists, least-privilege auth references, sanitized schemas, confirmation for sensitive operations, bounded outputs, and audit records for selection, arguments summary, result status, and side effect. Never embed credentials or private endpoints.

## Official sources

- [ADK Function tools](https://adk.dev/tools-custom/function-tools/index.md)
- [ADK MCP tools](https://adk.dev/tools-custom/mcp-tools/index.md)
- Installed signature evidence: [r1-adk-package-check.md](../../../../tests/skills/evidence/research/r1-adk-package-check.md), section D

## Checked date and Package Version

- Checked date: 2026-07-18
- Official sources: ADK Function tools and ADK MCP tools
- Installed package version: `google-adk 2.3.0`
- Known compatibility note: Generic `HttpConnectionParams` is not present; use the installed streamable-HTTP class, and do not rely on deprecated uppercase `MCPToolset`.
