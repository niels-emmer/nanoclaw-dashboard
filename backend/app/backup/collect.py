"""Collect nanoclaw state into a staging directory for backup.

Everything here reads from the read-only nanoclaw mount — nothing writes back
to the nanoclaw folder. The staging directory lives under the dashboard's own
writable backup folder.
"""

from __future__ import annotations

import hashlib
import json
import os
import shutil
import sqlite3
import subprocess
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional, Tuple

from ..logging import get_logger
from .manifest import Manifest, ManifestFile, now_iso

log = get_logger(__name__)

# ---------------------------------------------------------------------------
# Table inventory
# ---------------------------------------------------------------------------

# Config-relevant central-DB tables and their primary-key columns. Composite
# keys are listed in order. Used for table dumps and restore conflict analysis.
TABLE_KEYS: Dict[str, List[str]] = {
    "agent_groups": ["id"],
    "container_configs": ["agent_group_id"],
    "messaging_groups": ["id"],
    "messaging_group_agents": ["id"],
    "users": ["id"],
    "user_roles": ["user_id", "role", "agent_group_id"],
    "agent_group_members": ["user_id", "agent_group_id"],
    "user_dms": ["user_id", "channel_type"],
    "agent_destinations": ["agent_group_id", "local_name"],
    "agent_message_policies": ["from_agent_group_id", "to_agent_group_id"],
}

# Which column scopes a table to an agent group (for "specific agents" backups).
# ``None`` means the table is scoped by a from/to pair (policies) or not scoped.
AGENT_SCOPED_COLUMNS: Dict[str, Optional[str]] = {
    "agent_groups": "id",
    "container_configs": "agent_group_id",
    "agent_destinations": "agent_group_id",
    "agent_message_policies": None,  # scoped if either endpoint is in the set
    "agent_group_members": "agent_group_id",
    "user_roles": "agent_group_id",  # global roles (NULL) excluded for scoped backups
}

# Tables included per category (``full`` includes everything).
TABLE_CATEGORIES: Dict[str, set] = {
    "agent_groups": {"agents", "full"},
    "container_configs": {"agents", "full"},
    "agent_destinations": {"agents", "orchestrator", "full"},
    "agent_message_policies": {"agents", "orchestrator", "full"},
    "messaging_groups": {"channels", "orchestrator", "full"},
    "messaging_group_agents": {"channels", "orchestrator", "full"},
    "user_dms": {"channels", "orchestrator", "full"},
    "users": {"users", "full"},
    "user_roles": {"agents", "users", "full"},
    "agent_group_members": {"agents", "users", "full"},
}

# Files under groups/<folder>/ that are generated at spawn and must never be
# backed up or restored (they are projections of DB state / composed docs).
GENERATED_GROUP_FILES = frozenset({"CLAUDE.md", "container.json"})

# Directories never included when copying group folders. Transient/container
# state (package stores, Claude fragments, shared mounts) is not configuration
# and can be huge — e.g. .pnpm-store alone can exceed 900 MB on a live host.
# Agent working data (work/repos/projects/conversations) is also excluded: it
# is the agent's project workspace (often git clones of remotes), not nanoclaw
# config, and can reach multiple GB per group. The backup covers the agent's
# configuration: instructions, memory, notes, and small config files.
EXCLUDED_GROUP_DIRS = frozenset({
    ".git", "__pycache__", "node_modules",
    ".pnpm-store",       # package store — not config, can be hundreds of MB
    ".claude-fragments", # transient Claude state
    ".claude-shared",    # container-internal shared dir
    # Build artifacts / caches
    ".next", "dist", "build", ".cache",
    # Agent working data — not nanoclaw config (GBs of repos/projects)
    "work", "repos", "projects", "conversations",
})

# Individual files larger than this are skipped during group folder copies
# (config files are small; multi-MB files are working data like PDFs or build
# caches). Skipped files are recorded in the manifest notes.
MAX_GROUP_FILE_BYTES = 10 * 1024 * 1024  # 10 MiB


