"""Canonical telemetry event definitions."""

from __future__ import annotations

from enum import Enum
from typing import Dict, Literal, Optional

from pydantic import BaseModel, Field


class EventType(str, Enum):
    QUESTION = "question"
    RESPONSE = "response"
    AGENT_STATUS = "agent_status"


class AgentState(str, Enum):
    SPINNING_UP = "spinning_up"
    IDLE = "idle"
    RUNNING = "running"
    ERROR = "error"


class EventPayload(BaseModel):
    summary: str = Field(..., max_length=240)
    duration_ms: Optional[int] = Field(
        default=None,
        ge=0,
        json_schema_extra={"description": "Duration of the task if applicable."},
    )
    status: Literal["running", "completed", "error"] = "running"
    meta: Optional[Dict[str, str]] = None


class TelemetryEvent(BaseModel):
    id: str = Field(..., description="Globally unique event identifier")
    timestamp: str = Field(..., description="ISO-8601 timestamp")
    type: EventType
    source: str
    target: str
    payload: EventPayload
    agent_state: Optional[AgentState] = None
    schema_version: str = Field(default="0.1.0")
