export function buildA2aLauncherPy() {
  return `from __future__ import annotations

import argparse
import inspect
import logging
from typing import Sequence

import uvicorn

from google.adk.cli import fast_api as adk_fast_api
from google.adk.cli.utils import logs


def _patch_adk_a2a_json_scope_bug() -> None:
    """Patch ADK 2.2/2.3 api_server --a2a json local-scope bug in memory."""

    source = inspect.getsource(adk_fast_api.get_fast_api_app)
    needle = "    import inspect\\n    import json\\n\\n    from google.adk.agents import Agent\\n"
    if needle not in source:
        return
    patched = source.replace(
        "    import inspect\\n    import json\\n\\n",
        "    import inspect\\n\\n",
        1,
    )
    exec(compile(patched, adk_fast_api.__file__, "exec"), adk_fast_api.__dict__)


def _patch_adk_a2a_resume_executor_version() -> None:
    source = inspect.getsource(adk_fast_api.get_fast_api_app)
    needle = "          agent_executor = A2aAgentExecutor(\\n              runner=create_a2a_runner_loader(app_name),\\n          )"
    if needle not in source:
        return
    patched = source.replace(
        needle,
        "          agent_executor = A2aAgentExecutor(\\n              runner=create_a2a_runner_loader(app_name),\\n              force_new_version=True,\\n          )",
        1,
    )
    exec(compile(patched, adk_fast_api.__file__, "exec"), adk_fast_api.__dict__)


def main(argv: Sequence[str] | None = None) -> None:
    parser = argparse.ArgumentParser(description="Agent Factory ADK A2A launcher")
    parser.add_argument("agents_dir", nargs="?", default=".")
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=8001)
    parser.add_argument("--session_service_uri", default=None)
    parser.add_argument("--artifact_service_uri", default=None)
    parser.add_argument("--memory_service_uri", default=None)
    parser.add_argument("--no-reload", action="store_true")
    parser.add_argument("--with_ui", action="store_true")
    args = parser.parse_args(argv)

    logs.setup_adk_logger(logging.INFO)
    _patch_adk_a2a_json_scope_bug()
    _patch_adk_a2a_resume_executor_version()
    app = adk_fast_api.get_fast_api_app(
        agents_dir=args.agents_dir,
        session_service_uri=args.session_service_uri,
        artifact_service_uri=args.artifact_service_uri,
        memory_service_uri=args.memory_service_uri,
        use_local_storage=True,
        allow_origins=None,
        web=args.with_ui,
        a2a=True,
        host=args.host,
        port=args.port,
        reload_agents=False,
        auto_create_session=False,
    )
    config = uvicorn.Config(app, host=args.host, port=args.port, reload=False)
    uvicorn.Server(config).run()


if __name__ == "__main__":
    main()
`;
}