# ---------------------------------------------------------------------------
# SQLite helpers
# ---------------------------------------------------------------------------

def _query(db_path: Path, sql: str, params: tuple = ()) -> List[Dict[str, Any]]:
    """Read-only query returning rows as plain dicts."""
    conn = None
    try:
        conn = sqlite3.connect(f"file:{db_path}?mode=ro", uri=True)
        conn.row_factory = sqlite3.Row
        return [dict(row) for row in conn.execute(sql, params).fetchall()]
    except sqlite3.DatabaseError as exc:
        log.warning("backup_query_failed", db=str(db_path), error=str(exc))
        return []
    finally:
        if conn is not None:
            conn.close()


def _copy_db_raw(src: Path, dst: Path) -> None:
    """Copy a SQLite database faithfully, including WAL content.

    ``sqlite3.Connection.backup()`` reads the WAL and produces a consistent
    snapshot even while the nanoclaw host is writing.
    """
    src_conn = sqlite3.connect(f"file:{src}?mode=ro", uri=True)
    dst_conn = sqlite3.connect(dst)
    try:
        src_conn.backup(dst_conn)
    finally:
        dst_conn.close()
        src_conn.close()


def _table_exists(db_path: Path, table: str) -> bool:
    rows = _query(db_path, "SELECT name FROM sqlite_master WHERE type='table' AND name=?", (table,))
    return bool(rows)


def _dump_table(db_path: Path, table: str, staging: Path, scoped_ids: Optional[set] = None) -> None:
    """Dump a config table to ``staging/tables/<table>.json`` as a row list.

    The table's CREATE statement is appended to ``tables/schema.sql`` so the
    restore helper can recreate missing tables on a fresh target.
    """
    if not _table_exists(db_path, table):
        return
    schema_rows = _query(
        db_path, "SELECT sql FROM sqlite_master WHERE type='table' AND name=?", (table,)
    )
    if schema_rows and schema_rows[0].get("sql"):
        sql = str(schema_rows[0]["sql"]).replace("CREATE TABLE ", "CREATE TABLE IF NOT EXISTS ", 1)
        schema_path = staging / "tables" / "schema.sql"
        schema_path.parent.mkdir(parents=True, exist_ok=True)
        with schema_path.open("a", encoding="utf-8") as fh:
            fh.write(sql + ";\n")
    rows = _query(db_path, f"SELECT * FROM {table}")
    if scoped_ids is not None:
        col = AGENT_SCOPED_COLUMNS.get(table)
        if col:
            rows = [r for r in rows if r.get(col) in scoped_ids]
        elif table == "agent_message_policies":
            rows = [
                r
                for r in rows
                if r.get("from_agent_group_id") in scoped_ids
                or r.get("to_agent_group_id") in scoped_ids
            ]
        elif table == "user_roles":
            # Scoped backups keep only roles tied to the selected groups.
            rows = [r for r in rows if r.get("agent_group_id") in scoped_ids]
    if not rows:
        return
    tables_dir = staging / "tables"
    tables_dir.mkdir(parents=True, exist_ok=True)
    (tables_dir / f"{table}.json").write_text(
        json.dumps(rows, indent=2, ensure_ascii=False, default=str), encoding="utf-8"
    )


def _schema_version(db_path: Path) -> Optional[str]:
    """Highest applied migration version in the central DB, if readable."""
    if not _table_exists(db_path, "schema_version"):
        return None
    rows = _query(db_path, "SELECT MAX(version) AS v FROM schema_version")
    return str(rows[0]["v"]) if rows and rows[0].get("v") is not None else None


