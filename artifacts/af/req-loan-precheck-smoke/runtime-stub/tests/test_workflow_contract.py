from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


def test_agent_source_declares_adk_workflow():
    source = (ROOT / "req_loan_precheck_smoke_adk" / "agent.py").read_text(encoding="utf-8")
    assert "from google.adk.agents import BaseAgent" in source
    assert "class SyntheticRuntimeSmokeAgent(BaseAgent)" in source
    assert "TODO_IMPLEMENT_HERE" in source
    assert "runtime_mock_smoke" in source


def test_manifest_uses_scaffold_plan_contract():
    manifest = (ROOT / "req_loan_precheck_smoke_adk" / "workflow_manifest.json").read_text(encoding="utf-8")
    assert '"raw_requirement_to_code": false' in manifest
    assert '"generated_business_logic": false' in manifest
    assert '"private_data_or_endpoints": false' in manifest
    assert '"graph_ir"' in manifest
    assert '"catalog_bound_modules"' in manifest
    assert '"new_code_required"' in manifest
    assert '"runtime_contracts"' in manifest


def test_runtime_chat_smoke_contract_is_present():
    smoke = (ROOT / "runtime-chat-smoke.json").read_text(encoding="utf-8")
    assert '"appName": "req_loan_precheck_smoke_adk"' in smoke
    assert '"port": 8765' in smoke
