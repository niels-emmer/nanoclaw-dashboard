"""Contract tests verifying backend Pydantic models align with frontend TypeScript definitions."""

import re
from pathlib import Path

from app.telemetry.models import AgentState, EventPayload, EventType, TelemetryEvent


def test_schema_version_is_current():
    event = TelemetryEvent(
        id="test-id",
        timestamp="2026-07-30T00:00:00Z",
        type=EventType.QUESTION,
        source="orchestrator",
        target="agent:coder",
        payload=EventPayload(summary="test"),
    )
    assert event.schema_version == "0.2.0"


def test_frontend_types_match_backend_schema():
    frontend_types_file = Path(__file__).parent.parent.parent / "frontend" / "src" / "lib" / "types.ts"
    assert frontend_types_file.exists(), f"Frontend types file not found at {frontend_types_file}"

    ts_content = frontend_types_file.read_text(encoding="utf-8")

    # Verify EventType values
    for event_type in EventType:
        assert f"'{event_type.value}'" in ts_content, f"EventType.{event_type.name} ('{event_type.value}') missing in types.ts"

    # Verify AgentState values
    for agent_state in AgentState:
        assert f"'{agent_state.value}'" in ts_content, f"AgentState.{agent_state.name} ('{agent_state.value}') missing in types.ts"

    # Verify EventPayload fields
    payload_fields = list(EventPayload.model_fields.keys())
    for field_name in payload_fields:
        assert re.search(rf"\b{field_name}\??:\s", ts_content), f"EventPayload field '{field_name}' missing in frontend types.ts"