def _nanoclaw_version(root: Path) -> Optional[str]:
    """Best-effort nanoclaw version from package.json or upgrade-state.json."""
    pkg = root / "package.json"
    if pkg.is_file():
        try:
            data = json.loads(pkg.read_text(encoding="utf-8"))
            if data.get("version"):
                return str(data["version"])
        except (json.JSONDecodeError, OSError):
            pass
    state = root / "data" / "upgrade-state.json"
    if state.is_file():
        try:
            data = json.loads(state.read_text(encoding="utf-8"))
            if data.get("version"):
                return str(data["version"])
        except (json.JSONDecodeError, OSError):
            pass
    return None


# ---------------------------------------------------------------------------
# File collection
# ---------------------------------------------------------------------------

def _copy_tree(src: Path, dst: Path, exclude_dirs: Iterable[str] = (), skipped: Optional[list] = None) -> int:
    """Copy a directory tree, returning the number of files copied.

    Symlinks are skipped (nanoclaw group folders contain container-internal
    symlinks like ``.claude-shared.md -> /app/CLAUDE.md`` that are noise on
    the host), files over ``MAX_GROUP_FILE_BYTES`` are skipped and recorded in
    ``skipped``, and individual copy failures are logged and skipped so a file
    rotated mid-walk by the live host never aborts the backup.
    """
    count = 0
    for dirpath, dirnames, filenames in os.walk(src):
        dirnames[:] = [d for d in dirnames if d not in exclude_dirs]
        rel = Path(dirpath).relative_to(src)
        target = dst / rel if str(rel) != "." else dst
        target.mkdir(parents=True, exist_ok=True)
        for name in filenames:
            src_file = Path(dirpath) / name
            if src_file.is_symlink():
                continue
            try:
                if src_file.stat().st_size > MAX_GROUP_FILE_BYTES:
                    if skipped is not None:
                        skipped.append(str(src_file.relative_to(src.parent.parent)))
                    continue
                shutil.copy2(src_file, target / name)
                count += 1
            except OSError as exc:
                log.warning("backup_copy_skipped", path=str(src_file), error=str(exc))
    return count


def _collect_group_folder(root: Path, staging: Path, folder: str, skipped: Optional[list] = None) -> int:
    """Copy one agent group's folder (excluding generated files, symlinks,
    working-data dirs, and files over ``MAX_GROUP_FILE_BYTES``)."""
    src = root / "groups" / folder
    if not src.is_dir():
        return 0
    dst = staging / "groups" / folder
    dst.mkdir(parents=True, exist_ok=True)
    count = 0
    for dirpath, dirnames, filenames in os.walk(src):
        dirnames[:] = [d for d in dirnames if d not in EXCLUDED_GROUP_DIRS]
        rel = Path(dirpath).relative_to(src)
        target = dst / rel if str(rel) != "." else dst
        target.mkdir(parents=True, exist_ok=True)
        for name in filenames:
            if name in GENERATED_GROUP_FILES:
                continue
            src_file = Path(dirpath) / name
            if src_file.is_symlink():
                continue
            try:
                if src_file.stat().st_size > MAX_GROUP_FILE_BYTES:
                    if skipped is not None:
                        skipped.append(str(src_file.relative_to(root)))
                    continue
                shutil.copy2(src_file, target / name)
                count += 1
            except OSError as exc:
                log.warning("backup_copy_skipped", path=str(src_file), error=str(exc))
    return count


def _collect_memory(root: Path, staging: Path) -> int:
    """Copy every group's memory/ tree."""
    count = 0
    groups_dir = root / "groups"
    if not groups_dir.is_dir():
        return 0
    for folder in sorted(os.listdir(groups_dir)):
        mem = groups_dir / folder / "memory"
        if mem.is_dir():
            count += _copy_tree(mem, staging / "memory" / folder)
    return count


def _collect_sessions(root: Path, staging: Path) -> int:
    """Copy the v2-sessions tree (conversation history, opt-in)."""
    sessions = root / "data" / "v2-sessions"
    if not sessions.is_dir():
        return 0
    return _copy_tree(sessions, staging / "sessions", exclude_dirs={".claude-shared"})


