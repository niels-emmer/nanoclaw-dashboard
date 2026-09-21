"""HTTP API for nanoclaw backup / restore."""

from __future__ import annotations

import secrets
from typing import List, Optional

from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field

from ..config import settings
from ..logging import get_logger
from ..security import is_allowed_origin
from .archive import create_backup, list_backups, resolve_backup
from .manifest import CATEGORIES, CATEGORY_LABELS
from .restore import compute_plan, plan_to_text

log = get_logger(__name__)

router = APIRouter(prefix="/api/backup", tags=["backup"])


class BackupCreateRequest(BaseModel):
    categories: List[str] = Field(default_factory=list, max_length=16)
    agent_ids: Optional[List[str]] = Field(default=None, max_length=200)
    passphrase: Optional[str] = Field(default=None, max_length=1024)


class BackupIdRequest(BaseModel):
    backup_id: str = Field(min_length=1, max_length=64)


def _require_enabled() -> None:
    if not settings.enabled:
        raise HTTPException(
            status_code=503,
            detail="Backup requires a real nanoclaw instance (NANOCLAW_ENABLED=true)",
        )


def _check_origin(request: Request) -> None:
    if not is_allowed_origin(request.headers.get("origin"), request.headers.get("host")):
        raise HTTPException(status_code=403, detail="origin not allowed")


def _check_token(request: Request) -> None:
    """Enforce the optional shared secret for the backup surface."""
    if not settings.backup_token:
        return
    provided = request.headers.get("x-backup-token") or ""
    # compare_digest requires bytes for non-ASCII safety.
    if not secrets.compare_digest(provided.encode(), settings.backup_token.encode()):
        raise HTTPException(status_code=401, detail="invalid backup token")


def _authorize(request: Request) -> None:
    _check_origin(request)
    _check_token(request)


@router.get("/status")
async def backup_status(request: Request) -> dict:
    """Whether backup is available and where archives are written."""
    _authorize(request)
    return {
        "enabled": settings.enabled,
        "backup_dir": str(settings.backup_path),
        "categories": [
            {"id": c, "label": CATEGORY_LABELS[c]} for c in CATEGORIES
        ],
    }


@router.post("")
async def create_backup_endpoint(
    request: Request,
    body: BackupCreateRequest,
) -> dict:
    """Create a backup archive + restore script in the backup folder."""
    _authorize(request)
    _require_enabled()
    try:
        return create_backup(
            backup_dir=settings.backup_path,
            root=settings.root_path,
            categories=body.categories,
            agent_ids=body.agent_ids,
            passphrase=body.passphrase,
            orchestrator_hint=settings.orchestrator_group,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc))


@router.get("")
async def list_backups_endpoint(request: Request) -> dict:
    """List existing backups, newest first."""
    _authorize(request)
    _require_enabled()
    return {"backups": list_backups(settings.backup_path)}


@router.get("/download/{backup_id}")
async def download_backup(backup_id: str, request: Request) -> FileResponse:
    """Download a backup archive."""
    _authorize(request)
    _require_enabled()
    try:
        archive = resolve_backup(settings.backup_path, backup_id)
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="backup not found")
    return FileResponse(archive, media_type="application/gzip", filename=archive.name)


@router.post("/plan")
async def backup_plan(request: Request, body: BackupIdRequest) -> dict:
    """Compute a conflict plan for restoring a backup into the current target."""
    _authorize(request)
    _require_enabled()
    try:
        plan = compute_plan(settings.backup_path, body.backup_id, settings.root_path)
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="backup not found")
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    plan["text"] = plan_to_text(plan)
    return plan


@router.post("/restore-script")
async def restore_script(request: Request, body: BackupIdRequest) -> dict:
    """Return the host-side restore script for a backup (already written next
    to the archive at backup creation; this endpoint serves it for display)."""
    _authorize(request)
    _require_enabled()
    try:
        resolve_backup(settings.backup_path, body.backup_id)
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="backup not found")
    script_path = settings.backup_path / f"{body.backup_id}.sh"
    if not script_path.is_file():
        raise HTTPException(status_code=404, detail="restore script not found")
    return {
        "backup_id": body.backup_id,
        "script_path": str(script_path),
        "script": script_path.read_text(encoding="utf-8"),
    }