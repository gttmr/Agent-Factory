# Local Dev Server And Input Sensitivity

This note covers local Agent Factory development surfaces. It is not a
deployment guide.

Target 자산과 경계 용어의 기준은 [Taxonomy](taxonomy.md)이며, 로컬 artifact에 남아 있는 Adapter 또는 Remote A2A 필드는 Current Implementation(`legacy`) 표현이다.

## Local Surfaces

- Workbench dev server: `http://127.0.0.1:5173/`.
- Standalone Mock Lab package: `http://127.0.0.1:5176/`.
- ADK runtime/dev UI smoke server: usually `http://127.0.0.1:8765/`.
- Chrome DevTools automation gate: `http://127.0.0.1:9222/json/version`.

The workbench command uses `--host 0.0.0.0` for WSL/browser reachability, but
these servers are local development tools. Do not expose them to untrusted
networks.

## Sensitive Inputs

Do not put private endpoints, credentials, real customer data, deployment
scripts, or production business logic into:

- raw requirements used for local demos
- `analysis-result.json`, `scaffold-plan.json`, or generated runtime stubs
- Mock Lab prompts, `mock-spec.json`, smoke inputs, event logs, or audit logs
- catalog YAML, catalog contract fixtures, regression scenarios, or docs
- screenshots shared outside the local review context

Use synthetic or masked data. Banking-domain examples in this repository are
review scaffolding, not production data.

## Secrets

Runtime secrets belong only in ignored local env files such as
`.agent-factory/runtime.env` or a file pointed to by `AF_RUNTIME_ENV_FILE`.
Generated bundles may include `.env.example`, but examples must not contain real
secret values.

## If Real Inputs Are Unavoidable

- Keep them out of tracked files and screenshots.
- Delete local artifact roots after the review.
- Report which commands or browser flows touched the inputs.
- Prefer a masked fixture that preserves schema shape without retaining content.
