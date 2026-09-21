"""Backup archive creation, listing, and extraction."""

from __future__ import annotations

import json
import re
import shutil
import tarfile
import tempfile
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional

from ..logging import get_logger
from .collect import collect_backup, index_manifest_files
from .manifest import Manifest, read_manifest, validate_categories, write_manifest
from .restore import generate_restore_script

log = get_logger(__name__)

# Backup ids are server-generated: backup-YYYYMMDD-HHMMSS[-N] (N avoids
# same-second collisions).
_BACKUP_ID_RE = re.compile(r"^backup-\d{8}-\d{6}(-\d+)?$")


def _backup_id() -> str:
    return f"backup-{datetime.now():%Y%m%d-%H%M%S}"


def create_backup(
    backup_dir: Path,
    root: Path,
    categories: List[str],
    agent_ids: Optional[List[str]] = None,
    passphrase: Optional[str] = None,
    orchestrator_hint: Optional[str] = None,
) -> Dict[str, Any]:
    """Create a backup archive + restore script in ``backup_dir``.

    Returns metadata describing the created backup. Raises ValueError for
    invalid categories or a missing passphrase for the ``env`` category.
    """
    cats = validate_categories(categories)
    backup_dir.mkdir(parents=True, exist_ok=True)
    # Archives may contain conversation history (PII) and an encrypted .env —
    # restrict the folder and files to the owning user.
    try:
        backup_dir.chmod(0o700)
    except OSError as exc:
        log.warning("backup_dir_chmod_failed", path=str(backup_dir), error=str(exc))
    backup_id = _backup_id()
    archive_path = backup_dir / f"{backup_id}.tar.gz"
    # Avoid clobbering a same-second backup.
    counter = 1
    while archive_path.exists():
        backup_id = f"backup-{datetime.now():%Y%m%d-%H%M%S}-{counter}"
        archive_path = backup_dir / f"{backup_id}.tar.gz"
        counter += 1

    with tempfile.TemporaryDirectory(prefix=f".staging-{backup_id}-", dir=backup_dir) as tmp:
        staging = Path(tmp)
        manifest = collect_backup(
            root=root,
            staging=staging,
            categories=cats,
            agent_ids=agent_ids,
            passphrase=passphrase,
            orchestrator_hint=orchestrator_hint,
        )
        manifest.backup_id = backup_id
        manifest.files = index_manifest_files(staging)
        write_manifest(manifest, staging)

        with tarfile.open(archive_path, "w:gz") as tar:
            for path in sorted(staging.rglob("*")):
                if path.is_file():
                    tar.add(path, arcname=str(path.relative_to(staging)))

    # Restore script lives next to the archive so the user can run it from the
    # dashboard folder on the nanoclaw host.
    script_path = backup_dir / f"{backup_id}.sh"
    script_path.write_text(generate_restore_script(backup_id, archive_path.name), encoding="utf-8")
    script_path.chmod(0o700)
    try:
        archive_path.chmod(0o600)
    except OSError as exc:
        log.warning("backup_archive_chmod_failed", path=str(archive_path), error=str(exc))

    size = archive_path.stat().st_size
    log.info(
        "backup_created",
        backup_id=backup_id,
        categories=cats,
        size=size,
        files=len(manifest.files),
    )
    return {
        "backup_id": backup_id,
        "filename": archive_path.name,
        "script": script_path.name,
        "size": size,
        "created_at": manifest.created_at,
        "categories": manifest.categories,
        "schema_version": manifest.schema_version,
        "nanoclaw_version": manifest.nanoclaw_version,
        "encrypted": manifest.encrypted,
        "agent_ids": manifest.agent_ids,
        "notes": manifest.notes,
        "file_count": len(manifest.files),
    }


def _read_manifest_from_archive(archive_path: Path) -> Manifest:
    """Read manifest.json from an archive without extracting everything."""
    with tarfile.open(archive_path, "r:gz") as tar:
        member = tar.getmember("manifest.json")
        raw = tar.extractfile(member)
        if raw is None:
            raise ValueError("manifest.json missing from archive")
        data = json.loads(raw.read().decode("utf-8"))
    manifest = Manifest.from_dict(data)
    if manifest.format_version != 1:
        raise ValueError(f"Unsupported backup format version {manifest.format_version}")
    return manifest


