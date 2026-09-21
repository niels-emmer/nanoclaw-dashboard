"""Tests for the backup / restore module."""

import json
import sqlite3
import tarfile
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app.backup.archive import create_backup, extract_backup, list_backups, resolve_backup
from app.backup.collect import collect_backup, index_manifest_files
from app.backup.manifest import read_manifest, validate_categories
from app.backup.restore import compute_plan, generate_restore_script
from app.config import settings
from app.main import app


def build_nanoclaw_root(root: Path) -> None:
    """Create a minimal nanoclaw checkout for backup tests."""
    (root / "groups" / "main").mkdir(parents=True)
    (root / "groups" / "main" / "memory").mkdir(parents=True)
    (root / "groups" / "main" / "instructions.prepend.md").write_text("# Main agent\n")
    (root / "groups" / "main" / "memory" / "facts.md").write_text("fact: hello\n")
    (root / "groups" / "main" / "CLAUDE.md").write_text("generated - skip me\n")
    (root / "groups" / "main" / "container.json").write_text("{}")
    (root / "groups" / "worker").mkdir(parents=True)
    (root / "groups" / "worker" / "instructions.prepend.md").write_text("# Worker\n")
    (root / "container").mkdir(parents=True)
    (root / "container" / "CLAUDE.md").write_text("# Shared base\n")
    (root / ".env").write_text("ASSISTANT_NAME=Test\nONECLI_API_KEY=secret\n")
    (root / "data").mkdir(parents=True)

    db = sqlite3.connect(root / "data" / "v2.db")
    db.executescript(
        """
        CREATE TABLE schema_version (version INTEGER, name TEXT, applied TEXT);
        INSERT INTO schema_version VALUES (24, 'm024', '2026-01-01');
        CREATE TABLE agent_groups (id TEXT PRIMARY KEY, name TEXT, folder TEXT, agent_provider TEXT, created_at TEXT);
        INSERT INTO agent_groups VALUES ('ag-main', 'Main', 'main', NULL, '2026-01-01');
        INSERT INTO agent_groups VALUES ('ag-worker', 'Worker', 'worker', NULL, '2026-01-01');
        CREATE TABLE container_configs (agent_group_id TEXT PRIMARY KEY, provider TEXT, model TEXT, effort TEXT, image_tag TEXT, assistant_name TEXT, max_messages_per_prompt INTEGER, skills TEXT, mcp_servers TEXT, packages_apt TEXT, packages_npm TEXT, additional_mounts TEXT, cli_scope TEXT, timezone TEXT, updated_at TEXT);
        INSERT INTO container_configs VALUES ('ag-main', 'claude', 'sonnet', 'high', NULL, 'Main Agent', NULL, '"all"', '{}', '[]', '[]', '[]', 'group', NULL, '2026-01-01');
        INSERT INTO container_configs VALUES ('ag-worker', 'claude', 'opus', NULL, NULL, 'Worker', NULL, '"all"', '{}', '[]', '[]', '[]', 'group', NULL, '2026-01-01');
        CREATE TABLE messaging_groups (id TEXT PRIMARY KEY, channel_type TEXT, platform_id TEXT, instance TEXT, name TEXT, is_group INTEGER, unknown_sender_policy TEXT, denied_at TEXT, detached_at TEXT, created_at TEXT);
        INSERT INTO messaging_groups VALUES ('mg-1', 'whatsapp', '123', 'whatsapp', 'Chat', 0, 'strict', NULL, NULL, '2026-01-01');
        CREATE TABLE messaging_group_agents (id TEXT PRIMARY KEY, messaging_group_id TEXT, agent_group_id TEXT, engage_mode TEXT, engage_pattern TEXT, sender_scope TEXT, ignored_message_policy TEXT, session_mode TEXT, threads INTEGER, priority INTEGER, created_at TEXT);
        INSERT INTO messaging_group_agents VALUES ('w-1', 'mg-1', 'ag-main', 'mention', NULL, 'all', 'drop', 'shared', NULL, 0, '2026-01-01');
        CREATE TABLE users (id TEXT PRIMARY KEY, kind TEXT, display_name TEXT, created_at TEXT);
        INSERT INTO users VALUES ('phone:555', 'phone', 'Niels', '2026-01-01');
        CREATE TABLE user_roles (user_id TEXT, role TEXT, agent_group_id TEXT, granted_by TEXT, granted_at TEXT, PRIMARY KEY (user_id, role, agent_group_id));
        INSERT INTO user_roles VALUES ('phone:555', 'owner', NULL, NULL, '2026-01-01');
        CREATE TABLE agent_group_members (user_id TEXT, agent_group_id TEXT, added_by TEXT, added_at TEXT, PRIMARY KEY (user_id, agent_group_id));
        INSERT INTO agent_group_members VALUES ('phone:555', 'ag-main', NULL, '2026-01-01');
        CREATE TABLE user_dms (user_id TEXT, channel_type TEXT, messaging_group_id TEXT, resolved_at TEXT, PRIMARY KEY (user_id, channel_type));
        INSERT INTO user_dms VALUES ('phone:555', 'whatsapp', 'mg-1', '2026-01-01');
        CREATE TABLE agent_destinations (agent_group_id TEXT, local_name TEXT, target_type TEXT, target_id TEXT, created_at TEXT, PRIMARY KEY (agent_group_id, local_name));
        INSERT INTO agent_destinations VALUES ('ag-main', 'worker', 'agent', 'ag-worker', '2026-01-01');
        CREATE TABLE agent_message_policies (from_agent_group_id TEXT, to_agent_group_id TEXT, approver TEXT, created_at TEXT, PRIMARY KEY (from_agent_group_id, to_agent_group_id));
        INSERT INTO agent_message_policies VALUES ('ag-worker', 'ag-main', 'phone:555', '2026-01-01');
        """
    )
    db.commit()
    db.close()

    session_dir = root / "data" / "v2-sessions" / "ag-main" / "sess-1"
    session_dir.mkdir(parents=True)
    sdb = sqlite3.connect(session_dir / "inbound.db")
    sdb.executescript(
        """
        CREATE TABLE messages_in (id TEXT PRIMARY KEY, seq INTEGER, kind TEXT, timestamp TEXT, status TEXT, process_after TEXT, recurrence TEXT, series_id TEXT, tries INTEGER, trigger INTEGER, platform_id TEXT, channel_type TEXT, thread_id TEXT, content TEXT, source_session_id TEXT, on_wake INTEGER);
        INSERT INTO messages_in VALUES ('t-1', 2, 'task', '2026-01-01', 'pending', NULL, '0 7 * * *', 't-1', 0, 1, NULL, NULL, NULL, 'Morning summary', NULL, 0);
        """
    )
    sdb.commit()
    sdb.close()


