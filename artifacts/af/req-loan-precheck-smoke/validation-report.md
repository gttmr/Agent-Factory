# Validation Report

## Result

passed

## Commands

- `node scripts/validate-artifacts.mjs artifacts/af/req-loan-precheck-smoke` -> `Artifact validation OK`
- `node scripts/generate-adk-source.mjs artifacts/af/req-loan-precheck-smoke artifacts/af/req-loan-precheck-smoke/runtime-stub` -> generated `runtime-stub/req_loan_precheck_smoke_adk`
- `python3 -m compileall artifacts/af/req-loan-precheck-smoke/runtime-stub/req_loan_precheck_smoke_adk artifacts/af/req-loan-precheck-smoke/runtime-stub/tests` -> compiled agent package and tests
- `python3 -m pytest -q` from `artifacts/af/req-loan-precheck-smoke/runtime-stub` -> `2 passed in 0.01s`
- host `curl -I http://127.0.0.1:5173/` -> `HTTP/1.1 200 OK`
- Chrome DevTools smoke on `http://127.0.0.1:5173/af/req-loan-precheck-smoke/build` -> page contained `req-loan-precheck-smoke`, `can_generate_source: 예`, `runtime-stub`, and `req_loan_precheck_smoke_adk`
- Chrome DevTools smoke on `http://127.0.0.1:5173/af/req-loan-precheck-smoke/verify` -> page contained `AF-VERIFY-FEEDBACK`, `validation-report.md`, `catalog-delta.yaml`, and `passed`

## Browser Evidence

- `/tmp/chrome-devtools-mcp-ygiQVL/screenshot.png`
- `/tmp/chrome-devtools-mcp-xPI9uv/screenshot.png`

## Remaining Risk

The generated source is TODO-only by design. No ADK dependency installation, `adk web`, Gemini API credential, or live chat session was run in this verification pass.