def list_backups(backup_dir: Path) -> List[Dict[str, Any]]:
    """List backups in ``backup_dir``, newest first."""
    if not backup_dir.is_dir():
        return []
    backups: List[Dict[str, Any]] = []
    for archive in sorted(backup_dir.glob("backup-*.tar.gz"), reverse=True):
        try:
            manifest = _read_manifest_from_archive(archive)
        except (ValueError, KeyError, TypeError, tarfile.TarError, json.JSONDecodeError) as exc:
            log.warning("backup_manifest_unreadable", archive=archive.name, error=str(exc))
            backups.append({
                "backup_id": archive.stem,
                "filename": archive.name,
                "size": archive.stat().st_size,
                "created_at": None,
                "categories": [],
                "schema_version": None,
                "nanoclaw_version": None,
                "encrypted": False,
                "agent_ids": [],
                "notes": ["manifest unreadable — archive may be corrupt"],
                "file_count": 0,
            })
            continue
        backups.append({
            "backup_id": manifest.backup_id,
            "filename": archive.name,
            "size": archive.stat().st_size,
            "created_at": manifest.created_at,
            "categories": manifest.categories,
            "schema_version": manifest.schema_version,
            "nanoclaw_version": manifest.nanoclaw_version,
            "encrypted": manifest.encrypted,
            "agent_ids": manifest.agent_ids,
            "notes": manifest.notes,
            "file_count": len(manifest.files),
        })
    return backups


def _safe_extract(tar: tarfile.TarFile, dest: Path) -> None:
    """Extract an archive safely on Python 3.11 (no ``filter="data"``).

    Rejects absolute paths, ``..`` traversal, symlinks, hardlinks, and device
    files — the same guarantees ``filter="data"`` provides on 3.12+. Also caps
    total extracted size and member count to bound tar-bomb expansion.
    """
    dest = dest.resolve()
    total_size = 0
    for member in tar.getmembers():
        name = member.name
        if name.startswith("/") or ".." in Path(name).parts:
            raise ValueError(f"unsafe archive member: {name}")
        if member.issym() or member.islnk() or not (member.isfile() or member.isdir()):
            raise ValueError(f"unsupported archive member type: {name}")
        target = (dest / name).resolve()
        if not target.is_relative_to(dest):
            raise ValueError(f"archive member escapes destination: {name}")
        total_size += member.size
        if total_size > _MAX_EXTRACT_BYTES:
            raise ValueError("archive too large to extract safely")
    if len(tar.getmembers()) > _MAX_EXTRACT_MEMBERS:
        raise ValueError("archive has too many members")
    tar.extractall(dest)


# Bounds for _safe_extract (tar-bomb protection).
_MAX_EXTRACT_BYTES = 2 * 1024 * 1024 * 1024  # 2 GiB
_MAX_EXTRACT_MEMBERS = 100_000


def extract_backup(archive_path: Path, dest: Path) -> Manifest:
    """Extract an archive into ``dest`` and return its validated manifest."""
    dest.mkdir(parents=True, exist_ok=True)
    with tarfile.open(archive_path, "r:gz") as tar:
        _safe_extract(tar, dest)
    return read_manifest(dest)


def resolve_backup(backup_dir: Path, backup_id: str) -> Path:
    """Resolve a backup id to its archive path, or raise FileNotFoundError.

    ``backup_id`` must match the server-generated format; anything else is
    rejected to prevent path traversal via the API.
    """
    if not _BACKUP_ID_RE.match(backup_id):
        raise FileNotFoundError(f"Backup not found: {backup_id}")
    archive = backup_dir / f"{backup_id}.tar.gz"
    if not archive.is_file():
        raise FileNotFoundError(f"Backup not found: {backup_id}")
    return archive