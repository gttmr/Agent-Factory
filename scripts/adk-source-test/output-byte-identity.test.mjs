import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import {
  channelModules,
  generate,
  generateBundle,
  repoRoot,
  writeJson
} from "./fixtures.mjs";
import { assertBundleSha256Manifest } from "./generated-python-runtime.mjs";

const SMOKE_BASELINE = manifest([
  ["af_adk_a2a_server.py", "7b99703b21959b971c1a7365bd884698e7e8e3043605757bdd3907450d3428c0"],
  ["implementation-handoff.md", "8c36f45b67e145be9641b8582a72e1d52848e43658c5836da0babe68d8f7da4f"],
  ["req_gen_test_adk/__init__.py", "5ab8550f1e4ff205f461d035caad57bd7d4535bdd19f9c804d747f29f20953f1"],
  ["req_gen_test_adk/agent.json", "f4b8a28fc20cda7d7132dd26fbea75ade12a405fdf9e626c1eb29fac5488ecff"],
  ["req_gen_test_adk/agent.py", "26e21298b7d209dff08633ebba3e7f35546ed51bff55e56a9fd262a9fb3fe5b8"],
  ["req_gen_test_adk/mock_config.yaml", "9a56f996e0b3795b1e495051cf0406f5eac9077e26959fe48bff2a917cad4902"],
  ["req_gen_test_adk/nodes/__init__.py", "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"],
  ["req_gen_test_adk/nodes/adapters.py", "3bdbe9a01560955a25562fcd4556cb64bf02126d4947ceb593ae61d060af08e1"],
  ["req_gen_test_adk/nodes/agents.py", "a3912eb74456113a75a7c8fb3949ce9354e718af3fa4329b595017e651eae115"],
  ["req_gen_test_adk/nodes/gates.py", "0087b918f4b6aecf805014df060119c6b5d0f86fd5ac9ffe7a88b2dd7b6e5aad"],
  ["req_gen_test_adk/nodes/human_inputs.py", "85b80e0cc7f0aa36be8e7b2407459126d17d281f6df6baafc380229fb7de2677"],
  ["req_gen_test_adk/nodes/routers.py", "16c6bf552636e110b48b6f89e0a54d48a80d8ac5ecd9a5632ebd156e1b1d1dbe"],
  ["req_gen_test_adk/nodes/workflow_calls.py", "8395fab4e022dd7cce56c6e699f0f6b29a1e059d2eb9dc88a14bd91be0e2fad8"],
  ["req_gen_test_adk/sample_inputs.yaml", "af8bc165f14a5bab73642d48ae637d24dfa1c7d85b1b210f50a4ca9b8e9ff60a"],
  ["req_gen_test_adk/schemas.py", "28cda704fddf55339abf9df31f520647a4448ec3ef0a36b79123b613d897308e"],
  ["req_gen_test_adk/tests/__init__.py", "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"],
  ["req_gen_test_adk/tests/test_workflow_contract.py", "32b8ab251bbe6ee095cc68a0cea2b06175867c3db15c2950135cf12436dbc7f3"],
  ["req_gen_test_adk/workflow_manifest.json", "74c18ce0df430e4ea087cc0d9756e5f70f777c3cbb13fe41bb9e51d7df4369ed"],
  ["req_gen_test_adk/workflow.py", "70378ae7aa04203f3ce87a5b671f820509aaae2eb2293cce99ad44b2c6910704"],
  ["runtime-chat-smoke.json", "6fa96345c0a4b4b24ac8140bec4a4aa7659db97b5c6bbf343257b0efcb3f7775"],
  ["scaffold-plan.json", "0aab24f36fe013b72672b7d46e9e1db6b8f76748934743c439517b3f2958b8d7"]
]);

