import { toPyStr } from "../python-literals.mjs";

const GENERIC_PAYLOAD_WRAPPER_KEYS = [
  "previous",
  "arguments",
  "structured_content",
  "structuredContent",
  "result",
  "output",
  "input",
  "payload",
  "data",
  "response",
  "content_text"
];

export function reviewedPayloadWrapperKeys(assets) {
  const genericKeys = new Set(GENERIC_PAYLOAD_WRAPPER_KEYS);
  const reviewedKeys = new Set();
  for (const asset of Array.isArray(assets) ? assets : []) {
    for (const output of Array.isArray(asset?.outputs) ? asset.outputs : []) {
      const outputType = typeof output?.type === "string" ? output.type.trim().toLowerCase() : "";
      if (outputType !== "object" && outputType !== "array") continue;
      const outputName = typeof output?.name === "string" ? output.name.trim() : "";
      if (outputName && !genericKeys.has(outputName)) reviewedKeys.add(outputName);
    }
  }
  return [...GENERIC_PAYLOAD_WRAPPER_KEYS, ...[...reviewedKeys].sort()];
}

export function buildRuntimeToolInputsSection({ assets }) {
  const payloadWrapperKeys = reviewedPayloadWrapperKeys(assets)
    .map((key) => `    ${toPyStr(key)},`)
    .join("\n");
  return `

def _user_text_from_context(ctx: Context) -> str:
    content = getattr(ctx, "user_content", None)
    parts = getattr(content, "parts", None) or []
    text = "".join(getattr(part, "text", "") or "" for part in parts)
    return text.strip()


USER_TEXT_INPUT_NAMES = {
    "query",
    "user_query",
    "user_request",
    "request",
    "message",
    "prompt",
    "objective",
    "objective_text",
    "goal",
    "goal_text",
    "input_text",
}

PAYLOAD_WRAPPER_KEYS = (
${payloadWrapperKeys}
)


def _content_text(value: Any) -> str:
    parts = getattr(value, "parts", None)
    if not parts:
        return ""
    return "".join(getattr(part, "text", "") or "" for part in parts).strip()


def _json_safe_node_value(value: Any) -> Any:
    if value is None or isinstance(value, (str, int, float, bool)):
        return value
    content_text = _content_text(value)
    if content_text:
        return {"content_text": content_text}
    if isinstance(value, dict):
        return {str(key): _json_safe_node_value(item) for key, item in value.items()}
    if isinstance(value, (list, tuple)):
        return [_json_safe_node_value(item) for item in value]
    if hasattr(value, "model_dump"):
        try:
            return _json_safe_node_value(value.model_dump(mode="json"))
        except TypeError:
            return _json_safe_node_value(value.model_dump())
    return str(value)


def _short_error_reason(exc: Exception) -> str:
    text = f"{type(exc).__name__}: {exc}".strip()
    return text[:240] if len(text) > 240 else text


def _json_payload(value: Any) -> Any:
    if not isinstance(value, str):
        return None
    text = value.strip()
    if text.startswith("\`\`\`"):
        lines = text.splitlines()
        if lines and lines[0].strip().startswith("\`\`\`"):
            lines = lines[1:]
        if lines and lines[-1].strip().startswith("\`\`\`"):
            lines = lines[:-1]
        text = "\\n".join(lines).strip()
    if not text or text[0] not in "{[":
        return None
    try:
        parsed = json.loads(text)
    except Exception:
        return None
    return parsed if isinstance(parsed, (dict, list)) else None


def _payload_value(payload: Any, source_key: str, depth: int = 0) -> Any:
    if payload is None or depth > 6:
        return None
    if isinstance(payload, dict):
        if payload.get(source_key) is not None:
            return payload.get(source_key)
        for wrapper_key in PAYLOAD_WRAPPER_KEYS:
            if wrapper_key not in payload:
                continue
            value = _payload_value(payload.get(wrapper_key), source_key, depth + 1)
            if value is not None:
                return value
    if isinstance(payload, list):
        for item in payload:
            value = _payload_value(item, source_key, depth + 1)
            if value is not None:
                return value
    content_text = _content_text(payload)
    if content_text:
        value = _payload_value(content_text, source_key, depth + 1)
        if value is not None:
            return value
    _value = _json_payload(payload)
    if _value is not None:
        return _payload_value(_value, source_key, depth + 1)
    return None


def _payload_user_text(payload: Any, depth: int = 0) -> str:
    if payload is None or depth > 6:
        return ""
    if isinstance(payload, str):
        parsed = _json_payload(payload)
        if parsed is not None:
            parsed_text = _payload_user_text(parsed, depth + 1)
            if parsed_text:
                return parsed_text
        return payload.strip()
    content_text = _content_text(payload)
    if content_text:
        return _payload_user_text(content_text, depth + 1)
    if isinstance(payload, dict):
        for key in USER_TEXT_INPUT_NAMES:
            value = payload.get(key)
            if isinstance(value, str) and value.strip():
                return value.strip()
        for wrapper_key in PAYLOAD_WRAPPER_KEYS:
            if wrapper_key not in payload:
                continue
            value = _payload_user_text(payload.get(wrapper_key), depth + 1)
            if value:
                return value
    if isinstance(payload, list):
        text_items = [item.strip() for item in payload if isinstance(item, str) and item.strip()]
        if text_items:
            return "\\n".join(text_items)
        for item in payload:
            value = _payload_user_text(item, depth + 1)
            if value:
                return value
    return ""


def _resume_input_value(value: Any) -> Any:
    if isinstance(value, dict):
        for key in ("result", "response", "text", "message", "value"):
            if value.get(key) is not None:
                return value.get(key)
    return value


def _resume_input_for(ctx: Context, interrupt_id: str) -> Any:
    resume_inputs = getattr(ctx, "resume_inputs", None) or {}
    if not isinstance(resume_inputs, dict) or interrupt_id not in resume_inputs:
        return None
    return _resume_input_value(resume_inputs.get(interrupt_id))


def _collect_tool_inputs(
    ctx: Context, asset_id: str, input_names: list[str], required_names: list[str],
    data_channel_ids: list[str] | None = None, extra_payloads: list[dict] | None = None,
    node_input: Any = None,
) -> tuple[dict, dict]:
    # Resolve each reviewed tool input from (1) an explicit agents.config.yaml
    # input_map (tool_input -> state/output key), (2) reviewed state/channel
    # payloads, (3) this workflow edge's node_input, (4) matching fields inside
    # upstream *_output payloads, (5) user text for semantic text inputs, or (6)
    # the reviewed smoke_spec.synthetic_inputs seed. The fallback keeps runnable
    # scaffolds executable without inventing private data or hard-coding business
    # values in generated code.
    contract = COMPONENT_CONTRACTS.get(asset_id, {})
    overrides = _tool_cfg(asset_id, "input_map", {}) or {}
    smoke_spec = contract.get("smoke_spec") if isinstance(contract, dict) else {}
    synthetic_inputs = smoke_spec.get("synthetic_inputs", {}) if isinstance(smoke_spec, dict) else {}
    channel_payloads = [
        ctx.state.get(data_channel_id)
        for data_channel_id in (data_channel_ids or [])
        if ctx.state.get(data_channel_id) is not None
    ]
    channel_payloads.extend(payload for payload in (extra_payloads or []) if isinstance(payload, dict))
    args: dict = {}
    input_resolution: dict = {}
    for name in input_names:
        source_key = overrides.get(name, name)
        if not isinstance(source_key, str) or not source_key.strip():
            source_key = name
        if ctx.state.get(source_key) is not None:
            args[name] = ctx.state.get(source_key)
            input_resolution[name] = {"source": "state", "source_key": source_key}
            continue
        # Prefer a field named source_key from an explicitly-named incoming data channel.
        for payload in channel_payloads:
            value = _payload_value(payload, source_key)
            if value is not None:
                args[name] = value
                input_resolution[name] = {"source": "channel", "source_key": source_key}
                break
        if name in args:
            continue
        value = _payload_value(node_input, source_key)
        if value is not None:
            args[name] = value
            input_resolution[name] = {"source": "node_input", "source_key": source_key}
            continue
        # Fall back to a field named source_key inside any upstream *_output dict.
        # ADK's State object is not a dict (no .items()); to_dict() merges base + delta.
        for key, value in ctx.state.to_dict().items():
            resolved = _payload_value(value, source_key) if key.endswith("_output") else None
            if resolved is not None:
                args[name] = resolved
                input_resolution[name] = {"source": "upstream_output", "source_key": source_key, "state_key": key}
                break
        if name not in args and (source_key in USER_TEXT_INPUT_NAMES or source_key.endswith("_text")):
            user_text = _payload_user_text(node_input) or _user_text_from_context(ctx)
            if user_text:
                args[name] = user_text
                input_resolution[name] = {"source": "user_text", "source_key": source_key}
        if name not in args and isinstance(synthetic_inputs, dict) and synthetic_inputs.get(source_key) is not None:
            args[name] = synthetic_inputs.get(source_key)
            input_resolution[name] = {"source": "synthetic_inputs", "source_key": source_key}
    missing = [name for name in required_names if name not in args]
    if missing:
        raise RuntimeError(
            f"{asset_id}: required MCP tool inputs missing from node input / session state / upstream outputs: {missing}. "
            "Set an input_map for this Tool in agents.config.yaml."
        )
    return args, input_resolution
`;
}
