import { GEMINI_FALLBACK_MODEL } from "../context.mjs";
import { toPyStr } from "../python-literals.mjs";

export function buildRuntimeConfigSection({ componentContractLiteral }) {
  return `# Reviewed contract data for each approved module (synthetic test doubles only).
COMPONENT_CONTRACTS: dict[str, dict] = ${componentContractLiteral}

# Shared secrets live in <repo>/.agent-factory/runtime.env, or in the file
# pointed to by AF_RUNTIME_ENV_FILE. agents.config.yaml stays per-bundle and
# contains behavior overrides only.
_BUNDLE_DIR = Path(__file__).resolve().parent.parent
_CONFIG_PATH = _BUNDLE_DIR / "agents.config.yaml"
_DEFAULT_RUNTIME_ENV_RELATIVE_PATH = ".agent-factory/runtime.env"


def _parse_runtime_env(source: str) -> dict[str, str]:
    values: dict[str, str] = {}
    for raw_line in source.lstrip("\\ufeff").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#"):
            continue
        if line.startswith("export "):
            line = line[len("export ") :].lstrip()
        if "=" not in line:
            continue
        key, value = line.split("=", 1)
        key = key.strip()
        if not key.replace("_", "A").isalnum() or key[0].isdigit():
            continue
        value = value.strip()
        if len(value) >= 2 and value[0] == value[-1] == '"':
            value = (
                value[1:-1]
                .replace("\\\\n", "\\n")
                .replace("\\\\r", "\\r")
                .replace("\\\\t", "\\t")
                .replace('\\\\"', '"')
                .replace("\\\\\\\\", "\\\\")
            )
        elif len(value) >= 2 and value[0] == value[-1] == "'":
            value = value[1:-1]
        else:
            value = value.split(" #", 1)[0].strip()
        values[key] = value
    return values


def _central_runtime_env_path() -> Path:
    configured = os.environ.get("AF_RUNTIME_ENV_FILE")
    if configured:
        path = Path(configured).expanduser()
        return path if path.is_absolute() else (Path.cwd() / path).resolve()
    for root in (_BUNDLE_DIR, *_BUNDLE_DIR.parents):
        candidate = root / _DEFAULT_RUNTIME_ENV_RELATIVE_PATH
        if candidate.exists():
            return candidate
    return _BUNDLE_DIR / _DEFAULT_RUNTIME_ENV_RELATIVE_PATH


def _load_central_runtime_env() -> None:
    path = _central_runtime_env_path()
    if not path.exists():
        return
    for key, value in _parse_runtime_env(path.read_text(encoding="utf-8")).items():
        if key not in os.environ:
            os.environ[key] = value


_load_central_runtime_env()


def _load_config() -> dict:
    if not _CONFIG_PATH.exists():
        return {}
    try:
        return yaml.safe_load(_CONFIG_PATH.read_text(encoding="utf-8")) or {}
    except Exception as exc:  # malformed YAML, permissions, etc.
        import sys

        print(
            f"[agent.py] WARNING: could not load {_CONFIG_PATH.name} ({exc}); "
            "using seeded defaults.",
            file=sys.stderr,
        )
        return {}


_CONFIG = _load_config()


def _override(section: str, module_id: str, key: str, default: Any) -> Any:
    for entry in _CONFIG.get(section, []) or []:
        if isinstance(entry, dict) and entry.get("id") == module_id:
            value = entry.get(key)
            if value is not None:
                return value
    return default


def _agent_cfg(module_id: str, key: str, default: Any) -> Any:
    return _override("agents", module_id, key, default)


def _llm_cfg() -> dict:
    llm = _CONFIG.get("llm")
    return llm if isinstance(llm, dict) else {}


def _cfg_env(name: str, default: str) -> str:
    value = _llm_cfg().get(name)
    return str(value) if value else default


def _model_seed(module_id: str, seed: str) -> str:
    per_agent = _override("agents", module_id, "model", None)
    if per_agent:
        return str(per_agent)
    default_model = _llm_cfg().get("default_model") or _CONFIG.get("default_model")
    return str(default_model) if default_model else seed


def _selected_llm_provider() -> str:
    provider = os.environ.get("AF_LLM_PROVIDER", str(_llm_cfg().get("provider") or "auto")).strip().lower()
    if provider not in {"auto", "vllm", "vllm_openai", "gemini"}:
        raise RuntimeError(f"Unsupported AF_LLM_PROVIDER={provider!r}; expected auto, vllm, or gemini.")
    if provider != "auto":
        return "vllm" if provider == "vllm_openai" else provider
    api_base_env = _cfg_env("api_base_env", "AF_VLLM_API_BASE")
    model_env = _cfg_env("model_env", "AF_VLLM_MODEL")
    if os.environ.get(api_base_env) or os.environ.get(model_env):
        return "vllm"
    return "gemini"


def _vllm_model_name(model: str) -> str:
    model = model.strip()
    if not model:
        raise RuntimeError("AF_VLLM_MODEL or agents.config.yaml llm.default_model must not be empty for vLLM.")
    return model if model.startswith("hosted_vllm/") else f"hosted_vllm/{model}"


def _vllm_model(module_id: str, seed: str) -> Any:
    from google.adk.models.lite_llm import LiteLlm

    llm = _llm_cfg()
    api_base_env = _cfg_env("api_base_env", "AF_VLLM_API_BASE")
    model_env = _cfg_env("model_env", "AF_VLLM_MODEL")
    api_key_env = _cfg_env("api_key_env", "AF_VLLM_API_KEY")
    api_base = os.environ.get(api_base_env) or llm.get("api_base")
    if not api_base:
        raise RuntimeError(f"{api_base_env} is required when AF_LLM_PROVIDER resolves to vLLM.")
    model = os.environ.get(model_env) or _model_seed(module_id, seed)
    kwargs: dict[str, Any] = {
        "model": _vllm_model_name(str(model)),
        "api_base": str(api_base),
    }
    api_key = os.environ.get(api_key_env) or llm.get("api_key")
    if api_key:
        kwargs["api_key"] = str(api_key)
    return LiteLlm(**kwargs)


def _gemini_model(module_id: str, seed: str) -> str:
    model = _model_seed(module_id, seed)
    if str(model).startswith("hosted_vllm/"):
        return str(_llm_cfg().get("gemini_model") or ${toPyStr(GEMINI_FALLBACK_MODEL)})
    return str(model)


def _model_for(module_id: str, seed: str) -> Any:
    provider = _selected_llm_provider()
    if provider == "vllm":
        return _vllm_model(module_id, seed)
    return _gemini_model(module_id, seed)


def _adapter_cfg(module_id: str, key: str, default: Any) -> Any:
    return _override("adapters", module_id, key, default)


def _mcp_url(module_id: str, mcp_server: str) -> str:
    configured = _adapter_cfg(module_id, "mcp_url", None)
    if configured:
        return str(configured)
    base = os.environ.get("AF_MOCK_LAB_MCP_URL", "http://127.0.0.1:5173/api/mock-lab/mcp").rstrip("/")
    return f"{base}/{mcp_server}"
`;
}
