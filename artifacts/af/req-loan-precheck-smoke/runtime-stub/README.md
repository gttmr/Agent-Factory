# req_loan_precheck_smoke_adk

Generated from approved scaffold-plan.json for Synthetic loan precheck graph runtime handoff.

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python -m compileall req_loan_precheck_smoke_adk tests
python -m pytest -q
```

## ADK runtime chat smoke

This bundle supports local ADK API/Web UI smoke testing with reviewed synthetic test doubles only.
It does not contain private endpoints, credentials, deployment scripts, or real business logic.

```bash
adk api_server --host 127.0.0.1 --port 8765 --session_service_uri memory:// --artifact_service_uri memory:// --no-reload --with_ui .
curl -X POST http://127.0.0.1:8765/apps/req_loan_precheck_smoke_adk/users/af-reviewer/sessions/af-smoke -H "Content-Type: application/json" -d '{}'
curl -X POST http://127.0.0.1:8765/run -H "Content-Type: application/json" -d @runtime-chat-smoke.json
```
