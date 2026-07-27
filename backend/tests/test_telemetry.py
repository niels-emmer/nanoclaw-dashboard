import asyncio

import pytest

from app.telemetry.models import EventType
from app.telemetry.source import MockTelemetrySource


@pytest.mark.asyncio
async def test_mock_source_generates_question_and_response():
    source = MockTelemetrySource(["seer"], base_interval_ms=10, jitter_ms=0)
    gen = source.stream()
    event1 = await anext(gen)
    assert event1.type == EventType.QUESTION

    # Consume events until we see a RESPONSE (may have activity_update in between)
    for _ in range(20):
        evt = await anext(gen)
        if evt.type == EventType.RESPONSE:
            assert evt.source == "agent:seer"
            assert evt.payload.status == "completed"
            return
        # Allow activity_update and delivery_update between question and response
        assert evt.type in (EventType.ACTIVITY_UPDATE, EventType.DELIVERY_UPDATE)

    pytest.fail("Never got a RESPONSE event")


@pytest.mark.asyncio
async def test_mock_source_emits_new_event_types():
    """Verify the mock emits all the new event types over time."""
    source = MockTelemetrySource(["seer", "coder"], base_interval_ms=5, jitter_ms=0)
    gen = source.stream()
    seen_types: set[EventType] = set()

    # Consume up to 100 events and check we see the new types
    for _ in range(100):
        evt = await anext(gen)
        seen_types.add(evt.type)

    assert EventType.QUESTION in seen_types
    assert EventType.RESPONSE in seen_types
    assert EventType.ACTIVITY_UPDATE in seen_types
    assert EventType.DELIVERY_UPDATE in seen_types
    assert EventType.TOPOLOGY_SNAPSHOT in seen_types


@pytest.mark.asyncio
async def test_mock_activity_update_has_tool_fields():
    """Verify activity_update events carry tool state."""
    source = MockTelemetrySource(["coder"], base_interval_ms=5, jitter_ms=0)
    gen = source.stream()

    for _ in range(50):
        evt = await anext(gen)
        if evt.type == EventType.ACTIVITY_UPDATE:
            assert evt.payload.current_tool is not None
            assert evt.payload.tool_elapsed_ms is not None
            assert evt.payload.tool_timeout_ms is not None
            assert evt.payload.provider is not None
            assert evt.payload.model is not None
            assert evt.payload.container_status == "running"
            return

    pytest.fail("Never got an ACTIVITY_UPDATE event")


async def anext(ait):
    return await ait.__anext__()
