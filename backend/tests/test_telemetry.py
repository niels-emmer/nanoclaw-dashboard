import asyncio

import pytest

from app.telemetry.models import EventType
from app.telemetry.source import MockTelemetrySource


@pytest.mark.asyncio
async def test_mock_source_generates_question_and_response():
    source = MockTelemetrySource(["seer"], base_interval_ms=10, jitter_ms=0)
    gen = source.stream()
    event1 = await anext(gen)
    event2 = await anext(gen)
    assert event1.type == EventType.QUESTION
    assert event2.type == EventType.RESPONSE


async def anext(ait):
    return await ait.__anext__()