def _collect_tasks(root: Path, staging: Path) -> int:
    """Extract scheduled-task rows (kind='task') from session inbound DBs."""
    sessions = root / "data" / "v2-sessions"
    if not sessions.is_dir():
        return 0
    tasks: List[Dict[str, Any]] = []
    for inbound in sessions.glob("*/**/inbound.db"):
        if not _table_exists(inbound, "messages_in"):
            continue
        rows = _query(
            inbound,
            "SELECT id, seq, kind, timestamp, status, process_after, recurrence, "
            "series_id, tries, trigger, platform_id, channel_type, thread_id, "
            "content, source_session_id, on_wake FROM messages_in WHERE kind='task'",
        )
        for row in rows:
            # Record the session folder so restore can route the row back.
            row["session_path"] = str(inbound.parent.relative_to(sessions))
        tasks.extend(rows)
    if not tasks:
        return 0
    tasks_dir = staging / "tasks"
    tasks_dir.mkdir(parents=True, exist_ok=True)
    (tasks_dir / "tasks.json").write_text(
        json.dumps(tasks, indent=2, ensure_ascii=False, default=str), encoding="utf-8"
    )
    return len(tasks)


def _encrypt_env(root: Path, staging: Path, passphrase: str) -> bool:
    """Encrypt .env into staging/env.enc with openssl AES-256-CBC (PBKDF2).

    The salt is embedded in the output header by openssl, so decryption only
    needs the passphrase. Returns False when there is no .env to back up.
    """
    env_file = root / ".env"
    if not env_file.is_file():
        return False
    dst = staging / "env.enc"
    # Passphrase via stdin so it never appears in the process list.
    result = subprocess.run(
        [
            "openssl", "enc", "-aes-256-cbc", "-pbkdf2", "-salt",
            "-pass", "stdin",
            "-in", str(env_file), "-out", str(dst),
        ],
        input=passphrase,
        capture_output=True,
        text=True,
    )
    if result.returncode != 0:
        raise RuntimeError(f"openssl encryption failed: {result.stderr.strip()}")
    return True


# ---------------------------------------------------------------------------
# Orchestrator detection
# ---------------------------------------------------------------------------

def _determine_orchestrator(agent_groups: List[Dict[str, Any]], hint: Optional[str]) -> Optional[str]:
    """Identify the orchestrator agent group (mirrors the telemetry source)."""
    if not agent_groups:
        return None
    if hint:
        for group in agent_groups:
            if group.get("id") == hint or (group.get("name") or "").lower() == hint.lower():
                return group["id"]
    for group in agent_groups:
        if "orchestrator" in (group.get("name") or "").lower():
            return group["id"]
    return agent_groups[0]["id"]


# ---------------------------------------------------------------------------
# Main entry
# ---------------------------------------------------------------------------

