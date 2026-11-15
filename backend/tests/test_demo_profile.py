"""Tests for the demo mock profile (multi-tier agent network + human channel)."""

import asyncio
import json

import pytest

from app.telemetry.models import EventType
from app.telemetry.source import MockTelemetrySource


@pytest.mark.asyncio
async def test_demo_profile_emits_human_channel_conversation():
    """Human-channel events drive the Human node above the concierge agent."""
    source = MockTelemetrySource([], base_interval_ms=1, jitter_ms=0, profile="demo")
    gen = source.stream()

    for _ in range(300):
        evt = await anext(gen)
        if evt.type == EventType.QUESTION and evt.source == "channel:whatsapp":
            assert evt.target == "agent:concierge"
            # A response back to the human channel follows.
            for _ in range(50):
                evt2 = await anext(gen)
                if evt2.type == EventType.RESPONSE and evt2.target == "channel:whatsapp":
                    assert evt2.source == "agent:concierge"
                    assert evt2.payload.status == "completed"
                    return
            pytest.fail("No human-channel response after the question")
    pytest.fail("Never got a human-channel question")


@pytest.mark.asyncio
async def test_demo_profile_topology_has_multi_tier_tree():
    """The demo topology nests sub-agents under route-planner and coder."""
    source = MockTelemetrySource([], base_interval_ms=1, jitter_ms=0, profile="demo")
    gen = source.stream()

    for _ in range(300):
        evt = await anext(gen)
        if evt.type == EventType.TOPOLOGY_SNAPSHOT:
            tree = json.loads(evt.payload.meta["tree"])
            assert tree["root"] == "orchestrator"
            children = tree["children"]
            assert set(children["agent:route-planner"]) == {
                "agent:route-optimizer",
                "agent:route-validator",
            }
            assert set(children["agent:coder"]) == {"agent:reviewer", "agent:tester"}
            channels = json.loads(evt.payload.meta["channels"])
            assert any(c["id"] == "whatsapp" for c in channels)
            return
    pytest.fail("Never got a topology snapshot")


@pytest.mark.asyncio
async def test_demo_profile_roster_includes_new_agents():
    """The demo roster contains the concierge and coder's sub-agents."""
    source = MockTelemetrySource([], base_interval_ms=1, jitter_ms=0, profile="demo")
    gen = source.stream()

    for _ in range(300):
        evt = await anext(gen)
        if evt.type == EventType.INSTANCE_INFO:
            instance = json.loads(evt.payload.meta["instance"])
            ids = {a["id"] for a in instance["agents"]}
            assert "agent:concierge" in ids
            assert "agent:reviewer" in ids
            assert "agent:tester" in ids
            return
    pytest.fail("Never got an instance info event")


def test_default_profile_has_no_human_agent():
    """The default profile keeps the flat roster and no human channel."""
    source = MockTelemetrySource(["coder"], base_interval_ms=10, jitter_ms=0)
    assert source._human_agent is None
    assert source._agents == ["coder"]
    assert source._tree["children"] == {
        "agent:route-planner": ["agent:route-optimizer", "agent:route-validator"]
    }


def test_demo_human_content_lists_are_paired():
    """Human questions and replies are index-paired (same length)."""
    from app.telemetry import demo_profile as dp

    assert len(dp.DEMO_HUMAN_QUESTIONS) == len(dp.DEMO_HUMAN_RESPONSES)
    assert dp.DEMO_HUMAN_QUESTIONS


def test_demo_a2a_and_edges_reference_only_roster_agents():
    """Demo a2a patterns, edges, and tree children stay within the roster."""
    from app.telemetry import demo_profile as dp

    roster = set(dp.DEMO_AGENTS)
    for src, tgt, _, _ in dp.DEMO_A2A_PATTERNS:
        assert src in roster and tgt in roster
    for edge in dp.DEMO_A2A_EDGES:
        assert edge["source"].removeprefix("agent:") in roster
        assert edge["target"].removeprefix("agent:") in roster
    for parent, subs in dp.DEMO_TREE["children"].items():
        assert parent.removeprefix("agent:") in roster
        for sub in subs:
            assert sub.removeprefix("agent:") in roster


def test_mock_profile_env_wiring(monkeypatch):
    """NANOCLAW_MOCK_PROFILE env var selects the demo profile."""
    from app.config import Settings

    monkeypatch.setenv("NANOCLAW_MOCK_PROFILE", "demo")
    assert Settings().mock_profile == "demo"

    monkeypatch.setenv("NANOCLAW_MOCK_PROFILE", "default")
    assert Settings().mock_profile == "default"


def test_mock_profile_rejects_invalid_value(monkeypatch):
    """A typo'd profile fails fast at startup instead of silently falling back."""
    from pydantic import ValidationError

    from app.config import Settings

    monkeypatch.setenv("NANOCLAW_MOCK_PROFILE", "bogus")
    with pytest.raises(ValidationError):
        Settings()


def test_mock_profile_empty_env_falls_back_to_default(monkeypatch):
    """An empty NANOCLAW_MOCK_PROFILE (e.g. from a copied .env) uses the default."""
    from app.config import Settings

    monkeypatch.setenv("NANOCLAW_MOCK_PROFILE", "")
    assert Settings().mock_profile == "default"