import asyncio
import json
from pathlib import Path

import pytest

from app.telemetry.models import EventType
from app.telemetry.nanoclaw import NanoclawTelemetrySource
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
        EventType.INSTANCE_INFO,
        EventType.CONFIG_SNAPSHOT,
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


def test_normalize_timestamp_converts_naive_local_to_utc():
    """Naive (no-tz) timestamps are interpreted as local time and converted to UTC."""
    # A naive local timestamp must come out as UTC ISO-8601 with an offset.
    normalized = NanoclawTelemetrySource._normalize_timestamp("2026-08-24 15:00:00")
    assert normalized is not None
    assert normalized.endswith("+00:00")
    # Round-trips through datetime to confirm it parses and is timezone-aware.
    from datetime import datetime
    parsed = datetime.fromisoformat(normalized)
    assert parsed.utcoffset() is not None


def test_normalize_timestamp_keeps_utc_z_suffix():
    """Already-UTC ISO timestamps (messages_in) are preserved as UTC."""
    normalized = NanoclawTelemetrySource._normalize_timestamp("2026-08-24T15:00:00.339Z")
    assert normalized is not None
    assert normalized.endswith("+00:00")


def test_normalize_timestamp_returns_none_for_invalid():
    assert NanoclawTelemetrySource._normalize_timestamp(None) is None
    assert NanoclawTelemetrySource._normalize_timestamp("not-a-date") is None
    assert NanoclawTelemetrySource._normalize_timestamp("") is None


@pytest.mark.asyncio
async def test_mock_instance_info_has_details_and_metrics():
    """instance_info events carry version, uptime, resources, and metrics."""
    source = MockTelemetrySource(["coder", "researcher"], base_interval_ms=1, jitter_ms=0)
    gen = source.stream()

    for _ in range(250):
        evt = await anext(gen)
        if evt.type == EventType.INSTANCE_INFO:
            instance = json.loads(evt.payload.meta["instance"])
            assert instance["version"] == "0.3.0"
            assert instance["uptimeMs"] >= 0
            assert instance["resources"]["memoryTotalMb"] > 0
            assert "skills" in instance and isinstance(instance["skills"], list)
            assert "models" in instance and isinstance(instance["models"], list)
            assert any(a["id"] == "agent:coder" for a in instance["agents"])
            assert instance["metrics"]["messagesTotal"] >= 0
            assert instance["metrics"]["tokenBufferLimit"] > 0
            assert instance["metrics"]["timeToResetMs"] > 0
            assert instance["host"]["hostname"]
            return

    pytest.fail("Never got an INSTANCE_INFO event")


@pytest.mark.asyncio
async def test_mock_config_snapshot_has_grouped_files_with_content():
    """config_snapshot events carry logically grouped markdown files."""
    source = MockTelemetrySource(["coder"], base_interval_ms=1, jitter_ms=0)
    gen = source.stream()

    for _ in range(250):
        evt = await anext(gen)
        if evt.type == EventType.CONFIG_SNAPSHOT:
            groups = json.loads(evt.payload.meta["groups"])
            assert len(groups) >= 3
            labels = {g["label"] for g in groups}
            assert "Agents" in labels
            assert "Skills" in labels
            all_files = [f for g in groups for f in g["files"]]
            assert all_files
            assert all(f["content"] for f in all_files)
            assert any(f["name"].endswith(".md") for f in all_files)
            return

    pytest.fail("Never got a CONFIG_SNAPSHOT event")


def _make_nanoclaw_source(tmp_path: Path) -> NanoclawTelemetrySource:
    """Build a NanoclawTelemetrySource against a temp nanoclaw root without a real DB."""
    import sqlite3

    from app.config import Settings

    (tmp_path / "data").mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(tmp_path / "data" / "v2.db")
    conn.execute("CREATE TABLE agent_groups (id TEXT PRIMARY KEY, name TEXT)")
    conn.execute("CREATE TABLE container_configs (agent_group_id TEXT, provider TEXT, model TEXT, effort TEXT, skills TEXT, assistant_name TEXT)")
    conn.execute("CREATE TABLE sessions (id TEXT PRIMARY KEY, agent_group_id TEXT, container_status TEXT, last_active TEXT)")
    conn.commit()
    conn.close()

    settings = Settings(root=str(tmp_path), enabled=True)
    return NanoclawTelemetrySource(settings)


