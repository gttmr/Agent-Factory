# Codex Prompt: Maintain ADK Components Docs

아래 프롬프트는 Agent Factory 저장소에서 ADK component 참조 MD를 생성하거나 갱신할 때 사용했던 보관본이다.
현재 active workbench 문서 경로와 다를 수 있으므로 실행 전 최신 `docs/README.md`를 먼저 확인한다.

```text
You are working in the Agent Factory repository.

Task:
Create or update Markdown reference docs for ADK Components so that Agent Factory can use them during requirement analysis.

This is a documentation and requirement-analysis support task only.
Do not generate runnable business logic.
Do not scaffold agents.
Do not change application behavior.
Do not edit schemas unless explicitly requested in a separate task.
Do not edit .agents/skills unless explicitly requested for a skill-sync task.

Read first:
- README.md
- AGENTS.md
- docs/README.md
- docs/workbench/analysis-guide.md
- docs/workbench/taxonomy.md
- docs/workbench/workflow-decision-guide.md
- docs/workbench/validation.md
- docs/reference/target-agent-architecture/protocol-profile.md

Use official ADK docs as the only source for ADK component facts:
- https://adk.dev/get-started/about/
- https://adk.dev/context/
- https://adk.dev/context/caching/
- https://adk.dev/context/compaction/
- https://adk.dev/sessions/session/
- https://adk.dev/sessions/state/
- https://adk.dev/sessions/memory/
- https://adk.dev/callbacks/
- https://adk.dev/callbacks/types-of-callbacks/
- https://adk.dev/callbacks/design-patterns-and-best-practices/
- https://adk.dev/artifacts/
- https://adk.dev/events/
- https://adk.dev/apps/
- https://adk.dev/plugins/
- https://adk.dev/mcp/
- https://adk.dev/a2a/intro/
- https://adk.dev/streaming/
- https://adk.dev/streaming/streaming-tools/
- https://adk.dev/streaming/configuration/
- https://adk.dev/grounding/google_search_grounding/
- https://adk.dev/grounding/grounding_with_search/

Create this directory if missing:
- docs/reference/adk-components/

Create or update these files:
- docs/reference/adk-components/README.md
- docs/reference/adk-components/adk-component-selection-matrix.md
- docs/reference/adk-components/context.md
- docs/reference/adk-components/sessions-state-memory.md
- docs/reference/adk-components/callbacks.md
- docs/reference/adk-components/artifacts-events.md
- docs/reference/adk-components/apps-plugins.md
- docs/reference/adk-components/mcp-a2a.md
- docs/reference/adk-components/streaming-grounding.md

For each MD file, include:
1. Short Korean summary
2. What this ADK component means for Agent Factory requirement analysis
3. When to consider it
4. When not to use it
5. Mapping to Agent Factory taxonomy
6. Banking risk gates and review questions
7. Handoff examples for implementation-handoff.md
8. Official source URLs

Critical Agent Factory taxonomy rules:
- Top-level module_category remains only: agent, workflow, adapter, remote_a2a.
- ADK components are not new top-level module categories.
- Retrieval, grounding, memory search, MCP tools, and external connectors should be treated as adapter concerns when they are callable capabilities.
- `adapter_kind: retrieval` must be used for retrieval/grounding use cases.
- `adapter_kind: external_service` may be used for MCP/external tool services when appropriate.
- Remote A2A is only for independently owned/deployed/discoverable remote agent runtime with contract evidence.
- Do not infer remote_a2a from a multi-step local workflow.

Suggested optional analysis field:
Use `adk_component_hints` in documentation examples only, not schema, unless the schema already supports it.
If schema does not support this field, put the hints in implementation-handoff.md.

Also update docs/README.md to link the new docs under References:
- ADK Components Reference

Verification:
- Run `find docs/reference/adk-components -name "*.md" | sort`
- Run `git diff --check`
- Check that no TypeScript, schema, catalog, or template files changed unless explicitly requested.
- Check that all source URLs are official ADK docs.

Final response in Korean:
- files created/updated
- why the structure fits Agent Factory
- any unresolved ADK version/support concerns
- verification commands and results
```