@pytest.fixture
def nanoclaw_root(tmp_path: Path) -> Path:
    root = tmp_path / "nanoclaw"
    root.mkdir()
    build_nanoclaw_root(root)
    return root


@pytest.fixture
def backup_dir(tmp_path: Path) -> Path:
    return tmp_path / "backups"


# ---------------------------------------------------------------------------
# Manifest / categories
# ---------------------------------------------------------------------------

def test_validate_categories_full_implies_everything():
    assert validate_categories(["full", "agents"]) == ["full"]
    assert validate_categories(["agents", "env", "agents"]) == ["agents", "env"]
    with pytest.raises(ValueError):
        validate_categories(["bogus"])


# ---------------------------------------------------------------------------
# Collection
# ---------------------------------------------------------------------------

def test_collect_full_backup(nanoclaw_root: Path, tmp_path: Path):
    staging = tmp_path / "staging"
    staging.mkdir()
    manifest = collect_backup(nanoclaw_root, staging, ["full"], passphrase="pw")

    assert manifest.schema_version == "24"
    assert manifest.encrypted is True
    assert (staging / "data" / "v2.db").is_file()
    assert (staging / "tables" / "agent_groups.json").is_file()
    assert (staging / "tables" / "agent_message_policies.json").is_file()
    assert (staging / "env.enc").is_file()
    assert (staging / "container" / "CLAUDE.md").is_file()
    # Generated files are excluded.
    assert not (staging / "groups" / "main" / "CLAUDE.md").exists()
    assert not (staging / "groups" / "main" / "container.json").exists()
    # Real files are included.
    assert (staging / "groups" / "main" / "instructions.prepend.md").is_file()
    assert (staging / "groups" / "main" / "memory" / "facts.md").is_file()
    # Tasks extracted with session routing info.
    tasks = json.loads((staging / "tasks" / "tasks.json").read_text())
    assert tasks[0]["id"] == "t-1"
    assert tasks[0]["session_path"] == "ag-main/sess-1"

    files = index_manifest_files(staging)
    assert files, "manifest file index should not be empty"
    assert all(f.sha256 for f in files)


