# Agent Factory Mock Lab

Mock Lab is a separate local app for defining and testing synthetic MCP stdio mock servers. It is not mounted into the existing `/af/:reqId/*` workbench routes.

Running mocks are also re-exposed over network MCP (Streamable HTTP) at `/api/mock-lab/mcp/<key>`, with discovery at `/api/mock-lab/mcp-discovery`, so a generated runnable ADK bundle's connected adapter can call them live. See `docs/mock-lab/local-mcp-mock-lab.md`.

## Run

```bash
npm install
npm run dev
```

Open `http://127.0.0.1:5176/`.

## Guardrails

- `catalog/adapters.yaml` is read-only prefill input.
- Generated files are first written under `artifacts/mock-lab/<mock-id>/runs/<run-id>/proposed-files/`.
- `artifacts/mock-lab/<mock-id>/generated/` changes only through the apply API.
- Mock responses must stay synthetic and local-only.
- No credentials, private endpoints, deployment scripts, or production business logic.

## Verification

```bash
npm run test
npm run build
node scripts/validate-mock-spec.mjs ../../artifacts/mock-lab/<mock-id>/mock-spec.json
```

`npm run test` starts a local generated stdio process, so it needs an execution environment that allows child process spawning.
