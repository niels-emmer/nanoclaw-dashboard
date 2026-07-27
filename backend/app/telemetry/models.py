"""Canonical telemetry event definitions."""

from __future__ import annotations

from enum import Enum
from typing import Dict, List, Literal, Optional

from pydantic import BaseModel, Field


class EventType(str, Enum):
    QUESTION = "question"
    RESPONSE = "response"
    AGENT_STATUS = "agent_status"
    ACTIVITY_UPDATE = "activity_update"
    DELIVERY_UPDATE = "delivery_update"
    APPROVAL_PENDING = "approval_pending"
    TOPOLOGY_SNAPSHOT = "topology_snapshot"


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
    status: Literal["running", "completed", "error", "pending", "processing", "delivered", "failed"] = "running"
    meta: Optional[Dict[str, str]] = None

    # Activity / tool state
    current_tool: Optional[str] = Field(
        default=None,
        description="Name of the tool the agent is currently executing (e.g. Bash, Read).",
    )
    tool_elapsed_ms: Optional[int] = Field(
        default=None,
        ge=0,
        description="Milliseconds since the current tool started.",
    )
    tool_timeout_ms: Optional[int] = Field(
        default=None,
        ge=0,
        description="Declared timeout for the current tool in milliseconds.",
    )

    # Agent capabilities
    provider: Optional[str] = Field(
        default=None,
        description="Agent provider name (claude, codex, opencode).",
    )
    model: Optional[str] = Field(
        default=None,
        description="Model alias or ID (sonnet, gpt-4o, etc.).",
    )
    skills: Optional[List[str]] = Field(
        default=None,
        description="List of skill names the agent has loaded.",
    )

    # Liveness
    container_status: Optional[str] = Field(
        default=None,
        description="Container runtime status: running, idle, or stopped.",
    )
    heartbeat_age_ms: Optional[int] = Field(
        default=None,
        ge=0,
        description="Milliseconds since the last container heartbeat.",
    )

    # Processing / delivery
    retry_count: Optional[int] = Field(
        default=None,
        ge=0,
        description="Number of retry attempts for a message.",
    )
    delivery_status: Optional[str] = Field(
        default=None,
        description="Delivery outcome: delivered or failed.",
    )

    # Approvals
    approval_action: Optional[str] = Field(
        default=None,
        description="Type of pending approval action (install_packages, add_mcp_server, etc.).",
    )
    approval_title: Optional[str] = Field(
        default=None,
        description="Human-readable title for a pending approval.",
    )


class TelemetryEvent(BaseModel):
    id: str = Field(..., description="Globally unique event identifier")
    timestamp: str = Field(..., description="ISO-8601 timestamp")
    type: EventType
    source: str
    target: str
    payload: EventPayload
    agent_state: Optional[AgentState] = None
    schema_version: str = Field(default="0.2.0")
