# scenario-i — remote A2A runnable example

`input → local_dispatcher_agent (local) → remote_credit_agent (remote_a2a) → output`.
The remote node lowers to an ADK 2.x `RemoteA2aAgent` that calls a partner agent
over the A2A protocol; the agent card URL comes from the approved A2A contract
(`a2a-001`). Here the card points at the **local mock server** in `mock_remote/`,
which is synthetic (no real partner, no real data).

## Live A2A smoke (local)

The mock returns a fixed `{"analysis": "MOCK_REMOTE_OK", "risk": "low"}` — no Gemini,
no real endpoint. ADK A2A deps are needed on both sides.

```bash
# 1) deps (remote serving needs the a2a http-server extras)
python3 -m venv .venv && . .venv/bin/activate
pip install "google-adk[a2a]" "a2a-sdk[http-server]" uvicorn

# 2) start the mock remote A2A server on :8001
cd mock_remote
uvicorn serve_app:a2a_app --host localhost --port 8001
# card: http://localhost:8001/.well-known/agent-card.json

# 3) generate the runnable bundle from this scenario and run it; the generated
#    RemoteA2aAgent (agent_card = the mock card URL) calls the mock and returns
#    its result through the graph. (Generate via the workbench Build step, or
#    scripts/generate-adk-source.mjs against an artifact root seeded from this
#    scenario, then run with adk api_server / InMemoryRunner.)
```

The generator only emits the remote node when the A2A contract is approved and has
`agent_card.agent_card_url` (otherwise it rejects rather than mis-generate).
