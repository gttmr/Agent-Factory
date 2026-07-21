export function buildContractTest({ outputMode, packageName, a2aProviderEnabled = false }) {
  if (outputMode === "runnable") {
    return `import importlib.util
from pathlib import Path

import pytest


ROOT = Path(__file__).resolve().parents[2]


def test_agent_source_declares_runnable_workflow():
    source = (ROOT / "${packageName}" / "agent.py").read_text(encoding="utf-8")
    assert "from google.adk.workflow import" in source
    assert "from google.adk.agents import LlmAgent" in source
    assert "root_agent = Workflow(" in source or "root_agent = _AsyncResumeWorkflow(" in source
    assert "SyntheticRuntimeSmokeAgent" not in source
    if " = LlmAgent(" in source:
        assert "mode=" in source


def test_manifest_declares_runnable_mode():
    manifest = (ROOT / "${packageName}" / "workflow_manifest.json").read_text(encoding="utf-8")
    assert '"output_mode": "runnable"' in manifest
    assert '"raw_requirement_to_code": false' in manifest
    assert '"private_data_or_endpoints": false' in manifest
    assert '"runtime"' in manifest


def test_runtime_chat_smoke_contract_is_present():
    smoke = (ROOT / "runtime-chat-smoke.json").read_text(encoding="utf-8")
    assert '"appName": "${packageName}"' in smoke
    assert '"port": 8765' in smoke


${a2aProviderEnabled ? `def test_a2a_launcher_forces_new_executor_for_terminal_task_state():
    source = (ROOT / "af_adk_a2a_server.py").read_text(encoding="utf-8")
    assert "force_new_version=True" in source

` : ""}
@pytest.mark.skipif(importlib.util.find_spec("google.adk") is None, reason="google-adk not installed")
def test_root_agent_is_a_workflow():
    from google.adk.workflow import Workflow

    generated_package = importlib.import_module("${packageName}.agent")
    assert isinstance(generated_package.root_agent, Workflow)
`;
  }
  return `from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]


def test_agent_source_declares_adk_workflow():
    source = (ROOT / "${packageName}" / "agent.py").read_text(encoding="utf-8")
    assert "from google.adk.agents import BaseAgent" in source
    assert "class SyntheticRuntimeSmokeAgent(BaseAgent)" in source
    assert "TODO_IMPLEMENT_HERE" in source
    assert "synthetic_smoke" in source


def test_manifest_uses_scaffold_plan_contract():
    manifest = (ROOT / "${packageName}" / "workflow_manifest.json").read_text(encoding="utf-8")
    assert '"raw_requirement_to_code": false' in manifest
    assert '"generated_business_logic": false' in manifest
    assert '"private_data_or_endpoints": false' in manifest
    assert '"graph_ir"' in manifest
    assert '"catalog_bound_assets"' in manifest
    assert '"new_code_required"' in manifest
    assert '"runtime_contracts"' in manifest


def test_runtime_chat_smoke_contract_is_present():
    smoke = (ROOT / "runtime-chat-smoke.json").read_text(encoding="utf-8")
    assert '"appName": "${packageName}"' in smoke
    assert '"port": 8765' in smoke
`;
}