def test_collect_scoped_agents(nanoclaw_root: Path, tmp_path: Path):
    staging = tmp_path / "staging"
    staging.mkdir()
    manifest = collect_backup(nanoclaw_root, staging, ["agents"], agent_ids=["ag-main"])

    groups = json.loads((staging / "tables" / "agent_groups.json").read_text())
    assert [g["id"] for g in groups] == ["ag-main"]
    configs = json.loads((staging / "tables" / "container_configs.json").read_text())
    assert [c["agent_group_id"] for c in configs] == ["ag-main"]
    # Only the scoped group's folder is copied.
    assert (staging / "groups" / "main").is_dir()
    assert not (staging / "groups" / "worker").exists()
    # No raw DB for a partial backup.
    assert not (staging / "data" / "v2.db").exists()


def test_collect_env_requires_passphrase(nanoclaw_root: Path, tmp_path: Path):
    staging = tmp_path / "staging"
    staging.mkdir()
    with pytest.raises(ValueError, match="passphrase"):
        collect_backup(nanoclaw_root, staging, ["env"])


def test_collect_missing_db_raises(tmp_path: Path):
    root = tmp_path / "empty"
    root.mkdir()
    staging = tmp_path / "staging"
    staging.mkdir()
    with pytest.raises(FileNotFoundError):
        collect_backup(root, staging, ["full"], passphrase="pw")


def test_collect_skips_broken_symlinks(nanoclaw_root: Path, tmp_path: Path):
    """Broken container-internal symlinks (e.g. .claude-shared.md) must not
    abort the backup — they are skipped."""
    import os

    link = nanoclaw_root / "groups" / "main" / ".claude-shared.md"
    link.symlink_to("/app/CLAUDE.md")  # dangling on the host
    staging = tmp_path / "staging"
    staging.mkdir()
    manifest = collect_backup(nanoclaw_root, staging, ["agents"])
    assert manifest is not None
    assert not (staging / "groups" / "main" / ".claude-shared.md").exists()
    assert (staging / "groups" / "main" / "instructions.prepend.md").is_file()


def test_collect_excludes_transient_dirs(nanoclaw_root: Path, tmp_path: Path):
    """Transient dirs (.pnpm-store, .claude-fragments) are not config and must
    be excluded from group folder copies."""
    (nanoclaw_root / "groups" / "main" / ".pnpm-store" / "v10").mkdir(parents=True)
    (nanoclaw_root / "groups" / "main" / ".pnpm-store" / "v10" / "blob").write_text("x" * 100)
    (nanoclaw_root / "groups" / "main" / ".claude-fragments").mkdir()
    (nanoclaw_root / "groups" / "main" / ".claude-fragments" / "frag.md").write_text("frag")
    staging = tmp_path / "staging"
    staging.mkdir()
    collect_backup(nanoclaw_root, staging, ["agents"])
    assert not (staging / "groups" / "main" / ".pnpm-store").exists()
    assert not (staging / "groups" / "main" / ".claude-fragments").exists()
    assert (staging / "groups" / "main" / "instructions.prepend.md").is_file()


