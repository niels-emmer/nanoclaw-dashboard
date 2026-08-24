import asyncio

import pytest

from app.telemetry.models import EventType
from app.telemetry.source import MockTelemetrySource


@pytest.mark.asyncio
async def test_mock_source_generates_question_and_response():
    source = MockTelemetrySource(["seer"], base_interval_ms=10, jitter_ms=0)
    gen = source.stream()

    # Consume until we see a QUESTION. The mock may emit an idle agent_status
    # before the first question (random idle check), so don't assume event #1.
    question = None
    for _ in range(20):
        evt = await anext(gen)
        if evt.type == EventType.QUESTION:
            question = evt
            break
    assert question is not None
    assert question.target == "agent:seer"

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
    source = MockTelemetrySource(["seer", "coder"], base_interval_ms=1, jitter_ms=0)
    gen = source.stream()
    seen_types: set[EventType] = set()
    expected_types = {
        EventType.QUESTION,
        EventType.RESPONSE,
        EventType.ACTIVITY_UPDATE,
        EventType.DELIVERY_UPDATE,
        EventType.APPROVAL_PENDING,
        EventType.TOPOLOGY_SNAPSHOT,
    }

    # Consume until all expected types are seen or max iterations reached
    for _ in range(250):
        evt = await anext(gen)
        seen_types.add(evt.type)
        if expected_types.issubset(seen_types):
            break

    assert expected_types.issubset(seen_types)


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