def collect_backup(
    root: Path,
    staging: Path,
    categories: List[str],
    agent_ids: Optional[List[str]] = None,
    passphrase: Optional[str] = None,
    orchestrator_hint: Optional[str] = None,
) -> Manifest:
    """Collect the requested categories from ``root`` into ``staging``.

    Returns the manifest describing what was collected. ``staging`` must exist.
    """
    central_db = root / "data" / "v2.db"
    if not central_db.is_file():
        raise FileNotFoundError(f"Nanoclaw database not found at {central_db}")

    cats = set(categories)
    scoped_ids: Optional[set] = None
    if "agents" in cats and agent_ids:
        scoped_ids = set(agent_ids)
        known = {r["id"] for r in _query(central_db, "SELECT id FROM agent_groups")}
        unknown = scoped_ids - known
        if unknown:
            raise ValueError(
                f"Unknown agent ids: {', '.join(sorted(unknown))}"
            )

    # Files skipped during group folder copies (oversized working data).
    skipped_files: List[str] = []

    # Central-DB table dumps.
    for table, table_cats in TABLE_CATEGORIES.items():
        if cats & table_cats:
            _dump_table(central_db, table, staging, scoped_ids)

    # Raw central DB for full-system backups (faithful clone).
    if "full" in cats:
        (staging / "data").mkdir(parents=True, exist_ok=True)
        _copy_db_raw(central_db, staging / "data" / "v2.db")

    # Agent group folders.
    if "agents" in cats or "full" in cats:
        groups_dir = root / "groups"
        if groups_dir.is_dir():
            if scoped_ids is not None:
                # Map scoped ids to folders via agent_groups rows.
                rows = _query(central_db, "SELECT id, folder FROM agent_groups")
                folders = {r["folder"] for r in rows if r["id"] in scoped_ids and r.get("folder")}
                for folder in sorted(folders):
                    _collect_group_folder(root, staging, folder, skipped_files)
            else:
                for folder in sorted(os.listdir(groups_dir)):
                    if (groups_dir / folder).is_dir():
                        _collect_group_folder(root, staging, folder, skipped_files)

    # Orchestrator group folder (its own instructions/memory).
    if "orchestrator" in cats:
        rows = _query(central_db, "SELECT id, name, folder FROM agent_groups")
        orch_id = _determine_orchestrator(rows, orchestrator_hint)
        if orch_id:
            folder = next((r.get("folder") for r in rows if r["id"] == orch_id), None)
            if folder:
                _collect_group_folder(root, staging, folder, skipped_files)

    # Shared base instructions.
    if "full" in cats:
        shared = root / "container" / "CLAUDE.md"
        if shared.is_file():
            dst = staging / "container"
            dst.mkdir(parents=True, exist_ok=True)
            shutil.copy2(shared, dst / "CLAUDE.md")

    # Memory trees.
    if "memory" in cats or "full" in cats:
        _collect_memory(root, staging)

    # Scheduled tasks.
    if "tasks" in cats or "full" in cats:
        _collect_tasks(root, staging)

    # Conversation history (included in full-system backups).
    if "history" in cats or "full" in cats:
        _collect_sessions(root, staging)

    # Environment (secrets) — encrypted with a passphrase.
    encrypted = False
    if "env" in cats or "full" in cats:
        if not passphrase:
            raise ValueError(
                "The 'env' category contains secrets and requires a passphrase "
                "for encrypted inclusion"
            )
        encrypted = _encrypt_env(root, staging, passphrase)

    # Build the manifest.
    notes: List[str] = []
    if skipped_files:
        notes.append(
            f"Skipped {len(skipped_files)} file(s) over {MAX_GROUP_FILE_BYTES // (1024 * 1024)} MiB "
            f"(working data, not config): {', '.join(sorted(skipped_files)[:10])}"
            + (" …" if len(skipped_files) > 10 else "")
        )
    manifest = Manifest(
        format_version=1,
        backup_id="",  # assigned by the caller
        created_at=now_iso(),
        categories=categories,
        schema_version=_schema_version(central_db),
        nanoclaw_version=_nanoclaw_version(root),
        source_host=os.uname().nodename if hasattr(os, "uname") else None,
        source_root=str(root),
        agent_ids=list(scoped_ids) if scoped_ids else [],
        encrypted=encrypted,
        notes=notes,
    )
    return manifest


def index_manifest_files(staging: Path) -> List[ManifestFile]:
    """Compute the file list + checksums for everything in staging."""
    files: List[ManifestFile] = []
    for path in sorted(staging.rglob("*")):
        if not path.is_file():
            continue
        rel = str(path.relative_to(staging))
        if rel == "manifest.json":
            continue  # manifest is written after indexing
        digest = hashlib.sha256()
        with path.open("rb") as fh:
            for chunk in iter(lambda: fh.read(65536), b""):
                digest.update(chunk)
        files.append(ManifestFile(path=rel, size=path.stat().st_size, sha256=digest.hexdigest()))
    return files