# req_loan_precheck_smoke_adk

Runnable ADK 2.1 workflow generated from approved scaffold-plan.json for Synthetic loan precheck graph runtime handoff.

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env   # then set GOOGLE_API_KEY=...
python -m compileall req_loan_precheck_smoke_adk
python -m pytest -q
```

## What this bundle is

- `root_agent` is a `google.adk.workflow.Workflow` graph. Agent nodes are
  `LlmAgent` instances that call Gemini; adapter nodes are deterministic
  `FunctionNode`s. The graph runs over **synthetic inputs only** — no private
  endpoints, credentials, or real customer data.
- Generated from reviewed Agent Factory artifacts (`raw_requirement_to_code=false`).

## Individualize it

Edit `agents.config.yaml` to override any node's `model` or `instruction`
(and an adapter's `mcp_url`). `agent.py` loads this file at import, so changes
take effect on the next run. Put your `GOOGLE_API_KEY` in `.env` (gitignored).

## Adapters and the Mock Lab

Connected adapters call a live Mock Lab MCP tool over streamable-HTTP
(`AF_MOCK_LAB_MCP_URL` base, default `http://127.0.0.1:5176/api/mock-lab/mcp`). Adapters with no
bound/running Mock Lab server stay as TODO stubs returning reviewed synthetic
mock output and are listed under `runtime.unconnected_adapters` in
`workflow_manifest.json`.

## ADK runtime chat

```bash
adk api_server --host 127.0.0.1 --port 8765 --session_service_uri memory:// --artifact_service_uri memory:// --no-reload --with_ui .
curl -X POST http://127.0.0.1:8765/apps/req_loan_precheck_smoke_adk/users/af-reviewer/sessions/af-smoke -H "Content-Type: application/json" -d '{}'
curl -X POST http://127.0.0.1:8765/run -H "Content-Type: application/json" -d @runtime-chat-smoke.json
```