def test_collect_unknown_agent_ids_raise(nanoclaw_root: Path, tmp_path: Path):
    staging = tmp_path / "staging"
    staging.mkdir()
    with pytest.raises(ValueError, match="Unknown agent ids"):
        collect_backup(nanoclaw_root, staging, ["agents"], agent_ids=["ag-nope"])


def test_resolve_backup_rejects_traversal(backup_dir: Path):
    with pytest.raises(FileNotFoundError):
        resolve_backup(backup_dir, "../../etc/passwd")
    with pytest.raises(FileNotFoundError):
        resolve_backup(backup_dir, "backup-20260101-000000")  # wrong format
    with pytest.raises(FileNotFoundError):
        resolve_backup(backup_dir, "backup-20260101-000000.tar.gz")  # includes extension


def test_safe_extract_rejects_malicious_archive(tmp_path: Path):
    """Archives with traversal or symlink members must be rejected."""
    import io
    import tarfile

    evil = tmp_path / "evil.tar.gz"
    with tarfile.open(evil, "w:gz") as tar:
        info = tarfile.TarInfo("../escape.txt")
        info.size = 4
        tar.addfile(info, io.BytesIO(b"pwn!"))
    with pytest.raises(ValueError, match="unsafe archive member"):
        extract_backup(evil, tmp_path / "dest")

    symlink = tmp_path / "symlink.tar.gz"
    with tarfile.open(symlink, "w:gz") as tar:
        info = tarfile.TarInfo("link")
        info.type = tarfile.SYMTYPE
        info.linkname = "/etc"
        tar.addfile(info)
    with pytest.raises(ValueError, match="unsupported archive member type"):
        extract_backup(symlink, tmp_path / "dest2")


# ---------------------------------------------------------------------------
# Archive lifecycle
# ---------------------------------------------------------------------------

def test_create_and_list_backup(nanoclaw_root: Path, backup_dir: Path):
    meta = create_backup(backup_dir, nanoclaw_root, ["full"], passphrase="pw")
    assert meta["backup_id"].startswith("backup-")
    archive = backup_dir / f"{meta['backup_id']}.tar.gz"
    script = backup_dir / f"{meta['backup_id']}.sh"
    assert archive.is_file()
    assert script.is_file()
    assert script.stat().st_mode & 0o111  # executable

    with tarfile.open(archive, "r:gz") as tar:
        names = tar.getnames()
    assert "manifest.json" in names
    assert "data/v2.db" in names

    listed = list_backups(backup_dir)
    assert len(listed) == 1
    assert listed[0]["backup_id"] == meta["backup_id"]
    assert listed[0]["categories"] == ["full"]
    assert listed[0]["encrypted"] is True


def test_extract_backup_validates_manifest(nanoclaw_root: Path, backup_dir: Path, tmp_path: Path):
    meta = create_backup(backup_dir, nanoclaw_root, ["agents"])
    archive = backup_dir / f"{meta['backup_id']}.tar.gz"
    dest = tmp_path / "extracted"
    manifest = extract_backup(archive, dest)
    assert manifest.backup_id == meta["backup_id"]
    assert (dest / "tables" / "agent_groups.json").is_file()


# ---------------------------------------------------------------------------
# Restore planning
# ---------------------------------------------------------------------------

def test_compute_plan_full(nanoclaw_root: Path, backup_dir: Path):
    meta = create_backup(backup_dir, nanoclaw_root, ["full"], passphrase="pw")
    plan = compute_plan(backup_dir, meta["backup_id"], nanoclaw_root)
    assert plan["summary"]["full_restore"] is True
    actions = {i["action"] for i in plan["items"]}
    assert "replace" in actions
    # Existing rows on the target are reported as skips.
    assert any(i["action"] == "skip" for i in plan["items"])