def test_real_config_snapshot_groups_and_strips_groups_prefix(tmp_path):
    """Real source groups config markdown and strips the groups/ prefix in labels."""
    (tmp_path / "groups" / "coder").mkdir(parents=True)
    (tmp_path / "groups" / "coder" / "instructions.prepend.md").write_text("# Coder instructions\n\nBe precise.\n")
    (tmp_path / "groups" / "coder" / "memory").mkdir()
    (tmp_path / "groups" / "coder" / "memory" / "notes.md").write_text("# Memory\n\nLearned X.\n")
    (tmp_path / "container").mkdir()
    (tmp_path / "container" / "CLAUDE.md").write_text("# Base\n\nShared instructions.\n")

    source = _make_nanoclaw_source(tmp_path)
    event = source._build_config_snapshot()
    assert event is not None
    groups = json.loads(event.payload.meta["groups"])

    labels = {g["label"] for g in groups}
    assert "coder" in labels  # groups/coder -> coder (prefix stripped)
    assert "container" in labels
    assert not any(g["label"].startswith("groups/") for g in groups)

    coder = next(g for g in groups if g["label"] == "coder")
    names = {f["name"] for f in coder["files"]}
    assert "instructions.prepend.md" in names
    assert all(f["content"] for f in coder["files"])

    # memory/ files are browseable — they land in their own group (coder/memory).
    all_names = {f["name"] for g in groups for f in g["files"]}
    assert "notes.md" in all_names
    memory_group = next(g for g in groups if "memory" in g["label"])
    assert memory_group["files"][0]["name"] == "notes.md"


def test_real_config_snapshot_excludes_data_and_agent_runner(tmp_path):
    """Real source excludes data/, agent-runner/, and product source/docs."""
    (tmp_path / "data").mkdir(parents=True)
    (tmp_path / "data" / "secret.md").write_text("should not appear")
    (tmp_path / "container" / "agent-runner").mkdir(parents=True)
    (tmp_path / "container" / "agent-runner" / "README.md").write_text("source docs, not config")
    (tmp_path / "src" / "modules").mkdir(parents=True)
    (tmp_path / "src" / "modules" / "agent.md").write_text("product source, not config")
    (tmp_path / "docs").mkdir()
    (tmp_path / "docs" / "architecture.md").write_text("product docs, not config")
    (tmp_path / "groups" / "coder").mkdir(parents=True)
    (tmp_path / "groups" / "coder" / "instructions.prepend.md").write_text("# Coder\n")
    (tmp_path / "AGENTS.md").write_text("# Root agent instructions\n")

    source = _make_nanoclaw_source(tmp_path)
    event = source._build_config_snapshot()
    assert event is not None
    groups = json.loads(event.payload.meta["groups"])
    all_paths = [f["path"] for g in groups for f in g["files"]]
    assert "data/secret.md" not in all_paths
    assert "container/agent-runner/README.md" not in all_paths
    assert "src/modules/agent.md" not in all_paths
    assert "docs/architecture.md" not in all_paths
    assert "groups/coder/instructions.prepend.md" in all_paths
    assert "AGENTS.md" in all_paths  # root-level markdown is config-relevant


def test_real_config_snapshot_caps_file_count_and_content_length(tmp_path):
    """Real source caps the number of files and truncates oversized content."""
    (tmp_path / "groups" / "coder").mkdir(parents=True)
    for i in range(50):
        (tmp_path / "groups" / "coder" / f"file{i}.md").write_text(f"# File {i}\n")
    big = tmp_path / "groups" / "coder" / "big.md"
    big.write_text("x" * 50_000)

    source = _make_nanoclaw_source(tmp_path)
    event = source._build_config_snapshot()
    assert event is not None
    groups = json.loads(event.payload.meta["groups"])
    all_files = [f for g in groups for f in g["files"]]
    assert len(all_files) <= 40
    assert all(len(f["content"]) <= 20_000 for f in all_files)


def test_real_instance_info_has_agents_and_metrics(tmp_path):
    """Real source instance_info carries agents, skills, and message/error totals."""
    (tmp_path / "groups" / "coder").mkdir(parents=True)
    (tmp_path / "groups" / "coder" / "instructions.prepend.md").write_text("# Coder\n")

    source = _make_nanoclaw_source(tmp_path)
    source._messages_total = 12
    source._errors_total = 2
    event = source._build_instance_info()
    assert event is not None
    instance = json.loads(event.payload.meta["instance"])
    assert instance["version"] == "0.3.0"
    assert instance["uptimeMs"] >= 0
    assert instance["metrics"]["messagesTotal"] == 12
    assert instance["metrics"]["errorsTotal"] == 2
    assert isinstance(instance["agents"], list)
    assert isinstance(instance["skills"], list)
    assert isinstance(instance["models"], list)
