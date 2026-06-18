"""Synthetic A2A remote agent for local smoke (no Gemini, no real data).
Serve: uvicorn serve_app:a2a_app --host localhost --port 8001
"""
from __future__ import annotations

from typing import AsyncGenerator

from google.adk import Event
from google.adk.agents import BaseAgent
from google.adk.agents.invocation_context import InvocationContext
from google.adk.a2a.utils.agent_to_a2a import to_a2a
from google.genai import types


class MockRemoteCreditAgent(BaseAgent):
    """Returns a fixed, synthetic analysis result. Deterministic; no model call."""

    async def _run_async_impl(self, ctx: InvocationContext) -> AsyncGenerator[Event, None]:
        yield Event(
            invocation_id=ctx.invocation_id,
            author=self.name,
            content=types.Content(
                role="model",
                parts=[types.Part(text='{"analysis": "MOCK_REMOTE_OK", "risk": "low"}')],
            ),
        )


root_agent = MockRemoteCreditAgent(
    name="mock_remote_credit_agent",
    description="Synthetic A2A remote credit analyzer for local smoke (no real data).",
)

a2a_app = to_a2a(root_agent, port=8001)