const STATIC_RUNNABLE_BASELINE = manifest([
  [".env.example", "2aba4cb829bbc08355f2fdf4cf252d21bc20b4cc1fa9099c2ee45e52480547f4"],
  [".gitignore", "52a9121ac2c9f227e8faa7f74af1d8bdd96302521cd708f986ac4fe574bcf7d9"],
  ["af_adk_a2a_server.py", "7b99703b21959b971c1a7365bd884698e7e8e3043605757bdd3907450d3428c0"],
  ["agents.config.yaml", "0b6894d00eb13baeda3b30c19fc01fa0b3f43fa25e0c347839530952b6d7696c"],
  ["implementation-handoff.md", "638273a607f57d6a5a02e0462e97628e7dfdab8c0bfbee289d1d8c9d7b2bae2b"],
  ["req_gen_test_adk/__init__.py", "5ab8550f1e4ff205f461d035caad57bd7d4535bdd19f9c804d747f29f20953f1"],
  ["req_gen_test_adk/agent.json", "f4b8a28fc20cda7d7132dd26fbea75ade12a405fdf9e626c1eb29fac5488ecff"],
  ["req_gen_test_adk/agent.py", "f3ed9bf59989a9fd698d49b31a6b059f02e9996e8739533fc80caacfcae8609e"],
  ["req_gen_test_adk/mock_config.yaml", "9a56f996e0b3795b1e495051cf0406f5eac9077e26959fe48bff2a917cad4902"],
  ["req_gen_test_adk/nodes/__init__.py", "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"],
  ["req_gen_test_adk/nodes/adapters.py", "3bdbe9a01560955a25562fcd4556cb64bf02126d4947ceb593ae61d060af08e1"],
  ["req_gen_test_adk/nodes/agents.py", "a3912eb74456113a75a7c8fb3949ce9354e718af3fa4329b595017e651eae115"],
  ["req_gen_test_adk/nodes/gates.py", "0087b918f4b6aecf805014df060119c6b5d0f86fd5ac9ffe7a88b2dd7b6e5aad"],
  ["req_gen_test_adk/nodes/human_inputs.py", "85b80e0cc7f0aa36be8e7b2407459126d17d281f6df6baafc380229fb7de2677"],
  ["req_gen_test_adk/nodes/routers.py", "16c6bf552636e110b48b6f89e0a54d48a80d8ac5ecd9a5632ebd156e1b1d1dbe"],
  ["req_gen_test_adk/nodes/workflow_calls.py", "8395fab4e022dd7cce56c6e699f0f6b29a1e059d2eb9dc88a14bd91be0e2fad8"],
  ["req_gen_test_adk/sample_inputs.yaml", "af8bc165f14a5bab73642d48ae637d24dfa1c7d85b1b210f50a4ca9b8e9ff60a"],
  ["req_gen_test_adk/schemas.py", "28cda704fddf55339abf9df31f520647a4448ec3ef0a36b79123b613d897308e"],
  ["req_gen_test_adk/tests/__init__.py", "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"],
  ["req_gen_test_adk/tests/test_workflow_contract.py", "ebcf6869ded821ed386eafb4bfea54de9ff12a52bc7d8e35338e876481f5b347"],
  ["req_gen_test_adk/workflow_manifest.json", "7e3ca0cff2b796f75d5511c11121b0493921003cddeaf93afb760d8d5c4738f3"],
  ["req_gen_test_adk/workflow.py", "70378ae7aa04203f3ce87a5b671f820509aaae2eb2293cce99ad44b2c6910704"],
  ["runtime-chat-smoke.json", "fb74638bb8cb017786be6ceebd552e90cf383816a239568fcfe579d1dc6d728f"],
  ["scaffold-plan.json", "e45c12a77645806ab0014447d04b47223551f4a25e0626d5fc87e361cd4bc3df"]
]);

const DYNAMIC_RUNNABLE_BASELINE = manifest([
  [".env.example", "2aba4cb829bbc08355f2fdf4cf252d21bc20b4cc1fa9099c2ee45e52480547f4"],
  [".gitignore", "52a9121ac2c9f227e8faa7f74af1d8bdd96302521cd708f986ac4fe574bcf7d9"],
  ["af_adk_a2a_server.py", "7b99703b21959b971c1a7365bd884698e7e8e3043605757bdd3907450d3428c0"],
  ["agents.config.yaml", "695ccf0de1bea13fca6a3924aa5911dd4ad65b9a3eafc8376677dbc043b472c6"],
  ["implementation-handoff.md", "bea19cf720dcbe455345b403801f81d23b806faf1a08f3df3a9424ec8ef45e73"],
  ["req_gen_test_adk/__init__.py", "5ab8550f1e4ff205f461d035caad57bd7d4535bdd19f9c804d747f29f20953f1"],
  ["req_gen_test_adk/agent.json", "f4b8a28fc20cda7d7132dd26fbea75ade12a405fdf9e626c1eb29fac5488ecff"],
  ["req_gen_test_adk/agent.py", "46fd5309d4cbf2ad877d03bc1c0f829dacac8421d7597ad3ccd8b82e5a908334"],
  ["req_gen_test_adk/mock_config.yaml", "7632c7a19cf1c7d3ba7f90c504fb01df4d85700369bdb523d9c83bb1ce1c8340"],
  ["req_gen_test_adk/nodes/__init__.py", "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"],
  ["req_gen_test_adk/nodes/adapters.py", "3bdbe9a01560955a25562fcd4556cb64bf02126d4947ceb593ae61d060af08e1"],
  ["req_gen_test_adk/nodes/agents.py", "a3912eb74456113a75a7c8fb3949ce9354e718af3fa4329b595017e651eae115"],
  ["req_gen_test_adk/nodes/gates.py", "0087b918f4b6aecf805014df060119c6b5d0f86fd5ac9ffe7a88b2dd7b6e5aad"],
  ["req_gen_test_adk/nodes/human_inputs.py", "85b80e0cc7f0aa36be8e7b2407459126d17d281f6df6baafc380229fb7de2677"],
  ["req_gen_test_adk/nodes/routers.py", "16c6bf552636e110b48b6f89e0a54d48a80d8ac5ecd9a5632ebd156e1b1d1dbe"],
  ["req_gen_test_adk/nodes/workflow_calls.py", "8395fab4e022dd7cce56c6e699f0f6b29a1e059d2eb9dc88a14bd91be0e2fad8"],
  ["req_gen_test_adk/sample_inputs.yaml", "07826f35e787d0495c74fe45c820d0bf6c8961187cf663f983380d8b8b2e7443"],
  ["req_gen_test_adk/schemas.py", "cc62cf4e28bc57c96794a559670d0c0d54eb11995eab7df0b6fc1d59ef31f1a9"],
  ["req_gen_test_adk/tests/__init__.py", "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"],
  ["req_gen_test_adk/tests/test_workflow_contract.py", "ebcf6869ded821ed386eafb4bfea54de9ff12a52bc7d8e35338e876481f5b347"],
  ["req_gen_test_adk/workflow_manifest.json", "07d4b051a3586874e4a2d6d2f2da225aa2b4c67eaf3acba4afdf6a189255846c"],
  ["req_gen_test_adk/workflow.py", "70378ae7aa04203f3ce87a5b671f820509aaae2eb2293cce99ad44b2c6910704"],
  ["runtime-chat-smoke.json", "fb74638bb8cb017786be6ceebd552e90cf383816a239568fcfe579d1dc6d728f"],
  ["scaffold-plan.json", "08fe8f5b54719c89228fbee04be06957809d1f2eea71c7563442dc88f5961782"]
]);

