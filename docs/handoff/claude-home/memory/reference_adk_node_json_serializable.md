---
name: reference-adk-node-json-serializable
description: ADK 2.3 constraint — generated node outputs that feed an LlmAgent must be JSON-serializable; verify generator changes at real runtime not just unit tests
metadata: 
  node_type: memory
  type: reference
  originSessionId: 0704deb0-6f93-4873-a8d5-dcb5f581eac7
---

ADK 2.3 runtime constraint (learned 2026-07-03, cost a full rework cycle): when a graph node's output becomes the `node_input` of a downstream `LlmAgent` node, ADK calls `_node_input_to_content(node_input)` which does `json.dumps(node_input)` (`.venv/.../google/adk/workflow/_llm_agent_wrapper.py:197,243,306`). So EVERY generated node return payload that can flow into an LlmAgent MUST be fully JSON-serializable. Two things are NOT and crash with `TypeError: Object of type Content is not JSON serializable`:
1. A raw `google.genai.types.Content` (e.g. the initial user message — ADK passes it as `node_input` to the FIRST node).
2. Any payload embedding `node_input` verbatim (e.g. `"previous": node_input`) when that input is a Content.

To emit chat-visible text from a node (e.g. a terminal completion message), the node must be an async generator that `yield`s `Event(content=types.Content(...))` and separately `yield`/returns a JSON-safe dict — NEVER `return types.Content` (that becomes downstream node_input and breaks json.dumps). Also make router `Event(output=...)` values JSON-safe (`_json_safe_node_value`).

**Process lesson:** a generate-adk-source change that PASSES `generate-adk-source.test.mjs` + `py_compile` can still CRASH at ADK runtime. Always verify generator changes by actually running the generated bundle — real `adk api_server`/`InMemoryRunner` with a `types.Content` initial input — not just unit tests. Watch for transient Gemini `503 UNAVAILABLE "high demand"` during real runs (external, retry). Related: [[project-adk-runtime-env]], [[feedback-generator-extensible-structure]]