def test_compute_plan_against_empty_target(nanoclaw_root: Path, backup_dir: Path, tmp_path: Path):
    meta = create_backup(backup_dir, nanoclaw_root, ["agents"])
    empty = tmp_path / "empty-target"
    empty.mkdir()
    plan = compute_plan(backup_dir, meta["backup_id"], empty)
    assert plan["summary"]["full_restore"] is False
    assert plan["summary"]["create"] > 0
    assert plan["summary"]["skip"] == 0


def test_generate_restore_script():
    script = generate_restore_script("backup-20260101-000000", "backup-20260101-000000.tar.gz")
    assert "backup-20260101-000000" in script
    assert "helper.cjs" in script
    assert "better-sqlite3" in script
    assert "plan|restore|import" in script
    assert "upgrade-state" in script  # never restored; re-stamp reminder
    assert "OneCLI" in script


# ---------------------------------------------------------------------------
# API endpoints
# ---------------------------------------------------------------------------

def test_backup_status_503_in_mock_mode():
    client = TestClient(app)
    resp = client.get("/api/backup/status")
    assert resp.status_code == 200
    assert resp.json()["enabled"] is False
    resp = client.post("/api/backup", json={"categories": ["full"]})
    assert resp.status_code == 503


def test_backup_endpoints_with_real_source(nanoclaw_root: Path, backup_dir: Path, monkeypatch):
    monkeypatch.setattr(settings, "enabled", True)
    monkeypatch.setattr(settings, "root", str(nanoclaw_root))
    monkeypatch.setattr(settings, "backup_dir", str(backup_dir))
    client = TestClient(app)

    # Create
    resp = client.post("/api/backup", json={"categories": ["agents", "env"], "passphrase": "pw"})
    assert resp.status_code == 200, resp.text
    body = resp.json()
    backup_id = body["backup_id"]
    assert body["encrypted"] is True

    # List
    resp = client.get("/api/backup")
    assert resp.status_code == 200
    assert any(b["backup_id"] == backup_id for b in resp.json()["backups"])

    # Plan
    resp = client.post("/api/backup/plan", json={"backup_id": backup_id})
    assert resp.status_code == 200
    assert resp.json()["summary"]["total"] > 0

    # Restore script
    resp = client.post("/api/backup/restore-script", json={"backup_id": backup_id})
    assert resp.status_code == 200
    assert "helper.cjs" in resp.json()["script"]

    # Download
    resp = client.get(f"/api/backup/download/{backup_id}")
    assert resp.status_code == 200
    assert resp.headers["content-type"] == "application/gzip"

    # Origin rejection
    resp = client.post(
        "/api/backup",
        json={"categories": ["agents"]},
        headers={"origin": "http://evil.com"},
    )
    assert resp.status_code == 403

    # Unknown backup
    resp = client.post("/api/backup/plan", json={"backup_id": "backup-nope"})
    assert resp.status_code == 404


def test_backup_token_required_when_configured(nanoclaw_root: Path, backup_dir: Path, monkeypatch):
    monkeypatch.setattr(settings, "enabled", True)
    monkeypatch.setattr(settings, "root", str(nanoclaw_root))
    monkeypatch.setattr(settings, "backup_dir", str(backup_dir))
    monkeypatch.setattr(settings, "backup_token", "s3cret")
    client = TestClient(app)

    # Without the token → 401.
    resp = client.get("/api/backup/status")
    assert resp.status_code == 401
    resp = client.post("/api/backup", json={"categories": ["agents"]})
    assert resp.status_code == 401

    # With the wrong token → 401.
    resp = client.get("/api/backup/status", headers={"X-Backup-Token": "wrong"})
    assert resp.status_code == 401

    # With the right token → 200.
    resp = client.get("/api/backup/status", headers={"X-Backup-Token": "s3cret"})
    assert resp.status_code == 200
    assert resp.json()["enabled"] is True

    # Non-dict body → 422 (Pydantic), not 500.
    resp = client.post(
        "/api/backup",
        content="[]",
        headers={"Content-Type": "application/json", "X-Backup-Token": "s3cret"},
    )
    assert resp.status_code == 422