test("PR-B preserves canonical smoke and static runnable bundle bytes", () => {
  for (const [runnable, baseline] of [
    [false, SMOKE_BASELINE],
    [true, STATIC_RUNNABLE_BASELINE]
  ]) {
    const originalCwd = process.cwd();
    process.chdir(repoRoot);
    let generated;
    try {
      generated = generate({ runnable });
      assertBundleSha256Manifest(generated.outputRoot, baseline);
    } finally {
      if (generated) rmSync(generated.artifactRoot, { recursive: true, force: true });
      process.chdir(originalCwd);
    }
  }
});

test("PR-B preserves the accepted PR-A dynamic runnable bundle bytes", () => {
  const artifactRoot = mkdtempSync(join(tmpdir(), "af-gen-byte-dynamic-"));
  try {
    writeCanonicalDynamicFixture(artifactRoot);
    const outputRoot = join(artifactRoot, "runtime-stub");
    generateBundle(artifactRoot, outputRoot);
    assertBundleSha256Manifest(outputRoot, DYNAMIC_RUNNABLE_BASELINE);
  } finally {
    rmSync(artifactRoot, { recursive: true, force: true });
  }
});

function writeCanonicalDynamicFixture(artifactRoot) {
  const { agentBase } = channelModules();
  const modules = [
    { ...agentBase, id: "mod-a", name: "Branch A" },
    { ...agentBase, id: "mod-b", name: "Branch B" },
    { ...agentBase, id: "mod-sink", name: "Sink" }
  ];
  const nodes = [
    { id: "in1", node_kind: "input" },
    { id: "join1", node_kind: "join" },
    { id: "sink", node_kind: "agent", module_id: "mod-sink" },
    { id: "b", node_kind: "agent", module_id: "mod-b" },
    { id: "a", node_kind: "agent", module_id: "mod-a" },
    { id: "out1", node_kind: "output" }
  ];
  const edges = [
    { id: "e-in-a", from: "in1", to: "a", execution_semantics: "fan_out" },
    { id: "e-in-b", from: "in1", to: "b", execution_semantics: "fan_out" },
    { id: "e-a-join", from: "a", to: "join1", execution_semantics: "fan_in" },
    { id: "e-b-join", from: "b", to: "join1", execution_semantics: "fan_in" },
    { id: "e-join-sink", from: "join1", to: "sink", execution_semantics: "normal_transition" },
    { id: "e-sink-out", from: "sink", to: "out1", execution_semantics: "normal_transition" }
  ];
  const containers = [
    {
      id: "dynamic-root",
      container_kind: "dynamic_workflow",
      contains_node_ids: nodes.map((node) => node.id),
      entry_node_ids: ["in1"],
      exit_node_ids: ["out1"]
    }
  ];
  writeJson(join(artifactRoot, "normalized-requirement.json"), {
    id: "req-gen-test",
    title: "Generator test workflow",
    status: "approved"
  });
  writeJson(join(artifactRoot, "process-flow.json"), { nodes, edges, containers, validation: { errors: [] } });
  writeJson(
    join(artifactRoot, "module-candidates.json"),
    modules.map((module) => ({ id: module.id, status: "approved", missing_information: [] }))
  );
  writeJson(join(artifactRoot, "af-run-manifest.json"), {
    requirement_id: "req-gen-test",
    approvals: { analysis_reviewed: true, boundaries_approved: true, runtime_contracts_approved: true },
    stages: { design: { status: "complete" } }
  });
  writeJson(join(artifactRoot, "scaffold-plan.json"), {
    requirement_id: "req-gen-test",
    source: "approved_workbench_artifact",
    raw_requirement_to_code: false,
    output_mode: "runnable",
    modules,
    runtime_contracts: [],
    excluded_modules: [],
    manifest: { catalog_bound_modules: [], new_code_required: [] },
    validation: { can_generate_source: true, blockers: [], warnings: [] }
  });
}

function manifest(rows) {
  return rows.map(([path, sha256]) => ({ path, sha256 }));
}
