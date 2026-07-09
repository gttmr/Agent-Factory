# ADK 2.3 Remote A2A

Use this reference to review generated Remote A2A lowering. Remote A2A remains a high-friction boundary.

## Contract Source

Canonical contract data lives in embedded `analysis-result.json.a2aContracts[]`, paired 1:1 with `remote_a2a` module candidates through `remote_module_id` and `a2a_contract_id`.

Required candidate evidence includes owner, Agent Card or discovery, request/response shape, task lifecycle, auth, timeout, retry, fallback, audit, and data policy.

## Generator Mapping

For runnable output, the generator requires:

- a matching approved A2A contract
- `agent_card.agent_card_url`
- valid `adk_runtime_policy`

Generated Python uses `RemoteA2aAgent(...)` with:

- `agent_card=<url>`
- optional `timeout=<seconds>`
- optional `A2aRemoteAgentConfig(request_interceptors=[RequestInterceptor(...)])`
- `use_legacy=False`

Auth interceptor support exists for `bearer_env` and `metadata_env` when `auth.env_var` matches `AF_A2A_*`. Retry and fallback remain handoff policy metadata; the current generator does not emit runtime wrappers for them.

## Runtime Source

Installed ADK source confirms:

- `RemoteA2aAgent` accepts `agent_card`, `timeout`, `config`, and `use_legacy`
- `A2aRemoteAgentConfig` has `request_interceptors`
- `RequestInterceptor` supports `before_request`

## Verification

```bash
node scripts/validate-artifacts.mjs <artifact-root>
```

Stop if a remote candidate lacks exactly one matching approved A2A contract, `agent_card.agent_card_url`, or a valid `AF_A2A_*` auth environment variable name for env-based auth.

## Grounding

- `https://adk.dev/a2a/quickstart-consuming/ (captured 2026-07-08)`
- `scripts/adk-source/remote-a2a.mjs`
- `scripts/validate-artifacts.mjs`
- `packages/web/src/analyzer/types.ts`
- `.agent-factory/runtime/.venv/lib/python3.13/site-packages/google/adk/agents/remote_a2a_agent.py`
- `.agent-factory/runtime/.venv/lib/python3.13/site-packages/google/adk/a2a/agent/config.py`
