"""Backup manifest schema and helpers.

A backup is a ``.tar.gz`` archive containing a ``manifest.json`` plus the
collected state. The manifest records format version, nanoclaw schema version,
included categories, and a per-file checksum list so the restore script can
verify integrity before applying anything.
"""

from __future__ import annotations

import json
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional

BACKUP_FORMAT_VERSION = 1

# Categories that include the raw central database (full-system backups).
FULL_SYSTEM_CATEGORIES = frozenset({"full"})

# All selectable categories (frontend mirrors this list).
CATEGORIES = (
    "full",
    "agents",
    "orchestrator",
    "channels",
    "users",
    "memory",
    "tasks",
    "env",
    "history",
)

CATEGORY_LABELS = {
    "full": "Full system",
    "agents": "Agents",
    "orchestrator": "Orchestrator rules",
    "channels": "Channels & wirings",
    "users": "Users & roles",
    "memory": "Memory",
    "tasks": "Scheduled tasks",
    "env": "Environment (.env)",
    "history": "Conversation history",
}


@dataclass
class ManifestFile:
    """One file inside the archive, with integrity metadata."""

    path: str
    size: int
    sha256: str


@dataclass
class Manifest:
    """Top-level backup metadata."""

    format_version: int
    backup_id: str
    created_at: str
    categories: List[str]
    schema_version: Optional[str] = None
    nanoclaw_version: Optional[str] = None
    source_host: Optional[str] = None
    source_root: Optional[str] = None
    agent_ids: List[str] = field(default_factory=list)
    encrypted: bool = False
    notes: List[str] = field(default_factory=list)
    files: List[ManifestFile] = field(default_factory=list)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "format_version": self.format_version,
            "backup_id": self.backup_id,
            "created_at": self.created_at,
            "categories": self.categories,
            "schema_version": self.schema_version,
            "nanoclaw_version": self.nanoclaw_version,
            "source_host": self.source_host,
            "source_root": self.source_root,
            "agent_ids": self.agent_ids,
            "encrypted": self.encrypted,
            "notes": self.notes,
            "files": [
                {"path": f.path, "size": f.size, "sha256": f.sha256} for f in self.files
            ],
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "Manifest":
        return cls(
            format_version=int(data.get("format_version", 0)),
            backup_id=str(data.get("backup_id", "")),
            created_at=str(data.get("created_at", "")),
            categories=list(data.get("categories", [])),
            schema_version=data.get("schema_version"),
            nanoclaw_version=data.get("nanoclaw_version"),
            source_host=data.get("source_host"),
            source_root=data.get("source_root"),
            agent_ids=list(data.get("agent_ids", [])),
            encrypted=bool(data.get("encrypted", False)),
            notes=list(data.get("notes", [])),
            files=[
                ManifestFile(path=str(f["path"]), size=int(f["size"]), sha256=str(f["sha256"]))
                for f in data.get("files", [])
            ],
        )


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def write_manifest(manifest: Manifest, staging: Path) -> None:
    (staging / "manifest.json").write_text(
        json.dumps(manifest.to_dict(), indent=2, ensure_ascii=False), encoding="utf-8"
    )


def read_manifest(staging: Path) -> Manifest:
    data = json.loads((staging / "manifest.json").read_text(encoding="utf-8"))
    manifest = Manifest.from_dict(data)
    if manifest.format_version != BACKUP_FORMAT_VERSION:
        raise ValueError(
            f"Unsupported backup format version {manifest.format_version} "
            f"(expected {BACKUP_FORMAT_VERSION})"
        )
    return manifest


def validate_categories(categories: List[str]) -> List[str]:
    """Normalize and validate a category list; ``full`` implies everything."""
    unknown = [c for c in categories if c not in CATEGORIES]
    if unknown:
        raise ValueError(f"Unknown backup categories: {', '.join(unknown)}")
    if "full" in categories:
        return ["full"]
    return list(dict.fromkeys(categories))  # dedupe, preserve order